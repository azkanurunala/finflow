import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, login } = useAuth();

  useEffect(() => {
    // If user is already logged in, redirect to app
    if (user && !loading) {
      router.replace("/(app)");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="wallet" size={64} color="#667eea" />
          <Text style={styles.title}>AI Finance</Text>
          <Text style={styles.subtitle}>
            Smart expense tracking with AI
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#667eea" />
            <Text style={styles.featureText}>
              Chat naturally to log expenses
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="camera" size={24} color="#667eea" />
            <Text style={styles.featureText}>
              Scan receipts automatically
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="stats-chart" size={24} color="#667eea" />
            <Text style={styles.featureText}>
              Get AI-powered insights
            </Text>
          </View>
        </View>

        <View style={styles.trialBanner}>
          <Ionicons name="gift" size={20} color="#10b981" />
          <Text style={styles.trialText}>
            Start with 3-day free trial • 10 actions/day
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.googleButton} onPress={login}>
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.appleButton, styles.buttonDisabled]}
            disabled
          >
            <Ionicons name="logo-apple" size={20} color="#64748b" />
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
            <Text style={styles.comingSoonText}>(Coming Soon)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E27",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0E27",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 8,
  },
  features: {
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 15,
    color: "#e2e8f0",
    flex: 1,
  },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginBottom: 32,
  },
  trialText: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "600",
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#667eea",
    paddingVertical: 16,
    borderRadius: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    borderRadius: 12,
    position: "relative",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  comingSoonText: {
    fontSize: 12,
    color: "#64748b",
    position: "absolute",
    bottom: 4,
    right: 12,
  },
  termsText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
