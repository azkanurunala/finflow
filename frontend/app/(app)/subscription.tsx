import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SubscriptionInfo {
  tier: string;
  tier_name: string;
  is_active: boolean;
  expires_at?: string;
  days_remaining?: number;
  limits: any;
  usage: {
    chat_count: number;
    ocr_count: number;
    voice_minutes: number;
    total_actions: number;
  };
}

const TIERS = [
  {
    id: "basic",
    name: "Basic",
    price: "Rp79.000",
    features: [
      "150 minutes audio",
      "150 OCR scans",
      "300 chat messages",
      "Export reports",
    ],
    color: "#667eea",
  },
  {
    id: "pro",
    name: "Pro",
    price: "Rp129.000",
    features: [
      "300 minutes audio",
      "300 OCR scans",
      "600 chat messages",
      "AI Financial Analysis",
      "Priority queue",
    ],
    color: "#f093fb",
    recommended: true,
  },
  {
    id: "power",
    name: "Power",
    price: "Rp199.000",
    features: [
      "600 minutes audio",
      "1,000 OCR scans",
      "1,500 chat messages",
      "Advanced insights",
      "Forecast & predictions",
    ],
    color: "#4facfe",
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.get(`${BACKEND_URL}/api/subscription`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setSubscription(response.data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (tierId: string) => {
    Alert.alert(
      "Upgrade Subscription",
      "In-app purchases will be available soon. This will integrate with Google Play and App Store billing.",
      [{ text: "OK" }]
    );
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Plan */}
        <View style={styles.currentPlanCard}>
          <View style={styles.currentPlanHeader}>
            <View>
              <Text style={styles.currentPlanLabel}>Current Plan</Text>
              <Text style={styles.currentPlanName}>
                {subscription?.tier_name}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                subscription?.is_active
                  ? styles.statusActive
                  : styles.statusInactive,
              ]}
            >
              <Text style={styles.statusText}>
                {subscription?.is_active ? "Active" : "Expired"}
              </Text>
            </View>
          </View>

          {subscription?.tier === "free_trial" && (
            <View style={styles.trialInfo}>
              <Ionicons name="time-outline" size={16} color="#10b981" />
              <Text style={styles.trialText}>
                {subscription.days_remaining} days remaining in free trial
              </Text>
            </View>
          )}

          {/* Usage Stats */}
          <View style={styles.usageStats}>
            <Text style={styles.usageTitle}>Today's Usage</Text>
            <View style={styles.usageGrid}>
              <View style={styles.usageItem}>
                <Ionicons name="chatbubble" size={16} color="#667eea" />
                <Text style={styles.usageValue}>
                  {subscription?.usage.chat_count}
                </Text>
                <Text style={styles.usageLabel}>Chat</Text>
              </View>
              <View style={styles.usageItem}>
                <Ionicons name="camera" size={16} color="#667eea" />
                <Text style={styles.usageValue}>
                  {subscription?.usage.ocr_count}
                </Text>
                <Text style={styles.usageLabel}>OCR</Text>
              </View>
              <View style={styles.usageItem}>
                <Ionicons name="mic" size={16} color="#667eea" />
                <Text style={styles.usageValue}>
                  {subscription?.usage.voice_minutes.toFixed(1)}
                </Text>
                <Text style={styles.usageLabel}>Min</Text>
              </View>
              <View style={styles.usageItem}>
                <Ionicons name="flash" size={16} color="#667eea" />
                <Text style={styles.usageValue}>
                  {subscription?.usage.total_actions}
                </Text>
                <Text style={styles.usageLabel}>Total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription Tiers */}
        <Text style={styles.sectionTitle}>Upgrade Your Plan</Text>

        {TIERS.map((tier) => (
          <View
            key={tier.id}
            style={[
              styles.tierCard,
              tier.recommended && styles.tierCardRecommended,
            ]}
          >
            {tier.recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
            )}

            <View style={styles.tierHeader}>
              <View>
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.tierPrice}>{tier.price}/month</Text>
              </View>
              <View
                style={[
                  styles.tierIcon,
                  { backgroundColor: `${tier.color}20` },
                ]}
              >
                <Ionicons name="star" size={24} color={tier.color} />
              </View>
            </View>

            <View style={styles.tierFeatures}>
              {tier.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={tier.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.upgradeButton,
                { backgroundColor: tier.color },
                tier.recommended && styles.upgradeButtonRecommended,
              ]}
              onPress={() => handleUpgrade(tier.id)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to {tier.name}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* User Info */}
        <View style={styles.userInfoCard}>
          <Text style={styles.userInfoTitle}>Account</Text>
          <View style={styles.userInfoRow}>
            <Text style={styles.userInfoLabel}>Email</Text>
            <Text style={styles.userInfoValue}>{user?.email}</Text>
          </View>
          <View style={styles.userInfoRow}>
            <Text style={styles.userInfoLabel}>Name</Text>
            <Text style={styles.userInfoValue}>{user?.name}</Text>
          </View>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentPlanCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  currentPlanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  currentPlanLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  statusInactive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  trialInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  trialText: {
    fontSize: 14,
    color: "#10b981",
  },
  usageStats: {
    marginTop: 8,
  },
  usageTitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 12,
  },
  usageGrid: {
    flexDirection: "row",
    gap: 12,
  },
  usageItem: {
    flex: 1,
    backgroundColor: "rgba(102, 126, 234, 0.1)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    gap: 4,
  },
  usageValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  usageLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    position: "relative",
  },
  tierCardRecommended: {
    borderWidth: 2,
    borderColor: "#f093fb",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: "#f093fb",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  tierName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  tierPrice: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tierFeatures: {
    gap: 12,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: "#e2e8f0",
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  upgradeButtonRecommended: {
    shadowColor: "#f093fb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  userInfoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  userInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  userInfoLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  userInfoValue: {
    fontSize: 14,
    color: "#fff",
  },
});
