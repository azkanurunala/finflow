import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const { user, loading } = useAuth();
  const [showFreeTrial, setShowFreeTrial] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkFirstTime();
  }, [user]);

  const checkFirstTime = async () => {
    if (user) {
      // Check if user has seen free trial page
      const hasSeenFreeTrial = await AsyncStorage.getItem("has_seen_free_trial");
      if (!hasSeenFreeTrial) {
        await AsyncStorage.setItem("has_seen_free_trial", "true");
        setShowFreeTrial(true);
      }
    }
    setChecking(false);
  };

  if (loading || checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  // Redirect based on auth state
  if (user) {
    if (showFreeTrial) {
      return <Redirect href="/free-trial" />;
    }
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0E27",
    justifyContent: "center",
    alignItems: "center",
  },
});
