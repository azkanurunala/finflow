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
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function OnboardingTrialScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { state, actions } = useSubscription();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [loading, setLoading] = useState(false);

  // Load subscription data on mount
  useEffect(() => {
    actions.loadSubscriptionStatus();
  }, []);

  // Build plans from real subscription data
  const PLANS = [
    // Add trial if user hasn't used it
    ...(!state.trialUsed ? [{
      id: "trial",
      productId: null,
      name: "14-Day Free Trial",
      price: "$0",
      period: "14 days",
      features: [
        "Full Pro access",
        "Unlimited transactions",
        "AI categorization",
        "All premium features",
      ],
      isRecommended: true,
    }] : []),
    // Add available tiers from context
    ...state.availableTiers.map(tier => ({
      id: tier.id,
      productId: tier.productId,
      name: tier.name,
      price: tier.price,
      period: tier.duration === 'yearly' ? '/year' : '/month',
      features: tier.features,
      isRecommended: tier.isPopular || false,
    }))
  ];

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const plan = PLANS.find((p) => p.id === selectedPlan);
      
      if (selectedPlan === "trial") {
        // Start free trial via SubscriptionContext
        const result = await actions.startTrial();
        if (result.success) {
          await AsyncStorage.setItem("onboarding_preferences_saved", "true");
          await refreshUser();
          router.replace("/(app)");
        } else {
          Alert.alert(t('common.error'), result.error || t('onboarding.unableToStartTrial'));
        }
      } else if (plan?.productId) {
        // Purchase subscription via SubscriptionContext
        const result = await actions.purchaseSubscription(plan.productId);
        if (result.success) {
          await AsyncStorage.setItem("onboarding_preferences_saved", "true");
          await refreshUser();
          router.replace("/(app)");
        } else if (!result.cancelled) {
          Alert.alert(t('common.error'), result.error || t('onboarding.purchaseFailed'));
        }
      }
    } catch (error: any) {
      console.error("Error in onboarding trial:", error);
      Alert.alert(t('common.error'), error.message || t('onboarding.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleBack = () => {
    router.back();
  };

  // Show loading while fetching subscription data
  if (state.isLoading && !state.lastUpdated) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text style={styles.loadingText}>{t('onboarding.loadingPlans')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
        <Text style={styles.stepText}>{t('onboarding.step3of3')}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="rocket" size={48} color="#4DB6AC" />
        </View>

        <Text style={styles.title}>{t('onboarding.choosePlan')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.choosePlanDesc')}
        </Text>

        <View style={styles.planList}>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
              ]}
              onPress={() => handleSelectPlan(plan.id)}
              activeOpacity={0.7}
            >
              {plan.isRecommended && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>{t('subscription.badges.recommended')}</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
              <View style={styles.planFeatures}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#4DB6AC" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <View style={[
                styles.radio,
                selectedPlan === plan.id && styles.radioSelected,
              ]}>
                {selectedPlan === plan.id && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStartTrial}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.startButtonText}>
            {loading ? t('onboarding.starting') : selectedPlan === "trial" ? t('onboarding.startFreeTrial') : t('onboarding.subscribe')}
          </Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4DB6AC",
  },
  stepText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  planList: {
    gap: 12,
  },
  planCard: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  planCardSelected: {
    borderColor: "#4DB6AC",
    backgroundColor: "#F0FDFA",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    left: 16,
    backgroundColor: "#4DB6AC",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4DB6AC",
  },
  planPeriod: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 2,
  },
  planFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: "#4B5563",
  },
  radio: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    backgroundColor: "#4DB6AC",
    borderColor: "#4DB6AC",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  startButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
