import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Transaction {
  id: string;
  amount: number;
  currency?: string;
  merchant?: string;
  category: string;
  date: string;
  transaction_type: string;
  source: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      // Fetch recent transactions
      const transactionsRes = await axios.get(
        `${BACKEND_URL}/api/transactions?limit=5`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      
      // Fetch insights
      const insightsRes = await axios.get(
        `${BACKEND_URL}/api/insights?days=30`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setTransactions(transactionsRes.data.transactions);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 18) return t('home.goodAfternoon');
    return t('home.goodEvening');
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      "Groceries": "cart",
      "Dining & Coffee": "restaurant",
      "Transportation": "car",
      "Rent & Utilities": "home",
      "Subscriptions": "refresh",
      "Healthcare": "medical",
      "Insurance": "shield-checkmark",
      "Entertainment": "game-controller",
      "Shopping": "bag",
      "Travel": "airplane",
      "Income": "cash",
      "Other": "ellipsis-horizontal",
    };
    return icons[category] || "ellipsis-horizontal";
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return "Yesterday";
    return format(date, "MMM dd");
  };

  const totalBalance = insights 
    ? insights.total_income - insights.total_expenses 
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4DB6AC"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.onlineIndicator} />
            </View>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#1F2937" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('home.totalBalance')}</Text>
          <Text style={styles.balanceAmount}>
            {formatAmount(totalBalance, 'USD')}
          </Text>
        </View>

        {/* Income & Expenses Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.incomeCard]}>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>{t('home.income')}</Text>
              <Text style={styles.incomeAmount} numberOfLines={1} adjustsFontSizeToFit>
                +{formatAmount(insights?.total_income || 0)}
              </Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.expenseCard]}>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>{t('home.expenses')}</Text>
              <Text style={styles.expenseAmount} numberOfLines={1} adjustsFontSizeToFit>
                -{formatAmount(insights?.total_expenses || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(app)/chat")}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={["#E0F2F1", "#B2DFDB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#4DB6AC" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t('actions.askAssistant')}</Text>
                <Text style={styles.actionSubtitle}>
                  {t('actions.askAssistantDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#4DB6AC" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(app)/add?mode=camera")}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={["#FEF3C7", "#FDE68A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="camera" size={24} color="#F59E0B" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t('actions.scanReceipt')}</Text>
                <Text style={styles.actionSubtitle}>
                  {t('actions.scanReceiptDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(app)/add?mode=voice")}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={["#EDE9FE", "#DDD6FE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="mic" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t('actions.voiceLog')}</Text>
                <Text style={styles.actionSubtitle}>
                  {t('actions.voiceLogDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentActivity')}</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/history")}>
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t('home.noTransactions')}</Text>
              <Text style={styles.emptySubtext}>
                {t('home.startLogging')}
              </Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionIconContainer}>
                  <Ionicons
                    name={getCategoryIcon(transaction.category)}
                    size={24}
                    color="#4DB6AC"
                  />
                </View>
                <View style={styles.transactionContent}>
                  <Text style={styles.transactionMerchant}>
                    {transaction.merchant || "Unknown"}
                  </Text>
                  <View style={styles.transactionMeta}>
                    <Text style={styles.transactionCategory}>
                      {transaction.category}
                    </Text>
                    <Text style={styles.transactionDot}> • </Text>
                    <Text style={styles.transactionTime}>
                      {getTimeAgo(transaction.date)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.transaction_type === "income" &&
                      styles.transactionIncome,
                  ]}
                >
                  {transaction.transaction_type === "income" ? "+" : "-"}
                  {formatAmount(transaction.amount, transaction.currency || 'USD')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#4DB6AC" />
          <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/history")}
        >
          <Ionicons name="list-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Transactions</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#F9FAFB",
  },
  greeting: {
    fontSize: 12,
    color: "#6B7280",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  balanceCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1F2937",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    gap: 12,
  },
  incomeCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  expenseCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  viewAllText: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "500",
  },
  actionCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  actionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 2,
  },
  transactionMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  transactionCategory: {
    fontSize: 13,
    color: "#6B7280",
  },
  transactionDot: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  transactionTime: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  transactionIncome: {
    color: "#10B981",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 8,
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
