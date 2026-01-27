import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../contexts/NetworkContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function OfflineBanner() {
  const { isOnline, isReachable, isSyncing, syncStatus, forceSync } = useNetwork();
  const { language } = useLanguage();

  const isOffline = !isOnline || !isReachable;

  // Don't show anything if online and not syncing
  if (!isOffline && syncStatus === "idle") {
    return null;
  }

  // Syncing state
  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <ActivityIndicator size="small" color="#fff" style={styles.icon} />
        <Text style={styles.text}>
          {language === "id" ? "Menyinkronkan..." : "Syncing..."}
        </Text>
      </View>
    );
  }

  // Offline state
  if (isOffline) {
    return (
      <View style={[styles.container, styles.offlineContainer]}>
        <Ionicons name="cloud-offline-outline" size={16} color="#fff" style={styles.icon} />
        <Text style={styles.text}>
          {language === "id" ? "Mode Offline" : "Offline Mode"}
        </Text>
        <TouchableOpacity onPress={forceSync} style={styles.retryButton}>
          <Ionicons name="refresh" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // Sync success (briefly shown)
  if (syncStatus === "success") {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.icon} />
        <Text style={styles.text}>
          {language === "id" ? "Tersinkronisasi" : "Synced"}
        </Text>
      </View>
    );
  }

  // Sync error
  if (syncStatus === "error") {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Ionicons name="alert-circle" size={16} color="#fff" style={styles.icon} />
        <Text style={styles.text}>
          {language === "id" ? "Gagal sinkronisasi" : "Sync failed"}
        </Text>
        <TouchableOpacity onPress={forceSync} style={styles.retryButton}>
          <Text style={styles.retryText}>
            {language === "id" ? "Coba lagi" : "Retry"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineContainer: {
    backgroundColor: "#6B7280",
  },
  syncingContainer: {
    backgroundColor: "#3B82F6",
  },
  successContainer: {
    backgroundColor: "#10B981",
  },
  errorContainer: {
    backgroundColor: "#EF4444",
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  retryButton: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
});
