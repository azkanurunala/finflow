import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiClient } from "../../api/client";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import BottomNavWithAddModal from "../../components/BottomNavWithAddModal";
import TransactionFilter, {
  defaultFilters,
  applyFiltersAndSort,
  SortOption,
  DatePreset
} from "../../components/TransactionFilter";

import { CONFIG } from "../../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  merchant?: string;
  category: string;
  date: string;
  created_at?: string;
  transaction_type: string;
  notes?: string;
  source: string;
}

type TabType = "all" | "income" | "expense";

export default function HistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, language } = useLanguage();
  const { formatAmount } = useCurrency();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [filters, setFilters] = useState(defaultFilters);

  // Handle deep-linking from Home screen
  useEffect(() => {
    const tab = params.tab as string;
    if (tab === "income" || tab === "expense" || tab === "all") {
      setActiveTab(tab as TabType);
    }
  }, [params.tab]);

  const fetchTransactions = useCallback(async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await apiClient.get(`/api/transactions`);
      setTransactions(response.data.transactions || []);
    } catch (error) {
      Alert.alert(t('common.error'), "Failed to fetch transactions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t('common.delete'),
      language === 'id' ? "Yakin ingin menghapus transaksi ini?" : "Are you sure you want to delete this transaction?",
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('common.delete'),
          style: "destructive",
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem("session_token");
              await apiClient.delete(`/api/transactions/${id}`);
              setTransactions((prev) => prev.filter((t) => t.id !== id));
            } catch (error) {
              Alert.alert(t('common.error'), "Failed to delete transaction");
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      Groceries: "cart",
      "Dining & Coffee": "restaurant",
      Transportation: "car",
      "Rent & Utilities": "home",
      Subscriptions: "refresh",
      Healthcare: "medical",
      Insurance: "shield-checkmark",
      Entertainment: "game-controller",
      Shopping: "bag",
      Travel: "airplane",
      Income: "cash",
      Other: "ellipsis-horizontal",
    };
    return icons[category] || "ellipsis-horizontal";
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      Groceries: "#10B981",
      "Dining & Coffee": "#F59E0B",
      Transportation: "#3B82F6",
      "Rent & Utilities": "#8B5CF6",
      Subscriptions: "#EC4899",
      Healthcare: "#EF4444",
      Insurance: "#06B6D4",
      Entertainment: "#F97316",
      Shopping: "#84CC16",
      Travel: "#6366F1",
      Income: "#10B981",
      Other: "#6B7280",
    };
    return colors[category] || "#4DB6AC";
  };

  const getSourceIcon = (source: string) => {
    const icons: { [key: string]: any } = {
      chat: "chatbubble",
      receipt: "camera",
      voice: "mic",
      manual: "create",
    };
    return icons[source] || "document";
  };

  // Apply filters and get displayed transactions
  const displayedTransactions = applyFiltersAndSort(transactions, filters, activeTab);

  // Calculate totals for tabs
  const totals = {
    all: transactions.length,
    income: transactions.filter((t) => t.transaction_type === "income").length,
    expense: transactions.filter((t) => t.transaction_type === "expense").length,
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "all", label: language === 'id' ? "Semua" : "All", count: totals.all },
    { id: "income", label: language === 'id' ? "Pemasukan" : "Income", count: totals.income },
    { id: "expense", label: language === 'id' ? "Pengeluaran" : "Expenses", count: totals.expense },
  ];

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const categoryColor = getCategoryColor(item.category);

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => router.push(`/(app)/edit-transaction?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${categoryColor}20` }]}>
            <Ionicons
              name={getCategoryIcon(item.category)}
              size={24}
              color={categoryColor}
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.merchantText}>
              {item.merchant || "Unknown Merchant"}
            </Text>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{item.category}</Text>
              <View style={styles.separator} />
              <Ionicons
                name={getSourceIcon(item.source)}
                size={12}
                color="#6B7280"
              />
              <Text style={styles.sourceText}>{item.source}</Text>
            </View>
          </View>
          <View style={styles.amountContainer}>
            <Text
              style={[
                styles.amountText,
                item.transaction_type === "income" && styles.incomeAmount,
              ]}
            >
              {item.transaction_type === "income" ? "+" : "-"}
              {formatAmount(item.amount, item.currency || 'USD')}
            </Text>
            <Text style={styles.dateText}>
              {format(new Date(item.date), "MMM dd")}
            </Text>
          </View>
        </View>
        {item.notes && <Text style={styles.notesText}>{item.notes}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'id' ? "Riwayat Transaksi" : "Transaction History"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter & Sort */}
      <TransactionFilter filters={filters} onFiltersChange={setFilters} />

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : displayedTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            {activeTab === "all"
              ? (language === 'id' ? "Belum ada transaksi" : "No transactions yet")
              : activeTab === "income"
                ? (language === 'id' ? "Belum ada pemasukan" : "No income yet")
                : (language === 'id' ? "Belum ada pengeluaran" : "No expenses yet")}
          </Text>
          <Text style={styles.emptySubtext}>
            {language === 'id' ? "Mulai catat keuangan Anda" : "Start logging your finances"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4DB6AC"
            />
          }
        />
      )}

      <BottomNavWithAddModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    backgroundColor: "#F9FAFB",
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
  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  tabActive: {
    backgroundColor: "#10B981",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#fff",
  },
  tabBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabBadgeTextActive: {
    color: "#fff",
  },
  // Content
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  transactionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    position: "relative",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  merchantText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    color: "#6B7280",
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: "#D1D5DB",
  },
  sourceText: {
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "capitalize",
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#EF4444",
  },
  incomeAmount: {
    color: "#10B981",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  notesText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
    fontStyle: "italic",
  },
});
