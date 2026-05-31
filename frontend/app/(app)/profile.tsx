import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPPORTED_LANGUAGES } from "../../utils/i18n";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, redeemCode } = useAuth();
  const { t, language } = useLanguage();
  const { currency, conversionMode, setConversionMode } = useCurrency();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showRedeem, setShowRedeem] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [language]);

  const loadPreferences = async () => {
    const locale = await AsyncStorage.getItem("user_locale");
    if (locale) setSelectedLanguage(locale);
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: "cancel" },
      {
        text: t('auth.logout'),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleRedeem = async () => {
    if (!codeInput.trim()) return;
    setRedeeming(true);
    const r = await redeemCode(codeInput.trim());
    setRedeeming(false);
    if (r.success) {
      setShowRedeem(false);
      setCodeInput("");
      Alert.alert(t('common.success'), t('redeem.success'));
    } else {
      Alert.alert(t('common.error'), r.error || "");
    }
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : "English (US)";
  };

  // Real subscription tier → short badge label.
  const tierBadge = (() => {
    const tier = user?.subscription_tier;
    if (tier === "free_trial") return t('profile.planTrial');
    if (tier && ["basic", "pro", "power"].includes(tier)) {
      return tier.charAt(0).toUpperCase() + tier.slice(1);
    }
    return t('profile.planFree');
  })().toUpperCase();

  const menuItems = [
    {
      section: t('profile.accountSettings'),
      items: [
        {
          icon: "person-outline",
          label: t('profile.personalInfo'),
          color: "#4DB6AC",
          onPress: () => router.push("/(app)/personal-info"),
        },
        {
          icon: "card-outline",
          label: t('profile.paymentMethods'),
          color: "#F59E0B",
          onPress: () => router.push("/(app)/subscription"),
        },
        {
          icon: "shield-checkmark-outline",
          label: t('profile.security'),
          color: "#8B5CF6",
          onPress: () => router.push("/(app)/security"),
        },
        {
          icon: "notifications-outline",
          label: t('profile.notifications'),
          color: "#EF4444",
          onPress: () => router.push("/(app)/notifications"),
        },
      ],
    },
    {
      section: t('profile.preferences'),
      items: [
        {
          icon: "language-outline",
          label: t('profile.language'),
          value: getLanguageName(selectedLanguage),
          color: "#4DB6AC",
          onPress: () => router.push("/(app)/language"),
        },
        {
          icon: "cash-outline",
          label: t('profile.currency'),
          value: currency,
          color: "#10B981",
          onPress: () => router.push("/(app)/currency"),
        },
        {
          icon: "gift-outline",
          label: t('redeem.menuLabel'),
          color: "#8B5CF6",
          onPress: () => setShowRedeem(true),
        },
      ],
    },
    {
      section: t('profile.supportInfo'),
      items: [
        {
          icon: "help-circle-outline",
          label: t('profile.helpCenter'),
          color: "#4DB6AC",
          onPress: () => router.push("/(app)/help"),
        },
        {
          icon: "document-text-outline",
          label: t('profile.privacyPolicy'),
          color: "#6B7280",
          onPress: () => router.push("/(app)/privacy"),
        },
        {
          icon: "information-circle-outline",
          label: t('profile.aboutFinflow'),
          color: "#4DB6AC",
          onPress: () => router.push("/(app)/about"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.profile')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* Current plan (real subscription tier) */}
          <View style={styles.planRow}>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>{tierBadge}</Text>
            </View>
            <Text style={styles.planLabel}>{t('profile.plan')}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      itemIndex !== section.items.length - 1 &&
                        styles.menuItemBorder,
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.menuIcon,
                          { backgroundColor: `${item.color}20` },
                        ]}
                      >
                        <Ionicons name={item.icon} size={22} color={item.color} />
                      </View>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.menuItemRight}>
                      {item.value && (
                        <Text style={styles.menuValue}>{item.value}</Text>
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Live conversion toggle sits directly under Currency. */}
                  {item.label === t('profile.currency') && (
                    <View style={[styles.menuItem, styles.menuItemBorder]}>
                      <View style={styles.menuItemLeft}>
                        <View style={[styles.menuIcon, { backgroundColor: "#3B82F620" }]}>
                          <Ionicons name="swap-horizontal-outline" size={22} color="#3B82F6" />
                        </View>
                        <View style={styles.toggleTextWrap}>
                          <Text style={styles.menuLabel}>{t('profile.liveConversion')}</Text>
                          <Text style={styles.toggleHint}>
                            {conversionMode === "live"
                              ? t('profile.liveConversionOnHint', { currency })
                              : t('profile.liveConversionOffHint', { currency })}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={conversionMode === "live"}
                        onValueChange={(v) => setConversionMode(v ? "live" : "off")}
                        trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionLabel}>{t('profile.version')}</Text>
          <Text style={styles.versionText}>FinFlow v1.0.0</Text>
        </View>
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
          <Ionicons name="swap-horizontal-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>{t('nav.transactions')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() => router.push("/(app)/manual")}
        >
          <View style={styles.navCenterButton}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/insights")}
        >
          <Ionicons name="bar-chart-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>{t('nav.analytics')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={24} color="#10B981" />
          <Text style={[styles.navText, styles.navTextActive]}>{t('nav.profile')}</Text>
        </TouchableOpacity>
      </View>
      {/* Redeem code modal */}
      <Modal
        visible={showRedeem}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRedeem(false)}
      >
        <View style={styles.redeemOverlay}>
          <View style={styles.redeemCard}>
            <Text style={styles.redeemTitle}>{t('redeem.title')}</Text>
            <TextInput
              style={styles.redeemInput}
              placeholder={t('redeem.placeholder')}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              value={codeInput}
              onChangeText={setCodeInput}
            />
            <View style={styles.redeemActions}>
              <TouchableOpacity
                style={styles.redeemCancel}
                onPress={() => setShowRedeem(false)}
              >
                <Text style={styles.redeemCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.redeemConfirm}
                onPress={handleRedeem}
                disabled={redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.redeemConfirmText}>{t('redeem.button')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    fontWeight: "600",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proBadge: {
    backgroundColor: "#4DB6AC",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  planLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  toggleTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  toggleHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuValue: {
    fontSize: 14,
    color: "#6B7280",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  versionLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
    letterSpacing: 1,
  },
  versionText: {
    fontSize: 13,
    color: "#6B7280",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -28,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navText: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  navTextActive: {
    color: "#10B981",
    fontWeight: "600",
  },
  redeemOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  redeemCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  redeemTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },
  redeemInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 16,
  },
  redeemActions: {
    flexDirection: "row",
    gap: 12,
  },
  redeemCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  redeemCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  redeemConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4DB6AC",
    alignItems: "center",
  },
  redeemConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
