import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface Insights {
  total_expenses: number;
  total_income: number;
  net: number;
  by_category: { [key: string]: number };
  period: string;
}

export default function InsightsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    fetchInsights();
  }, [selectedPeriod]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.get(
        `${BACKEND_URL}/api/insights?days=${selectedPeriod}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setInsights(response.data);
    } catch (error) {
      console.error("Failed to fetch insights", error);
    } finally {
      setLoading(false);
    }
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

  const renderCategoryBar = (
    category: string,
    amount: number,
    index: number,
    maxAmount: number
  ) => {
    const percentage = (amount / maxAmount) * 100;
    const barWidth = (percentage / 100) * (SCREEN_WIDTH - 100);
    const color = getCategoryColor(category);

    return (
      <View key={category} style={styles.categoryItem}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryLeft}>
            <View style={[styles.categoryIcon, { backgroundColor: `${color}20` }]}>
              <Ionicons name={getCategoryIcon(category)} size={16} color={color} />
            </View>
            <Text style={styles.categoryName}>{category}</Text>
          </View>
          <Text style={styles.categoryAmount}>{formatAmount(amount, 'USD')}</Text>
        </View>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              {
                width: barWidth,
                backgroundColor: color,
              },
            ]}
          />
        </View>
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
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.periodSelector}>
          {[7, 30, 90].map((days) => (
            <TouchableOpacity
              key={days}
              style={[
                styles.periodButton,
                selectedPeriod === days && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(days)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === days && styles.periodButtonTextActive,
                ]}
              >
                {days} Days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4DB6AC" />
          </View>
        ) : insights ? (
          <>
            <View style={styles.summaryCards}>
              <View style={[styles.summaryCard, styles.incomeCard]}>
                <View style={styles.summaryIconContainer}>
                  <Ionicons name="arrow-down" size={20} color="#10B981" />
                </View>
                <Text style={styles.summaryLabel}>{t('home.income')}</Text>
                <Text style={[styles.summaryAmount, styles.incomeAmount]}>
                  {formatAmount(insights.total_income, 'USD')}
                </Text>
              </View>

              <View style={[styles.summaryCard, styles.expenseCard]}>
                <View style={styles.summaryIconContainer}>
                  <Ionicons name="arrow-up" size={20} color="#EF4444" />
                </View>
                <Text style={styles.summaryLabel}>{t('home.expenses')}</Text>
                <Text style={[styles.summaryAmount, styles.expenseAmount]}>
                  {formatAmount(insights.total_expenses, 'USD')}
                </Text>
              </View>
            </View>

            <View style={styles.netCard}>
              <Text style={styles.netLabel}>Net Balance</Text>
              <Text
                style={[
                  styles.netAmount,
                  insights.net >= 0 ? styles.netPositive : styles.netNegative,
                ]}
              >
                {insights.net >= 0 ? "+" : ""}
                {formatAmount(insights.net, 'USD')}
              </Text>
              <Text style={styles.netPeriod}>{insights.period}</Text>
            </View>

            {Object.keys(insights.by_category).length > 0 && (
              <View style={styles.categoriesSection}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                <View style={styles.categoriesList}>
                  {Object.entries(insights.by_category)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount], index) =>
                      renderCategoryBar(
                        category,
                        amount,
                        index,
                        Math.max(...Object.values(insights.by_category))
                      )
                    )}
                </View>
              </View>
            )}

            {Object.keys(insights.by_category).length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="stats-chart-outline"
                  size={64}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyText}>
                  No spending data for this period
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)")}
        >
          <Ionicons name="home-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Home</Text>
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

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="analytics" size={24} color="#4DB6AC" />
          <Text style={[styles.navText, styles.navTextActive]}>Analytics</Text>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  periodSelector: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  periodButtonActive: {
    backgroundColor: "#4DB6AC",
    borderColor: "#4DB6AC",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  loadingContainer: {
    marginTop: 100,
    alignItems: "center",
  },
  summaryCards: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    gap: 8,
  },
  incomeCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  expenseCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  incomeAmount: {
    color: "#10B981",
  },
  expenseAmount: {
    color: "#EF4444",
  },
  netCard: {
    marginHorizontal: 16,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  netLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  netAmount: {
    fontSize: 36,
    fontWeight: "bold",
  },
  netPositive: {
    color: "#10B981",
  },
  netNegative: {
    color: "#EF4444",
  },
  netPeriod: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },
  categoriesSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  categoriesList: {
    gap: 16,
    marginBottom: 24,
  },
  categoryItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  barContainer: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
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
