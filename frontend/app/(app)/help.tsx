import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../contexts/LanguageContext";

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const faqs = [
    { q: t("help.q1"), a: t("help.a1") },
    { q: t("help.q2"), a: t("help.a2") },
    { q: t("help.q3"), a: t("help.a3") },
    { q: t("help.q4"), a: t("help.a4") },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>{t("help.intro")}</Text>

        {faqs.map((f, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.qRow}>
              <Ionicons name="help-circle" size={20} color="#4DB6AC" />
              <Text style={styles.question}>{f.q}</Text>
            </View>
            <Text style={styles.answer}>{f.a}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.contactCard}
          activeOpacity={0.7}
          onPress={() => Linking.openURL("mailto:support@finflow.app")}
        >
          <Ionicons name="mail-outline" size={20} color="#4DB6AC" />
          <Text style={styles.contactText}>{t("help.contact")}</Text>
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
  scrollContent: { padding: 20 },
  intro: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  qRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  question: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1F2937" },
  answer: { fontSize: 14, lineHeight: 21, color: "#6B7280" },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  contactText: { fontSize: 14, fontWeight: "500", color: "#4DB6AC" },
});
