import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem("user_locale");
      const savedCurrency = await AsyncStorage.getItem("user_currency");
      const onboardingDone = await AsyncStorage.getItem("onboarding_complete");
      
      // If onboarding was explicitly marked complete, skip onboarding
      if (onboardingDone === "true") {
        setOnboardingComplete(true);
      } else if (savedLanguage && savedCurrency) {
        // If both are set, mark onboarding as complete
        await AsyncStorage.setItem("onboarding_complete", "true");
        setOnboardingComplete(true);
      } else {
        setOnboardingComplete(false);
      }
    } catch (error) {
      console.error("Error checking onboarding:", error);
      setOnboardingComplete(false);
    } finally {
      setChecking(false);
    }
  };

  if (loading || checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // Step 1: Complete onboarding first
  if (!onboardingComplete) {
    return <Redirect href="/onboarding-language" />;
  }

  // Step 2: Must login/register
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Step 3: Check subscription status
  if (!user.is_subscription_active) {
    return <Redirect href="/onboarding-trial" />;
  }

  // Step 4: Go to home
  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
});
