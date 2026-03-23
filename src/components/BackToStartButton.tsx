import { useRouter } from "expo-router";
import { HeaderBackTextButton } from "./HeaderBackTextButton";

/**
 * Onboarding back: goes to the previous screen in the stack.
 * Works correctly because each onboarding screen is pushed (not replaced),
 * and verify replaces itself with profile — so the stack always reflects
 * the true previous step.
 */
export function BackToStartButton() {
  const router = useRouter();

  return (
    <HeaderBackTextButton
      label="Back"
      onPress={() => router.back()}
    />
  );
}
