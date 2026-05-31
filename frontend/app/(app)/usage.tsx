import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const PERIODS = [7, 30, 90];

// action -> label + icon + color
const ACTION_META: { [k: string]: { label: string; icon: any; color: string } } = {
  chat: { label: "Chat", icon: "chatbubble-outline", color: "#4DB6AC" },
  voice: { label: "Voice", icon: "mic-outline", color: "#8B5CF6" },
  ocr: { label: "Receipt Scan", icon: "scan-outline", color: "#F59E0B" },
  insights: { label: "AI Insights", icon: "stats-chart-outline", color: "#3B82F6" },
  transcribe: { label: "Transcription", icon: "recording-outline", color: "#EC4899" },
  other: { label: "Other", icon: "ellipsis-horizontal", color: "#9CA3AF" },
};

interface ActionStat {
  calls: number;
  tokens: number;
  cost_usd: number;
}
interface UsageCost {
  period_days: number;
  calls: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_per_call_usd: number;
  by_action: { [k: string]: ActionStat };
  by_model: { [k: string]: ActionStat };
  by_day: { [k: string]: ActionStat };
}

// Costs are tiny (fractions of a cent) — show enough precision.
const fmtCost = (n: number) => {
  if (!n) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
};
const fmtNum = (n: number) => (n || 0).toLocaleString("en-US");

export default function UsageScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<UsageCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("session_token");
      const res = await axios.get(`${BACKEND_URL}/api/usage/cost?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      console.error("Error fetching usage:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchUsage();
  }, [fetchUsage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsage();
  };

  const actions = data
    ? Object.entries(data.by_action).sort((a, b) => b[1].cost_usd - a[1].cost_usd)
    : [];
  const maxCost = actions.length ? Math.max(...actions.map(([, s]) => s.cost_usd), 0.0000001) : 1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usage & Cost</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4DB6AC" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Total cost card */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Estimated cost · last {period} days</Text>
            <Text style={styles.totalCost}>{fmtCost(data?.total_cost_usd || 0)}</Text>
            <View style={styles.totalMetaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{fmtNum(data?.total_tokens || 0)}</Text>
                <Text style={styles.metaLabel}>tokens</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{fmtNum(data?.calls || 0)}</Text>
                <Text style={styles.metaLabel}>AI calls</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{fmtCost(data?.avg_cost_per_call_usd || 0)}</Text>
                <Text style={styles.metaLabel}>avg/call</Text>
              </View>
            </View>
          </View>

          {/* Breakdown by feature */}
          <Text style={styles.sectionTitle}>By feature</Text>
          <View style={styles.card}>
            {actions.length === 0 && (
              <Text style={styles.emptyText}>No AI usage in this period yet.</Text>
            )}
            {actions.map(([action, s], i) => {
              const meta = ACTION_META[action] || ACTION_META.other;
              const pct = (s.cost_usd / maxCost) * 100;
              return (
                <View
                  key={action}
                  style={[styles.row, i !== actions.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: `${meta.color}20` }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowLabel}>{meta.label}</Text>
                      <Text style={styles.rowCost}>{fmtCost(s.cost_usd)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]}
                      />
                    </View>
                    <Text style={styles.rowSub}>
                      {fmtNum(s.calls)} calls · {fmtNum(s.tokens)} tokens
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.note}>
            Cost is an estimate from token counts × model pricing (your OpenAI spend).
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
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
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  placeholder: { width: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { flex: 1 },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  periodBtnActive: { backgroundColor: "#4DB6AC", borderColor: "#4DB6AC" },
  periodText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  periodTextActive: { color: "#fff" },
  totalCard: {
    backgroundColor: "#1F2937",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  totalLabel: { color: "#9CA3AF", fontSize: 13, marginBottom: 6 },
  totalCost: { color: "#fff", fontSize: 36, fontWeight: "700", marginBottom: 16 },
  totalMetaRow: { flexDirection: "row", alignItems: "center" },
  metaItem: { flex: 1, alignItems: "center" },
  metaValue: { color: "#fff", fontSize: 16, fontWeight: "600" },
  metaLabel: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  metaDivider: { width: 1, height: 32, backgroundColor: "#374151" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    paddingHorizontal: 20,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  emptyText: { color: "#9CA3AF", fontSize: 14, paddingVertical: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#1F2937" },
  rowCost: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    marginBottom: 6,
  },
  barFill: { height: 6, borderRadius: 3 },
  rowSub: { fontSize: 12, color: "#9CA3AF" },
  note: {
    fontSize: 12,
    color: "#9CA3AF",
    paddingHorizontal: 24,
    marginTop: 16,
    lineHeight: 18,
  },
});
