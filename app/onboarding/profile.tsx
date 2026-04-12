import { useState } from "react";
import { View, Text, Pressable, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Screen } from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { useKeyboardInset } from "../../src/hooks/useKeyboardInset";
import { onboardingStore } from "../../src/state/onboardingStore";
import { upsertProfile, uploadAvatar } from "../../src/lib/auth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const isValid = firstName.trim().length > 0;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to add a profile picture.");
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
        setAvatarUri(destUri);
      } catch {
        setAvatarUri(sourceUri);
      }
    }
  };

  const handleComplete = async () => {
    if (!isValid) return;

    const phone = await onboardingStore.getPhone();
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

    let remoteAvatarUrl: string | undefined;
    if (avatarUri && phone) {
      const uploadResult = await uploadAvatar(avatarUri, phone);
      if ("error" in uploadResult) {
        Alert.alert("Avatar upload failed", uploadResult.error);
        return;
      }
      remoteAvatarUrl = uploadResult.url;
    }

    const profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || undefined,
      avatarUri: remoteAvatarUrl || avatarUri || undefined,
    };
    await onboardingStore.saveProfile(profile);
    if (phone) {
      await onboardingStore.saveProfileForPhone(phone, profile);
      const upsert = await upsertProfile({ phone, fullName, avatarUrl: remoteAvatarUrl });
      if (upsert.error) {
        Alert.alert("Profile save failed", upsert.error);
        return;
      }
    }

    await onboardingStore.setOnboarded(true);
    router.replace("/");
  };

  return (
    <Screen topPadding={insets.top + spacing.xxxxl + spacing.md}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: spacing.xl + keyboardInset,
        }}
      >
      <View style={{ flex: 1, position: "relative", minHeight: 480 }}>
        <View
          style={{
            flex: 1,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
          }}
        >
          {/* Header */}
          <View style={{ marginBottom: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
                color: colors.text,
              }}
            >
              Your profile
            </Text>
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: colors.textMuted,
                marginTop: spacing.xs,
              }}
            >
              Help your friends recognize you at events.
            </Text>
          </View>

          {/* Avatar: upload photo */}
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <View style={{ position: "relative" }}>
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
                  borderColor: avatarUri ? colors.border : colors.primary,
                  borderStyle: "dashed",
                  overflow: "hidden",
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>📷</Text>
                )}
              </Pressable>
              {!avatarUri && (
                <View
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
                  }}
                >
                  <Text style={{ fontSize: 18, color: colors.text, fontWeight: "600" }}>+</Text>
                </View>
              )}
            </View>
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                color: colors.text,
                marginTop: spacing.md,
              }}
            >
              Add a photo
            </Text>
            <Text
              style={{
                fontSize: typography.sizes.xs,
                color: colors.textMuted,
                marginTop: spacing.xs,
              }}
            >
              Optional
            </Text>
          </View>

          {/* Form inputs */}
          <View style={{ gap: spacing.lg }}>
            <AppInput
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
            />

            <AppInput
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
            />
          </View>

          {/* Complete button */}
          <View style={{ marginTop: spacing.xxl }}>
            <AppButton
              title="Done"
              onPress={handleComplete}
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isValid}
            />
          </View>
        </View>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
