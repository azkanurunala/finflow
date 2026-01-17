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
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Conditionally import react-native-iap only on native platforms
let RNIap: any = null;
if (Platform.OS !== 'web') {
  RNIap = require('react-native-iap');
}

// Apple IAP Product IDs (configure in App Store Connect)
const PRODUCT_IDS = Platform.select({
  ios: [
    'com.finflow.subscription.basic',      // $2.99/month
    'com.finflow.subscription.premium',    // $9.99/month  
    'com.finflow.subscription.yearly',     // $99/year
    'com.finflow.subscription.monthly',    // $29/month
  ],
  default: [],
}) as string[];

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

// Subscription Packages - Vertical Layout
const PACKAGES = [
  {
    id: "trial",
    productId: null, // Free trial, no IAP needed
    name: "14-Day Free Trial",
    tagline: "Try all features free for 14 days",
    price: "Free",
    priceValue: 0,
    period: "14 days",
    features: [
      { icon: "infinite", text: "Full Feature Access", highlight: true },
      { icon: "chatbubble", text: "Unlimited Chat" },
      { icon: "mic", text: "30x Audio Log" },
      { icon: "camera", text: "30x OCR Scan" },
    ],
    color: "#10B981",
    isTrial: true,
  },
  {
    id: "basic",
    productId: "com.finflow.subscription.basic",
    name: "Basic Package",
    tagline: "Essential features for everyday use",
    price: "$2.99",
    priceValue: 2.99,
    period: "month",
    features: [
      { icon: "chatbubble", text: "Unlimited Chat", highlight: true },
      { icon: "mic", text: "30x Audio Log / month" },
      { icon: "camera", text: "30x OCR Scan / month" },
    ],
    color: "#4DB6AC",
  },
  {
    id: "premium",
    productId: "com.finflow.subscription.premium",
    name: "Premium Package",
    tagline: "Everything unlimited, no restrictions",
    price: "$9.99",
    priceValue: 9.99,
    period: "month",
    features: [
      { icon: "chatbubble", text: "Unlimited Chat", highlight: true },
      { icon: "mic", text: "Unlimited Audio Log", highlight: true },
      { icon: "camera", text: "Unlimited OCR Scan", highlight: true },
      { icon: "stats-chart", text: "Premium Analytics" },
      { icon: "download", text: "Export & Import Data" },
    ],
    color: "#8B5CF6",
    recommended: true,
  },
  {
    id: "yearly",
    productId: "com.finflow.subscription.yearly",
    name: "Annual Plan",
    tagline: "Best value! Get 2 months FREE",
    price: "$99",
    priceValue: 99,
    period: "year",
    originalPrice: "$119.88",
    savings: "Save $20.88",
    features: [
      { icon: "infinite", text: "All Features Unlimited", highlight: true },
      { icon: "chatbubble", text: "Unlimited Chat" },
      { icon: "mic", text: "Unlimited Audio Log" },
      { icon: "camera", text: "Unlimited OCR Scan" },
      { icon: "stats-chart", text: "Premium Analytics" },
      { icon: "download", text: "Export & Import Data" },
      { icon: "gift", text: "2 Months FREE", highlight: true },
    ],
    color: "#F59E0B",
    bestValue: true,
  },
  {
    id: "monthly_full",
    productId: "com.finflow.subscription.monthly",
    name: "Monthly Full Access",
    tagline: "Full flexibility, cancel anytime",
    price: "$29",
    priceValue: 29,
    period: "month",
    features: [
      { icon: "infinite", text: "All Features Unlimited", highlight: true },
      { icon: "chatbubble", text: "Unlimited Chat" },
      { icon: "mic", text: "Unlimited Audio Log" },
      { icon: "camera", text: "Unlimited OCR Scan" },
      { icon: "stats-chart", text: "Premium Analytics" },
      { icon: "download", text: "Export & Import Data" },
    ],
    color: "#3B82F6",
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [products, setProducts] = useState<RNIap.Product[]>([]);

  useEffect(() => {
    initializeIAP();
    fetchSubscription();
    
    return () => {
      // Cleanup IAP connection
      RNIap.endConnection();
    };
  }, []);

  const initializeIAP = async () => {
    try {
      if (Platform.OS === 'ios') {
        await RNIap.initConnection();
        const availableProducts = await RNIap.getProducts({ skus: PRODUCT_IDS });
        setProducts(availableProducts);
      }
    } catch (error) {
      console.log('IAP Init Error:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.get(`${BACKEND_URL}/api/subscription`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setSubscription(response.data);
    } catch (error) {
      console.error("Fetch subscription error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: typeof PACKAGES[0]) => {
    if (pkg.isTrial) {
      // Start free trial
      await startFreeTrial();
      return;
    }

    if (!pkg.productId) {
      Alert.alert("Error", "Product not available");
      return;
    }

    if (Platform.OS !== 'ios') {
      Alert.alert(
        "Apple In-App Purchase",
        "In-App Purchase is only available on iOS devices. Please use the iOS app to subscribe.",
        [{ text: "OK" }]
      );
      return;
    }

    setPurchasing(pkg.id);

    try {
      // Request purchase from App Store
      const purchase = await RNIap.requestPurchase({
        sku: pkg.productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      if (purchase) {
        // Verify receipt on backend
        await verifyPurchase(purchase);
      }
    } catch (error: any) {
      if (error.code === 'E_USER_CANCELLED') {
        // User cancelled, do nothing
      } else {
        console.error('Purchase error:', error);
        Alert.alert("Purchase Failed", error.message || "Unable to complete purchase. Please try again.");
      }
    } finally {
      setPurchasing(null);
    }
  };

  const verifyPurchase = async (purchase: any) => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      const response = await axios.post(
        `${BACKEND_URL}/api/subscription/verify-apple`,
        {
          receipt_data: purchase.transactionReceipt,
          product_id: purchase.productId,
          transaction_id: purchase.transactionId,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      if (response.data.success) {
        // Finish transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
        
        Alert.alert(
          "Success!",
          "Your subscription is now active. Enjoy all the features!",
          [{ text: "Great!", onPress: () => {
            refreshUser();
            fetchSubscription();
          }}]
        );
      } else {
        throw new Error(response.data.message || "Verification failed");
      }
    } catch (error: any) {
      console.error("Verify purchase error:", error);
      Alert.alert("Verification Failed", "Unable to verify your purchase. Please contact support.");
    }
  };

  const startFreeTrial = async () => {
    setPurchasing("trial");
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      await axios.post(
        `${BACKEND_URL}/api/subscription/start-trial`,
        { trial_days: 14 },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      Alert.alert(
        "Trial Started!",
        "Your 14-day free trial is now active. Enjoy all features!",
        [{ text: "Let's Go!", onPress: () => {
          refreshUser();
          fetchSubscription();
        }}]
      );
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Unable to start trial");
    } finally {
      setPurchasing(null);
    }
  };

  const restorePurchases = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert("Info", "Restore purchases is only available on iOS");
      return;
    }

    setLoading(true);
    try {
      const purchases = await RNIap.getAvailablePurchases();
      
      if (purchases.length > 0) {
        // Verify the latest purchase
        const latestPurchase = purchases[purchases.length - 1];
        await verifyPurchase(latestPurchase);
      } else {
        Alert.alert("No Purchases", "No previous purchases found to restore.");
      }
    } catch (error) {
      console.error("Restore error:", error);
      Alert.alert("Error", "Unable to restore purchases. Please try again.");
    } finally {
      setLoading(false);
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
            <Text style={styles.badgeText}>RECOMMENDED</Text>
          </View>
        )}
        {pkg.bestValue && (
          <View style={styles.bestValueBadge}>
            <Text style={styles.badgeText}>BEST VALUE</Text>
          </View>
        )}
        {isCurrentPlan && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.badgeText}>CURRENT PLAN</Text>
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
                ? "Current Plan" 
                : pkg.isTrial 
                  ? "Start Free Trial" 
                  : `Subscribe for ${pkg.price}`
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
        <Text style={styles.headerTitle}>Subscription</Text>
        <TouchableOpacity onPress={restorePurchases} style={styles.restoreButton}>
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
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
                {subscription.tier_name || "Free Trial"}
              </Text>
            </View>
            {subscription.days_remaining !== undefined && (
              <Text style={styles.daysRemaining}>
                {subscription.days_remaining} days remaining
              </Text>
            )}
            {subscription.usage && (
              <View style={styles.usageInfo}>
                <Text style={styles.usageText}>
                  Chat: {subscription.usage.chat_count} | 
                  Audio: {subscription.usage.voice_minutes.toFixed(1)} min | 
                  OCR: {subscription.usage.ocr_count}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>
        <Text style={styles.sectionSubtitle}>
          All plans include a 7-day money-back guarantee
        </Text>

        {/* Packages - Vertical List */}
        <View style={styles.packagesContainer}>
          {PACKAGES.map(renderPackageCard)}
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            • Subscriptions are managed through Apple App Store
          </Text>
          <Text style={styles.footerText}>
            • Cancel anytime from your device settings
          </Text>
          <Text style={styles.footerText}>
            • Payment will be charged to your Apple ID
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
  restoreButton: {
    padding: 8,
  },
  restoreText: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "600",
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
