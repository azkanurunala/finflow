import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLanguage } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function OnboardingBalanceScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { currency, currencySymbol } = useCurrency();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep only digits and a single decimal point.
  const numeric = (() => {
    const cleaned = amount.replace(/[^0-9.]/g, "");
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  })();

  const finish = async (withBalance: boolean) => {
    setLoading(true);
    try {
      if (withBalance && numeric > 0) {
        const sessionToken = await AsyncStorage.getItem("session_token");
        await axios.post(
          `${BACKEND_URL}/api/transactions/manual`,
          {
            amount: numeric,
            currency,
            merchant: null,
            category: "Income",
            date: new Date().toISOString().split("T")[0],
            transaction_type: "income",
            notes: t("onboarding.openingBalanceNote"),
          },
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
    } catch (e) {
      // Non-blocking: even if saving the opening balance fails, let the user in.
    } finally {
      setLoading(false);
      router.replace("/(app)");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
        <Text style={styles.stepText}>{t("onboarding.step", { current: 4, total: 4 })}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="wallet" size={48} color="#4DB6AC" />
        </View>

        <Text style={styles.title}>{t("onboarding.initialBalance")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.initialBalanceSubtitle")}</Text>

        <View style={styles.inputWrap}>
          <Text style={styles.symbol}>{currencySymbol}</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text style={styles.code}>{currency}</Text>
        </View>
        <Text style={styles.hint}>{t("onboarding.initialBalanceHint")}</Text>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => finish(true)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {numeric > 0 ? t("onboarding.finish") : t("onboarding.skip")}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
        {numeric > 0 && (
          <TouchableOpacity onPress={() => finish(false)} disabled={loading} style={styles.skipLink}>
            <Text style={styles.skipLinkText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  progressBar: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#4DB6AC" },
  stepText: { fontSize: 12, color: "#6B7280", marginTop: 8, textAlign: "center" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1F2937", textAlign: "center", marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#4DB6AC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  symbol: { fontSize: 24, fontWeight: "700", color: "#4DB6AC", marginRight: 8 },
  input: { flex: 1, fontSize: 28, fontWeight: "700", color: "#1F2937", padding: 0 },
  code: { fontSize: 14, color: "#9CA3AF", fontWeight: "600", marginLeft: 8 },
  hint: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginTop: 12 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  skipLink: { alignItems: "center", paddingVertical: 14 },
  skipLinkText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
});
