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
import { useSubscription } from "../../contexts/SubscriptionContext";
import CouponRedeemModal from "../../components/CouponRedeemModal";


export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { state, actions } = useSubscription();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Load subscription data on mount
  useEffect(() => {
    actions.loadSubscriptionStatus();
  }, []);

  // Calculate days remaining
  const getDaysRemaining = (): number | null => {
    if (!state.expirationDate) return null;
    const now = new Date();
    const expiration = new Date(state.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Define packages using real pricing from available tiers
  const PACKAGES = state.availableTiers.map(tier => ({
    id: tier.id,
    productId: tier.productId,
    name: tier.name,
    tagline: tier.duration === 'yearly' ? t('subscription.plans.yearly.tagline') : t('subscription.plans.premium.tagline'),
    price: tier.price,
    priceValue: parseFloat(tier.price.replace(/[^0-9.]/g, '')),
    period: tier.duration === 'yearly' ? t('subscription.periods.year') : t('subscription.periods.month'),
    features: tier.features.map(feature => ({
      icon: "checkmark-circle",
      text: feature,
      highlight: true
    })),
    color: tier.duration === 'yearly' ? "#F59E0B" : "#8B5CF6",
    recommended: tier.isPopular,
    bestValue: tier.duration === 'yearly',
  }));

  // Add trial package if user hasn't used trial yet
  if (!state.trialUsed) {
    PACKAGES.unshift({
      id: "trial",
      productId: null,
      name: t('subscription.plans.trial.name'),
      tagline: t('subscription.plans.trial.tagline'),
      price: "Free",
      priceValue: 0,
      period: t('subscription.periods.days14'),
      features: [
        { icon: "infinite", text: t('subscription.features.fullAccess'), highlight: true },
        { icon: "chatbubble", text: t('subscription.features.unlimitedChat'), highlight: false },
        { icon: "mic", text: t('subscription.features.audioTrial'), highlight: false },
        { icon: "camera", text: t('subscription.features.ocrTrial'), highlight: false },
      ],
      color: "#10B981",
      isTrial: true,
    });
  }

  const handlePurchase = async (pkg: any) => {
    if (pkg.isTrial) {
      await startFreeTrial();
      return;
    }

    if (!pkg.productId) {
      Alert.alert(t('subscription.alerts.error'), t('subscription.alerts.productUnavailable'));
      return;
    }

    setPurchasing(pkg.id);
    try {
      const result = await actions.purchaseSubscription(pkg.productId);
      
      if (result.success) {
        Alert.alert(
          t('subscription.alerts.success'),
          t('subscription.alerts.successDesc').replace('{plan}', pkg.name),
          [{
            text: "OK", onPress: () => {
              refreshUser();
              actions.refreshEntitlements();
            }
          }]
        );
      } else if (result.cancelled) {
        // User cancelled, no need to show error
        console.log('Purchase cancelled by user');
      } else {
        Alert.alert(t('subscription.alerts.error'), result.error || 'Purchase failed');
      }
    } catch (error: any) {
      Alert.alert(t('subscription.alerts.error'), error.message || 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const startFreeTrial = async () => {
    setPurchasing("trial");
    try {
      const result = await actions.startTrial();
      
      if (result.success) {
        Alert.alert(
          t('subscription.alerts.trialStarted'),
          t('subscription.alerts.trialDesc'),
          [{
            text: "OK", onPress: () => {
              refreshUser();
              actions.refreshEntitlements();
            }
          }]
        );
      } else {
        Alert.alert(t('subscription.alerts.error'), result.error || "Unable to start trial");
      }
    } catch (error: any) {
      Alert.alert(t('subscription.alerts.error'), error.message || "Unable to start trial");
    } finally {
      setPurchasing(null);
    }
  };

  const handleCouponSuccess = () => {
    refreshUser();
    actions.refreshEntitlements();
    Alert.alert(t('common.success'), t('subscription.couponRedeemed') || "Coupon redeemed! Enjoy your Pro access.");
  };

  const handleRestorePurchases = async () => {
    try {
      const result = await actions.restorePurchases();
      
      if (result.success) {
        Alert.alert(
          t('subscription.purchasesRestored') || "Purchases Restored",
          t('subscription.purchasesRestoredDesc') || "Your previous purchases have been restored successfully.",
          [{ text: "OK", onPress: () => {
            refreshUser();
            actions.refreshEntitlements();
          }}]
        );
      } else {
        Alert.alert(
          t('subscription.noPurchases') || "No Purchases Found", 
          t('subscription.noPurchasesDesc') || "We couldn't find any previous purchases to restore."
        );
      }
    } catch (error: any) {
      Alert.alert(t('subscription.alerts.error'), error.message || "Failed to restore purchases");
    }
  };

  const handleManageSubscription = () => {
    const storeUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    
    Alert.alert(
      t('subscription.manageSubscription') || "Manage Subscription",
      t('subscription.manageSubscriptionDesc') || `To manage your subscription, please visit your ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account settings.`,
      [
        { text: t('common.cancel'), style: "cancel" },
        { text: t('subscription.openSettings') || "Open Settings", onPress: () => {
          // In a real app, you would use Linking.openURL(storeUrl)
          console.log("Opening:", storeUrl);
        }}
      ]
    );
  };

  const renderPackageCard = (pkg: any) => {
    const isCurrentPlan = state.currentTier === pkg.id;
    const isDisabled = isCurrentPlan || purchasing !== null || state.isLoading;

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
          {pkg.features.map((feature: any, index: number) => (
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

  if (state.isLoading && !state.lastUpdated) {
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Loading Skeleton */}
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonSubtitle} />
            
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonCardHeader} />
                <View style={styles.skeletonCardPrice} />
                <View style={styles.skeletonCardFeature} />
                <View style={styles.skeletonCardFeature} />
                <View style={styles.skeletonCardButton} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
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
        {/* Trial Conversion Prompt */}
        {state.status === 'trial' && getDaysRemaining() !== null && getDaysRemaining()! < 7 && (
          <View style={styles.trialConversionBanner}>
            <View style={styles.trialConversionHeader}>
              <Ionicons name="time" size={24} color="#F59E0B" />
              <Text style={styles.trialConversionTitle}>
                {getDaysRemaining()! < 3 
                  ? t('subscription.trialEndingSoon') || 'Trial Ending Soon!'
                  : t('subscription.trialReminder') || 'Trial Reminder'}
              </Text>
            </View>
            <Text style={styles.trialConversionText}>
              {getDaysRemaining()! < 3
                ? t('subscription.trialEndingMessage') || `Your trial ends in ${getDaysRemaining()} days. Subscribe now to continue enjoying Pro features without interruption.`
                : t('subscription.trialReminderMessage') || `You have ${getDaysRemaining()} days left in your trial. Don't miss out on Pro features!`}
            </Text>
            <TouchableOpacity
              style={styles.trialConversionButton}
              onPress={() => {
                // Scroll to packages section
                const yearlyPackage = PACKAGES.find(p => p.bestValue);
                if (yearlyPackage) {
                  handlePurchase(yearlyPackage);
                }
              }}
            >
              <Text style={styles.trialConversionButtonText}>
                {t('subscription.upgradeNow') || 'Upgrade Now'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Current Plan Info */}
        {state.status !== 'expired' && (
          <View style={styles.currentPlanInfo}>
            <View style={styles.planInfoHeader}>
              <Ionicons name="diamond" size={24} color="#4DB6AC" />
              <Text style={styles.currentPlanTitle}>
                {state.currentTier === 'free' ? t('subscription.plans.free') || 'Free Plan' : 
                 state.currentTier === 'trial' ? t('subscription.plans.trial.name') :
                 state.currentTier === 'coupon' ? t('subscription.plans.coupon') || 'Coupon Access' :
                 state.availableTiers.find(t => t.id === state.currentTier)?.name || t('subscription.plans.pro') || 'Pro Plan'}
              </Text>
            </View>
            {getDaysRemaining() !== null && getDaysRemaining()! > 0 && (
              <Text style={styles.daysRemaining}>
                {getDaysRemaining()} {t('analytics.days')} {t('chat.left')}
              </Text>
            )}
            <View style={styles.usageInfo}>
              <Text style={styles.usageText}>
                {t('subscription.status')}: {state.status === 'active' ? t('subscription.statusActive') || 'Active' : 
                        state.status === 'trial' ? t('subscription.statusTrial') || 'Trial' : 
                        state.status === 'expired' ? t('subscription.statusExpired') || 'Expired' : 
                        t('subscription.statusCancelled') || 'Cancelled'}
              </Text>
            </View>
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

        {/* Coupon Link */}
        <TouchableOpacity
          style={styles.couponLink}
          onPress={() => setShowCouponModal(true)}
        >
          <Ionicons name="gift-outline" size={18} color="#6366F1" />
          <Text style={styles.couponLinkText}>{t('subscription.haveCoupon') || 'Have a coupon code?'}</Text>
        </TouchableOpacity>

        {/* Subscription Management Actions */}
        <View style={styles.managementSection}>
          <TouchableOpacity
            style={styles.managementButton}
            onPress={handleRestorePurchases}
          >
            <Ionicons name="refresh-outline" size={20} color="#4DB6AC" />
            <Text style={styles.managementButtonText}>{t('subscription.restorePurchases') || 'Restore Purchases'}</Text>
          </TouchableOpacity>

          {state.currentTier !== 'free' && (
            <TouchableOpacity
              style={styles.managementButton}
              onPress={handleManageSubscription}
            >
              <Ionicons name="settings-outline" size={20} color="#4DB6AC" />
              <Text style={styles.managementButtonText}>{t('subscription.manageSubscription') || 'Manage Subscription'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subscription Info */}
        {state.currentTier !== 'free' && state.expirationDate && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionInfoText}>
              {state.status === 'active' ? t('subscription.renews') || 'Renews' : t('subscription.expires') || 'Expires'} {t('subscription.on') || 'on'}{' '}
              {new Date(state.expirationDate).toLocaleDateString()}
            </Text>
            {state.status === 'active' && (
              <Text style={styles.subscriptionInfoSubtext}>
                {t('subscription.autoRenewalInfo') || `Auto-renewal is enabled. Cancel anytime from your ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account.`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Coupon Modal */}
      <CouponRedeemModal
        visible={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        onSuccess={handleCouponSuccess}
      />
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
  trialConversionBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#F59E0B",
  },
  trialConversionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  trialConversionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400E",
  },
  trialConversionText: {
    fontSize: 14,
    color: "#78350F",
    lineHeight: 20,
    marginBottom: 16,
  },
  trialConversionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  trialConversionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
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
    // G11 — tier cards stack vertically (1 column). Default flexDirection is column,
    // but make it explicit so any future row layout requires a deliberate edit and
    // shows up in code review.
    flexDirection: "column",
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
  couponLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
    paddingVertical: 12,
  },
  couponLinkText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "600",
  },
  managementSection: {
    marginTop: 24,
    gap: 12,
  },
  managementButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  managementButtonText: {
    color: "#4DB6AC",
    fontSize: 14,
    fontWeight: "600",
  },
  subscriptionInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  subscriptionInfoText: {
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  subscriptionInfoSubtext: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
  },
  skeletonContainer: {
    paddingVertical: 20,
  },
  skeletonTitle: {
    height: 28,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 12,
    width: "60%",
    alignSelf: "center",
  },
  skeletonSubtitle: {
    height: 16,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    marginBottom: 24,
    width: "80%",
    alignSelf: "center",
  },
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  skeletonCardHeader: {
    height: 20,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    marginBottom: 12,
    width: "50%",
  },
  skeletonCardPrice: {
    height: 36,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 16,
    width: "40%",
  },
  skeletonCardFeature: {
    height: 14,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 10,
    width: "70%",
  },
  skeletonCardButton: {
    height: 48,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    marginTop: 8,
  },
});
