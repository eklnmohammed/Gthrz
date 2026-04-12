import {
  View,
  Text,
  Pressable,
  ImageBackground,
  StyleSheet,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatEventDate } from "@/src/utils/formatEventDate";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_HERO_RADIUS } from "./eventFormTokens";

export type EventFormHeroProps = {
  heroWidth: number;
  /** `null`: branded abstract gradient (no preset image). */
  coverSource: ImageSourcePropType | null;
  title: string;
  selectedDate: Date | null;
  onPressChangeCover: () => void;
  /** Shown when title is empty (Create). Edit can pass the same for consistency. */
  placeholderTitle?: string;
};

export function EventFormHero({
  heroWidth,
  coverSource,
  title,
  selectedDate,
  onPressChangeCover,
  placeholderTitle = "Your event title",
}: EventFormHeroProps) {
  return (
    <View
      style={{
        width: heroWidth,
        alignSelf: "center",
        aspectRatio: 1,
        borderRadius: EVENT_FORM_HERO_RADIUS,
        overflow: "hidden",
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
      }}
    >
      <View style={{ width: "100%", height: "100%" }}>
        {coverSource == null ? (
          <>
            <LinearGradient
              colors={[...colors.heroGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(123, 104, 238, 0.38)", "rgba(123, 104, 238, 0.06)", "transparent"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.15, y: 0.55 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.45)"]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </>
        ) : (
          <ImageBackground source={coverSource} resizeMode="cover" style={StyleSheet.absoluteFillObject}>
            <View style={{ flex: 1 }} />
          </ImageBackground>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "28%" }}
        />
        <View style={{ position: "absolute", top: spacing.md, right: spacing.md }}>
          <Pressable
            onPress={onPressChangeCover}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 14 }}>📷</Text>
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
            gap: spacing.xs,
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.bold,
              color: "#fff",
              lineHeight: 32,
            }}
            numberOfLines={2}
          >
            {title.trim() ? title : placeholderTitle}
          </Text>
          {selectedDate ? (
            <Text
              style={{
                fontSize: typography.sizes.sm,
                color: "rgba(255,255,255,0.85)",
                fontWeight: typography.weights.medium,
              }}
            >
              {formatEventDate(selectedDate.toISOString())}
            </Text>
          ) : (
            <Text style={{ fontSize: typography.sizes.sm, color: "rgba(255,255,255,0.55)" }}>Date & time not set</Text>
          )}
        </View>
      </View>
    </View>
  );
}
