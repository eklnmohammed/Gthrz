import { useState, useCallback } from "react";
import { View, Text, Pressable, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Screen } from "../../src/components/Screen";
import { HeaderBackTextButton } from "../../src/components/HeaderBackTextButton";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { useKeyboardInset } from "../../src/hooks/useKeyboardInset";
import { onboardingStore, UserProfile } from "../../src/state/onboardingStore";
import { uploadAvatar, upsertProfile } from "../../src/lib/auth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

export default function ProfileEditScreen() {
  const keyboardInset = useKeyboardInset();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const [p, ph] = await Promise.all([
      onboardingStore.getProfile(),
      onboardingStore.getPhone(),
    ]);
    setProfile(p);
    setPhone(ph);
    setEditFirstName(p?.firstName ?? "");
    setEditLastName(p?.lastName ?? "");
    setEditAvatarUri(p?.avatarUri ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const sourceUri = result.assets[0].uri;
      try {
        const filename = `avatar_${Date.now()}.jpg`;
        const docUri = FileSystem.documentDirectory;
        const destUri = docUri ? `${docUri}${filename}` : sourceUri;
        if (docUri) await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        setEditAvatarUri(destUri);
      } catch {
        setEditAvatarUri(sourceUri);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!phone) return;
    if (!editFirstName.trim()) {
      Alert.alert("First name required", "Please enter your first name.");
      return;
    }
    setSaving(true);
    try {
      let resolvedAvatarUri: string | undefined = editAvatarUri ?? undefined;
      if (editAvatarUri && !editAvatarUri.startsWith("http")) {
        const uploadResult = await uploadAvatar(editAvatarUri, phone);
        if ("error" in uploadResult) {
          Alert.alert("Avatar upload failed", uploadResult.error);
          setSaving(false);
          return;
        }
        resolvedAvatarUri = uploadResult.url;
      }

      const updated: UserProfile = {
        firstName: editFirstName.trim() || profile?.firstName || "",
        lastName: editLastName.trim() || profile?.lastName || "",
        phone,
        avatarUri: resolvedAvatarUri,
      };
      await onboardingStore.saveProfile(updated);
      await onboardingStore.saveProfileForPhone(phone, updated);

      const fullName = [updated.firstName, updated.lastName].filter(Boolean).join(" ");
      const upsert = await upsertProfile({ phone, fullName, avatarUrl: resolvedAvatarUri });
      if (upsert.error) {
        Alert.alert("Profile save failed", upsert.error);
        setSaving(false);
        return;
      }

      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const isValid = editFirstName.trim().length > 0;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackTextButton label="Back" onPress={() => router.back()} />
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: spacing.xl,
          paddingBottom: spacing.xxl + keyboardInset,
        }}
      >
        {/* Avatar + form */}
        <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
          <View style={{ position: "relative", marginBottom: spacing.lg }}>
            <Pressable
              onPress={handlePickImage}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: colors.surfaceLight,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {editAvatarUri ? (
                <Image
                  source={{ uri: editAvatarUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 32 }}>
                  {editFirstName?.charAt(0)?.toUpperCase() || "👤"}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={handlePickImage}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            >
              <Text style={{ fontSize: 14 }}>📷</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: spacing.lg, marginBottom: spacing.xxl }}>
          <AppInput
            label="First name"
            value={editFirstName}
            onChangeText={setEditFirstName}
            placeholder="First name"
          />
          <AppInput
            label="Last name"
            value={editLastName}
            onChangeText={setEditLastName}
            placeholder="Last name"
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <AppButton
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={{ flex: 1 }}
          />
          <AppButton
            title="Save changes"
            onPress={handleSaveProfile}
            disabled={!isValid || saving}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
