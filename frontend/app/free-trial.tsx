import React from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";

export default function FreeTrialScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const handleStartTrial = () => {
    // Navigate to main app
    router.replace("/(app)");
  };

  const handleViewPlans = () => {
    // Navigate to subscription page
    router.push("/(app)/subscription");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('trial.header')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Gift Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.giftCircle}>
            <Ionicons name="gift" size={40} color="#4DB6AC" />
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>{t('trial.threeDaysOfPro')}</Text>
          <Text style={styles.subtitle}>
            {t('trial.subtitle')}
          </Text>
        </View>

        {/* Features Card */}
        <View style={styles.featuresCard}>
          {/* Full Access Period */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="calendar" size={24} color="#4DB6AC" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{t('trial.fullAccessPeriod')}</Text>
              <Text style={styles.featureDescription}>
                {t('trial.fullAccessDesc')}
              </Text>
            </View>
          </View>

          {/* 10 Daily Actions */}
          <View style={styles.featureRow}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="flash" size={24} color="#4DB6AC" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{t('trial.tenDailyActions')}</Text>
              <Text style={styles.featureDescription}>
                {t('trial.tenDailyActionsDesc')}
              </Text>
              <View style={styles.actionBadges}>
                <View style={styles.actionBadge}>
                  <Ionicons name="chatbubble" size={16} color="#4DB6AC" />
                  <Text style={styles.actionBadgeText}>{t('trial.chat')}</Text>
                </View>
                <View style={styles.actionBadge}>
                  <Ionicons name="document-text" size={16} color="#4DB6AC" />
                  <Text style={styles.actionBadgeText}>{t('trial.ocr')}</Text>
                </View>
                <View style={styles.actionBadge}>
                  <Ionicons name="mic" size={16} color="#4DB6AC" />
                  <Text style={styles.actionBadgeText}>{t('trial.voice')}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Limit Reset Info */}
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={18} color="#F59E0B" />
            <Text style={styles.infoText}>
              {t('trial.limitsReset')}
            </Text>
          </View>
        </View>

        {/* No Hidden Costs */}
        <View style={styles.noCostsCard}>
          <View style={styles.noCostsIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color="#4DB6AC" />
          </View>
          <View style={styles.noCostsContent}>
            <Text style={styles.noCostsTitle}>{t('trial.noHiddenCosts')}</Text>
            <Text style={styles.noCostsText}>{t('trial.cancelAnytime')}</Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleStartTrial}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#4DB6AC", "#45A599"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{t('trial.startMyTrial')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* View Plans Link */}
        <TouchableOpacity style={styles.viewPlansLink} onPress={handleViewPlans}>
          <Text style={styles.viewPlansText}>
            {t('trial.viewAllPlans')}
          </Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          {t('trial.disclaimer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  iconContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  giftCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  featuresCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#4DB6AC",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  actionBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4DB6AC",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
  },
  noCostsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noCostsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  noCostsContent: {
    flex: 1,
  },
  noCostsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  noCostsText: {
    fontSize: 13,
    color: "#6B7280",
  },
  ctaButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#4DB6AC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  viewPlansLink: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 24,
  },
  viewPlansText: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
