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
import { useRouter } from "expo-router";
import axios from "axios";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  merchant?: string;
  category: string;
  date: string;
  transaction_type: string;
  notes?: string;
  source: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.get(`${BACKEND_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setTransactions(response.data.transactions);
    } catch (error) {
      Alert.alert(t('common.error'), "Failed to fetch transactions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t('common.delete'),
      "Are you sure you want to delete this transaction?",
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('common.delete'),
          style: "destructive",
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem("session_token");
              await axios.delete(`${BACKEND_URL}/api/transactions/${id}`, {
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
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
    };
    return icons[source] || "document";
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const categoryColor = getCategoryColor(item.category);
    
    return (
      <View style={styles.transactionCard}>
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
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('home.noTransactions')}</Text>
          <Text style={styles.emptySubtext}>
            {t('home.startLogging')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
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

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)")}
        >
          <Ionicons name="home-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="list" size={24} color="#4DB6AC" />
          <Text style={[styles.navText, styles.navTextActive]}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() => router.push("/(app)/add")}
        >
          <View style={styles.navCenterButton}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/insights")}
        >
          <Ionicons name="analytics-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/profile")}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
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
  deleteButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    padding: 8,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: 8,
    paddingTop: 8,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navItemCenter: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
    elevation: 4,
    shadowColor: "#4DB6AC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  navText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  navTextActive: {
    color: "#4DB6AC",
    fontWeight: "600",
  },
});
