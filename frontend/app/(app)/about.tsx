import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../contexts/LanguageContext";

const APP_VERSION = "1.0.0";

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("about.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.logo}>
          <Ionicons name="wallet" size={44} color="#fff" />
        </View>
        <Text style={styles.appName}>{t("app.name")}</Text>
        <Text style={styles.tagline}>{t("app.tagline")}</Text>

        <View style={styles.card}>
          <Text style={styles.description}>{t("about.description")}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("about.version")}</Text>
            <Text style={styles.rowValue}>v{APP_VERSION}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => Linking.openURL("mailto:support@finflow.app")}
        >
          <View style={styles.row}>
            <Text style={styles.rowLabel}>support@finflow.app</Text>
            <Ionicons name="mail-outline" size={20} color="#4DB6AC" />
          </View>
        </TouchableOpacity>
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
  scrollContent: { padding: 20, alignItems: "center" },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  appName: { fontSize: 26, fontWeight: "bold", color: "#1F2937" },
  tagline: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 24, textAlign: "center" },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  description: { fontSize: 15, lineHeight: 22, color: "#374151" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 15, color: "#1F2937", fontWeight: "500" },
  rowValue: { fontSize: 15, color: "#6B7280" },
});
