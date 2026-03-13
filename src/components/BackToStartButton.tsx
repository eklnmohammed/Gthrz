import { useRouter } from "expo-router";
import { HeaderBackTextButton } from "./HeaderBackTextButton";

/**
 * Onboarding back: same look as other header back buttons (chevron + text, no pill).
 */
export function BackToStartButton() {
  const router = useRouter();
  return (
    <HeaderBackTextButton
      label="Back"
      onPress={() => router.replace("/onboarding")}
    />
  );
}
