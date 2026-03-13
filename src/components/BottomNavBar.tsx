import { View, Text, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";

interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "🏠", label: "Home" },
  { icon: "🔍", label: "Discover" },
  { icon: "➕", label: "Create" },
  { icon: "📅", label: "Events" },
  { icon: "👤", label: "Profile" },
];

interface BottomNavBarProps {
  onCreatePress?: () => void;
  onEventsPress?: () => void;
  onProfilePress?: () => void;
  onDiscoverPress?: () => void;
  activeLabel?: string;
}

export function BottomNavBar({
  onCreatePress,
  onEventsPress,
  onProfilePress,
  onDiscoverPress,
  activeLabel = "Home",
}: BottomNavBarProps) {
  const handlePress = (item: NavItem) => {
    if (item.label === "Create" && onCreatePress) {
      onCreatePress();
    } else if (item.label === "Events" && onEventsPress) {
      onEventsPress();
    } else if (item.label === "Profile" && onProfilePress) {
      onProfilePress();
    } else if (item.label === "Discover" && onDiscoverPress) {
      onDiscoverPress();
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
      }}
    >
      {NAV_ITEMS.map((item, index) => {
        const isActive = activeLabel === item.label;
        return (
          <Pressable
            key={index}
            onPress={() => handlePress(item)}
            style={{
              flex: 1,
              alignItems: "center",
            }}
          >
            <View
              style={{
                alignItems: "center",
                gap: spacing.xs,
                backgroundColor: isActive ? "rgba(123, 104, 238, 0.15)" : "transparent",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
              }}
            >
              <Text style={{ fontSize: 26 }}>{item.icon}</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: isActive ? colors.primary : colors.textMuted,
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
