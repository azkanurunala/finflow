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

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, updateName } = useAuth();
  const { t, language } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const memberSince = (() => {
    if (!user?.created_at) return null;
    try {
      return new Date(user.created_at).toLocaleDateString(language, {
        year: "numeric",
        month: "long",
      });
    } catch {
      return null;
    }
  })();

  const dirty = name.trim().length > 0 && name.trim() !== (user?.name ?? "");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t("common.error"), t("account.nameRequired"));
      return;
    }
    setSaving(true);
    const r = await updateName(trimmed);
    setSaving(false);
    if (r.success) {
      Alert.alert(t("common.success"), t("account.saved"));
      router.back();
    } else {
      Alert.alert(t("common.error"), r.error || "");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("account.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || "?"}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("account.name")}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("account.name")}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("account.email")}</Text>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyValue}>{user?.email}</Text>
              <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
            </View>
          </View>

          {memberSince && (
            <View style={styles.card}>
              <Text style={styles.label}>{t("account.memberSince")}</Text>
              <Text style={styles.readonlyValue}>{memberSince}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, (!dirty || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>{t("account.save")}</Text>
            )}
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
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
  readonlyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  readonlyValue: { fontSize: 16, color: "#6B7280" },
  saveButton: {
    backgroundColor: "#4DB6AC",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonDisabled: { backgroundColor: "#9CA3AF" },
  saveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
