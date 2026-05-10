import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiClient } from "../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useEntitlements } from "../../hooks/useEntitlements";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { exportFile } from "../../utils/exportFile";
import BottomNavWithAddModal from "../../components/BottomNavWithAddModal";
import TransactionFilter, { defaultFilters, DatePreset, SortOption } from "../../components/TransactionFilter";
import { differenceInDays } from "date-fns";

import { CONFIG } from "../../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface AIInsights {
  summary: string;
  insights: string[];
  recommendations: string[];
  spending_trend: string;
  chart_data: {
    by_category: { category: string; amount: number }[];
    income_vs_expenses: { income: number; expenses: number; net: number };
  };
  period_days: number;
  currency: string;
}

export default function AdvancedAnalyticsScreen() {
  const router = useRouter();
  const { formatAmount, currency } = useCurrency();
  const { language, t } = useLanguage();
  const entitlements = useEntitlements();
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);

  // Calculate days from filter
  const getFilterDays = () => {
    if (filters.startDate && filters.endDate) {
      return differenceInDays(filters.endDate, filters.startDate) + 1;
    }
    // Default period based on preset
    switch (filters.datePreset) {
      case "today": return 1;
      case "week": return 7;
      case "month": return 30;
      case "year": return 365;
      case "all": return 3650;
      default: return 30;
    }
  };

  useEffect(() => {
    fetchAIInsights();
  }, [filters]);

  const fetchAIInsights = async () => {
    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const days = getFilterDays();
      const response = await apiClient.get(`/api/insights/ai?days=${days}`);
      setInsights(response.data);
    } catch (error) {
      console.error("Failed to fetch AI insights", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    // Check if user has export entitlement
    if (!entitlements.hasExport) {
      Alert.alert(
        "Premium Feature",
        "Export functionality is available for Pro subscribers. Upgrade to export your financial data.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/(app)/subscription") }
        ]
      );
      return;
    }

    setExporting(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      if (!sessionToken) {
        Alert.alert("Error", "Please login again to export data");
        setExporting(false);
        return;
      }

      const days = getFilterDays();

      if (format === "json") {
        const response = await apiClient.get(
          `/api/export/transactions?format=json&days=${days}`,
          { timeout: 30000 }
        );

        if (!response.data || !response.data.transactions) {
          Alert.alert(t('common.info'), t('analytics.export.noData'));
          setExporting(false);
          return;
        }

        const jsonString = JSON.stringify(response.data, null, 2);
        const filename = `transactions_${new Date().toISOString().split('T')[0]}.json`;

        // G5 — unified export helper handles web (Blob) + native (File API + Share).
        const exportResult = await exportFile({
          filename,
          contents: jsonString,
          mimeType: "application/json",
          dialogTitle: "Export Transactions",
        });
        if (!exportResult.ok) {
          Alert.alert(t('common.error') || 'Export failed', exportResult.reason || 'Could not save export.');
          setExporting(false);
          return;
        }
        if (exportResult.uri && Platform.OS !== "web") {
          // Sharing handled inside exportFile when available.
        }
      } else {
        // CSV export
        const response = await apiClient.get(
          `/api/export/transactions?format=csv&days=${days}`,
          {
            responseType: "text",
            timeout: 30000
          }
        );

        if (!response.data || response.data.trim() === "") {
          Alert.alert(t('common.info'), t('analytics.export.noData'));
          setExporting(false);
          return;
        }

        const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;

        // G5 — unified export helper.
        const exportResult = await exportFile({
          filename,
          contents: response.data,
          mimeType: "text/csv",
          dialogTitle: "Export Transactions",
        });
        if (!exportResult.ok) {
          Alert.alert(t('common.error') || 'Export failed', exportResult.reason || 'Could not save export.');
          setExporting(false);
          return;
        }
      }

      Alert.alert(t('common.success'), t('analytics.export.success'));
    } catch (error: any) {
      console.error("Export error:", error);
      const errorMessage = error.response?.data?.detail || error.message || t('analytics.export.failed');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setExporting(false);
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "good": return "#10B981";
      case "needs_attention": return "#F59E0B";
      case "concerning": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "good": return "trending-up";
      case "needs_attention": return "trending-down";
      case "concerning": return "warning";
      default: return "analytics";
    }
  };

  const getCategoryColor = (index: number) => {
    const colors = ["#4DB6AC", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#10B981", "#6366F1"];
    return colors[index % colors.length];
  };

  const renderCategoryBar = (item: { category: string; amount: number }, index: number, maxAmount: number) => {
    const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
    const barWidth = (percentage / 100) * (SCREEN_WIDTH - 80);
    const color = getCategoryColor(index);

    return (
      <View key={item.category} style={styles.categoryItem}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{item.category}</Text>
          <Text style={styles.categoryAmount}>{formatAmount(item.amount)}</Text>
        </View>
        <View style={styles.barContainer}>
          <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('analytics.aiTitle')}</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => Alert.alert(
            "Export Data",
            "Choose export format",
            [
              { text: "CSV", onPress: () => handleExport("csv") },
              { text: "JSON", onPress: () => handleExport("json") },
              { text: "Cancel", style: "cancel" }
            ]
          )}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#4DB6AC" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#4DB6AC" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Filter & Sort (using shared component) */}
        <TransactionFilter
          filters={filters}
          onFiltersChange={setFilters}
          showSortOnly={false}
        />

        {/* Premium Gate for Analytics */}
        {!entitlements.hasAnalytics ? (
          <View style={styles.premiumGate}>
            <View style={styles.premiumIcon}>
              <Ionicons name="lock-closed" size={48} color="#4DB6AC" />
            </View>
            <Text style={styles.premiumTitle}>{t('subscription.premiumFeature') || 'Premium Feature'}</Text>
            <Text style={styles.premiumText}>
              {t('analytics.premiumDesc') || 'Advanced analytics and AI insights are available for Pro subscribers. Upgrade to unlock detailed spending analysis and personalized recommendations.'}
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push("/(app)/subscription")}
            >
              <Text style={styles.upgradeButtonText}>{t('subscription.upgradeToPro') || 'Upgrade to Pro'}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>{t('analytics.analyzing')}</Text>
          </View>
        ) : insights ? (
          <>
            {/* AI Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={[styles.trendBadge, { backgroundColor: getTrendColor(insights?.spending_trend || 'good') + "20" }]}>
                  <Ionicons
                    name={getTrendIcon(insights?.spending_trend || 'good') as any}
                    size={20}
                    color={getTrendColor(insights?.spending_trend || 'good')}
                  />
                  <Text style={[styles.trendText, { color: getTrendColor(insights?.spending_trend || 'good') }]}>
                    {(insights?.spending_trend || 'good') === "good" ? "On Track" :
                      (insights?.spending_trend || 'good') === "needs_attention" ? "Needs Attention" : "Review Needed"}
                  </Text>
                </View>
                <Ionicons name="sparkles" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.summaryText}>{insights?.summary || 'No summary available'}</Text>
            </View>

            {/* Income vs Expenses */}
            <View style={styles.statsCard}>
              <Text style={styles.sectionTitle}>{t('analytics.overview')}</Text>
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.incomeBox]}>
                  <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
                  <Text style={styles.statLabel}>{t('common.income')}</Text>
                  <Text style={[styles.statValue, { color: "#10B981" }]}>
                    {formatAmount(insights?.chart_data?.income_vs_expenses?.income || 0)}
                  </Text>
                </View>
                <View style={[styles.statBox, styles.expenseBox]}>
                  <Ionicons name="arrow-up-circle" size={24} color="#EF4444" />
                  <Text style={styles.statLabel}>{t('common.expenses')}</Text>
                  <Text style={[styles.statValue, { color: "#EF4444" }]}>
                    {formatAmount(insights?.chart_data?.income_vs_expenses?.expenses || 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>{t('analytics.netBalance')}</Text>
                <Text style={[
                  styles.netValue,
                  { color: (insights?.chart_data?.income_vs_expenses?.net || 0) >= 0 ? "#10B981" : "#EF4444" }
                ]}>
                  {(insights?.chart_data?.income_vs_expenses?.net || 0) >= 0 ? "+" : ""}
                  {formatAmount(insights?.chart_data?.income_vs_expenses?.net || 0)}
                </Text>
              </View>
            </View>

            {/* AI Insights */}
            <View style={styles.insightsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="bulb" size={24} color="#F59E0B" />
                <Text style={styles.sectionTitle}>{t('analytics.aiInsights')}</Text>
              </View>
              {(insights?.insights || []).map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightDot} />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>

            {/* Recommendations */}
            <View style={styles.recommendationsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.sectionTitle}>{t('analytics.recommendations')}</Text>
              </View>
              {(insights?.recommendations || []).map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={[styles.recNumber, { backgroundColor: getCategoryColor(index) }]}>
                    <Text style={styles.recNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>

            {/* Spending by Category */}
            {(insights?.chart_data?.by_category?.length || 0) > 0 && (
              <View style={styles.categoryCard}>
                <Text style={styles.sectionTitle}>{t('analytics.spendingByCategory')}</Text>
                <View style={styles.categoryList}>
                  {(insights?.chart_data?.by_category || []).map((item, index) =>
                    renderCategoryBar(
                      item,
                      index,
                      Math.max(...(insights?.chart_data?.by_category || []).map(c => c.amount || 0), 1)
                    )
                  )}
                </View>
              </View>
            )}

            {/* Export Options */}
            <View style={styles.exportCard}>
              <Text style={styles.sectionTitle}>{t('analytics.exportData')}</Text>
              <View style={styles.exportButtons}>
                <TouchableOpacity
                  style={styles.exportOption}
                  onPress={() => handleExport("csv")}
                  disabled={exporting}
                >
                  <Ionicons name="document-text" size={24} color="#4DB6AC" />
                  <Text style={styles.exportOptionText}>CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exportOption}
                  onPress={() => handleExport("json")}
                  disabled={exporting}
                >
                  <Ionicons name="code-slash" size={24} color="#3B82F6" />
                  <Text style={styles.exportOptionText}>JSON</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Bottom Navigation with Add Modal */}
      <BottomNavWithAddModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  exportButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  premiumGate: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    marginTop: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  premiumIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
  },
  premiumText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4DB6AC",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  periodSelector: { flexDirection: "row", gap: 12, marginBottom: 16 },
  periodButton: {
    flex: 1, paddingVertical: 12, backgroundColor: "#fff", borderRadius: 12,
    alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB",
  },
  periodButtonActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  periodButtonText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  periodButtonTextActive: { color: "#fff" },
  loadingContainer: { marginTop: 100, alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 14, color: "#6B7280" },
  summaryCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
  },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  trendBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  trendText: { fontSize: 13, fontWeight: "600" },
  summaryText: { fontSize: 15, color: "#374151", lineHeight: 22 },
  statsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center", gap: 8 },
  incomeBox: { backgroundColor: "#D1FAE5" },
  expenseBox: { backgroundColor: "#FEE2E2" },
  statLabel: { fontSize: 12, color: "#6B7280" },
  statValue: { fontSize: 18, fontWeight: "bold" },
  netRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB",
  },
  netLabel: { fontSize: 14, color: "#6B7280" },
  netValue: { fontSize: 20, fontWeight: "bold" },
  insightsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  insightItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B", marginTop: 6 },
  insightText: { flex: 1, fontSize: 14, color: "#4B5563", lineHeight: 20 },
  recommendationsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  recommendationItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  recNumber: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  recNumberText: { fontSize: 12, fontWeight: "bold", color: "#fff" },
  recommendationText: { flex: 1, fontSize: 14, color: "#4B5563", lineHeight: 20 },
  categoryCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  categoryList: { gap: 12 },
  categoryItem: { gap: 6 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between" },
  categoryName: { fontSize: 14, color: "#374151" },
  categoryAmount: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  barContainer: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4 },
  exportCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16 },
  exportButtons: { flexDirection: "row", gap: 12 },
  exportOption: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, backgroundColor: "#F3F4F6", borderRadius: 12,
  },
  exportOptionText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  bottomNav: {
    flexDirection: "row", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 20, paddingTop: 12, position: "absolute", bottom: 0, left: 0, right: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 8 },
  navItemCenter: { flex: 1, alignItems: "center", paddingVertical: 8 },
  navCenterButton: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#10B981",
    justifyContent: "center", alignItems: "center", marginTop: -28,
    shadowColor: "#10B981", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  navText: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  navTextActive: { color: "#10B981", fontWeight: "600" },
});
