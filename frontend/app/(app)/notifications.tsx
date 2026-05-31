import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  requestNotificationPermission,
  hasNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleTrialEndingReminder,
  cancelTrialEndingReminder,
} from "../../utils/notifications";

const DAILY_KEY = "notif_daily_enabled";
const TRIAL_KEY = "notif_trial_enabled";
const REMINDER_HOUR = 20; // 8 PM local

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [daily, setDaily] = useState(false);
  const [trial, setTrial] = useState(false);
  const [permission, setPermission] = useState(true);

  useEffect(() => {
    (async () => {
      setDaily((await AsyncStorage.getItem(DAILY_KEY)) === "1");
      setTrial((await AsyncStorage.getItem(TRIAL_KEY)) === "1");
      setPermission(await hasNotificationPermission());
    })();
  }, []);

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    setPermission(granted);
    if (!granted) {
      Alert.alert(t("notif.title"), t("notif.permissionNeeded"));
    }
    return granted;
  };

  const toggleDaily = async (value: boolean) => {
    if (value) {
      if (!(await ensurePermission())) return;
      await scheduleDailyReminder(REMINDER_HOUR, 0, t("app.name"), t("notif.reminderBody"));
    } else {
      await cancelDailyReminder();
    }
    setDaily(value);
    await AsyncStorage.setItem(DAILY_KEY, value ? "1" : "0");
  };

  const toggleTrial = async (value: boolean) => {
    if (value) {
      if (!(await ensurePermission())) return;
      const expiresAt = user?.subscription_expires_at
        ? new Date(user.subscription_expires_at)
        : null;
      if (expiresAt) {
        await scheduleTrialEndingReminder(expiresAt, t("app.name"), t("notif.trialAlertsDesc"));
      }
    } else {
      await cancelTrialEndingReminder();
    }
    setTrial(value);
    await AsyncStorage.setItem(TRIAL_KEY, value ? "1" : "0");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("notif.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {!permission && (daily || trial) && (
          <View style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
            <Text style={styles.warningText}>{t("notif.permissionNeeded")}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: "#EF444420" }]}>
              <Ionicons name="alarm-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{t("notif.dailyReminder")}</Text>
              <Text style={styles.subtitle}>{t("notif.dailyReminderDesc")}</Text>
            </View>
            <Switch
              value={daily}
              onValueChange={toggleDaily}
              trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.icon, { backgroundColor: "#F59E0B20" }]}>
              <Ionicons name="time-outline" size={22} color="#F59E0B" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{t("notif.trialAlerts")}</Text>
              <Text style={styles.subtitle}>{t("notif.trialAlertsDesc")}</Text>
            </View>
            <Switch
              value={trial}
              onValueChange={toggleTrial}
              trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
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
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  placeholder: { width: 40 },
  content: { flex: 1 },
  scrollContent: { padding: 20 },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: "#92400E" },
  card: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textWrap: { flex: 1, marginRight: 8 },
  title: { fontSize: 16, fontWeight: "500", color: "#1F2937" },
  subtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
});
