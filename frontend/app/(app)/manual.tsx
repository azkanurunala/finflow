import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { translateCategory } from "../../utils/i18n";
import DateTimePicker from "@react-native-community/datetimepicker";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const CATEGORIES = [
  { id: "Income", icon: "cash", color: "#10B981" },
  { id: "Groceries", icon: "cart", color: "#10B981" },
  { id: "Dining & Coffee", icon: "restaurant", color: "#F59E0B" },
  { id: "Transportation", icon: "car", color: "#3B82F6" },
  { id: "Rent & Utilities", icon: "home", color: "#8B5CF6" },
  { id: "Subscriptions", icon: "refresh", color: "#EC4899" },
  { id: "Healthcare", icon: "medical", color: "#EF4444" },
  { id: "Entertainment", icon: "game-controller", color: "#F97316" },
  { id: "Shopping", icon: "bag", color: "#84CC16" },
  { id: "Travel", icon: "airplane", color: "#6366F1" },
  { id: "Other", icon: "ellipsis-horizontal", color: "#6B7280" },
];

export default function ManualInputScreen() {
  const router = useRouter();
  const { currency, currencySymbol } = useCurrency();
  const { t } = useLanguage();
  
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Other");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const formatInputAmount = (value: string) => {
    // Remove non-numeric characters except decimal point/comma
    let cleaned = value.replace(/[^0-9.,]/g, "");
    
    // Handle Indonesian format (comma as decimal)
    if (currency === "IDR") {
      cleaned = cleaned.replace(/\./g, ""); // Remove thousand separators
      cleaned = cleaned.replace(",", "."); // Convert decimal comma to point
    } else {
      cleaned = cleaned.replace(/,/g, ""); // Remove thousand separators
    }
    
    return cleaned;
  };

  const handleSave = async () => {
    if (!amount || parseFloat(formatInputAmount(amount)) <= 0) {
      Alert.alert(t('common.error'), t('form.enterValidAmount'));
      return;
    }

    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const numericAmount = parseFloat(formatInputAmount(amount));
      
      await axios.post(
        `${BACKEND_URL}/api/transactions/manual`,
        {
          amount: numericAmount,
          currency: currency,
          merchant: merchant || null,
          category: transactionType === "income" ? "Income" : category,
          date: date.toISOString().split("T")[0],
          transaction_type: transactionType,
          notes: notes || null,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      Alert.alert(t('common.success'), t('manual.transactionSaved'), [
        { text: t('manual.addAnother'), onPress: () => resetForm() },
        { text: t('manual.goHome'), onPress: () => router.replace("/(app)") },
      ]);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('form.failSave'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setMerchant("");
    setCategory("Other");
    setTransactionType("expense");
    setDate(new Date());
    setNotes("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('manual.addTransaction')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Transaction Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, transactionType === "expense" && styles.typeButtonActive]}
              onPress={() => setTransactionType("expense")}
            >
              <Ionicons name="arrow-up" size={20} color={transactionType === "expense" ? "#fff" : "#EF4444"} />
              <Text style={[styles.typeButtonText, transactionType === "expense" && styles.typeButtonTextActive]}>
                {t('form.expense')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, styles.typeButtonIncome, transactionType === "income" && styles.typeButtonIncomeActive]}
              onPress={() => setTransactionType("income")}
            >
              <Ionicons name="arrow-down" size={20} color={transactionType === "income" ? "#fff" : "#10B981"} />
              <Text style={[styles.typeButtonText, transactionType === "income" && styles.typeButtonTextActive]}>
                {t('form.income')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{currencySymbol}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* Merchant Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('form.merchantDescription')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('form.merchantPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={merchant}
              onChangeText={setMerchant}
            />
          </View>

          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('form.date')}</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.dateText}>
                {date.toLocaleDateString(currency === "IDR" ? "id-ID" : "en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          {/* Category Selection (only for expenses) */}
          {transactionType === "expense" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('form.category')}</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.filter(c => c.id !== "Income").map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      category === cat.id && { backgroundColor: cat.color + "20", borderColor: cat.color },
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={16}
                      color={category === cat.id ? cat.color : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.id && { color: cat.color },
                      ]}
                    >
                      {translateCategory(cat.id)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('form.notesOptional')}</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder={t('form.notesPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>{t('manual.saveTransaction')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  keyboardView: {
    flex: 1,
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
    backgroundColor: "#F3F4F6",
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
    padding: 20,
  },
  typeToggle: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    borderWidth: 2,
    borderColor: "#FEE2E2",
  },
  typeButtonActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  typeButtonIncome: {
    backgroundColor: "#D1FAE5",
    borderColor: "#D1FAE5",
  },
  typeButtonIncomeActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    paddingVertical: 16,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1F2937",
    minWidth: 100,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 16,
    color: "#1F2937",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
