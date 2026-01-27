import React, { createContext, useState, useContext, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiClient } from "../api/client";
import axios, { AxiosError } from "axios";

import { CONFIG } from "../constants/Config";
import { UserProfile } from "../types/auth";
import { oauthService } from "../services/OAuthService";
import { profileStorageManager } from "../services/ProfileStorageManager";

const BACKEND_URL = CONFIG.BACKEND_URL;
const AUTH_URL = "https://auth.emergentagent.com";

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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateOnboarding: (data: { language?: string; currency?: string; onboarding_completed?: boolean }) => Promise<void>;
  startTrial: () => Promise<void>;
  setUser: (user: User | null) => void;
  // New profile management methods
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Handle deep linking (for mobile auth callback)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      await processAuthCallback(url);
    };

    // Check for initial URL (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        processAuthCallback(url);
      }
    });

    // Listen for deep links (hot start)
    const subscription = Linking.addEventListener("url", handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle web auth callback (hash fragment)
  useEffect(() => {
    if (Platform.OS === "web") {
      const hash = window.location.hash;
      if (hash.includes("session_id=")) {
        const url = window.location.href;
        processAuthCallback(url);
      }
    }
  }, []);

  const checkExistingSession = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        // Verify session with backend
        const response = await apiClient.get(`/api/auth/me`);
        const userData = response.data;
        setUser(userData);

        // Load or create profile data for existing user (migration logic)
        await loadUserProfile(userData.user_id);
      }
    } catch (error) {
      console.error('[AuthContext] Session check failed:', error);
      // Session invalid, clear it
      await AsyncStorage.removeItem("session_token");
      
      // Clear any cached profile data for security
      try {
        await profileStorageManager.clearAllProfiles();
      } catch (clearError) {
        console.error('[AuthContext] Failed to clear profiles after session failure:', clearError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to load user profile data
  const loadUserProfile = async (userId: string) => {
    try {
      const storedProfile = await profileStorageManager.loadProfile(userId);
      if (storedProfile) {
        setProfile(storedProfile);
        console.log(`[AuthContext] Profile loaded for user ${userId}`);
      } else {
        console.log(`[AuthContext] No profile found for user ${userId}`);
        
        // Graceful degradation: if no profile exists and we have user data,
        // attempt to create a fallback profile for existing users
        if (user) {
          console.log(`[AuthContext] Creating fallback profile for existing user ${userId}`);
          const fallbackProfile = createFallbackProfileFromUser(user);
          await saveUserProfile(fallbackProfile);
        }
      }
    } catch (error) {
      console.error('[AuthContext] Failed to load profile:', error);
      
      // Graceful degradation: if profile loading fails but we have user data,
      // create a minimal fallback profile to maintain functionality
      if (user) {
        console.warn(`[AuthContext] Profile loading failed, creating fallback profile for user ${userId}`);
        try {
          const fallbackProfile = createFallbackProfileFromUser(user);
          setProfile(fallbackProfile);
          // Don't save the fallback profile if storage is failing
        } catch (fallbackError) {
          console.error('[AuthContext] Failed to create fallback profile:', fallbackError);
          // Continue without profile data - graceful degradation
        }
      }
    }
  };

  // Helper function to save user profile data
  const saveUserProfile = async (profileData: UserProfile) => {
    try {
      await profileStorageManager.saveProfile(profileData);
      setProfile(profileData);
      console.log(`[AuthContext] Profile saved for user ${profileData.id}`);
    } catch (error) {
      console.error('[AuthContext] Failed to save profile:', error);
      
      // Graceful degradation: set profile in memory even if storage fails
      // This allows the app to continue functioning with profile data
      console.warn('[AuthContext] Storage failed, keeping profile in memory only');
      setProfile(profileData);
      
      // Don't throw error to allow authentication to continue
      // In a production app, you might want to show a warning to the user
    }
  };

  // Helper function to create fallback profile from existing user data
  const createFallbackProfileFromUser = (userData: User): UserProfile => {
    const now = new Date();
    return {
      id: userData.user_id,
      displayName: userData.name || userData.email.split('@')[0],
      email: userData.email,
      providerId: userData.user_id,
      providerType: 'google', // Default assumption for existing users
      avatarUrl: userData.picture,
      firstName: undefined,
      lastName: undefined,
      createdAt: now,
      updatedAt: now,
    };
  };

  const processAuthCallback = async (url: string) => {
    try {
      // Extract session_id from URL (support both # and ? formats)
      let sessionId = null;

      if (url.includes("#session_id=")) {
        sessionId = url.split("#session_id=")[1].split("&")[0];
      } else if (url.includes("?session_id=")) {
        sessionId = url.split("?session_id=")[1].split("&")[0];
      }

      if (!sessionId) return;

      // Exchange session_id for session_token
      const response = await apiClient.post(`/api/auth/session`, {
        session_id: sessionId,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);

      // Set user data
      setUser(userData as User);

      // Check if user just completed onboarding preferences but hasn't started trial
      const onboardingPrefsSaved = await AsyncStorage.getItem("onboarding_preferences_saved");
      if (onboardingPrefsSaved === "true" && !userData.onboarding_completed) {
        // Auto-start trial for new users
        try {
          const trialResponse = await apiClient.post(
            `/api/auth/start-trial`,
            {}
          );
          // Update user state with trial info
          setUser(prev => prev ? {
            ...prev,
            subscription_tier: "free_trial",
            is_subscription_active: true,
            onboarding_completed: true
          } : null);
          // Clear the flag
          await AsyncStorage.removeItem("onboarding_preferences_saved");
        } catch (trialError) {
          console.error("Error auto-starting trial:", trialError);
        }
      }

      // Check for initial balance to sync
      const initialBalance = await AsyncStorage.getItem("initial_balance");
      if (initialBalance && initialBalance !== "0") {
        try {
          await axios.post(
            `${BACKEND_URL}/api/transactions`,
            {
              amount: parseFloat(initialBalance),
              category: "Income",
              transaction_type: "income",
              date: new Date().toISOString(),
              description: "Initial Balance",
              merchant: "Opening Balance",
              currency: userData.currency || "USD" // Use user's currency
            },
            { headers: { Authorization: `Bearer ${session_token}` } }
          );
          // Clear it so we don't sync again
          await AsyncStorage.removeItem("initial_balance");
        } catch (balanceError) {
          console.error("Error syncing initial balance:", balanceError);
        }
      }

      // Clean up URL (web only)
      if (Platform.OS === "web") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (error) {
      console.error("Error processing auth callback:", error);
    }
  };

  const login = async () => {
    try {
      // Determine redirect URL based on platform
      const redirectUrl =
        Platform.OS === "web"
          ? (typeof window !== 'undefined' ? window.location.origin + "/" : "/")
          : Linking.createURL("/");

      const authUrl = `${AUTH_URL}/?redirect=${encodeURIComponent(
        redirectUrl
      )}`;

      if (Platform.OS === "web") {
        // For web, redirect directly
        window.location.href = authUrl;
      } else {
        // For mobile, open auth session
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

        if (result.type === "success" && result.url) {
          await processAuthCallback(result.url);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.post(`/api/auth/login`, {
        email,
        password,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);

      // Set user data
      setUser(userData as User);

      // Load or create profile data for existing user (migration logic)
      const existingProfile = await profileStorageManager.loadProfile(userData.user_id);
      
      if (existingProfile) {
        setProfile(existingProfile);
      } else {
        // If no profile exists, create a fallback profile from user data
        const fallbackProfile = createFallbackProfileFromUser(userData as User);
        await saveUserProfile(fallbackProfile);
      }

      // Check for initial balance to sync
      const initialBalance = await AsyncStorage.getItem("initial_balance");
      if (initialBalance && initialBalance !== "0") {
        try {
          await axios.post(
            `${BACKEND_URL}/api/transactions`,
            {
              amount: parseFloat(initialBalance),
              category: "Income",
              transaction_type: "income",
              date: new Date().toISOString(),
              description: "Initial Balance",
              merchant: "Opening Balance",
              currency: userData.currency || "USD" // Use user's currency
            },
            { headers: { Authorization: `Bearer ${session_token}` } }
          );
          // Clear it so we don't sync again
          await AsyncStorage.removeItem("initial_balance");
        } catch (balanceError) {
          console.error("Error syncing initial balance:", balanceError);
        }
      }

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Login failed";
      return { success: false, error: errorMessage };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.post(`/api/auth/register`, {
        name,
        email,
        password,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);

      // Set user data (new user, onboarding not completed)
      setUser(userData as User);

      // Create profile data for new user
      const newUserProfile = createFallbackProfileFromUser(userData as User);
      await saveUserProfile(newUserProfile);

      // Check for initial balance to sync
      const initialBalance = await AsyncStorage.getItem("initial_balance");
      if (initialBalance && initialBalance !== "0") {
        try {
          await axios.post(
            `${BACKEND_URL}/api/transactions`,
            {
              amount: parseFloat(initialBalance),
              category: "Income",
              transaction_type: "income",
              date: new Date().toISOString(),
              description: "Initial Balance",
              merchant: "Opening Balance",
              currency: userData.currency || "USD" // Use user's currency
            },
            { headers: { Authorization: `Bearer ${session_token}` } }
          );
          // Clear it so we don't sync again
          await AsyncStorage.removeItem("initial_balance");
        } catch (balanceError) {
          console.error("Error syncing initial balance:", balanceError);
        }
      }

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
        // Call logout endpoint
        try {
          await apiClient.post(`/api/auth/logout`, {});
        } catch (logoutError) {
          console.error('[AuthContext] Backend logout failed:', logoutError);
          // Continue with local cleanup even if backend logout fails
        }
      }

      // Clear profile data securely
      if (user) {
        try {
          await profileStorageManager.clearProfile(user.user_id);
        } catch (profileError) {
          console.error('[AuthContext] Failed to clear profile data:', profileError);
          // Continue with other cleanup steps
        }
      }

      // Clear local storage
      await AsyncStorage.removeItem("session_token");
      
      // Clear state
      setUser(null);
      setProfile(null);
      
      console.log('[AuthContext] Logout completed successfully');
      
    } catch (error) {
      console.error("Logout error:", error);
      
      // Ensure local cleanup happens even if other steps fail
      try {
        await AsyncStorage.removeItem("session_token");
        
        // Try to clear profile data even if logout failed
        if (user) {
          try {
            await profileStorageManager.clearProfile(user.user_id);
          } catch (profileError) {
            console.error("Failed to clear profile data during error cleanup:", profileError);
          }
        }
        
        setUser(null);
        setProfile(null);
        
      } catch (cleanupError) {
        console.error("Critical error during logout cleanup:", cleanupError);
        // Force clear state even if storage operations fail
        setUser(null);
        setProfile(null);
      }
    }
  };

  const refreshUser = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        const response = await apiClient.get(`/api/auth/me`);
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
        await apiClient.put(
          `/api/auth/onboarding`,
          data
        );

        // Update local user state
        setUser(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (error) {
      console.error("Update onboarding error:", error);
    }
  };

  const startTrial = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      if (sessionToken) {
        const response = await apiClient.post(
          `/api/auth/start-trial`,
          {}
        );

        // Update local user state
        setUser(prev => prev ? {
          ...prev,
          subscription_tier: "free_trial",
          is_subscription_active: true,
          onboarding_completed: true
        } : null);
      }
    } catch (error) {
      console.error("Start trial error:", error);
    }
  };

  // New OAuth authentication methods
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Use OAuthService to authenticate with Google
      const authResult = await oauthService.signInWithGoogle();
      
      // Save profile data using ProfileStorageManager
      await saveUserProfile(authResult.user);
      
      // Create User object for backward compatibility
      const userData: User = {
        user_id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.displayName,
        picture: authResult.user.avatarUrl,
        // Default values for new OAuth users
        subscription_tier: undefined,
        subscription_expires_at: undefined,
        is_subscription_active: false,
        onboarding_completed: false,
        language: undefined,
        currency: undefined,
      };
      
      setUser(userData);
      
      // TODO: Backend integration needed for session token exchange
      // This would typically involve sending the OAuth tokens to backend
      // and receiving a session token in return
      console.log('[AuthContext] Google OAuth successful, backend integration needed for session token');
      
    } catch (error) {
      console.error('[AuthContext] Google sign-in failed:', error);
      
      // Graceful degradation: if profile extraction/storage fails,
      // we can still attempt to continue with basic auth if we have minimal data
      if (error instanceof Error && error.message.includes('profile')) {
        console.warn('[AuthContext] Profile handling failed, attempting graceful degradation');
        // Could implement fallback logic here if needed
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      
      // Use OAuthService to authenticate with Apple
      const authResult = await oauthService.signInWithApple();
      
      // Save profile data using ProfileStorageManager
      await saveUserProfile(authResult.user);
      
      // Create User object for backward compatibility
      const userData: User = {
        user_id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.displayName,
        picture: authResult.user.avatarUrl,
        // Default values for new OAuth users
        subscription_tier: undefined,
        subscription_expires_at: undefined,
        is_subscription_active: false,
        onboarding_completed: false,
        language: undefined,
        currency: undefined,
      };
      
      setUser(userData);
      
      // TODO: Backend integration needed for session token exchange
      // This would typically involve sending the OAuth tokens to backend
      // and receiving a session token in return
      console.log('[AuthContext] Apple OAuth successful, backend integration needed for session token');
      
    } catch (error) {
      console.error('[AuthContext] Apple sign-in failed:', error);
      
      // Graceful degradation: if profile extraction/storage fails,
      // we can still attempt to continue with basic auth if we have minimal data
      if (error instanceof Error && error.message.includes('profile')) {
        console.warn('[AuthContext] Profile handling failed, attempting graceful degradation');
        // Could implement fallback logic here if needed
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user || !profile) {
        throw new Error('No user or profile data available');
      }

      // Validate updates before applying them
      if (updates.email && updates.email !== profile.email) {
        // Email changes might require re-authentication in a real app
        console.warn('[AuthContext] Email change detected, may require re-authentication');
      }

      // Update profile using ProfileStorageManager
      await profileStorageManager.updateProfile(user.user_id, updates);
      
      // Reload profile to get updated data and ensure consistency
      const updatedProfile = await profileStorageManager.loadProfile(user.user_id);
      if (updatedProfile) {
        setProfile(updatedProfile);
        
        // Update User object if display name changed (for backward compatibility)
        if (updates.displayName && updates.displayName !== user.name) {
          setUser(prev => prev ? { ...prev, name: updates.displayName! } : null);
        }
        
        console.log(`[AuthContext] Profile updated successfully for user ${user.user_id}`);
      } else {
        throw new Error('Failed to reload updated profile');
      }
      
    } catch (error) {
      console.error('[AuthContext] Failed to update profile:', error);
      
      // Graceful degradation: attempt to reload current profile to maintain consistency
      try {
        if (user) {
          await loadUserProfile(user.user_id);
        }
      } catch (reloadError) {
        console.error('[AuthContext] Failed to reload profile after update error:', reloadError);
      }
      
      throw error;
    }
  };

  const refreshProfile = async () => {
    try {
      if (!user) {
        console.log('[AuthContext] No user available for profile refresh');
        return;
      }

      await loadUserProfile(user.user_id);
    } catch (error) {
      console.error('[AuthContext] Failed to refresh profile:', error);
      // Don't throw error - graceful degradation
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      login,
      loginWithEmail,
      register,
      logout,
      refreshUser,
      updateOnboarding,
      startTrial,
      setUser,
      // New profile management methods
      signInWithGoogle,
      signInWithApple,
      updateProfile,
      refreshProfile,
    }}>
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
