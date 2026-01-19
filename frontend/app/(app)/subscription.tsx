import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { apiClient } from "../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CONFIG } from "../../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

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

// Packages moved into component to use translation hook


export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const PACKAGES = [
    {
      id: "trial",
      productId: null,
      name: t('subscription.plans.trial.name'),
      tagline: t('subscription.plans.trial.tagline'),
      price: "Free",
      priceValue: 0,
      period: t('subscription.periods.days14'),
      features: [
        { icon: "infinite", text: t('subscription.features.fullAccess'), highlight: true },
        { icon: "chatbubble", text: t('subscription.features.unlimitedChat') },
        { icon: "mic", text: t('subscription.features.audioTrial') },
        { icon: "camera", text: t('subscription.features.ocrTrial') },
      ],
      color: "#10B981",
      isTrial: true,
    },
    {
      id: "basic",
      productId: "com.finflow.subscription.basic",
      name: t('subscription.plans.basic.name'),
      tagline: t('subscription.plans.basic.tagline'),
      price: "$2.99",
      priceValue: 2.99,
      period: t('subscription.periods.month'),
      features: [
        { icon: "chatbubble", text: t('subscription.features.unlimitedChat'), highlight: true },
        { icon: "mic", text: t('subscription.features.audioLimit') },
        { icon: "camera", text: t('subscription.features.ocrLimit') },
      ],
      color: "#4DB6AC",
    },
    {
      id: "premium",
      productId: "com.finflow.subscription.premium",
      name: t('subscription.plans.premium.name'),
      tagline: t('subscription.plans.premium.tagline'),
      price: "$9.99",
      priceValue: 9.99,
      period: t('subscription.periods.month'),
      features: [
        { icon: "chatbubble", text: t('subscription.features.unlimitedChat'), highlight: true },
        { icon: "mic", text: t('subscription.features.audioUnlimited'), highlight: true },
        { icon: "camera", text: t('subscription.features.ocrUnlimited'), highlight: true },
        { icon: "stats-chart", text: t('subscription.features.premiumAnalytics') },
        { icon: "download", text: t('subscription.features.exportImport') },
      ],
      color: "#8B5CF6",
      recommended: true,
    },
    {
      id: "yearly",
      productId: "com.finflow.subscription.yearly",
      name: t('subscription.plans.yearly.name'),
      tagline: t('subscription.plans.yearly.tagline'),
      price: "$99",
      priceValue: 99,
      period: t('subscription.periods.year'),
      originalPrice: "$119.88",
      savings: t('subscription.savings').replace('{amount}', "$20.88"),
      features: [
        { icon: "infinite", text: t('subscription.features.allUnlimited'), highlight: true },
        { icon: "chatbubble", text: t('subscription.features.unlimitedChat') },
        { icon: "mic", text: t('subscription.features.audioUnlimited') },
        { icon: "camera", text: t('subscription.features.ocrUnlimited') },
        { icon: "stats-chart", text: t('subscription.features.premiumAnalytics') },
        { icon: "download", text: t('subscription.features.exportImport') },
        { icon: "gift", text: t('subscription.features.freeMonths'), highlight: true },
      ],
      color: "#F59E0B",
      bestValue: true,
    },
  ];

  const fetchSubscription = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await apiClient.get(`/api/subscription`);
      setSubscription(response.data);
    } catch (error) {
      console.error("Fetch subscription error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: typeof PACKAGES[0]) => {
    if (pkg.isTrial) {
      await startFreeTrial();
      return;
    }

    if (!pkg.productId) {
      Alert.alert(t('subscription.alerts.error'), t('subscription.alerts.productUnavailable'));
      return;
    }

    // For iOS, this would trigger Apple IAP
    // For now, show info about Apple IAP requirement
    if (Platform.OS === 'ios') {
      Alert.alert(
        t('subscription.alerts.iapRequired'),
        t('subscription.alerts.iapDesc')
          .replace('{plan}', pkg.name)
          .replace('{price}', pkg.price)
          .replace('{period}', pkg.period),
        [
          { text: t('common.cancel'), style: "cancel" },
          {
            text: t('common.confirm'),
            onPress: () => simulatePurchase(pkg)
          }
        ]
      );
    } else {
      Alert.alert(
        t('subscription.alerts.iosRequired'),
        t('subscription.alerts.iosRequiredDesc'),
        [{ text: "OK" }]
      );
    }
  };

  // Simulate purchase for testing (in production, use real Apple IAP)
  const simulatePurchase = async (pkg: typeof PACKAGES[0]) => {
    setPurchasing(pkg.id);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      // Call backend to activate subscription (simulated)
      await apiClient.post(
        `/api/subscription/verify-apple`,
        {
          receipt_data: "simulated_receipt",
          product_id: pkg.productId,
          transaction_id: `simulated_${Date.now()}`,
        }
      );

      Alert.alert(
        t('subscription.alerts.success'),
        t('subscription.alerts.successDesc').replace('{plan}', pkg.name),
        [{
          text: "OK", onPress: () => {
            refreshUser();
            fetchSubscription();
          }
        }]
      );
    } catch (error: any) {
      Alert.alert(t('subscription.alerts.error'), error.response?.data?.detail || "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  };

  const startFreeTrial = async () => {
    setPurchasing("trial");
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      await apiClient.post(
        `/api/subscription/start-trial`,
        { trial_days: 14 }
      );

      Alert.alert(
        t('subscription.alerts.trialStarted'),
        t('subscription.alerts.trialDesc'),
        [{
          text: "OK", onPress: () => {
            refreshUser();
            fetchSubscription();
          }
        }]
      );
    } catch (error: any) {
      Alert.alert(t('subscription.alerts.error'), error.response?.data?.detail || "Unable to start trial");
    } finally {
      setPurchasing(null);
    }
  };

  const renderPackageCard = (pkg: typeof PACKAGES[0]) => {
    const isCurrentPlan = subscription?.tier === pkg.id;
    const isDisabled = isCurrentPlan || purchasing !== null;

    return (
      <View
        key={pkg.id}
        style={[
          styles.packageCard,
          pkg.recommended && styles.recommendedCard,
          pkg.bestValue && styles.bestValueCard,
          isCurrentPlan && styles.currentPlanCard,
        ]}
      >
        {/* Badges */}
        {pkg.recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.badgeText}>{t('subscription.badges.recommended')}</Text>
          </View>
        )}
        {pkg.bestValue && (
          <View style={styles.bestValueBadge}>
            <Text style={styles.badgeText}>{t('subscription.badges.bestValue')}</Text>
          </View>
        )}
        {isCurrentPlan && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.badgeText}>{t('subscription.badges.current')}</Text>
          </View>
        )}

        {/* Package Header */}
        <View style={styles.packageHeader}>
          <Text style={[styles.packageName, { color: pkg.color }]}>{pkg.name}</Text>
          <Text style={styles.packageTagline}>{pkg.tagline}</Text>
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={[styles.priceText, { color: pkg.color }]}>{pkg.price}</Text>
          {pkg.period !== "14 days" && (
            <Text style={styles.periodText}>/ {pkg.period}</Text>
          )}
        </View>

        {/* Savings */}
        {pkg.savings && (
          <View style={styles.savingsContainer}>
            <Text style={styles.originalPrice}>{pkg.originalPrice}</Text>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>{pkg.savings}</Text>
            </View>
          </View>
        )}

        {/* Features */}
        <View style={styles.featuresContainer}>
          {pkg.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons
                name={feature.icon as any}
                size={18}
                color={feature.highlight ? pkg.color : "#6B7280"}
              />
              <Text style={[
                styles.featureText,
                feature.highlight && { color: pkg.color, fontWeight: "600" }
              ]}>
                {feature.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: pkg.color },
            isDisabled && styles.disabledButton,
          ]}
          onPress={() => handlePurchase(pkg)}
          disabled={isDisabled}
        >
          {purchasing === pkg.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              {isCurrentPlan
                ? t('subscription.currentPlan')
                : pkg.isTrial
                  ? t('subscription.startTrial')
                  : `${t('subscription.subscription')} ${pkg.price}`
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.subscription')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan Info */}
        {subscription && (
          <View style={styles.currentPlanInfo}>
            <View style={styles.planInfoHeader}>
              <Ionicons name="diamond" size={24} color="#4DB6AC" />
              <Text style={styles.currentPlanTitle}>
                {subscription.tier_name || "Free Plan"}
              </Text>
            </View>
            {subscription.days_remaining !== undefined && subscription.days_remaining > 0 && (
              <Text style={styles.daysRemaining}>
                {subscription.days_remaining} {t('analytics.days')} {t('chat.left')}
              </Text>
            )}
            {subscription.usage && (
              <View style={styles.usageInfo}>
                <Text style={styles.usageText}>
                  Chat: {subscription.usage.chat_count} |
                  Audio: {subscription.usage.voice_minutes?.toFixed(1) || 0} min |
                  OCR: {subscription.usage.ocr_count}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Section Title */}
        <Text style={styles.sectionTitle}>{t('subscription.choosePlan')}</Text>
        <Text style={styles.sectionSubtitle}>
          {t('subscription.tagline') || "Choose the plan that fits your needs"}
        </Text>

        {/* Packages - Vertical List (Single Column) */}
        <View style={styles.packagesContainer}>
          {PACKAGES.map(renderPackageCard)}
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            • {t('subscription.footer.appleManaged')}
          </Text>
          <Text style={styles.footerText}>
            • {t('subscription.footer.cancelAnytime')}
          </Text>
          <Text style={styles.footerText}>
            • {t('subscription.footer.chargedToApple')}
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  currentPlanInfo: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  planInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  currentPlanTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  daysRemaining: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  usageInfo: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 10,
  },
  usageText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  packagesContainer: {
    gap: 16,
  },
  packageCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
    overflow: "hidden",
  },
  recommendedCard: {
    borderColor: "#8B5CF6",
  },
  bestValueCard: {
    borderColor: "#F59E0B",
  },
  currentPlanCard: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  recommendedBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  bestValueBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  currentBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  packageHeader: {
    marginBottom: 12,
  },
  packageName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  packageTagline: {
    fontSize: 14,
    color: "#6B7280",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  priceText: {
    fontSize: 36,
    fontWeight: "800",
  },
  periodText: {
    fontSize: 16,
    color: "#6B7280",
    marginLeft: 4,
  },
  savingsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  originalPrice: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  savingsBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706",
  },
  featuresContainer: {
    marginBottom: 16,
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#4B5563",
    flex: 1,
  },
  subscribeButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  footerInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
});
