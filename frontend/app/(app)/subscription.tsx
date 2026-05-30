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
import { useLanguage } from "../../contexts/LanguageContext";
import { findPackage, purchasePackage, restorePurchases, billingAvailable } from "../../utils/purchases";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

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

// tagline/feature text are translation keys resolved with t() at render time.
const TIERS = [
  {
    id: "basic",
    name: "Basic",
    tagline: "subscription.tagBasic",
    monthlyPrice: 1.99,
    yearlyPrice: 19.99,
    features: [
      { icon: "chatbubble", text: "subscription.featChat30" },
      { icon: "document-text", text: "subscription.featUploads20" },
      { icon: "stats-chart", text: "subscription.featFullAnalytics" },
      { icon: "headset", text: "subscription.featPrioritySupport" },
    ],
    color: "#4DB6AC",
    isFree: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "subscription.tagPro",
    monthlyPrice: 4.99,
    yearlyPrice: 49.99,
    features: [
      { icon: "chatbubble", text: "subscription.featChat100" },
      { icon: "document-text", text: "subscription.featUploads100" },
      { icon: "stats-chart", text: "subscription.featAdvancedAnalytics" },
      { icon: "headset", text: "subscription.featPrioritySupport" },
    ],
    color: "#4DB6AC",
    mostPopular: true,
  },
  {
    id: "power",
    name: "Power",
    tagline: "subscription.tagPower",
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: [
      { icon: "infinite", text: "subscription.featUnlimitedChat" },
      { icon: "infinite", text: "subscription.featUnlimitedUploads" },
      { icon: "stats-chart", text: "subscription.featAllFeatures" },
      { icon: "headset", text: "subscription.featVipSupport" },
    ],
    color: "#1E3A8A",
    isDark: true,
    isUnlimited: true,
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, logout, syncBilling } = useAuth();
  const { t } = useLanguage();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );

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

  const handleUpgrade = async (tierId: string, tierName: string) => {
    if (!billingAvailable()) {
      Alert.alert(t("subscription.subscription"), t("subscription.billingUnavailable"));
      return;
    }
    const productId = `${tierId}_${billingPeriod === "monthly" ? "monthly" : "yearly"}`;
    setPurchasing(true);
    try {
      const pkg = await findPackage(productId);
      if (!pkg) {
        Alert.alert(t("subscription.subscription"), t("subscription.billingUnavailable"));
        return;
      }
      const r = await purchasePackage(pkg);
      if (r.cancelled) return;
      if (!r.success) {
        Alert.alert(t("common.error"), r.error || t("subscription.purchaseFailed"));
        return;
      }
      await syncBilling();
      await fetchSubscription();
      Alert.alert(t("common.success"), t("subscription.purchaseSuccess"));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!billingAvailable()) {
      Alert.alert(t("subscription.subscription"), t("subscription.billingUnavailable"));
      return;
    }
    setPurchasing(true);
    try {
      const r = await restorePurchases();
      if (!r.success) {
        Alert.alert(t("common.error"), r.error || t("subscription.purchaseFailed"));
        return;
      }
      await syncBilling();
      await fetchSubscription();
      Alert.alert(t("common.success"), t("subscription.restored"));
    } finally {
      setPurchasing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const getPrice = (tier: any) => {
    return billingPeriod === "monthly"
      ? `$${tier.monthlyPrice.toFixed(2)}`
      : `$${tier.yearlyPrice.toFixed(2)}`;
  };

  const getPeriod = () =>
    billingPeriod === "monthly"
      ? t("subscription.perMonth")
      : t("subscription.perYear");

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
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
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.subscription')}</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>{t('subscription.choosePlan')}</Text>
          <Text style={styles.subtitle}>
            {t('subscription.choosePlanSubtitle')}
          </Text>
        </View>

        {/* Billing Period Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              billingPeriod === "monthly" && styles.toggleButtonActive,
            ]}
            onPress={() => setBillingPeriod("monthly")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                billingPeriod === "monthly" && styles.toggleTextActive,
              ]}
            >
              {t('subscription.monthly')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              billingPeriod === "yearly" && styles.toggleButtonActive,
            ]}
            onPress={() => setBillingPeriod("yearly")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                billingPeriod === "yearly" && styles.toggleTextActive,
              ]}
            >
              {t('subscription.yearly')}
            </Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{t('subscription.save20')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Pricing Cards */}
        <View style={styles.tiersContainer}>
          {TIERS.map((tier, index) => {
            const isCurrentPlan =
              subscription?.tier === tier.id ||
              (subscription?.tier === "free_trial" && tier.id === "basic");

            return (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  tier.isDark && styles.tierCardDark,
                  tier.mostPopular && styles.tierCardPopular,
                ]}
              >
                {/* Badges */}
                {tier.mostPopular && (
                  <View style={styles.mostPopularBadge}>
                    <Text style={styles.mostPopularText}>{t('subscription.mostPopular')}</Text>
                  </View>
                )}
                {tier.isUnlimited && (
                  <View style={styles.unlimitedBadge}>
                    <Text style={styles.unlimitedText}>{t('subscription.unlimited')}</Text>
                  </View>
                )}
                {isCurrentPlan && (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanText}>{t('subscription.currentPlan')}</Text>
                  </View>
                )}

                <View style={styles.tierHeader}>
                  <View style={styles.tierInfo}>
                    <Text
                      style={[
                        styles.tierName,
                        tier.isDark && styles.tierNameDark,
                      ]}
                    >
                      {tier.name}
                    </Text>
                    <Text
                      style={[
                        styles.tierTagline,
                        tier.isDark && styles.tierTaglineDark,
                      ]}
                    >
                      {t(tier.tagline)}
                    </Text>
                  </View>
                  <View style={styles.tierPricing}>
                    <Text
                      style={[
                        styles.tierPrice,
                        tier.isDark && styles.tierPriceDark,
                      ]}
                    >
                      {getPrice(tier)}
                    </Text>
                    {!tier.isFree && (
                      <Text
                        style={[
                          styles.tierPeriod,
                          tier.isDark && styles.tierPeriodDark,
                        ]}
                      >
                        {getPeriod()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                  {tier.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <Ionicons
                        name={feature.icon}
                        size={18}
                        color={tier.isDark ? "#FCD34D" : "#4DB6AC"}
                      />
                      <Text
                        style={[
                          styles.featureText,
                          tier.isDark && styles.featureTextDark,
                        ]}
                      >
                        {t(feature.text)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* CTA Button */}
                {isCurrentPlan ? (
                  <View style={styles.currentPlanButton}>
                    <Text style={styles.currentPlanButtonText}>
                      {t('subscription.currentPlan')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleUpgrade(tier.id, tier.name)}
                    activeOpacity={0.8}
                  >
                    {tier.isDark ? (
                      <View style={styles.powerButton}>
                        <Text style={styles.powerButtonText}>
                          {t('subscription.getPlan', { plan: tier.name })}
                        </Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={["#4DB6AC", "#45A599"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.upgradeButton}
                      >
                        <Text style={styles.upgradeButtonText}>
                          {t('subscription.upgradeTo', { plan: tier.name })}
                        </Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Account Info */}
        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>{t('subscription.accountInfo')}</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>{t('subscription.name')}</Text>
            <Text style={styles.accountValue}>{user?.name}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>{t('subscription.email')}</Text>
            <Text style={styles.accountValue}>{user?.email}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={styles.restoreText}>{t('subscription.restore')}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t('subscription.disclaimer')}
        </Text>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)")}
        >
          <Ionicons name="home-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>{t('nav.home')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/history")}
        >
          <Ionicons name="list-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>{t('nav.transactions')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItemCenter}>
          <View style={styles.navCenterButton}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/insights")}
        >
          <Ionicons name="analytics-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>{t('nav.analytics')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#4DB6AC" />
          <Text style={[styles.navText, styles.navTextActive]}>{t('nav.profile')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: "#fff",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleTextActive: {
    color: "#1F2937",
  },
  discountBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  tiersContainer: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  tierCardPopular: {
    borderColor: "#4DB6AC",
    borderWidth: 2,
  },
  tierCardDark: {
    backgroundColor: "#1E3A8A",
  },
  mostPopularBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: "#4DB6AC",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mostPopularText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  unlimitedBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#FCD34D",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlimitedText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  currentPlanBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentPlanText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  tierNameDark: {
    color: "#fff",
  },
  tierTagline: {
    fontSize: 13,
    color: "#6B7280",
  },
  tierTaglineDark: {
    color: "#93C5FD",
  },
  tierPricing: {
    alignItems: "flex-end",
  },
  tierPrice: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1F2937",
  },
  tierPriceDark: {
    color: "#FCD34D",
  },
  tierPeriod: {
    fontSize: 14,
    color: "#6B7280",
  },
  tierPeriodDark: {
    color: "#93C5FD",
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
  },
  featureTextDark: {
    color: "#E5E7EB",
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  powerButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  powerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E3A8A",
  },
  currentPlanButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  currentPlanButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  accountLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  accountValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  disclaimer: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 4,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4DB6AC",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: 8,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navItemCenter: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
    elevation: 4,
    shadowColor: "#4DB6AC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  navText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  navTextActive: {
    color: "#4DB6AC",
    fontWeight: "600",
  },
});
