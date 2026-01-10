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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/transactions`);
      setTransactions(response.data.transactions);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch transactions");
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
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(`${BACKEND_URL}/api/transactions/${id}`);
              setTransactions((prev) => prev.filter((t) => t.id !== id));
            } catch (error) {
              Alert.alert("Error", "Failed to delete transaction");
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

  const getSourceIcon = (source: string) => {
    const icons: { [key: string]: any } = {
      chat: "chatbubble",
      receipt: "camera",
      voice: "mic",
    };
    return icons[source] || "document";
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={getCategoryIcon(item.category)}
            size={24}
            color="#667eea"
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
              color="#64748b"
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
            {item.transaction_type === "income" ? "+" : "-"}$
            {item.amount.toFixed(2)}
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
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#64748b" />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>
            Start logging your expenses to see them here
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
              tintColor="#667eea"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E27",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
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
    fontSize: 20,
    fontWeight: "600",
    color: "#e2e8f0",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  transactionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    position: "relative",
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(102, 126, 234, 0.2)",
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
    color: "#fff",
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: "#475569",
  },
  sourceText: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "capitalize",
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ef4444",
  },
  incomeAmount: {
    color: "#10b981",
  },
  dateText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  notesText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 8,
    fontStyle: "italic",
  },
  deleteButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    padding: 8,
  },
});
