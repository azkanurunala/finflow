import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function SecurityScreen() {
  const router = useRouter();
  const { user, changePassword, logout } = useAuth();
  const { t } = useLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // OAuth-only accounts (Google/Apple) have no password to change.
  const hasPassword = user?.has_password !== false;

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleChange = async () => {
    if (next.length < 6) {
      Alert.alert(t("common.error"), t("security.tooShort"));
      return;
    }
    if (next !== confirm) {
      Alert.alert(t("common.error"), t("security.mismatch"));
      return;
    }
    setSaving(true);
    const r = await changePassword(current, next);
    setSaving(false);
    if (r.success) {
      setCurrent("");
      setNext("");
      setConfirm("");
      Alert.alert(t("common.success"), t("security.changed"));
      router.back();
    } else {
      Alert.alert(t("common.error"), r.error || "");
    }
  };

  const canSubmit = current.length > 0 && next.length > 0 && confirm.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("security.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {hasPassword ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>{t("security.currentPassword")}</Text>
                <TextInput
                  style={styles.input}
                  value={current}
                  onChangeText={setCurrent}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.card}>
                <Text style={styles.label}>{t("security.newPassword")}</Text>
                <TextInput
                  style={styles.input}
                  value={next}
                  onChangeText={setNext}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.card}>
                <Text style={styles.label}>{t("security.confirmPassword")}</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, (!canSubmit || saving) && styles.saveButtonDisabled]}
                onPress={handleChange}
                disabled={!canSubmit || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{t("security.changePassword")}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noteCard}>
              <Ionicons name="shield-checkmark-outline" size={28} color="#4DB6AC" />
              <Text style={styles.noteText}>{t("security.socialNote")}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.logoutText}>{t("auth.logout")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: { fontSize: 16, color: "#1F2937", padding: 0 },
  saveButton: {
    backgroundColor: "#4DB6AC",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonDisabled: { backgroundColor: "#9CA3AF" },
  saveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  noteCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  noteText: { fontSize: 14, lineHeight: 21, color: "#6B7280", textAlign: "center" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
});
