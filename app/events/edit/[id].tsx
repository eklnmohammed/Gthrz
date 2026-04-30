import { useState, useRef, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Modal,
  Keyboard,
  Alert,
  ImageBackground,
  StatusBar,
  useWindowDimensions,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onboardingStore } from "@/src/state/onboardingStore";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  useEvents,
  type LineupEntry,
  getAutoApprovalPendingCapacityBlockReason,
  resolveCapacityLimitForAutoApproval,
} from "@/src/state/eventsStore";
import { supabase, EventType, normalizeEventType } from "@/src/lib/supabase";
import { HeaderBackTextButton } from "@/src/components/HeaderBackTextButton";
import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { formatEventDate } from "@/src/utils/formatEventDate";
import { getCoverOptions, getCoverSource, getEventFormHeroCoverSource, getDefaultCoverKey } from "@/src/utils/covers";
import { BRING_SUGGESTIONS, EVENT_TYPE_OPTIONS } from "@/src/constants/eventFormOptions";
import { bringTitleKey } from "@/src/utils/bringTitleKey";
import { getEntryFeePreviewLine } from "@/src/utils/entryFeePreview";
import { isValidPositiveWholeCapacityString } from "@/src/utils/capacityInput";
import {
  EVENT_FORM_HERO_PADDING_H,
  eventFormScrollPaddingBottom,
  EventFormSectionCard,
  EventFormHero,
  EventFormEventTypeChips,
  EventFormErrorBanner,
  EventFormFooter,
  EventFormEssentialsHeading,
  EventFormTogglePair,
  EventFormAudienceChips,
  EventFormCapacityControl,
  EventFormDressCodeControl,
  EventFormLocationVisibilityControl,
  EventFormPriceSection,
  EventFormCapacitySheetModal,
  EventFormRevealAddressSheetModal,
  EventFormDressCodeSheetModal,
  EVENT_FORM_DRESS_CODE_CUSTOM,
} from "@/src/components/event-form";
import { LocationCardWithPicker, type LocationSelection } from "@/src/components/LocationCardWithPicker";
import { isValidCoverUrl } from "@/src/utils/coverUrl";
import { uploadEventCover } from "@/src/utils/uploadEventCover";
import { useKeyboardInset } from "@/src/hooks/useKeyboardInset";
import { areSamePhone } from "@/src/utils/phone";
import {
  formatTime24ToDisplay,
  formatLineupTimeRange,
  parseTime24ToDate,
  dateToTime24,
  isEndAfterStart,
} from "@/src/utils/lineupTime";
import type { EndDayOffset } from "@/src/lib/supabase";

function serializeLocationForDirty(loc: LocationSelection): string {
  return JSON.stringify({
    name: (loc.name ?? "").trim(),
    address: loc.address ?? undefined,
    lat: loc.lat ?? undefined,
    lng: loc.lng ?? undefined,
  });
}

const BRING_LOCAL_PREFIX = "local:";

