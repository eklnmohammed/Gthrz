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
} from "@/src/components/event-form";
import { LocationCardWithPicker, type LocationSelection } from "@/src/components/LocationCardWithPicker";
import { isValidCoverUrl } from "@/src/utils/coverUrl";
import { uploadEventCover } from "@/src/utils/uploadEventCover";
import { useKeyboardInset } from "@/src/hooks/useKeyboardInset";
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
    approveRsvp,
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

  const AUDIENCE_OPTIONS = ["Men only", "Mixed", "Women only"];

  const DRESS_CODE_PRESETS = ["Casual", "Smart casual", "Formal", "Traditional", "All black", "Techno", "Y2K", "Custom"];
  const DRESS_CODE_CUSTOM = "Custom";
  const dressCodeValue = dressCode === DRESS_CODE_CUSTOM ? dressCodeCustom.trim() : dressCode;

  const DRAFT_INDEX = -1;

  const openDraft = () => {
    setDraftError(null);
    setDraftLineup({ name: "", startTime: "", endTime: "", note: "", endDayOffset: 0 });
    setDraftEditingIndex(null);
  };

  const openEditDraft = (index: number) => {
    setDraftError(null);
    setDraftLineup({ ...lineup[index] });
    setDraftEditingIndex(index);
  };

  const cancelDraft = () => {
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
      setLineup((prev) => prev.map((e, i) => (i === draftEditingIndex ? entry : e)));
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
          if (data.host_phone !== phone) {
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
          const loadedLineup: LineupEntry[] = Array.isArray(data.lineup) ? data.lineup : [];
          setLineup(loadedLineup);
          const existingDressCode = data.dress_code ?? "";
          const presets = ["Casual", "Smart casual", "Formal", "Traditional", "All black", "Techno", "Y2K"];
          if (presets.includes(existingDressCode)) {
            setDressCode(existingDressCode);
          } else if (existingDressCode) {
            setDressCode(DRESS_CODE_CUSTOM);
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
    if (type == null) {
      setCoverKey("");
    } else {
      setCoverKey(getDefaultCoverKey(type));
    }
    setCoverUrl(null);
  };

  const openLineupTimePicker = (index: number, field: "startTime" | "endTime") => {
    const entry = index === DRAFT_INDEX ? draftLineup : lineup[index];
    const current = field === "startTime" ? entry?.startTime : entry?.endTime;
    setLineupTimePickerValue(parseTime24ToDate(current));
    setLineupTimePicker({ index, field });
  };

  const handleLineupTimeChange = (_: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      if (date != null && lineupTimePicker != null) {
        const t = dateToTime24(date);
        if (lineupTimePicker.index === DRAFT_INDEX) {
          setDraftLineup((prev) => {
            if (!prev) return null;
            const next = { ...prev, [lineupTimePicker.field]: t };
            if (lineupTimePicker.field === "startTime") {
              next.endDayOffset = prev.endTime && !isEndAfterStart(t, prev.endTime) ? 1 : 0;
            } else {
              next.endDayOffset = prev.startTime && !isEndAfterStart(prev.startTime, t) ? 1 : 0;
            }
            return next;
          });
        } else {
          updateLineupEntry(lineupTimePicker.index, lineupTimePicker.field, t);
        }
      }
      setLineupTimePicker(null);
      return;
    }
    if (date != null) setLineupTimePickerValue(date);
  };

  const confirmLineupTime = () => {
    if (lineupTimePicker == null) return;
    const t = dateToTime24(lineupTimePickerValue);
    if (lineupTimePicker.index === DRAFT_INDEX) {
      setDraftLineup((prev) => {
        if (!prev) return null;
        const next = { ...prev, [lineupTimePicker.field]: t };
        if (lineupTimePicker.field === "startTime") {
          next.endDayOffset = prev.endTime && !isEndAfterStart(t, prev.endTime) ? 1 : 0;
        } else {
          next.endDayOffset = prev.startTime && !isEndAfterStart(prev.startTime, t) ? 1 : 0;
        }
        return next;
      });
    } else {
      updateLineupEntry(lineupTimePicker.index, lineupTimePicker.field, t);
    }
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
      if (initialManual && nowAuto) {
        const formCap = parseFormCapacityLimitEdit(capacityMode, effectiveCapacity);
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
        for (const p of rsvps.pending) {
          await approveRsvp(params.id, p.user_phone);
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
        approvalRequired,
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
      setSaving(false);
      Alert.alert("Event Updated", "Your changes have been saved.", [
        {
          text: "OK",
          onPress: async () => {
            initialValuesRef.current = null;
            await fetchEvents();
            router.back();
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
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Who can join
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["private", "public"] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setVisibility(v)}
                    style={{
                      flex: 1,
                      backgroundColor: visibility === v ? colors.primary : colors.surfaceLight,
                      borderRadius: radius.md,
                      paddingVertical: spacing.md,
                      alignItems: "center",
                      borderWidth: 0.5,
                      borderColor: visibility === v ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: visibility === v ? colors.text : colors.textMuted }}>
                      {v === "private" ? "Private" : "Public"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                {visibility === "private"
                  ? "Only people with the code can find this event."
                  : "Visible in Discover. Share the code for quick access."}
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Guest approval
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => {
                    if (approvalRequired) {
                      void handleSelectAutoApprove();
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: !approvalRequired ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: !approvalRequired ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: !approvalRequired ? colors.text : colors.textMuted }}>
                    Auto approve
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setApprovalRequired(true)}
                  style={{
                    flex: 1,
                    backgroundColor: approvalRequired ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: approvalRequired ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: approvalRequired ? colors.text : colors.textMuted }}>
                    Manual approval
                  </Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                {approvalRequired ? "You approve each request" : "Anyone can join instantly"}
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Allow extra
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setAllowPlusOne(false)}
                  style={{
                    flex: 1,
                    backgroundColor: !allowPlusOne ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: !allowPlusOne ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: !allowPlusOne ? colors.text : colors.textMuted }}>
                    No
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAllowPlusOne(true)}
                  style={{
                    flex: 1,
                    backgroundColor: allowPlusOne ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: allowPlusOne ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: allowPlusOne ? colors.text : colors.textMuted }}>
                    Yes
                  </Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                Guests can bring one additional person
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Capacity
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setCapacityMode("unlimited")}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: capacityMode === "unlimited" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: capacityMode === "unlimited" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: capacityMode === "unlimited" ? colors.text : colors.textMuted }}>
                    Unlimited
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCapacitySheetTemp(capacityValue || "50");
                    setShowCapacitySheet(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: capacityMode === "set" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: capacityMode === "set" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: capacityMode === "set" ? colors.text : colors.textMuted }}>
                    {capacityMode === "set" && capacityValue !== "" ? `${capacityValue} guests` : "Set limit"}
                  </Text>
                </Pressable>
              </View>
              {capacityMode === "set" && capacityValue !== "" && (
                <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                  Max {capacityValue} guests
                </Text>
              )}
              {showValidationErrors && hasCapacityError && (
                <Text style={{ fontSize: typography.sizes.xs, color: colors.error, marginTop: 2 }}>
                  Capacity must be a positive whole number.
                </Text>
              )}
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Dress code
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => { setDressCode(""); setDressCodeCustom(""); }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: dressCode === "" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: dressCode === "" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: dressCode === "" ? colors.text : colors.textMuted }}>
                    None
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDressCodeSheetTemp(dressCode || "");
                    setDressCodeSheetCustom(dressCode === DRESS_CODE_CUSTOM ? dressCodeCustom : "");
                    setShowDressCodeSheet(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: dressCode !== "" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: dressCode !== "" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: dressCode !== "" ? colors.text : colors.textMuted }} numberOfLines={1}>
                    {dressCodeValue !== "" ? dressCodeValue : "Set dress code"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Guest type
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {AUDIENCE_OPTIONS.map((opt) => {
                  const selected = audience === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setAudience(selected ? "" : opt)}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radius.md,
                        backgroundColor: selected ? colors.primary : colors.surfaceLight,
                        borderWidth: 0.5,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        </EventFormSectionCard>

        {/* ── Privacy: location visibility + guest visibility toggles ── */}
        <EventFormSectionCard title="Privacy">
          <>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                When do guests see the address?
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => { setLocationVisibility("now"); setRevealHoursBefore(null); }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: locationVisibility === "now" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: locationVisibility === "now" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: locationVisibility === "now" ? colors.text : colors.textMuted }}>
                    Visible now
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRevealSheetTemp(revealHoursBefore ?? 24);
                    setRevealSheetCustom(revealHoursBefore != null && revealHoursBefore > 0 && ![1, 2, 5, 24].includes(revealHoursBefore) ? String(revealHoursBefore) : "");
                    setShowRevealSheet(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: locationVisibility === "reveal" ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: locationVisibility === "reveal" ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: locationVisibility === "reveal" ? colors.text : colors.textMuted }} numberOfLines={1}>
                    {locationVisibility === "reveal" && revealHoursBefore != null && revealHoursBefore > 0
                      ? `${revealHoursBefore}h before`
                      : "Reveal later"}
                  </Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                {locationVisibility === "reveal" ? "Address is hidden until the reveal time" : "Address is visible to all guests"}
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Guest names
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setHideGuestNames(false)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: !hideGuestNames ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: !hideGuestNames ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: !hideGuestNames ? colors.text : colors.textMuted }}>
                    Show names
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHideGuestNames(true)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: hideGuestNames ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: hideGuestNames ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: hideGuestNames ? colors.text : colors.textMuted }}>
                    Hide names
                  </Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                Guests can see attendee names
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Guest photos
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setHideGuestAvatars(false)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: !hideGuestAvatars ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: !hideGuestAvatars ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: !hideGuestAvatars ? colors.text : colors.textMuted }}>
                    Show photos
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHideGuestAvatars(true)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: hideGuestAvatars ? colors.primary : colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: hideGuestAvatars ? colors.primary : colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: hideGuestAvatars ? colors.text : colors.textMuted }}>
                    Hide photos
                  </Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                Guests can see attendee profile photos
              </Text>
            </View>
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
          <>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                Entry fee
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => { setPriceMode("free"); setPriceAmount(""); }}
                  style={{
                    flex: 1,
                    backgroundColor: priceMode === "free" ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: priceMode === "free" ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceMode === "free" ? colors.text : colors.textMuted }}>
                    Free
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPriceMode("paid")}
                  style={{
                    flex: 1,
                    backgroundColor: priceMode === "paid" ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: priceMode === "paid" ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceMode === "paid" ? colors.text : colors.textMuted }}>
                    Paid
                  </Text>
                </Pressable>
              </View>
            </View>
            {priceMode === "paid" && (
              <View style={{ gap: spacing.sm }}>
                <View style={{ gap: spacing.xs }}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                    Amount *
                  </Text>
                  <TextInput
                    value={priceAmount}
                    onChangeText={setPriceAmount}
                    placeholder="0"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.surfaceLight,
                      borderRadius: radius.md,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      fontSize: typography.sizes.md,
                      color: colors.text,
                      borderWidth: 0.5,
                      borderColor: showValidationErrors && hasPaidAmountError ? colors.error : colors.border,
                    }}
                  />
                  {showValidationErrors && hasPaidAmountError && (
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                      Enter a valid amount greater than 0
                    </Text>
                  )}
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
                    Currency
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {(["SAR", "$", "£"] as const).map((cur) => (
                      <Pressable
                        key={cur}
                        onPress={() => setPriceCurrency(cur)}
                        style={{
                          flex: 1,
                          backgroundColor: priceCurrency === cur ? colors.primary : colors.surfaceLight,
                          borderRadius: radius.md,
                          paddingVertical: spacing.md,
                          alignItems: "center",
                          borderWidth: 0.5,
                          borderColor: priceCurrency === cur ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceCurrency === cur ? colors.text : colors.textMuted }}>
                          {cur}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {entryFeePreviewLine ? (
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      fontWeight: typography.weights.semibold,
                      color: colors.text,
                      marginTop: spacing.xs,
                    }}
                  >
                    {entryFeePreviewLine}
                  </Text>
                ) : null}
                <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                  Display only — no payments are processed
                </Text>
              </View>
            )}
          </>
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

      {/* ── Capacity bottom sheet ── */}
      <Modal
        visible={showCapacitySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCapacitySheet(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setShowCapacitySheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: keyboardInset > 0 ? spacing.lg : spacing.xxl + (insets?.bottom ?? 0),
              marginBottom: keyboardInset,
              borderWidth: 0.5,
              borderColor: "rgba(255,255,255,0.08)",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.md }}>
              Guest limit
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
              {[10, 20, 50, 100].map((n) => {
                const val = String(n);
                const selected = capacitySheetTemp === val;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setCapacitySheetTemp(val)}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary : colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginBottom: spacing.lg }}>
              <AppInput
                label="Custom number"
                value={capacitySheetTemp}
                onChangeText={(t) => setCapacitySheetTemp(t.replace(/\D/g, "").slice(0, 5))}
                placeholder="e.g. 75"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowCapacitySheet(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceLight,
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
              {(() => {
                const v = capacitySheetTemp.trim();
                const capacityApplyValid = isValidPositiveWholeCapacityString(capacitySheetTemp);
                return (
                  <Pressable
                    onPress={() => {
                      if (capacityApplyValid) {
                        setCapacityValue(v);
                        setCapacityMode("set");
                        setShowCapacitySheet(false);
                      }
                    }}
                    disabled={!capacityApplyValid}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: capacityApplyValid ? colors.primary : colors.surfaceLight,
                      alignItems: "center",
                      opacity: pressed && capacityApplyValid ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: capacityApplyValid ? colors.text : colors.textMuted }}>
                      Apply
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Location reveal bottom sheet ── */}
      <Modal
        visible={showRevealSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRevealSheet(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setShowRevealSheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: keyboardInset > 0 ? spacing.lg : spacing.xxl + (insets?.bottom ?? 0),
              marginBottom: keyboardInset,
              borderWidth: 0.5,
              borderColor: "rgba(255,255,255,0.08)",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.md }}>
              When to reveal address
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
              {([1, 2, 5, 24] as const).map((hours) => {
                const selected = revealSheetCustom === "" && revealSheetTemp === hours;
                return (
                  <Pressable
                    key={hours}
                    onPress={() => { setRevealSheetTemp(hours); setRevealSheetCustom(""); }}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary : colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                      {hours} hours before
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginBottom: spacing.lg }}>
              <AppInput
                label="Custom hours"
                value={revealSheetCustom}
                onChangeText={(t) => {
                  setRevealSheetCustom(t.replace(/\D/g, "").slice(0, 3));
                  const n = parseInt(t.replace(/\D/g, ""), 10);
                  if (!Number.isNaN(n) && n >= 1) setRevealSheetTemp(n);
                }}
                placeholder="e.g. 12"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowRevealSheet(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceLight,
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
                onPress={() => {
                  const hours = revealSheetCustom.trim() ? parseInt(revealSheetCustom, 10) : revealSheetTemp;
                  if (hours >= 1) {
                    setRevealHoursBefore(hours);
                    setLocationVisibility("reveal");
                    setShowRevealSheet(false);
                  }
                }}
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
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Dress code bottom sheet ── */}
      <Modal
        visible={showDressCodeSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDressCodeSheet(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setShowDressCodeSheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xl,
              paddingBottom: keyboardInset > 0 ? spacing.lg : spacing.xxl + (insets?.bottom ?? 0),
              marginBottom: keyboardInset,
              borderWidth: 0.5,
              borderColor: "rgba(255,255,255,0.08)",
              gap: spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text }}>
                Dress code
              </Text>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
                Choose a preset or enter a custom style
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" }}>
              {DRESS_CODE_PRESETS.filter((p) => p !== DRESS_CODE_CUSTOM).map((preset) => {
                const selected = dressCodeSheetTemp === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => { setDressCodeSheetTemp(preset); setDressCodeSheetCustom(""); }}
                    style={{
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary : colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
              {(() => {
                const selected = dressCodeSheetTemp === DRESS_CODE_CUSTOM;
                return (
                  <Pressable
                    onPress={() => setDressCodeSheetTemp(DRESS_CODE_CUSTOM)}
                    style={{
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.primary : colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                      {DRESS_CODE_CUSTOM}
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
            {dressCodeSheetTemp === DRESS_CODE_CUSTOM && (
              <AppInput
                placeholder="e.g. Thobe, Abaya, All black"
                value={dressCodeSheetCustom}
                onChangeText={setDressCodeSheetCustom}
                maxLength={60}
              />
            )}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowDressCodeSheet(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceLight,
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
              {(() => {
                const applyValid =
                  dressCodeSheetTemp !== "" &&
                  (dressCodeSheetTemp !== DRESS_CODE_CUSTOM || dressCodeSheetCustom.trim() !== "");
                return (
                  <Pressable
                    onPress={() => {
                      if (applyValid) {
                        setDressCode(dressCodeSheetTemp);
                        setDressCodeCustom(
                          dressCodeSheetTemp === DRESS_CODE_CUSTOM ? dressCodeSheetCustom.trim() : ""
                        );
                        setShowDressCodeSheet(false);
                      }
                    }}
                    disabled={!applyValid}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: applyValid ? colors.primary : colors.surfaceLight,
                      alignItems: "center",
                      opacity: pressed && applyValid ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: applyValid ? colors.text : colors.textMuted }}>
                      Apply
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
      {lineupTimePicker && Platform.OS === "ios" && (
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
