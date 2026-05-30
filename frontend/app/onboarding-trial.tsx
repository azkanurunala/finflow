import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LinearGradient } from "expo-linear-gradient";

// Feature/period labels are translation keys resolved with t() at render time.
const PLANS = [
  {
    id: "free_trial",
    name: "Free Trial",
    price: "$0",
    periodKey: "onboarding.period3Days",
    features: [
      "onboarding.featActionsPerDay",
      "onboarding.featBasicAiChat",
      "onboarding.featReceiptScanning",
      "onboarding.featTryAllFeatures",
    ],
    isRecommended: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "$1.99",
    periodKey: "onboarding.periodPerMonth",
    features: [
      "subscription.featChat30",
      "subscription.featUploads20",
      "subscription.featFullAnalytics",
      "subscription.featPrioritySupport",
    ],
    isRecommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4.99",
    periodKey: "onboarding.periodPerMonth",
    features: [
      "subscription.featChat100",
      "subscription.featUploads100",
      "subscription.featAdvancedAnalytics",
      "subscription.featPrioritySupport",
    ],
    isRecommended: true,
  },
  {
    id: "power",
    name: "Power",
    price: "$9.99",
    periodKey: "onboarding.periodPerMonth",
    features: [
      "subscription.featUnlimitedChat",
      "subscription.featUnlimitedUploads",
      "subscription.featAllFeatures",
      "subscription.featVipSupport",
    ],
    isRecommended: false,
  },
];

export default function OnboardingTrialScreen() {
  const router = useRouter();
  const { startTrial, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState("free_trial");
  const [loading, setLoading] = useState(false);

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      await startTrial();
      await refreshUser();
      router.replace("/(app)");
    } catch (error) {
      console.error("Error starting trial:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    if (planId !== "free_trial") {
      // TODO: Implement in-app purchase
      // For now, just show a message
      alert(t('onboarding.iapComingSoon'));
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
        <Text style={styles.stepText}>{t('onboarding.step', { current: 3, total: 3 })}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="rocket" size={48} color="#4DB6AC" />
        </View>
        
        <Text style={styles.title}>{t('onboarding.choosePlan')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.choosePlanSubtitle')}
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
                  <Text style={styles.recommendedText}>{t('onboarding.recommended')}</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <Text style={styles.planName}>
                  {plan.id === "free_trial" ? t('onboarding.planFreeTrial') : plan.name}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{t(plan.periodKey)}</Text>
                </View>
              </View>
              <View style={styles.planFeatures}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#4DB6AC" />
                    <Text style={styles.featureText}>{t(feature)}</Text>
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
            {loading ? t('onboarding.starting') : selectedPlan === "free_trial" ? t('onboarding.startFreeTrial') : t('onboarding.subscribe')}
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
