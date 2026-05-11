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
import { apiClient } from "../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import DateTimePicker from "@react-native-community/datetimepicker";

import { CONFIG } from "../../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

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
  const { currency, currencySymbol, formatInputValue, parseInputValue, getDecimalSeparator } = useCurrency();
  const { language, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const response = await apiClient.get(`/api/transactions/${id}`);

      const txData = response.data;
      
      // Get the transaction's currency (or fallback to user's currency)
      const txCurrency = txData.currency || currency;
      setTransactionCurrency(txCurrency);
      
      // Format the amount properly based on the transaction's currency
      // The amount from server is a number like 7878999.56
      // We need to convert it to display format:
      // - IDR: 7.878.999,56
      // - USD: 7,878,999.56
      const isIDRFormat = ['IDR', 'VND'].includes(txCurrency);
      let formattedAmount: string;
      
      if (isIDRFormat) {
        // For IDR: convert 7878999.56 to "7.878.999,56"
        const hasDecimals = txData.amount % 1 !== 0;
        const [intPart, decPart] = txData.amount.toFixed(2).split('.');
        
        // Add thousand separators with dots for IDR
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        if (hasDecimals && decPart !== '00') {
          formattedAmount = `${formattedInt},${decPart}`;
        } else {
          formattedAmount = formattedInt;
        }
      } else {
        // For USD and others: convert 7878999.56 to "7,878,999.56"
        const [intPart, decPart] = txData.amount.toFixed(2).split('.');
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        if (decPart && decPart !== '00') {
          formattedAmount = `${formattedInt}.${decPart}`;
        } else {
          formattedAmount = formattedInt;
        }
      }
      
      setDisplayAmount(formattedAmount);
      setMerchant(txData.merchant || "");
      setCategory(txData.category);
      setTransactionType(txData.transaction_type);
      setDate(new Date(txData.date));
      setNotes(txData.notes || "");

      // If category is not in default list, add to custom categories
      const isDefaultCategory = DEFAULT_CATEGORIES.some(cat => cat.id === txData.category);
      if (!isDefaultCategory && txData.category !== "Income") {
        setCustomCategories([txData.category]);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('edit.failedLoad'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Parse the formatted display amount back to numeric value
    const numericAmount = parseInputValue(displayAmount);
    if (!displayAmount || numericAmount <= 0) {
      Alert.alert(t('common.error'), t('edit.enterValidAmount'));
      return;
    }

    setSaving(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      await apiClient.put(
        `/api/transactions/${id}`,
        {
          amount: numericAmount,
          currency: transactionCurrency, // Use selected currency
          merchant: merchant || null,
          category: transactionType === "income" ? "Income" : category,
          date: date.toISOString().split("T")[0],
          transaction_type: transactionType,
          notes: notes || null,
        }
      );

      Alert.alert(t('common.success'), t('edit.transactionUpdated'), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('edit.failedUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('edit.deleteTitle'),
      t('edit.deleteDesc'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('edit.deleteConfirm'),
          style: "destructive",
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem("session_token");
              await apiClient.delete(`/api/transactions/${id}`);
              router.back();
            } catch (error) {
              Alert.alert(t('common.error'), t('edit.failedDelete'));
            }
          },
        },
      ]
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
              ? t('edit.reviewTitle')
              : t('edit.title')}
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
                    ? t('edit.fromVoice')
                    : t('edit.fromReceipt')}
                </Text>
              </View>
              <Text style={styles.reviewNote}>
                {t('edit.reviewNote')}
              </Text>
            </View>
          )}

          {/* Voice Transcription */}
          {isFromVoice && decodedTranscription && (
            <View style={styles.transcriptionBox}>
              <View style={styles.transcriptionHeader}>
                <Ionicons name="text" size={18} color="#8B5CF6" />
                <Text style={styles.transcriptionTitle}>
                  {t('edit.transcription')}
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
            <Text style={styles.inputLabel}>{t('manual.notesOptional') || 'Notes (optional)'}</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder={t('manual.notesPlaceholder') || 'Add any additional notes...'}
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
                <Text style={styles.saveButtonText}>{t('edit.saveChanges')}</Text>
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
