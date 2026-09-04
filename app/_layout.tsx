import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, Redirect, useSegments, useRootNavigationState } from "expo-router";
import { EventsProvider } from "../src/state/eventsStore";
import { FavoritesProvider } from "../src/state/favoritesStore";
import { onboardingStore } from "../src/state/onboardingStore";
import { syncCurrentProfileFromServer } from "../src/lib/auth";
import { savePushTokenForUser } from "../src/lib/notifications";
import { supabase } from "../src/lib/supabase";
import { colors } from "../src/theme/colors";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const pushTokenRegistrationAttempted = useRef(false);
  const prevRouteGroup = useRef<string | undefined>(undefined);

  const checkOnboarding = async () => {
    const onboarded = await onboardingStore.isOnboarded();
    if (onboarded) {
      syncCurrentProfileFromServer().catch(() => {});
      // Returning OTP users never hit verify again. Register once per launch, and only
      // when a real Supabase session exists (demo / Skip OTP has none → no permission prompt).
      if (!pushTokenRegistrationAttempted.current) {
        pushTokenRegistrationAttempted.current = true;
        void (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            if (!data.session) return;
            const phone = (await onboardingStore.getPhone())?.trim();
            if (!phone) return;
            savePushTokenForUser(phone).catch(() => {});
          } catch {
            // Token registration must never block or crash startup.
          }
        })();
      }
    }
    setIsOnboarded(onboarded);
    setIsLoading(false);
  };

  // After profile Done → home, React still has isOnboarded=false for one paint.
  // That paint would Redirect to Get started. Hold the gate until storage is re-read.
  useLayoutEffect(() => {
    const group = segments[0] as string | undefined;
    if (prevRouteGroup.current !== group) {
      prevRouteGroup.current = group;
      setIsLoading(true);
    }
  }, [segments]);

  useEffect(() => {
    checkOnboarding();
  }, [segments]);

  if (isLoading || !navigationState?.key) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const inOnboarding = segments[0] === "onboarding";
  if (!isOnboarded && !inOnboarding) {
    return <Redirect href="/onboarding" />;
  }
  if (isOnboarded && inOnboarding) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <EventsProvider>
      <FavoritesProvider>
      <OnboardingGate>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: "600",
            },
            headerShadowVisible: false,
            headerBackTitle: "Back",
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          {/* Main screens */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="profile"
            options={{ title: "Profile", headerBackTitle: "Home" }}
          />
          <Stack.Screen
            name="profile/edit"
            options={{ title: "Edit profile", headerBackTitle: "Profile" }}
          />
          <Stack.Screen
            name="profile/saved"
            options={{ title: "Saved", headerBackTitle: "Profile" }}
          />
          <Stack.Screen
            name="profile/about"
            options={{ title: "About", headerBackTitle: "Profile" }}
          />
          <Stack.Screen
            name="events/index"
            options={{ title: "Events", headerBackTitle: "Home" }}
          />
          <Stack.Screen
            name="events/create"
            options={{ title: "Create Event", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="events/[id]"
            options={{
              title: "",
              headerBackTitle: "Events",
              headerTransparent: true,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="events/hosting"
            options={{ title: "Hosting", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="events/going"
            options={{ title: "Going / Pending", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="events/edit/[id]"
            options={{ title: "Edit event", headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="discover"
            options={{ title: "Discover", headerBackTitle: "Home" }}
          />

          {/* Onboarding screens */}
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/value-props" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/phone" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/verify" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/profile" options={{ headerShown: false }} />
        </Stack>
      </OnboardingGate>
      </FavoritesProvider>
    </EventsProvider>
  );
}
