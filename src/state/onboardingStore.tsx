import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "gthrz_onboarded";
const PHONE_KEY = "gthrz_phone";
const PROFILE_KEY = "gthrz_profile";
const PROFILES_BY_PHONE_KEY = "gthrz_profiles_by_phone";

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUri?: string;
}

export const onboardingStore = {
  // Check if user has completed onboarding
  async isOnboarded(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_KEY);
      return value === "true";
    } catch {
      // If we can't read, default to showing onboarding
      return false;
    }
  },

  // Mark onboarding as complete
  async setOnboarded(value: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, value ? "true" : "false");
    } catch (error) {
      console.error("Failed to save onboarding state:", error);
    }
  },

  // Save phone number temporarily
  async savePhone(phone: string): Promise<void> {
    try {
      await AsyncStorage.setItem(PHONE_KEY, phone);
    } catch (error) {
      console.error("Failed to save phone:", error);
    }
  },

  // Get saved phone number
  async getPhone(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PHONE_KEY);
    } catch {
      return null;
    }
  },

  // Save user profile
  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  },

  // Get user profile
  async getProfile(): Promise<UserProfile | null> {
    try {
      const value = await AsyncStorage.getItem(PROFILE_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  // Get profile by phone (for returning users)
  async getProfileForPhone(phone: string): Promise<UserProfile | null> {
    try {
      const value = await AsyncStorage.getItem(PROFILES_BY_PHONE_KEY);
      const map = value ? JSON.parse(value) : {};
      return map[phone] || null;
    } catch {
      return null;
    }
  },

  // Save profile for a phone (so we can restore on login)
  async saveProfileForPhone(phone: string, profile: UserProfile): Promise<void> {
    try {
      const value = await AsyncStorage.getItem(PROFILES_BY_PHONE_KEY);
      const map = value ? JSON.parse(value) : {};
      map[phone] = profile;
      await AsyncStorage.setItem(PROFILES_BY_PHONE_KEY, JSON.stringify(map));
    } catch (error) {
      console.error("Failed to save profile for phone:", error);
    }
  },

  // Reset current session (keeps profiles by phone for login)
  async reset(): Promise<void> {
    try {
      // Before clearing, migrate current profile to profiles-by-phone so login can find it
      const [phone, profile] = await Promise.all([
        AsyncStorage.getItem(PHONE_KEY),
        AsyncStorage.getItem(PROFILE_KEY),
      ]);
      if (phone && profile) {
        const parsed = JSON.parse(profile) as UserProfile;
        const existingMap = await AsyncStorage.getItem(PROFILES_BY_PHONE_KEY);
        const map = existingMap ? JSON.parse(existingMap) : {};
        map[phone] = parsed;
        await AsyncStorage.setItem(PROFILES_BY_PHONE_KEY, JSON.stringify(map));
      }

      await AsyncStorage.multiRemove([ONBOARDING_KEY, PHONE_KEY, PROFILE_KEY]);
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
    }
  },

  // Reset all onboarding data including profiles by phone (for testing)
  async resetAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        ONBOARDING_KEY,
        PHONE_KEY,
        PROFILE_KEY,
        PROFILES_BY_PHONE_KEY,
      ]);
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
    }
  },
};
