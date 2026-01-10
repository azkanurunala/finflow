import React, { createContext, useState, useContext, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import axios from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
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
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateOnboarding: (data: { language?: string; currency?: string; onboarding_completed?: boolean }) => Promise<void>;
  startTrial: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
        const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        setUser(response.data);
      }
    } catch (error) {
      // Session invalid, clear it
      await AsyncStorage.removeItem("session_token");
    } finally {
      setLoading(false);
    }
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
      const response = await axios.post(`${BACKEND_URL}/api/auth/session`, {
        session_id: sessionId,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);
      
      // Set user data
      setUser(userData as User);

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
          ? `${BACKEND_URL}/`
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
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);
      
      // Set user data
      setUser(userData as User);

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Login failed";
      return { success: false, error: errorMessage };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        name,
        email,
        password,
      });

      const { session_token, ...userData } = response.data;

      // Store session token
      await AsyncStorage.setItem("session_token", session_token);
      
      // Set user data (new user, onboarding not completed)
      setUser(userData as User);

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
        await axios.post(
          `${BACKEND_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
      
      // Clear local storage
      await AsyncStorage.removeItem("session_token");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      // Clear local storage anyway
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
        await axios.put(
          `${BACKEND_URL}/api/auth/onboarding`,
          data,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
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
        const response = await axios.post(
          `${BACKEND_URL}/api/auth/start-trial`,
          {},
          { headers: { Authorization: `Bearer ${sessionToken}` } }
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      loginWithEmail,
      register,
      logout, 
      refreshUser,
      updateOnboarding,
      startTrial
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
