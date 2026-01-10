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
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    fetchInsights();
  }, [selectedPeriod]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/insights?days=${selectedPeriod}`
      );
      setInsights(response.data);
    } catch (error) {
      console.error("Failed to fetch insights", error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      "#667eea",
      "#764ba2",
      "#f093fb",
      "#4facfe",
      "#00f2fe",
      "#43e97b",
      "#38f9d7",
      "#fa709a",
      "#fee140",
      "#30cfd0",
    ];
    return colors[index % colors.length];
  };

  const renderCategoryBar = (
    category: string,
    amount: number,
    index: number,
    maxAmount: number
  ) => {
    const percentage = (amount / maxAmount) * 100;
    const barWidth = (percentage / 100) * (SCREEN_WIDTH - 80);

    return (
      <View key={category} style={styles.categoryItem}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{category}</Text>
          <Text style={styles.categoryAmount}>${amount.toFixed(2)}</Text>
        </View>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              {
                width: barWidth,
                backgroundColor: getCategoryColor(index),
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
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insights</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
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
                {days}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : insights ? (
          <>
            <View style={styles.summaryCards}>
              <View style={[styles.summaryCard, styles.expenseCard]}>
                <Ionicons name="arrow-down" size={24} color="#ef4444" />
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryAmount, styles.expenseAmount]}>
                  ${insights.total_expenses.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.summaryCard, styles.incomeCard]}>
                <Ionicons name="arrow-up" size={24} color="#10b981" />
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryAmount, styles.incomeAmount]}>
                  ${insights.total_income.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.netCard}>
              <Text style={styles.netLabel}>Net</Text>
              <Text
                style={[
                  styles.netAmount,
                  insights.net >= 0 ? styles.netPositive : styles.netNegative,
                ]}
              >
                {insights.net >= 0 ? "+" : "-"}$
                {Math.abs(insights.net).toFixed(2)}
              </Text>
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
                  color="#64748b"
                />
                <Text style={styles.emptyText}>
                  No spending data for this period
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
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
  content: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#667eea",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
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
    gap: 8,
  },
  expenseCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  incomeCard: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: "bold",
  },
  expenseAmount: {
    color: "#ef4444",
  },
  incomeAmount: {
    color: "#10b981",
  },
  netCard: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  netLabel: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 8,
  },
  netAmount: {
    fontSize: 32,
    fontWeight: "bold",
  },
  netPositive: {
    color: "#10b981",
  },
  netNegative: {
    color: "#ef4444",
  },
  categoriesSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  categoriesList: {
    gap: 16,
    marginBottom: 24,
  },
  categoryItem: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 14,
    color: "#e2e8f0",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  barContainer: {
    height: 8,
    backgroundColor: "#1e293b",
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
    color: "#64748b",
    marginTop: 16,
  },
});
