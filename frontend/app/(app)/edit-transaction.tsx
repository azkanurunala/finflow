import React, { useState, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
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

export default function EditTransactionScreen() {
  const router = useRouter();
  const { id, source, transcription } = useLocalSearchParams();
  const { currency, currencySymbol } = useCurrency();
  const { language, t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [displayAmount, setDisplayAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Other");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [transactionCurrency, setTransactionCurrency] = useState(currency);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  
  // Source info for displaying context
  const isFromVoice = source === "voice";
  const isFromReceipt = source === "receipt";
  const decodedTranscription = transcription ? decodeURIComponent(transcription as string) : null;

  // Format number with thousand separators
  const formatWithThousandSeparator = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    const parts = numericValue.split(".");
    let integerPart = parts[0] || "";
    const decimalPart = parts.length > 1 ? parts[1] : "";
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  };

  const handleAmountChange = (value: string) => {
    const rawValue = value.replace(/,/g, "");
    setAmount(rawValue);
    setDisplayAmount(formatWithThousandSeparator(rawValue));
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

  // Get all categories
  const getAllCategories = () => {
    const customCats = customCategories.map(cat => ({
      id: cat,
      icon: "pricetag",
      color: "#6366F1"
    }));
    return [...DEFAULT_CATEGORIES, ...customCats];
  };

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.get(
        `${BACKEND_URL}/api/transactions/${id}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      
      const t = response.data;
      const amountStr = t.amount.toString();
      setAmount(amountStr);
      setDisplayAmount(formatWithThousandSeparator(amountStr));
      setMerchant(t.merchant || "");
      setCategory(t.category);
      setTransactionType(t.transaction_type);
      setDate(new Date(t.date));
      setNotes(t.notes || "");
      // Use transaction's currency if exists, otherwise use user's global currency
      setTransactionCurrency(t.currency || currency);
      
      // If category is not in default list, add to custom categories
      const isDefaultCategory = DEFAULT_CATEGORIES.some(cat => cat.id === t.category);
      if (!isDefaultCategory && t.category !== "Income") {
        setCustomCategories([t.category]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load transaction");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    if (!amount || numericAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      await axios.put(
        `${BACKEND_URL}/api/transactions/${id}`,
        {
          amount: numericAmount,
          currency: transactionCurrency, // Use selected currency
          merchant: merchant || null,
          category: transactionType === "income" ? "Income" : category,
          date: date.toISOString().split("T")[0],
          transaction_type: transactionType,
          notes: notes || null,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      Alert.alert("Success", "Transaction updated!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem("session_token");
              await axios.delete(
                `${BACKEND_URL}/api/transactions/${id}`,
                { headers: { Authorization: `Bearer ${sessionToken}` } }
              );
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete transaction");
            }
          },
        },
      ]
    );
  };

  const getCurrencySymbol = (code: string) => {
    const symbols: { [key: string]: string } = {
      USD: "$", EUR: "€", GBP: "£", JPY: "¥", IDR: "Rp", SGD: "S$"
    };
    return symbols[code] || "$";
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isFromVoice || isFromReceipt 
              ? (language === 'id' ? 'Periksa & Simpan' : 'Review & Save')
              : (language === 'id' ? 'Edit Transaksi' : 'Edit Transaction')}
          </Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Source Badge */}
          {(isFromVoice || isFromReceipt) && (
            <View style={styles.sourceBadgeContainer}>
              <View style={[styles.sourceBadge, isFromVoice ? styles.voiceBadge : styles.receiptBadge]}>
                <Ionicons 
                  name={isFromVoice ? "mic" : "scan"} 
                  size={16} 
                  color={isFromVoice ? "#8B5CF6" : "#F59E0B"} 
                />
                <Text style={[styles.sourceBadgeText, isFromVoice ? styles.voiceBadgeText : styles.receiptBadgeText]}>
                  {isFromVoice 
                    ? (language === 'id' ? 'Dari Voice' : 'From Voice')
                    : (language === 'id' ? 'Dari Scan Receipt' : 'From Receipt Scan')}
                </Text>
              </View>
              <Text style={styles.reviewNote}>
                {language === 'id' 
                  ? 'Periksa data di bawah dan koreksi jika perlu'
                  : 'Review the data below and correct if needed'}
              </Text>
            </View>
          )}

          {/* Voice Transcription */}
          {isFromVoice && decodedTranscription && (
            <View style={styles.transcriptionBox}>
              <View style={styles.transcriptionHeader}>
                <Ionicons name="text" size={18} color="#8B5CF6" />
                <Text style={styles.transcriptionTitle}>
                  {language === 'id' ? 'Transkripsi' : 'Transcription'}
                </Text>
              </View>
              <Text style={styles.transcriptionText}>"{decodedTranscription}"</Text>
            </View>
          )}

          {/* Transaction Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, transactionType === "expense" && styles.typeButtonActive]}
              onPress={() => setTransactionType("expense")}
            >
              <Ionicons name="arrow-up" size={20} color={transactionType === "expense" ? "#fff" : "#EF4444"} />
              <Text style={[styles.typeButtonText, transactionType === "expense" && styles.typeButtonTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, styles.typeButtonIncome, transactionType === "income" && styles.typeButtonIncomeActive]}
              onPress={() => setTransactionType("income")}
            >
              <Ionicons name="arrow-down" size={20} color={transactionType === "income" ? "#fff" : "#10B981"} />
              <Text style={[styles.typeButtonText, transactionType === "income" && styles.typeButtonTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{getCurrencySymbol(transactionCurrency)}</Text>
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
            <Text style={styles.inputLabel}>Merchant / Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Starbucks, Salary, etc."
              placeholderTextColor="#9CA3AF"
              value={merchant}
              onChangeText={setMerchant}
            />
          </View>

          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.dateText}>
                {date.toLocaleDateString(transactionCurrency === "IDR" ? "id-ID" : "en-US", {
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

          {/* Category Selection */}
          {transactionType === "expense" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
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
                      {cat.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#10B981",
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
  sourceBadgeContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  voiceBadge: {
    backgroundColor: "#EDE9FE",
  },
  receiptBadge: {
    backgroundColor: "#FEF3C7",
  },
  sourceBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  voiceBadgeText: {
    color: "#8B5CF6",
  },
  receiptBadgeText: {
    color: "#F59E0B",
  },
  reviewNote: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  transcriptionBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  transcriptionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  transcriptionText: {
    fontSize: 15,
    color: "#4B5563",
    fontStyle: "italic",
    lineHeight: 22,
  },
});
