import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { configurePurchases } from "../utils/purchases";
import { useCurrency } from "./CurrencyContext";
import { useLanguage } from "./LanguageContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type OAuthProvider = "google" | "apple";

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  subscription_tier?: string;
  subscription_expires_at?: string;
  is_subscription_active?: boolean;
  onboarding_completed?: boolean;
  language?: string;
  currency?: string;
  created_at?: string;
  has_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Sign in with a verified provider ID token (Google/Apple). */
  signInWithProvider: (
    provider: OAuthProvider,
    idToken: string,
    fullName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateOnboarding: (data: { language?: string; currency?: string; onboarding_completed?: boolean }) => Promise<void>;
  startTrial: () => Promise<void>;
  /** Redeem a promo/trial code → grants a free trial (server-validated). */
  redeemCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  /** Refresh entitlement from the billing provider (after purchase/restore). */
  syncBilling: () => Promise<void>;
  /** Update the signed-in user's display name. */
  updateName: (name: string) => Promise<{ success: boolean; error?: string }>;
  /** Change password (email accounts only). */
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // AuthProvider is nested inside Language/CurrencyProvider, so we can drive
  // those contexts to reconcile the user's saved prefs on sign-in.
  const { setCurrency } = useCurrency();
  const { setLanguage } = useLanguage();

  useEffect(() => {
    checkExistingSession();
  }, []);

  // Identify the signed-in user to the billing SDK (RevenueCat appUserID).
  useEffect(() => {
    if (user?.user_id) configurePurchases(user.user_id);
  }, [user?.user_id]);

  const checkExistingSession = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        setUser(response.data);
      }
    } catch (error) {
      await AsyncStorage.removeItem("session_token");
    } finally {
      setLoading(false);
    }
  };

  // Reconcile the device's language/currency with the signed-in account.
  // - If the account already has saved prefs → apply them locally (so the same
  //   choice follows the user across devices / reinstalls).
  // - Otherwise → persist the device's onboarding choices to the account so they
  //   are actually saved (previously onboarding only wrote AsyncStorage).
  const syncPrefsAfterAuth = async (userData: User) => {
    try {
      if (userData.language) await setLanguage(userData.language);
      if (userData.currency) await setCurrency(userData.currency);

      const [locale, curr] = await Promise.all([
        AsyncStorage.getItem("user_locale"),
        AsyncStorage.getItem("user_currency"),
      ]);
      const payload: { language?: string; currency?: string; onboarding_completed?: boolean } = {};
      if (!userData.language && locale) payload.language = locale;
      if (!userData.currency && curr) payload.currency = curr;
      // The device having local onboarding prefs means the user already
      // completed the onboarding-language/currency screens before signing
      // in — mark it done server-side too, regardless of whether language/
      // currency were already synced on a previous (partial) attempt.
      // Without this, OAuth users (who skip /onboarding-trial because
      // they're auto-granted a trial server-side, unlike email/password
      // users whose start-trial call sets this flag) never get
      // onboarding_completed set on the backend, and (app)/_layout.tsx's
      // guard bounces them back to /onboarding-language forever.
      if (userData.onboarding_completed !== true && (locale || curr)) {
        payload.onboarding_completed = true;
      }
      if (Object.keys(payload).length) await updateOnboarding(payload);
    } catch {
      // Best-effort — never block sign-in on preference syncing.
    }
  };

  // Exchange a provider ID token for our own session. The token is verified
  // server-side at /api/auth/oauth/{provider}.
  const signInWithProvider = async (
    provider: OAuthProvider,
    idToken: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/oauth/${provider}`, {
        id_token: idToken,
        full_name: fullName ?? null,
      });
      const { session_token, ...userData } = response.data;
      await AsyncStorage.setItem("session_token", session_token);
      setUser(userData as User);
      await syncPrefsAfterAuth(userData as User);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Sign-in failed";
      return { success: false, error: errorMessage };
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
      const { session_token, ...userData } = response.data;
      await AsyncStorage.setItem("session_token", session_token);
      setUser(userData as User);
      await syncPrefsAfterAuth(userData as User);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Login failed";
      return { success: false, error: errorMessage };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/register`, { name, email, password });
      const { session_token, ...userData } = response.data;
      await AsyncStorage.setItem("session_token", session_token);
      setUser(userData as User);
      await syncPrefsAfterAuth(userData as User);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Registration failed";
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        await axios.post(
          `${BACKEND_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
      await AsyncStorage.removeItem("session_token");
      setUser(null);
    } catch (error) {
      await AsyncStorage.removeItem("session_token");
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        setUser(response.data);
      }
    } catch (error) {
      console.error("Refresh user error:", error);
    }
  };

  const updateOnboarding = async (data: { language?: string; currency?: string; onboarding_completed?: boolean }) => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        await axios.put(`${BACKEND_URL}/api/auth/onboarding`, data, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        setUser((prev) => (prev ? { ...prev, ...data } : null));
      }
    } catch (error) {
      console.error("Update onboarding error:", error);
    }
  };

  const startTrial = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        await axios.post(
          `${BACKEND_URL}/api/auth/start-trial`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        setUser((prev) =>
          prev
            ? { ...prev, subscription_tier: "free_trial", is_subscription_active: true, onboarding_completed: true }
            : null
        );
      }
    } catch (error) {
      console.error("Start trial error:", error);
    }
  };

  const redeemCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await axios.post(
        `${BACKEND_URL}/api/codes/redeem`,
        { code },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      await refreshUser();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.detail || "Redeem failed" };
    }
  };

  const syncBilling = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (!sessionToken) return;
      await axios.post(
        `${BACKEND_URL}/api/billing/sync`,
        {},
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      await refreshUser();
    } catch (error) {
      // Billing not configured or transient error — leave entitlement as-is.
    }
  };

  const updateName = async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.put(
        `${BACKEND_URL}/api/auth/profile`,
        { name },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      const newName = response.data?.name ?? name;
      setUser((prev) => (prev ? { ...prev, name: newName } : null));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.detail || "Update failed" };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await axios.post(
        `${BACKEND_URL}/api/auth/change-password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.detail || "Change password failed" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithProvider,
        loginWithEmail,
        register,
        logout,
        refreshUser,
        updateOnboarding,
        startTrial,
        redeemCode,
        syncBilling,
        updateName,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