function generateLocalBringId(): string {
  return `${BRING_LOCAL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeBringRowsForDirty(rows: { id: string; title: string }[]): string {
  return JSON.stringify(
    [...rows]
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({ id: r.id, title: r.title }))
  );
}

async function applyBringContributionChanges(
  eventId: string,
  initial: { id: string; title: string }[],
  current: { id: string; title: string }[],
  addContribution: (eventId: string, title: string) => Promise<void>,
  removeContribution: (id: string) => Promise<void>,
) {
  const isLocal = (id: string) => id.startsWith(BRING_LOCAL_PREFIX);
  const currentIds = new Set(current.map((c) => c.id));
  for (const row of initial) {
    if (!currentIds.has(row.id) && !isLocal(row.id)) {
      await removeContribution(row.id);
    }
  }
  for (const row of current) {
    if (isLocal(row.id)) {
      await addContribution(eventId, row.title);
    }
  }
}

const HERO_PADDING_H = EVENT_FORM_HERO_PADDING_H;

export default function EditEventScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const {
    updateEvent,
    deleteEvent,
    fetchEvents,
    getContributions,
    addContribution,
    removeContribution,
    getRsvpsForEvent,
    finalizeManualToAutoApproval,
  } = useEvents();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationData, setLocationData] = useState<LocationSelection>({ name: "" });
  const [details, setDetails] = useState("");
  const [capacityMode, setCapacityMode] = useState<"unlimited" | "set">("unlimited");
  const [capacityValue, setCapacityValue] = useState("");
  const [showCapacitySheet, setShowCapacitySheet] = useState(false);
  const [capacitySheetTemp, setCapacitySheetTemp] = useState("");
  const [showRevealSheet, setShowRevealSheet] = useState(false);
  const [revealSheetTemp, setRevealSheetTemp] = useState<number>(24);
  const [revealSheetCustom, setRevealSheetCustom] = useState("");
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [hideGuestNames, setHideGuestNames] = useState(false);
  const [hideGuestAvatars, setHideGuestAvatars] = useState(false);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [selectedCoverType, setSelectedCoverType] = useState<EventType | null>(null);
  const [coverKey, setCoverKey] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [locationVisibility, setLocationVisibility] = useState<"now" | "reveal">("now");
  const [revealHoursBefore, setRevealHoursBefore] = useState<number | null>(null);
  const [locationExactAudience, setLocationExactAudience] = useState<"all_viewers" | "going_only">("going_only");
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [draftLineup, setDraftLineup] = useState<LineupEntry | null>(null);
  const [draftEditingIndex, setDraftEditingIndex] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lineupTimePicker, setLineupTimePicker] = useState<{ index: number; field: "startTime" | "endTime" } | null>(null);
  const [lineupTimePickerValue, setLineupTimePickerValue] = useState<Date>(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });

  const [bringRows, setBringRows] = useState<{ id: string; title: string }[]>([]);
  const [bringInput, setBringInput] = useState("");

  const [dressCode, setDressCode] = useState<string>("");
  const [dressCodeCustom, setDressCodeCustom] = useState<string>("");
  const [showDressCodeSheet, setShowDressCodeSheet] = useState(false);
  const [dressCodeSheetTemp, setDressCodeSheetTemp] = useState<string>("");
  const [dressCodeSheetCustom, setDressCodeSheetCustom] = useState<string>("");
  const [audience, setAudience] = useState<string>("");
  const [allowPlusOne, setAllowPlusOne] = useState(false);
  const [priceMode, setPriceMode] = useState<"free" | "paid">("free");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("SAR");

  const dressCodeValue = dressCode === EVENT_FORM_DRESS_CODE_CUSTOM ? dressCodeCustom.trim() : dressCode;

  const DRAFT_INDEX = -1;

  const openDraft = () => {
    setDraftError(null);
    setDraftLineup({ name: "", startTime: "", endTime: "", note: "", endDayOffset: 0 });
    setDraftEditingIndex(null);
  };

  const openEditDraft = (index: number) => {
    const source = lineup[index];
    if (!source) return;
    setDraftError(null);
    setDraftLineup({
      name: source.name ?? "",
      startTime: source.startTime?.trim() || "",
      endTime: source.endTime?.trim() || "",
      endDayOffset: Math.min(1, source.endDayOffset ?? 0) as EndDayOffset,
      note: source.note ?? "",
    });
    setDraftEditingIndex(index);
  };

  const cancelDraft = () => {
    setLineupTimePicker(null);
    setDraftLineup(null);
    setDraftEditingIndex(null);
    setDraftError(null);
  };

  const updateLineupEntry = (index: number, field: keyof LineupEntry, value: string | number) =>
    setLineup((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));

  const updateDraftEntry = (field: keyof LineupEntry, value: string | number) => {
    setDraftLineup((prev) => (prev ? { ...prev, [field]: value } : null));
    setDraftError(null);
  };

  const validateDraft = (): string | null => {
    if (!draftLineup) return null;
    if (!draftLineup.name?.trim() || !draftLineup.startTime?.trim() || !draftLineup.endTime?.trim())
      return "Name, start and end are required";
    const startTime = draftLineup.startTime.trim();
    const endTime = draftLineup.endTime.trim();
    const crossesMidnight = Math.min(1, draftLineup.endDayOffset ?? 0) === 1;
    if (!crossesMidnight && !isEndAfterStart(startTime, endTime)) {
      return "End time must be after start time";
    }
    return null;
  };

  const confirmDraft = () => {
    if (!draftLineup) return;
    const err = validateDraft();
    if (err) {
      setDraftError(err);
      return;
    }
    const startTime = draftLineup.startTime?.trim();
    const endTime = draftLineup.endTime?.trim();
    if (!startTime || !endTime) {
      setDraftError("Name, start and end are required");
      return;
    }
    const entry: LineupEntry = {
      name: draftLineup.name.trim(),
      startTime,
      endTime,
      endDayOffset: Math.min(1, draftLineup.endDayOffset ?? 0) as EndDayOffset,
      note: (draftLineup.note ?? "").trim(),
    };
    if (draftEditingIndex === null) {
      setLineup((prev) => [...prev, entry]);
    } else {
      setLineup((prev) => {
        if (draftEditingIndex < 0 || draftEditingIndex >= prev.length) return prev;
        const next = [...prev];
        next[draftEditingIndex] = entry;
        return next;
      });
    }
    cancelDraft();
  };

  const removeLineupEntry = (index: number) =>
    setLineup((prev) => prev.filter((_, i) => i !== index));

  const requestDeleteLineupEntry = () => {
    if (draftEditingIndex === null) return;
    const name = draftLineup?.name?.trim() || lineup[draftEditingIndex]?.name?.trim() || "this performer";
    Alert.alert(
      "Remove performer?",
      `This will remove ${name} from the lineup.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => {
          removeLineupEntry(draftEditingIndex);
          cancelDraft();
        } },
      ]
    );
  };

  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = screenWidth - HERO_PADDING_H * 2;

  useEffect(() => {
    onboardingStore.getPhone().then(setUserPhone);
  }, []);
  const pickerClosedAt = useRef(0);

  const effectiveCapacity = capacityMode === "unlimited" ? "" : capacityValue;

  /** Positive integer or null (unlimited). Set mode with empty/invalid string yields null — callers must gate on form validation first. */
  function parseFormCapacityLimitEdit(
    mode: "unlimited" | "set",
    effectiveCap: string,
  ): number | null {
    if (mode === "unlimited") return null;
    const t = effectiveCap.trim();
    if (t === "") return null;
    if (!isValidPositiveWholeCapacityString(t)) return null;
    return parseInt(t, 10);
  }

  type InitialSnapshot = {
    title: string;
    dateTime: number | null;
    locationJson: string;
    details: string;
    capacityMode: "unlimited" | "set";
    capacityValue: string;
    visibility: "private" | "public";
    approvalRequired: boolean;
    eventType: EventType | null;
    selectedCoverType: EventType | null;
    coverKey: string;
    coverUrl: string | null;
    lineup: string;
    locationVisibility: "now" | "reveal";
    revealHoursBefore: number | null;
    locationExactAudience: "all_viewers" | "going_only";
    hideGuestNames: boolean;
    hideGuestAvatars: boolean;
    allowPlusOne: boolean;
    dressEffective: string;
    audience: string;
    bringItemsJson: string;
  };
  const initialValuesRef = useRef<InitialSnapshot | null>(null);
  /** Snapshot of bring rows at load; used to diff removals/adds on save. */
  const initialBringRowsRef = useRef<{ id: string; title: string }[] | null>(null);

  const isDirty =
    initialValuesRef.current !== null &&
    (draftLineup !== null ||
      title.trim() !== initialValuesRef.current.title ||
      (selectedDate ? selectedDate.getTime() : null) !== initialValuesRef.current.dateTime ||
      serializeLocationForDirty(locationData) !== initialValuesRef.current.locationJson ||
      details.trim() !== initialValuesRef.current.details ||
      capacityMode !== initialValuesRef.current.capacityMode ||
      capacityValue !== initialValuesRef.current.capacityValue ||
      visibility !== initialValuesRef.current.visibility ||
      approvalRequired !== initialValuesRef.current.approvalRequired ||
      eventType !== initialValuesRef.current.eventType ||
      selectedCoverType !== initialValuesRef.current.selectedCoverType ||
      coverKey !== initialValuesRef.current.coverKey ||
      coverUrl !== initialValuesRef.current.coverUrl ||
      JSON.stringify(lineup) !== initialValuesRef.current.lineup ||
      locationVisibility !== initialValuesRef.current.locationVisibility ||
      revealHoursBefore !== initialValuesRef.current.revealHoursBefore ||
      locationExactAudience !== initialValuesRef.current.locationExactAudience ||
      hideGuestNames !== initialValuesRef.current.hideGuestNames ||
      hideGuestAvatars !== initialValuesRef.current.hideGuestAvatars ||
      allowPlusOne !== initialValuesRef.current.allowPlusOne ||
      dressCodeValue !== initialValuesRef.current.dressEffective ||
      audience !== initialValuesRef.current.audience ||
      serializeBringRowsForDirty(bringRows) !== initialValuesRef.current.bringItemsJson);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setUploadingCover(true);
      try {
        const publicUrl = await uploadEventCover(localUri, params.id);
        if (publicUrl) {
          setCoverUrl(publicUrl);
          setCoverKey("");
          setShowCoverModal(false);
        } else {
          Alert.alert("Upload failed", "Could not upload the image. Try again or pick a preset cover.");
        }
      } finally {
        setUploadingCover(false);
      }
    }
  };

  const handleBack = () => {
    if (isDirty) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!params.id) {
        setLoading(false);
        return;
      }
      try {
        const phone = await onboardingStore.getPhone();
        if (!phone) {
          setError("You must complete onboarding first");
          setLoading(false);
          return;
        }
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("*")
          .eq("id", params.id)
          .single();
        if (fetchError) throw fetchError;
        if (data) {
          if (!areSamePhone(data.host_phone, phone)) {
            setError("You can only edit events you created");
            setLoading(false);
            return;
          }
          setTitle(data.title || "");
          setSelectedDate(data.date_time ? new Date(data.date_time) : null);
          setLocationData({
            name: data.location_name || data.location || "",
            address: data.location_address || undefined,
            lat: data.location_lat ?? undefined,
            lng: data.location_lng ?? undefined,
          });
          setDetails(data.details || "");
          const capStr = data.capacity?.toString() || "";
          setCapacityMode(capStr !== "" ? "set" : "unlimited");
          setCapacityValue(capStr);
          setVisibility(data.visibility || "private");
          setApprovalRequired(data.approval_required ?? false);
          setHideGuestNames(data.hide_guest_names ?? false);
          setHideGuestAvatars(data.hide_guest_avatars ?? false);
          const loadedType = normalizeEventType(data.event_type);
          setEventType(loadedType);
          setSelectedCoverType(loadedType);
          setCoverKey(data.cover_key ?? "");
          setCoverUrl(isValidCoverUrl(data.cover_url) ? data.cover_url : null);
          setLocationVisibility(
            data.location_visibility === "reveal" ? "reveal" : "now"
          );
          setRevealHoursBefore(
            typeof data.reveal_hours_before === "number" ? data.reveal_hours_before : null
          );
          setLocationExactAudience(
            data.location_exact_audience === "all_viewers" ? "all_viewers" : "going_only"
          );
          const loadedLineup: LineupEntry[] = Array.isArray(data.lineup) ? data.lineup : [];
          setLineup(loadedLineup);
          const existingDressCode = data.dress_code ?? "";
          const presets = ["Casual", "Smart casual", "Formal", "Traditional", "All black", "Techno", "Y2K"];
          if (presets.includes(existingDressCode)) {
            setDressCode(existingDressCode);
          } else if (existingDressCode) {
            setDressCode(EVENT_FORM_DRESS_CODE_CUSTOM);
            setDressCodeCustom(existingDressCode);
          }
          setAudience(data.audience ?? "");
          setAllowPlusOne(data.allow_plus_one ?? false);
          setPriceMode(data.price_mode === "paid" ? "paid" : "free");
          setPriceAmount(data.price_amount != null ? String(data.price_amount) : "");
          setPriceCurrency(data.price_currency ?? "SAR");
          const loaded = await getContributions(params.id!);
          const bringRowsSnapshot = loaded.map((c) => ({ id: c.id, title: c.title }));
          setBringRows(bringRowsSnapshot);
          initialBringRowsRef.current = bringRowsSnapshot.map((r) => ({ ...r }));
          const sanitizedCoverUrl = isValidCoverUrl(data.cover_url) ? data.cover_url : null;
          initialValuesRef.current = {
            title: data.title || "",
            dateTime: data.date_time ? new Date(data.date_time).getTime() : null,
            locationJson: serializeLocationForDirty({
              name: data.location_name || data.location || "",
              address: data.location_address || undefined,
              lat: data.location_lat ?? undefined,
              lng: data.location_lng ?? undefined,
            }),
            details: data.details || "",
            capacityMode: capStr !== "" ? "set" : "unlimited",
            capacityValue: capStr,
            visibility: data.visibility || "private",
            approvalRequired: data.approval_required ?? false,
            eventType: normalizeEventType(data.event_type),
            selectedCoverType: normalizeEventType(data.event_type),
            coverKey: data.cover_key ?? "",
            coverUrl: sanitizedCoverUrl,
            lineup: JSON.stringify(loadedLineup),
            locationVisibility:
              data.location_visibility === "reveal" ? "reveal" : "now",
            revealHoursBefore:
              typeof data.reveal_hours_before === "number"
                ? data.reveal_hours_before
                : null,
            locationExactAudience:
              data.location_exact_audience === "all_viewers" ? "all_viewers" : "going_only",
            hideGuestNames: data.hide_guest_names ?? false,
            hideGuestAvatars: data.hide_guest_avatars ?? false,
            allowPlusOne: data.allow_plus_one ?? false,
            dressEffective: (data.dress_code ?? "").trim(),
            audience: data.audience ?? "",
            bringItemsJson: serializeBringRowsForDirty(bringRowsSnapshot),
          };
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [params.id]);

  const hasLineupTimeError = false;
  const hasPaidAmountError = priceMode === "paid" && (priceAmount.trim() === "" || Number.isNaN(parseFloat(priceAmount)) || parseFloat(priceAmount) <= 0);
  const hasPastDateError = selectedDate !== null && selectedDate <= new Date();
  const hasCapacityError =
    capacityMode === "set" && !isValidPositiveWholeCapacityString(capacityValue);

  const isValid =
    title.trim().length > 0 &&
    selectedDate !== null &&
    selectedDate > new Date() &&
    !hasLineupTimeError &&
    !hasPaidAmountError &&
    !hasCapacityError;

  const handleEventTypeChange = (type: EventType | null) => {
    setEventType(type);
    // Keep current cover unchanged. Event type selection should not
    // implicitly change preset or uploaded cover.
  };

  const openLineupTimePicker = (index: number, field: "startTime" | "endTime") => {
    const entry = index === DRAFT_INDEX ? draftLineup : lineup[index];
    const current = field === "startTime" ? entry?.startTime : entry?.endTime;
    setLineupTimePickerValue(parseTime24ToDate(current));
    setLineupTimePicker({ index, field });
  };

  const applyPickedLineupTime = (
    index: number,
    field: "startTime" | "endTime",
    t: string
  ) => {
    if (index === DRAFT_INDEX) {
      setDraftLineup((prev) => {
        if (!prev) return null;
        const next = { ...prev, [field]: t };
        if (field === "startTime") {
          next.endDayOffset = prev.endTime && !isEndAfterStart(t, prev.endTime) ? 1 : 0;
        } else {
          next.endDayOffset = prev.startTime && !isEndAfterStart(prev.startTime, t) ? 1 : 0;
        }
        return next;
      });
      return;
    }
    updateLineupEntry(index, field, t);
  };

  const handleLineupTimeChange = (_: unknown, date?: Date) => {
    if (date != null && lineupTimePicker != null) {
      const t = dateToTime24(date);
      // Keep draft lineup times in sync immediately (especially on iOS spinner),
      // so saving right after editing does not reuse stale times.
      applyPickedLineupTime(lineupTimePicker.index, lineupTimePicker.field, t);
    }
    if (Platform.OS === "android") {
      setLineupTimePicker(null);
      return;
    }
    if (date != null) setLineupTimePickerValue(date);
  };

  const confirmLineupTime = () => {
    if (lineupTimePicker == null) return;
    const t = dateToTime24(lineupTimePickerValue);
    applyPickedLineupTime(lineupTimePicker.index, lineupTimePicker.field, t);
    setLineupTimePicker(null);
  };

  const handleSelectAutoApprove = async () => {
    if (!approvalRequired) return;
    if (!params.id) return;
    try {
      const formCap = parseFormCapacityLimitEdit(capacityMode, effectiveCapacity);
      const rsvps = await getRsvpsForEvent(params.id);
      const { data: evRow, error: capErr } = await supabase
        .from("events")
        .select("capacity")
        .eq("id", params.id)
        .single();
      if (capErr) throw capErr;
      const capRaw = evRow?.capacity != null ? Number(evRow.capacity) : NaN;
      const dbCap = !Number.isNaN(capRaw) && capRaw > 0 ? capRaw : null;
      const cap = resolveCapacityLimitForAutoApproval(formCap, dbCap);
      const block = getAutoApprovalPendingCapacityBlockReason(cap, rsvps);
      if (block) {
        Alert.alert("Auto approval", block);
        return;
      }
      if (rsvps.pending.length === 0) {
        setApprovalRequired(false);
        return;
      }
      Alert.alert(
        "Switch to auto approval?",
        `You have ${rsvps.pending.length} pending ${rsvps.pending.length === 1 ? "request" : "requests"}. They will be accepted as Going and the event will switch to auto approval.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: () => {
              void (async () => {
                try {
                  await finalizeManualToAutoApproval(params.id!, formCap);
                  setApprovalRequired(false);
                  if (initialValuesRef.current) {
                    initialValuesRef.current = {
                      ...initialValuesRef.current,
                      approvalRequired: false,
                    };
                  }
                  await fetchEvents();
                } catch (e) {
                  Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
                }
              })();
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const handleSave = async () => {
    if (!isValid || !selectedDate) {
      setShowValidationErrors(true);
      return;
    }
    if (saving || !params.id) return;
    setSaving(true);
    setError(null);
    try {
      await onboardingStore.getPhone();

      const initialManual = initialValuesRef.current?.approvalRequired === true;
      const nowAuto = !approvalRequired;
      const needsFinalizeManualToAuto = initialManual && nowAuto;
      const formCap = parseFormCapacityLimitEdit(capacityMode, effectiveCapacity);
      if (needsFinalizeManualToAuto) {
        const { data: evRow, error: capErr } = await supabase
          .from("events")
          .select("capacity")
          .eq("id", params.id)
          .single();
        if (capErr) throw capErr;
        const capRaw = evRow?.capacity != null ? Number(evRow.capacity) : NaN;
        const dbCap = !Number.isNaN(capRaw) && capRaw > 0 ? capRaw : null;
        const cap = resolveCapacityLimitForAutoApproval(formCap, dbCap);
        const rsvps = await getRsvpsForEvent(params.id);
        const block = getAutoApprovalPendingCapacityBlockReason(cap, rsvps);
        if (block) {
          Alert.alert("Cannot save", block);
          setSaving(false);
          return;
        }
      }

      await updateEvent(params.id, {
        title: title.trim(),
        dateTime: selectedDate.toISOString(),
        locationName: locationData.name.trim() || undefined,
        locationAddress: locationData.address || undefined,
        locationLat: locationData.lat,
        locationLng: locationData.lng,
        details: details.trim() || undefined,
        capacity: effectiveCapacity.trim() || undefined,
        visibility,
        approvalRequired: needsFinalizeManualToAuto ? true : approvalRequired,
        eventType: eventType ?? undefined,
        coverKey: coverKey || undefined,
        coverUrl: isValidCoverUrl(coverUrl) ? coverUrl ?? undefined : undefined,
        lineup: lineup.length > 0
          ? lineup.map((e) => ({
              name: e.name.trim(),
              startTime: e.startTime?.trim() || undefined,
              endTime: e.endTime?.trim() || undefined,
              endDayOffset: Math.min(1, e.endDayOffset ?? 0) as EndDayOffset,
              note: e.note?.trim() || undefined,
            })).filter((e) => e.name)
          : undefined,
        locationVisibility,
        revealHoursBefore:
          locationVisibility === "reveal" && revealHoursBefore != null && revealHoursBefore > 0 ? revealHoursBefore : undefined,
        locationExactAudience,
        hideGuestNames,
        hideGuestAvatars,
        dressCode: dressCodeValue || undefined,
        audience: audience || undefined,
        allowPlusOne,
        priceMode,
        priceAmount: priceMode === "paid" && priceAmount.trim() !== "" ? parseFloat(priceAmount) : null,
        priceCurrency: priceMode === "paid" ? priceCurrency : undefined,
      });
      await applyBringContributionChanges(
        params.id,
        initialBringRowsRef.current ?? [],
        bringRows,
        addContribution,
        removeContribution,
      );
      if (needsFinalizeManualToAuto) {
        await finalizeManualToAutoApproval(params.id, formCap);
      }
      setSaving(false);
      Alert.alert("Event Updated", "Your changes have been saved.", [
        {
          text: "OK",
          onPress: () => {
            initialValuesRef.current = null;
            router.back();
            void fetchEvents();
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete event",
      "This will permanently remove the event. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete event",
          style: "destructive",
          onPress: async () => {
            if (!params.id) return;
            setDeleting(true);
            setError(null);
            try {
              await deleteEvent(params.id);
              await fetchEvents();
              Alert.alert("Event deleted", "Your event has been permanently removed.", [
                {
                  text: "OK",
                  onPress: () => {
                    router.back();
                    router.back();
                  },
                },
              ]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete event");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleDateChange = (_: unknown, date?: Date) => {
    if (!date) { setShowDatePicker(false); return; }
    const next = selectedDate ? new Date(selectedDate) : new Date();
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(next);
    if (Platform.OS === "android") { setShowDatePicker(false); setShowTimePicker(true); }
  };

  const handleTimeChange = (_: unknown, date?: Date) => {
    if (!date) { setShowTimePicker(false); return; }
    const next = selectedDate ? new Date(selectedDate) : new Date();
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setSelectedDate(next);
    if (Platform.OS === "android") setShowTimePicker(false);
  };

  const handleDateNext = () => {
    setShowDatePicker(false);
    setShowTimePicker(true);
    pickerClosedAt.current = Date.now();
  };

  const handleTimeDone = () => {
    setShowTimePicker(false);
    pickerClosedAt.current = Date.now();
  };

  const openDatePicker = () => {
    if (Date.now() - pickerClosedAt.current < 250) return;
    Keyboard.dismiss();
    setShowDatePicker(true);
  };

  const ctaBottom = Math.max(spacing.lg, insets.bottom);
  const entryFeePreviewLine = getEntryFeePreviewLine(priceAmount, priceCurrency);
  const coverSource = getEventFormHeroCoverSource(coverUrl, coverKey, eventType);

  if (loading) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar barStyle="light-content" />
      <Stack.Screen
        options={{
          headerTitle: "Edit Event",
          headerBackVisible: false,
          headerLeft: () => <HeaderBackTextButton label="Back" onPress={handleBack} />,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: eventFormScrollPaddingBottom(ctaBottom), gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <EventFormHero
          heroWidth={heroWidth}
          coverSource={coverSource}
          title={title}
          selectedDate={selectedDate}
          onPressChangeCover={() => {
            setSelectedCoverType(eventType);
            setShowCoverModal(true);
          }}
        />

        <EventFormEventTypeChips eventType={eventType} onSelect={handleEventTypeChange} />

        {error ? <EventFormErrorBanner message={error} /> : null}

        {/* ── Essentials: Title, Date/Time, Location ── */}
        <View style={{ paddingHorizontal: HERO_PADDING_H, marginBottom: spacing.xl }}>
          <EventFormEssentialsHeading />
          <View style={{ gap: spacing.xl }}>
            <AppInput
              label="Title *"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Eid gathering, Istiraha night..."
              error={showValidationErrors && !title.trim() ? "Title is required" : undefined}
            />
            <View style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Date & Time *
              </Text>
              <Pressable
                onPress={openDatePicker}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceLight,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  minHeight: 48,
                  justifyContent: "center",
                  borderWidth: 0.5,
                  borderColor: showValidationErrors && (!selectedDate || hasPastDateError) ? colors.error : colors.border,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: typography.sizes.md, color: selectedDate ? colors.text : colors.textDim }}>
                  {selectedDate ? formatEventDate(selectedDate.toISOString()) : "Tap to choose date and time"}
                </Text>
              </Pressable>
              {showValidationErrors && !selectedDate && (
                <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                  Date & time is required
                </Text>
              )}
              {showValidationErrors && hasPastDateError && (
                <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                  Event date must be in the future.
                </Text>
              )}
            </View>
            <View style={{ gap: spacing.sm }}>
              <LocationCardWithPicker
                value={locationData}
                onChange={setLocationData}
                userPhone={userPhone}
              />
            </View>
            <AppInput
              label="About"
              value={details}
              onChangeText={setDetails}
              placeholder="What's this event about?"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* ── Access: visibility, approval, capacity ── */}
        <EventFormSectionCard title="Access">
          <>
            <EventFormTogglePair
              label="Who can join"
              options={[
                { value: "private", label: "Private" },
                { value: "public", label: "Public" },
              ]}
              value={visibility}
              onChange={setVisibility}
              helperText={(v) =>
                v === "private"
                  ? "Only people with the code can find this event."
                  : "Visible in Discover. Share the code for quick access."
              }
            />
            <EventFormTogglePair
              label="Guest approval"
              options={[
                { value: "auto", label: "Auto approve" },
                { value: "manual", label: "Manual approval" },
              ]}
              value={approvalRequired ? "manual" : "auto"}
              onChange={(v) => {
                if (v === "auto" && approvalRequired) {
                  void handleSelectAutoApprove();
                } else if (v === "manual") {
                  setApprovalRequired(true);
                }
              }}
              helperText={(v) =>
                v === "manual" ? "You approve each request" : "Anyone can join instantly"
              }
            />
            <EventFormTogglePair
              label="Allow extra"
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
              value={allowPlusOne ? "yes" : "no"}
              onChange={(v) => setAllowPlusOne(v === "yes")}
              helperText="Guests can bring one additional person"
            />
            <EventFormCapacityControl
              mode={capacityMode}
              value={capacityValue}
              onSelectUnlimited={() => setCapacityMode("unlimited")}
              onOpenSheet={() => {
                setCapacitySheetTemp(capacityValue || "50");
                setShowCapacitySheet(true);
              }}
              showValidationError={showValidationErrors && hasCapacityError}
            />
            <EventFormDressCodeControl
              dressCode={dressCode}
              dressCodeValue={dressCodeValue}
              onClear={() => { setDressCode(""); setDressCodeCustom(""); }}
              onOpenSheet={() => {
                setDressCodeSheetTemp(dressCode || "");
                setDressCodeSheetCustom(dressCode === EVENT_FORM_DRESS_CODE_CUSTOM ? dressCodeCustom : "");
                setShowDressCodeSheet(true);
              }}
            />
            <EventFormAudienceChips value={audience} onChange={setAudience} />
          </>
        </EventFormSectionCard>

        {/* ── Privacy: location visibility + guest visibility toggles ── */}
        <EventFormSectionCard title="Privacy">
          <>
            <EventFormLocationVisibilityControl
              visibility={locationVisibility}
              revealHoursBefore={revealHoursBefore}
              onSelectNow={() => { setLocationVisibility("now"); setRevealHoursBefore(null); }}
              onOpenSheet={() => {
                setRevealSheetTemp(revealHoursBefore ?? 24);
                setRevealSheetCustom(revealHoursBefore != null && revealHoursBefore > 0 && ![1, 2, 5, 24].includes(revealHoursBefore) ? String(revealHoursBefore) : "");
                setShowRevealSheet(true);
              }}
            />
            <EventFormTogglePair
              label="Who sees exact location"
              options={[
                { value: "all_viewers", label: "All viewers" },
                { value: "going_only", label: "Going only" },
              ]}
              value={locationExactAudience}
              onChange={setLocationExactAudience}
              helperText={locationExactAudience === "going_only" ? "Only confirmed guests see the address" : "Anyone who views the event can see the address"}
            />
            <EventFormTogglePair
              label="Guest names"
              options={[
                { value: "show", label: "Show names" },
                { value: "hide", label: "Hide names" },
              ]}
              value={hideGuestNames ? "hide" : "show"}
              onChange={(v) => setHideGuestNames(v === "hide")}
              helperText="Guests can see attendee names"
            />
            <EventFormTogglePair
              label="Guest photos"
              options={[
                { value: "show", label: "Show photos" },
                { value: "hide", label: "Hide photos" },
              ]}
              value={hideGuestAvatars ? "hide" : "show"}
              onChange={(v) => setHideGuestAvatars(v === "hide")}
              helperText="Guests can see attendee profile photos"
            />
          </>
        </EventFormSectionCard>

        {/* ── Extras: optional lineup ── */}
        <EventFormSectionCard title="Extras">
          <>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginBottom: spacing.xs }}>
              Optional - add a lineup
            </Text>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                  Lineup
                </Text>
                    {!draftLineup && (
                      <Pressable
                        onPress={openDraft}
                        style={({ pressed }) => ({
                          paddingVertical: 4,
                          paddingHorizontal: spacing.sm,
                          borderRadius: radius.full,
                          backgroundColor: pressed ? colors.surfaceLighter : colors.surfaceLight,
                          borderWidth: 0.5,
                          borderColor: colors.border,
                        })}
                      >
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.primary }}>
                          {lineup.length > 0 ? "+ Add item" : "Add lineup"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {lineup.map((entry, i) => (
                    <Pressable
                      key={i}
                      onPress={() => openEditDraft(i)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: colors.surfaceLight,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.text, flex: 1 }} numberOfLines={1}>
                        {entry.name}
                        {entry.startTime && entry.endTime && (
                          <Text style={{ color: colors.textMuted, fontWeight: typography.weights.normal }}>
                            {" · "}
                            {formatLineupTimeRange(entry.startTime, entry.endTime, Math.min(1, entry.endDayOffset ?? 0) as EndDayOffset)}
                            {entry.note?.trim() ? ` · ${entry.note.trim()}` : ""}
                          </Text>
                        )}
                      </Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.primary, fontWeight: typography.weights.semibold }}>
                        Edit
                      </Text>
                    </Pressable>
                  ))}
                  {draftLineup && draftEditingIndex === null && (
                    <View
                      style={{
                        backgroundColor: colors.surfaceLight,
                        borderRadius: radius.lg,
                        padding: spacing.md,
                        gap: spacing.md,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <AppInput
                            label="Name *"
                            value={draftLineup.name}
                            onChangeText={(v) => updateDraftEntry("name", v)}
                            placeholder="DJ / Performer name"
                          />
                        </View>
                      </View>
                      <View style={{ gap: spacing.xs }}>
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: 4 }}>
                              Start
                            </Text>
                            <Pressable
                              onPress={() => openLineupTimePicker(DRAFT_INDEX, "startTime")}
                              style={({ pressed }) => ({
                                backgroundColor: colors.surface,
                                borderRadius: radius.md,
                                paddingVertical: spacing.sm,
                                paddingHorizontal: spacing.md,
                                borderWidth: 0.5,
                                borderColor: "rgba(255,255,255,0.08)",
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.startTime ? colors.text : colors.textDim }}>
                                {draftLineup.startTime ? formatTime24ToDisplay(draftLineup.startTime) : "Start time"}
                              </Text>
                            </Pressable>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: 4 }}>
                              End
                            </Text>
                            <Pressable
                              onPress={() => openLineupTimePicker(DRAFT_INDEX, "endTime")}
                              style={({ pressed }) => ({
                                backgroundColor: colors.surface,
                                borderRadius: radius.md,
                                paddingVertical: spacing.sm,
                                paddingHorizontal: spacing.md,
                                borderWidth: 0.5,
                                borderColor: "rgba(255,255,255,0.08)",
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.endTime ? colors.text : colors.textDim }}>
                                {draftLineup.endTime ? formatTime24ToDisplay(draftLineup.endTime) : "End time"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        {(draftLineup.endDayOffset ?? 0) === 1 && (
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 }}>
                            Ends next day
                          </Text>
                        )}
                      </View>
                      <AppInput
                        label="Note"
                        value={draftLineup.note ?? ""}
                        onChangeText={(v) => updateDraftEntry("note", v)}
                        placeholder="Optional note"
                      />
                      {draftError && (
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                          {draftError}
                        </Text>
                      )}
                      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                        <Pressable
                          onPress={cancelDraft}
                          style={({ pressed }) => ({
                            flex: 1,
                            paddingVertical: spacing.md,
                            borderRadius: radius.md,
                            backgroundColor: colors.surface,
                            borderWidth: 0.5,
                            borderColor: colors.border,
                            alignItems: "center",
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={confirmDraft}
                          style={({ pressed }) => ({
                            flex: 1,
                            paddingVertical: spacing.md,
                            borderRadius: radius.md,
                            backgroundColor: colors.primary,
                            alignItems: "center",
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
                            Add
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {draftLineup && draftEditingIndex !== null && (
                    <Modal visible transparent animationType="slide" onRequestClose={cancelDraft}>
                      <Pressable
                        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
                        onPress={cancelDraft}
                      >
                        <Pressable
                          style={{
                            backgroundColor: colors.surface,
                            borderTopLeftRadius: radius.xl,
                            borderTopRightRadius: radius.xl,
                            padding: spacing.lg,
                            paddingBottom: spacing.xxl + 24,
                            borderWidth: 0.5,
                            borderColor: "rgba(255,255,255,0.08)",
                          }}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.md }}>
                            Edit lineup item
                          </Text>
                          <View style={{ gap: spacing.md }}>
                            <AppInput
                              label="Name *"
                              value={draftLineup.name}
                              onChangeText={(v) => updateDraftEntry("name", v)}
                              placeholder="DJ / Performer name"
                            />
                            <View style={{ flexDirection: "row", gap: spacing.sm }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: 4 }}>
                                  Start
                                </Text>
                                <Pressable
                                  onPress={() => openLineupTimePicker(DRAFT_INDEX, "startTime")}
                                  style={({ pressed }) => ({
                                    backgroundColor: colors.surfaceLight,
                                    borderRadius: radius.md,
                                    paddingVertical: spacing.sm,
                                    paddingHorizontal: spacing.md,
                                    borderWidth: 0.5,
                                    borderColor: "rgba(255,255,255,0.08)",
                                    opacity: pressed ? 0.9 : 1,
                                  })}
                                >
                                  <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.startTime ? colors.text : colors.textDim }}>
                                    {draftLineup.startTime ? formatTime24ToDisplay(draftLineup.startTime) : "Start time"}
                                  </Text>
                                </Pressable>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: 4 }}>
                                  End
                                </Text>
                                <Pressable
                                  onPress={() => openLineupTimePicker(DRAFT_INDEX, "endTime")}
                                  style={({ pressed }) => ({
                                    backgroundColor: colors.surfaceLight,
                                    borderRadius: radius.md,
                                    paddingVertical: spacing.sm,
                                    paddingHorizontal: spacing.md,
                                    borderWidth: 0.5,
                                    borderColor: "rgba(255,255,255,0.08)",
                                    opacity: pressed ? 0.9 : 1,
                                  })}
                                >
                                  <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.endTime ? colors.text : colors.textDim }}>
                                    {draftLineup.endTime ? formatTime24ToDisplay(draftLineup.endTime) : "End time"}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                            {Platform.OS === "ios" &&
                              lineupTimePicker != null &&
                              lineupTimePicker.index === DRAFT_INDEX && (
                                <View
                                  style={{
                                    marginTop: spacing.xs,
                                    backgroundColor: colors.surfaceLight,
                                    borderRadius: radius.lg,
                                    padding: spacing.sm,
                                    borderWidth: 0.5,
                                    borderColor: "rgba(255,255,255,0.08)",
                                  }}
                                >
                                  <DateTimePicker
                                    value={lineupTimePickerValue}
                                    mode="time"
                                    display="spinner"
                                    onChange={handleLineupTimeChange}
                                    textColor={colors.text}
                                  />
                                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                                    <Pressable
                                      onPress={() => setLineupTimePicker(null)}
                                      style={({ pressed }) => ({
                                        flex: 1,
                                        paddingVertical: spacing.sm,
                                        borderRadius: radius.md,
                                        backgroundColor: colors.surface,
                                        alignItems: "center",
                                        opacity: pressed ? 0.9 : 1,
                                      })}
                                    >
                                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
                                        Cancel
                                      </Text>
                                    </Pressable>
                                    <Pressable
                                      onPress={confirmLineupTime}
                                      style={({ pressed }) => ({
                                        flex: 1,
                                        paddingVertical: spacing.sm,
                                        borderRadius: radius.md,
                                        backgroundColor: colors.primary,
                                        alignItems: "center",
                                        opacity: pressed ? 0.9 : 1,
                                      })}
                                    >
                                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
                                        Done
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              )}
                            {(draftLineup.endDayOffset ?? 0) === 1 && (
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 }}>
                                Ends next day
                              </Text>
                            )}
                            <AppInput
                              label="Note"
                              value={draftLineup.note ?? ""}
                              onChangeText={(v) => updateDraftEntry("note", v)}
                              placeholder="Optional note"
                            />
                            {draftError && (
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                                {draftError}
                              </Text>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                            <Pressable
                              onPress={cancelDraft}
                              style={({ pressed }) => ({
                                flex: 1,
                                paddingVertical: spacing.md,
                                borderRadius: radius.md,
                                backgroundColor: colors.surfaceLight,
                                alignItems: "center",
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
                                Cancel
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={confirmDraft}
                              style={({ pressed }) => ({
                                flex: 1,
                                paddingVertical: spacing.md,
                                borderRadius: radius.md,
                                backgroundColor: colors.primary,
                                alignItems: "center",
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
                                Save
                              </Text>
                            </Pressable>
                          </View>
                          <Pressable
                            onPress={requestDeleteLineupEntry}
                            style={({ pressed }) => ({
                              paddingVertical: spacing.md,
                              marginTop: spacing.sm,
                              alignItems: "center",
                              borderRadius: radius.md,
                              backgroundColor: "rgba(255,71,87,0.10)",
                              borderWidth: 0.5,
                              borderColor: "rgba(255,71,87,0.35)",
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.error }}>
                              Delete lineup item
                            </Text>
                          </Pressable>
                        </Pressable>
                      </Pressable>
                    </Modal>
                  )}
                </View>
              </>
        </EventFormSectionCard>

        {/* ── Bring ── */}
        <EventFormSectionCard title="Bring">
          <>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginBottom: spacing.xs }}>
              Add items guests can bring
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
            >
              {BRING_SUGGESTIONS.map((s) => {
                const alreadyAdded = bringRows.some((b) => bringTitleKey(b.title) === bringTitleKey(s));
                return (
                  <Pressable
                    key={s}
                    disabled={alreadyAdded}
                    onPress={() => {
                      if (alreadyAdded) return;
                      setBringRows((prev) => {
                        if (prev.some((b) => bringTitleKey(b.title) === bringTitleKey(s))) return prev;
                        return [...prev, { id: generateLocalBringId(), title: s }];
                      });
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      borderRadius: 999,
                      opacity: alreadyAdded ? 0.45 : 1,
                      backgroundColor: colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: colors.border,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: typography.sizes.xs,
                        color: alreadyAdded ? colors.textDim : colors.textMuted,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <TextInput
                value={bringInput}
                onChangeText={setBringInput}
                placeholder="Add custom item"
                placeholderTextColor={colors.textDim}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceLight,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  fontSize: typography.sizes.sm,
                  color: colors.text,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              />
              <Pressable
                onPress={() => {
                  const t = bringInput.trim();
                  if (!t) return;
                  setBringRows((prev) => {
                    if (prev.some((b) => bringTitleKey(b.title) === bringTitleKey(t))) return prev;
                    return [...prev, { id: generateLocalBringId(), title: t }];
                  });
                  setBringInput("");
                }}
                style={({ pressed }) => ({
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.primaryDark : colors.primary,
                  justifyContent: "center",
                })}
              >
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Add</Text>
              </Pressable>
            </View>
            {bringRows.length > 0 && (
              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
                  {bringRows.length} {bringRows.length === 1 ? "item" : "items"} added
                </Text>
                {bringRows.map((item) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceLight, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 0.5, borderColor: colors.border }}>
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.text }}>{item.title}</Text>
                    <Pressable onPress={() => setBringRows((prev) => prev.filter((b) => b.id !== item.id))}>
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        </EventFormSectionCard>

        {/* ── Price ── */}
        <EventFormSectionCard title="Price">
          <EventFormPriceSection
            priceMode={priceMode}
            priceAmount={priceAmount}
            priceCurrency={priceCurrency}
            entryFeePreviewLine={entryFeePreviewLine}
            showValidationError={showValidationErrors && hasPaidAmountError}
            onSelectFree={() => { setPriceMode("free"); setPriceAmount(""); }}
            onSelectPaid={() => setPriceMode("paid")}
            onAmountChange={setPriceAmount}
            onCurrencyChange={setPriceCurrency}
          />
        </EventFormSectionCard>

        {/* ── Delete ── */}
        <Pressable
          onPress={handleDelete}
          disabled={deleting || saving}
          style={({ pressed }) => ({
            marginHorizontal: HERO_PADDING_H,
            paddingVertical: spacing.lg,
            alignItems: "center",
            opacity: pressed || deleting ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: colors.error,
            }}
          >
            {deleting ? "Deleting…" : "Delete event"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <EventFormFooter bottomInset={ctaBottom}>
        {saving ? (
          <View
            style={{
              flexDirection: "row",
              height: spacing.buttonHeightLg,
              justifyContent: "center",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
              Saving…
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={saving || deleting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              height: spacing.buttonHeightLg,
              borderRadius: radius.lg,
              backgroundColor: isValid && !deleting ? colors.primary : colors.surfaceLight,
              borderWidth: 0.5,
              borderColor: isValid && !deleting ? colors.primary : colors.border,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
                color: isValid && !deleting ? colors.text : colors.textMuted,
              }}
            >
              Save changes
            </Text>
            <Text style={{ fontSize: typography.sizes.md, color: isValid && !deleting ? colors.text : colors.textMuted }}>
              →
            </Text>
          </Pressable>
        )}
      </EventFormFooter>

      {/* ── Date/time picker modal ── */}
      <Modal
        visible={showDatePicker || showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDatePicker(false); setShowTimePicker(false); }}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}
        >
          <Pressable
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xxl,
              paddingBottom: spacing.xxl + 34,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ gap: spacing.lg }}>
              <DateTimePicker
                value={selectedDate || new Date()}
                mode={showTimePicker ? "time" : "date"}
                display="spinner"
                onChange={showTimePicker ? handleTimeChange : handleDateChange}
                minimumDate={showTimePicker ? undefined : new Date()}
                {...(Platform.OS === "ios" && { textColor: colors.text })}
              />
              <AppButton
                title="Done"
                onPress={showTimePicker ? handleTimeDone : handleDateNext}
                variant="primary"
                size="md"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <EventFormCapacitySheetModal
        visible={showCapacitySheet}
        onClose={() => setShowCapacitySheet(false)}
        keyboardInset={keyboardInset}
        bottomSafeInset={insets?.bottom ?? 0}
        capacitySheetTemp={capacitySheetTemp}
        onCapacitySheetTempChange={setCapacitySheetTemp}
        onApply={(trimmed) => {
          setCapacityValue(trimmed);
          setCapacityMode("set");
          setShowCapacitySheet(false);
        }}
      />

      <EventFormRevealAddressSheetModal
        visible={showRevealSheet}
        onClose={() => setShowRevealSheet(false)}
        keyboardInset={keyboardInset}
        bottomSafeInset={insets?.bottom ?? 0}
        revealSheetTemp={revealSheetTemp}
        onRevealSheetTempChange={setRevealSheetTemp}
        revealSheetCustom={revealSheetCustom}
        onRevealSheetCustomChange={setRevealSheetCustom}
        onApply={(hours) => {
          setRevealHoursBefore(hours);
          setLocationVisibility("reveal");
          setShowRevealSheet(false);
        }}
      />

      <EventFormDressCodeSheetModal
        visible={showDressCodeSheet}
        onClose={() => setShowDressCodeSheet(false)}
        keyboardInset={keyboardInset}
        bottomSafeInset={insets?.bottom ?? 0}
        dressCodeSheetTemp={dressCodeSheetTemp}
        onDressCodeSheetTempChange={setDressCodeSheetTemp}
        dressCodeSheetCustom={dressCodeSheetCustom}
        onDressCodeSheetCustomChange={setDressCodeSheetCustom}
        onApply={(preset, customTrimmed) => {
          setDressCode(preset);
          setDressCodeCustom(preset === EVENT_FORM_DRESS_CODE_CUSTOM ? customTrimmed : "");
          setShowDressCodeSheet(false);
        }}
      />

      {/* ── Cover picker modal ── */}
      <Modal
        visible={showCoverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCoverModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: spacing.lg }}
          onPress={() => setShowCoverModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.lg,
              maxWidth: 400,
              alignSelf: "center",
              width: "100%",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.semibold,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              Choose cover
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.md }}
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSelectedCoverType(option.value)}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    backgroundColor: selectedCoverType === option.value ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: selectedCoverType === option.value ? colors.primary : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      color: colors.text,
                      fontWeight: selectedCoverType === option.value ? typography.weights.semibold : typography.weights.medium,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={handlePickPhoto}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: pressed ? colors.surfaceLighter : colors.surfaceLight,
                borderWidth: coverUrl ? 1 : 0.5,
                borderColor: coverUrl ? colors.primary : colors.border,
                marginBottom: spacing.md,
              })}
            >
              <Text style={{ fontSize: 20 }}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
                  Upload photo
                </Text>
                {coverUrl && (
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.primary, marginTop: 1 }}>
                    Photo selected
                  </Text>
                )}
              </View>
              {coverUrl && <Text style={{ fontSize: typography.sizes.xs, color: colors.primary }}>✓</Text>}
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {getCoverOptions(selectedCoverType).map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setCoverKey(opt.key);
                    setCoverUrl(null);
                    setShowCoverModal(false);
                  }}
                  style={{
                    width: "47%",
                    alignItems: "center",
                    padding: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: coverKey === opt.key ? colors.primaryLight20 : "transparent",
                    borderWidth: coverKey === opt.key ? 1 : 0,
                    borderColor: coverKey === opt.key ? colors.primary : "transparent",
                  }}
                >
                  <ImageBackground
                    source={getCoverSource(opt.key, selectedCoverType)}
                    resizeMode="cover"
                    style={{ width: "100%", aspectRatio: 1, borderRadius: radius.md, marginBottom: spacing.xs }}
                    imageStyle={{ borderRadius: radius.md }}
                  />
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted }} numberOfLines={1}>
                    Cover {opt.key.split("_")[1]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowCoverModal(false)} style={{ paddingVertical: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: typography.weights.medium }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Lineup time picker: Android = native dialog, iOS = bottom sheet */}
      {lineupTimePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={lineupTimePickerValue}
          mode="time"
          display="default"
          onChange={handleLineupTimeChange}
        />
      )}
      {lineupTimePicker &&
        Platform.OS === "ios" &&
        !(draftEditingIndex !== null && lineupTimePicker.index === DRAFT_INDEX) && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLineupTimePicker(null)}>
          <Pressable
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setLineupTimePicker(null)}
          >
            <Pressable
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingHorizontal: spacing.xxl,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xxl + 24,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.08)",
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker
                value={lineupTimePickerValue}
                mode="time"
                display="spinner"
                onChange={handleLineupTimeChange}
                textColor={colors.text}
              />
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setLineupTimePicker(null)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceLight,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmLineupTime}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text }}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}
