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
  Switch,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onboardingStore } from "@/src/state/onboardingStore";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEvents, type LineupEntry } from "@/src/state/eventsStore";
import { supabase } from "@/src/lib/supabase";
import { EventType } from "@/src/lib/supabase";
import { HeaderBackTextButton } from "@/src/components/HeaderBackTextButton";
import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { formatEventDate } from "@/src/utils/formatEventDate";
import { getCoverOptions, getCoverSource } from "@/src/utils/covers";
import { getEventTypeLabel } from "@/src/utils/eventTypeBadge";
import { LocationCardWithPicker, type LocationSelection } from "@/src/components/LocationCardWithPicker";
import { isValidCoverUrl } from "@/src/utils/coverUrl";
import { uploadEventCover } from "@/src/utils/uploadEventCover";
import {
  formatTime24ToDisplay,
  formatLineupTimeRange,
  parseTime24ToDate,
  dateToTime24,
  isEndAfterStart,
} from "@/src/utils/lineupTime";
import type { EndDayOffset } from "@/src/lib/supabase";

const EVENT_TYPE_OPTIONS: { value: EventType; label: string; emoji: string }[] = [
  { value: "party", label: "Party", emoji: "🎉" },
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "wedding", label: "Wedding", emoji: "💍" },
  { value: "graduation", label: "Graduation", emoji: "🎓" },
  { value: "majlis", label: "Majlis", emoji: "☕" },
  { value: "istiraha", label: "Istiraha", emoji: "🏕️" },
  { value: "ramadan", label: "Ramadan", emoji: "🌙" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.xl,
        gap: spacing.xl,
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          color: colors.textMuted,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function EditEventScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { updateEvent, deleteEvent, fetchEvents } = useEvents();
  const insets = useSafeAreaInsets();

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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [hideGuestNames, setHideGuestNames] = useState(false);
  const [hideGuestAvatars, setHideGuestAvatars] = useState(false);
  const [eventType, setEventType] = useState<EventType>("party");
  const [selectedCoverType, setSelectedCoverType] = useState<EventType>("party");
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

  const [dressCode, setDressCode] = useState<string>("");
  const [dressCodeCustom, setDressCodeCustom] = useState<string>("");
  const [showDressCodeSheet, setShowDressCodeSheet] = useState(false);
  const [dressCodeSheetTemp, setDressCodeSheetTemp] = useState<string>("");
  const [dressCodeSheetCustom, setDressCodeSheetCustom] = useState<string>("");

  const DRESS_CODE_PRESETS = ["Casual", "Smart casual", "Formal", "Black tie", "Costume", "Thobe", "Abaya", "Traditional", "Other"];
  const dressCodeValue = dressCode === "Other" ? dressCodeCustom.trim() : dressCode;

  const DRAFT_INDEX = -1;
  const showLineup = eventType === "party" || eventType === "wedding";

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
    const entry: LineupEntry = {
      name: draftLineup.name.trim(),
      startTime: draftLineup.startTime.trim(),
      endTime: draftLineup.endTime.trim(),
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
  const coverPadding = spacing.xxxxl * 2;
  const coverSize = screenWidth - coverPadding;
  const typeLabel = getEventTypeLabel(eventType);

  useEffect(() => {
    onboardingStore.getPhone().then(setUserPhone);
  }, []);
  const pickerClosedAt = useRef(0);

  const effectiveCapacity = capacityMode === "unlimited" ? "" : capacityValue;

  type InitialSnapshot = {
    title: string;
    dateTime: number | null;
    locationName: string;
    details: string;
    capacityMode: "unlimited" | "set";
    capacityValue: string;
    visibility: "private" | "public";
    approvalRequired: boolean;
    eventType: EventType;
    coverKey: string;
    coverUrl: string | null;
    lineup: string;
    locationVisibility: "now" | "reveal";
    revealHoursBefore: number | null;
  };
  const initialValuesRef = useRef<InitialSnapshot | null>(null);

  const isDirty =
    initialValuesRef.current !== null &&
    (title.trim() !== initialValuesRef.current.title ||
      (selectedDate ? selectedDate.getTime() : null) !== initialValuesRef.current.dateTime ||
      locationData.name.trim() !== initialValuesRef.current.locationName ||
      details.trim() !== initialValuesRef.current.details ||
      capacityMode !== initialValuesRef.current.capacityMode ||
      capacityValue !== initialValuesRef.current.capacityValue ||
      visibility !== initialValuesRef.current.visibility ||
      approvalRequired !== initialValuesRef.current.approvalRequired ||
      eventType !== initialValuesRef.current.eventType ||
      coverKey !== initialValuesRef.current.coverKey ||
      coverUrl !== initialValuesRef.current.coverUrl ||
      JSON.stringify(lineup) !== initialValuesRef.current.lineup ||
      locationVisibility !== initialValuesRef.current.locationVisibility ||
      revealHoursBefore !== initialValuesRef.current.revealHoursBefore);

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
      if (!params.id) return;
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
          setEventType(data.event_type || "party");
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
          const presets = ["Casual", "Smart casual", "Formal", "Black tie", "Costume", "Other"];
          if (presets.includes(existingDressCode)) {
            setDressCode(existingDressCode);
          } else if (existingDressCode) {
            setDressCode("Other");
            setDressCodeCustom(existingDressCode);
          }
          const sanitizedCoverUrl = isValidCoverUrl(data.cover_url) ? data.cover_url : null;
          initialValuesRef.current = {
            title: data.title || "",
            dateTime: data.date_time ? new Date(data.date_time).getTime() : null,
            locationName: data.location_name || data.location || "",
            details: data.details || "",
            capacityMode: capStr !== "" ? "set" : "unlimited",
            capacityValue: capStr,
            visibility: data.visibility || "private",
            approvalRequired: data.approval_required ?? false,
            eventType: data.event_type || "party",
            coverKey: data.cover_key ?? "",
            coverUrl: sanitizedCoverUrl,
            lineup: JSON.stringify(loadedLineup),
            locationVisibility:
              data.location_visibility === "reveal" ? "reveal" : "now",
            revealHoursBefore:
              typeof data.reveal_hours_before === "number"
                ? data.reveal_hours_before
                : null,
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

  const isValid =
    title.trim().length > 0 &&
    selectedDate !== null &&
    !hasLineupTimeError;

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

  const handleSave = async () => {
    if (!isValid || saving || !selectedDate || !params.id) return;
    setSaving(true);
    setError(null);
    try {
      const phone = await onboardingStore.getPhone();
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
        eventType,
        coverKey: coverKey || undefined,
        coverUrl: isValidCoverUrl(coverUrl) ? coverUrl ?? undefined : undefined,
        lineup: showLineup && lineup.length > 0
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
      });
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
  const hasCover = isValidCoverUrl(coverUrl) || (coverKey != null && coverKey.trim() !== "");

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
        contentContainerStyle={{ paddingBottom: 100 + ctaBottom, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero poster (square, centered) ── */}
        <View
          style={{
            alignSelf: "center",
            width: coverSize,
            height: coverSize,
            borderRadius: 24,
            overflow: "hidden",
            marginVertical: spacing.xxl,
          }}
        >
          {hasCover ? (
            <ImageBackground
              source={isValidCoverUrl(coverUrl) ? { uri: coverUrl! } : getCoverSource(coverKey, eventType)}
              resizeMode="cover"
              style={{ flex: 1, width: "100%", height: "100%" }}
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.45)", "transparent"]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130 }}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.82)"]}
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160 }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "rgba(0,0,0,0.38)",
                    paddingVertical: 5,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 0.5,
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{typeLabel.emoji}</Text>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: "#fff" }}>
                    {typeLabel.label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setSelectedCoverType(eventType); setShowCoverModal(true); }}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.18)",
                    paddingVertical: 6,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    borderWidth: 0.5,
                    borderColor: "rgba(255,255,255,0.25)",
                  })}
                >
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: "#fff" }}>
                    Change cover
                  </Text>
                </Pressable>
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.xl,
                  gap: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sizes.xxl,
                    fontWeight: typography.weights.bold,
                    color: "#fff",
                    lineHeight: 28,
                  }}
                  numberOfLines={2}
                >
                  {title || "Your event title"}
                </Text>
                {selectedDate ? (
                  <Text style={{ fontSize: typography.sizes.sm, color: "rgba(255,255,255,0.78)", fontWeight: typography.weights.medium }}>
                    {formatEventDate(selectedDate.toISOString())}
                  </Text>
                ) : (
                  <Text style={{ fontSize: typography.sizes.sm, color: "rgba(255,255,255,0.38)" }}>
                    Date & time not set
                  </Text>
                )}
              </View>
            </ImageBackground>
          ) : (
            <View
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: colors.border,
                justifyContent: "space-between",
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xl,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: colors.surfaceLight,
                    paddingVertical: 5,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{typeLabel.emoji}</Text>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.text }}>
                    {typeLabel.label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setSelectedCoverType(eventType); setShowCoverModal(true); }}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.surfaceLighter : colors.primary,
                    paddingVertical: 6,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    borderWidth: 0.5,
                    borderColor: colors.primary,
                  })}
                >
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: "#fff" }}>
                    Add cover
                  </Text>
                </Pressable>
              </View>
              <View style={{ gap: 3 }}>
                <Text
                  style={{
                    fontSize: typography.sizes.xxl,
                    fontWeight: typography.weights.bold,
                    color: colors.text,
                    lineHeight: 28,
                  }}
                  numberOfLines={2}
                >
                  {title || "Your event title"}
                </Text>
                {selectedDate ? (
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: typography.weights.medium }}>
                    {formatEventDate(selectedDate.toISOString())}
                  </Text>
                ) : (
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
                    Date & time not set
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Error ── */}
        {error && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              backgroundColor: "rgba(255,71,87,0.12)",
              borderRadius: radius.lg,
              padding: spacing.lg,
              borderWidth: 0.5,
              borderColor: colors.error,
            }}
          >
            <Text style={{ fontSize: typography.sizes.sm, color: colors.error, textAlign: "center" }}>
              {error}
            </Text>
          </View>
        )}

        {/* ── Basics card ── */}
        <SectionCard title="Basics">
          <AppInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Eid gathering, Istiraha night..."
          />

          {/* Event type — one row, compact chips */}
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                color: colors.textMuted,
              }}
            >
              Event type
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {EVENT_TYPE_OPTIONS.map((option) => {
                const selected = eventType === option.value;
                const label = getEventTypeLabel(option.value).label;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setEventType(option.value)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.full,
                      backgroundColor: selected ? colors.primary : pressed ? colors.surfaceLighter : colors.surfaceLight,
                      borderWidth: 0.5,
                      borderColor: selected ? colors.primary : "rgba(255,255,255,0.06)",
                    })}
                  >
                    <Text style={{ fontSize: 14 }}>{option.emoji}</Text>
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: selected ? typography.weights.semibold : typography.weights.medium,
                        color: colors.text,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                color: colors.textMuted,
              }}
            >
              Date & Time *
            </Text>
            <Pressable
              onPress={openDatePicker}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceLighter : colors.surfaceLight,
                borderRadius: radius.md,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                minHeight: 52,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Text style={{ fontSize: typography.sizes.md, color: selectedDate ? colors.text : colors.textDim }}>
                {selectedDate ? formatEventDate(selectedDate.toISOString()) : "Tap to choose date and time"}
              </Text>
            </Pressable>
          </View>

          {/* Location */}
          <View style={{ gap: spacing.md }}>
            <LocationCardWithPicker
              value={locationData}
              onChange={setLocationData}
              userPhone={userPhone}
            />
          </View>

          {/* Visibility */}
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
              Visibility
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
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      fontWeight: typography.weights.semibold,
                      color: visibility === v ? colors.text : colors.textMuted,
                    }}
                  >
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

        </SectionCard>

        {/* ── About card ── */}
        <SectionCard title="About">
          <AppInput
            label="Details"
            value={details}
            onChangeText={setDetails}
            placeholder="What's this event about?"
            multiline
            numberOfLines={4}
          />
        </SectionCard>

        {/* ── Options (always visible) ── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            overflow: "hidden",
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <View style={{ padding: spacing.xl }}>
            <Text
              style={{
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                color: colors.textMuted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginBottom: spacing.xl,
              }}
            >
              Options
            </Text>
            <View style={{ gap: spacing.xl }}>
              {/* Guest approval */}
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Guest approval
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    onPress={() => setApprovalRequired(false)}
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
                      Auto-approve
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
                      Approve guests
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Capacity */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Capacity
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    onPress={() => setCapacityMode("unlimited")}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
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
                      paddingHorizontal: spacing.md,
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
              </View>

              {/* Location visibility */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Location visibility
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    onPress={() => { setLocationVisibility("now"); setRevealHoursBefore(null); }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
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
                      paddingHorizontal: spacing.md,
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
              </View>

              {/* Dress code */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Dress code
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    onPress={() => { setDressCode(""); setDressCodeCustom(""); }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
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
                      setDressCodeSheetCustom(dressCode === "Other" ? dressCodeCustom : "");
                      setShowDressCodeSheet(true);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
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

              {/* Privacy */}
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Privacy
                </Text>
                <View style={{ backgroundColor: colors.surfaceLight, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, overflow: "hidden" }}>
                  {/* Hide guest names */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.lg }}>
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text }}>
                        Hide guest names
                      </Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                        Guests see avatars only, not names.
                      </Text>
                    </View>
                    <Switch
                      value={hideGuestNames}
                      onValueChange={setHideGuestNames}
                      trackColor={{ false: colors.surfaceLighter, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  {/* Divider */}
                  <View style={{ height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.lg }} />
                  {/* Hide guest avatars */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.lg }}>
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text }}>
                        Hide guest avatars
                      </Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
                        Guests see a placeholder instead of photos.
                      </Text>
                    </View>
                    <Switch
                      value={hideGuestAvatars}
                      onValueChange={setHideGuestAvatars}
                      trackColor={{ false: colors.surfaceLighter, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              </View>

              {/* Lineup — party/wedding */}
              {showLineup && (
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
                          + Add DJ/Performer
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
                      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.textMuted, marginBottom: spacing.xs }}>
                            Start
                          </Text>
                          <Pressable
                            onPress={() => openLineupTimePicker(DRAFT_INDEX, "startTime")}
                            style={({ pressed }) => ({
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.md,
                              backgroundColor: colors.surface,
                              borderWidth: 0.5,
                              borderColor: colors.border,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.startTime ? colors.text : colors.textMuted }}>
                              {draftLineup.startTime ? formatTime24ToDisplay(draftLineup.startTime) : "Start time"}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.textMuted, marginBottom: spacing.xs }}>
                            End
                          </Text>
                          <Pressable
                            onPress={() => openLineupTimePicker(DRAFT_INDEX, "endTime")}
                            style={({ pressed }) => ({
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.md,
                              backgroundColor: colors.surface,
                              borderWidth: 0.5,
                              borderColor: colors.border,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.endTime ? colors.text : colors.textMuted }}>
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
                            Edit DJ/Performer
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
                                  <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.startTime ? colors.text : colors.textMuted }}>
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
                                  <Text style={{ fontSize: typography.sizes.sm, color: draftLineup.endTime ? colors.text : colors.textMuted }}>
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
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.error }}>
                              Delete DJ/Performer
                            </Text>
                          </Pressable>
                        </Pressable>
                      </Pressable>
                    </Modal>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Delete ── */}
        <Pressable
          onPress={handleDelete}
          disabled={deleting || saving}
          style={({ pressed }) => ({
            marginHorizontal: spacing.lg,
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
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: ctaBottom,
          backgroundColor: colors.background,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
        }}
      >
        {saving ? (
          <View style={{ height: spacing.buttonHeightLg, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.coral} />
          </View>
        ) : (
          <AppButton
            title="Save changes"
            onPress={handleSave}
            disabled={!isValid || saving || deleting}
            variant="coral"
            size="lg"
            fullWidth
          />
        )}
      </View>

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
              paddingBottom: spacing.xxl + (insets?.bottom ?? 0),
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
                const num = parseInt(v, 10);
                const capacityApplyValid = v !== "" && !Number.isNaN(num) && num >= 1;
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
              paddingBottom: spacing.xxl + (insets?.bottom ?? 0),
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
              paddingBottom: spacing.xxl + (insets?.bottom ?? 0),
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
              {DRESS_CODE_PRESETS.filter((p) => p !== "Other").map((preset) => {
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
                const selected = dressCodeSheetTemp === "Other";
                return (
                  <Pressable
                    onPress={() => setDressCodeSheetTemp("Other")}
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
                      Other
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
            {dressCodeSheetTemp === "Other" && (
              <AppInput
                placeholder="e.g. traditional, all white..."
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
                const applyValid = dressCodeSheetTemp !== "" && (dressCodeSheetTemp !== "Other" || dressCodeSheetCustom.trim() !== "");
                return (
                  <Pressable
                    onPress={() => {
                      if (applyValid) {
                        setDressCode(dressCodeSheetTemp);
                        setDressCodeCustom(dressCodeSheetCustom.trim());
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
                    {option.emoji} {option.label}
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
                  onPress={() => { setCoverKey(opt.key); setEventType(selectedCoverType); setCoverUrl(null); setShowCoverModal(false); }}
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
