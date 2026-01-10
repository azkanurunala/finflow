import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasLanguage, setHasLanguage] = useState(false);
  const [hasCurrency, setHasCurrency] = useState(false);

  useEffect(() => {
    checkPreferences();
  }, []);

  const checkPreferences = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem("user_locale");
      const savedCurrency = await AsyncStorage.getItem("user_currency");
      
      setHasLanguage(!!savedLanguage);
      setHasCurrency(!!savedCurrency);
    } catch (error) {
      console.error("Error checking preferences:", error);
    } finally {
      setChecking(false);
    }
  };

  if (loading || checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  // Step 1: Must select language first
  if (!hasLanguage) {
    return <Redirect href="/onboarding-language" />;
  }

  // Step 2: Must select currency second
  if (!hasCurrency) {
    return <Redirect href="/onboarding-currency" />;
  }

  // Step 3: Must login/register
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Step 4: Check subscription status
  if (!user.is_subscription_active) {
    return <Redirect href="/onboarding-trial" />;
  }

  // Step 5: Go to home
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
