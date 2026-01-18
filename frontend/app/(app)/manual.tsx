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
import { apiClient } from "../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import DateTimePicker from "@react-native-community/datetimepicker";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const DEFAULT_CATEGORIES = [
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
  const { currency, currencySymbol, formatInputValue, parseInputValue, getDecimalSeparator } = useCurrency();
  const { t } = useLanguage();

  const [displayAmount, setDisplayAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Other");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Handle amount input change with proper currency formatting
  // IDR: 1.250.000,50 (. for thousands, , for decimals)
  // USD/etc: 1,250.00 (, for thousands, . for decimals)
  const handleAmountChange = (value: string) => {
    const formatted = formatInputValue(value);
    setDisplayAmount(formatted);
  };

  // Add custom category
  const handleAddCategory = () => {
    if (newCategoryInput.trim() && !customCategories.includes(newCategoryInput.trim())) {
      const newCategory = newCategoryInput.trim();
      setCustomCategories([...customCategories, newCategory]);
      setCategory(newCategory);
      setNewCategoryInput("");
      setShowAddCategory(false);
    }
  };

  // Get all categories (default + custom)
  const getAllCategories = () => {
    const customCats = customCategories.map(cat => ({
      id: cat,
      icon: "pricetag",
      color: "#6366F1"
    }));
    return [...DEFAULT_CATEGORIES, ...customCats];
  };

  const handleSave = async () => {
    // Parse the formatted display amount back to numeric value
    const numericAmount = parseInputValue(displayAmount);
    if (!displayAmount || numericAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      await apiClient.post(
        `/api/transactions/manual`,
        {
          amount: numericAmount,
          currency: currency, // Use user's global currency setting
          merchant: merchant || null,
          category: transactionType === "income" ? "Income" : category,
          date: date.toISOString().split("T")[0],
          transaction_type: transactionType,
          notes: notes || null,
        }
      );

      Alert.alert("Success", "Transaction saved!", [
        { text: "Add Another", onPress: () => resetForm() },
        { text: "Go Home", onPress: () => router.replace("/(app)") },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDisplayAmount("");
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
          <Text style={styles.headerTitle}>{t('add.title')}</Text>
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
                {t('home.expenses')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, styles.typeButtonIncome, transactionType === "income" && styles.typeButtonIncomeActive]}
              onPress={() => setTransactionType("income")}
            >
              <Ionicons name="arrow-down" size={20} color={transactionType === "income" ? "#fff" : "#10B981"} />
              <Text style={[styles.typeButtonText, transactionType === "income" && styles.typeButtonTextActive]}>
                {t('home.income')}
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
              value={displayAmount}
              onChangeText={handleAmountChange}
            />
          </View>

          {/* Merchant Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('manual.desc')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('manual.placeholderDesc')}
              placeholderTextColor="#9CA3AF"
              value={merchant}
              onChangeText={setMerchant}
            />
          </View>

          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('manual.date')}</Text>
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
              <Text style={styles.inputLabel}>{t('manual.category')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScrollView}
                contentContainerStyle={styles.categoriesScrollContent}
              >
                {getAllCategories().map((cat) => (
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
                      {cat.id}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Add Custom Category Button */}
                <TouchableOpacity
                  style={styles.addCategoryChip}
                  onPress={() => setShowAddCategory(true)}
                >
                  <Ionicons name="add" size={16} color="#4DB6AC" />
                  <Text style={styles.addCategoryText}>{t('manual.add')}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Add Category Input */}
              {showAddCategory && (
                <View style={styles.addCategoryContainer}>
                  <TextInput
                    style={styles.addCategoryInput}
                    placeholder={t('manual.customPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    value={newCategoryInput}
                    onChangeText={setNewCategoryInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.addCategoryButton}
                    onPress={handleAddCategory}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelCategoryButton}
                    onPress={() => {
                      setShowAddCategory(false);
                      setNewCategoryInput("");
                    }}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Add any additional notes..."
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
                <Text style={styles.saveButtonText}>{t('manual.save')}</Text>
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
  categoriesScrollView: {
    marginHorizontal: -20,
  },
  categoriesScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: "row",
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
  addCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E0F2F1",
    borderWidth: 1,
    borderColor: "#4DB6AC",
    borderStyle: "dashed",
  },
  addCategoryText: {
    fontSize: 13,
    color: "#4DB6AC",
    fontWeight: "500",
  },
  addCategoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  addCategoryInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  addCategoryButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelCategoryButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
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
