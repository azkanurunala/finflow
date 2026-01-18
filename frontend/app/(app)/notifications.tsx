import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { apiClient } from "../../api/client";
import { useLanguage } from "../../contexts/LanguageContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatDistanceToNow } from "date-fns";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    push: true,
    email: true,
    system: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem("notification_settings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load settings");
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem("notification_settings", JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings");
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    saveSettings({ ...settings, [key]: !settings[key] });
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await apiClient.get(`/api/notifications`);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error("Fetch notifications error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await apiClient.post(
        `/api/notifications/${notificationId}/read`,
        {}
      );

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await apiClient.post(
        `/api/notifications/read-all`,
        {}
      );

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Mark all as read error:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, { name: string; color: string; bg: string }> = {
      transaction_created: { name: "receipt", color: "#10B981", bg: "#D1FAE5" },
      subscription_activated: { name: "diamond", color: "#8B5CF6", bg: "#EDE9FE" },
      subscription_expiring: { name: "warning", color: "#F59E0B", bg: "#FEF3C7" },
      trial_started: { name: "rocket", color: "#3B82F6", bg: "#DBEAFE" },
      budget_alert: { name: "alert-circle", color: "#EF4444", bg: "#FEE2E2" },
      general: { name: "notifications", color: "#6B7280", bg: "#F3F4F6" },
    };
    return icons[type] || icons.general;
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return t('notifications.justNow');
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case "transaction_created":
        if (notification.data?.transaction_id) {
          router.push(`/(app)/edit-transaction?id=${notification.data.transaction_id}`);
        }
        break;
      case "subscription_activated":
      case "subscription_expiring":
        router.push("/(app)/subscription");
        break;
      case "budget_alert":
        router.push("/(app)/insights");
        break;
      default:
        break;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name as any} size={22} color={icon.color} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !item.read && styles.unreadTitle]}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>{t('notifications.readAll')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('notifications.settings.title')}</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('notifications.settings.push')}</Text>
              <Switch
                value={settings.push}
                onValueChange={() => toggleSetting('push')}
                trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('notifications.settings.email')}</Text>
              <Switch
                value={settings.email}
                onValueChange={() => toggleSetting('email')}
                trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('notifications.settings.system')}</Text>
              <Switch
                value={settings.system}
                onValueChange={() => toggleSetting('system')}
                trackColor={{ false: "#D1D5DB", true: "#4DB6AC" }}
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.saveButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#4DB6AC"]}
              tintColor="#4DB6AC"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('notifications.emptyDesc')}
          </Text>
        </View>
      )}
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
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    gap: 12,
  },
  unreadItem: {
    backgroundColor: "#F0FDF4",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4DB6AC",
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  settingsButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingLabel: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#4DB6AC",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
