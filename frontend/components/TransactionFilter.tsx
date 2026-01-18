import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";

export type SortOption = "newest" | "oldest" | "highest" | "lowest";
export type DatePreset = "all" | "today" | "week" | "month" | "year" | "custom";

interface FilterState {
  datePreset: DatePreset;
  startDate: Date | null;
  endDate: Date | null;
  sortBy: SortOption;
}

interface TransactionFilterProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  showSortOnly?: boolean;
}

export const defaultFilters: FilterState = {
  datePreset: "all",
  startDate: null,
  endDate: null,
  sortBy: "newest",
};

export default function TransactionFilter({
  filters,
  onFiltersChange,
  showSortOnly = false,
}: TransactionFilterProps) {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: "all", label: "Semua" },
    { id: "today", label: "Hari Ini" },
    { id: "week", label: "Minggu Ini" },
    { id: "month", label: "Bulan Ini" },
    { id: "year", label: "Tahun Ini" },
    { id: "custom", label: "Kustom" },
  ];

  const sortOptions: { id: SortOption; label: string; icon: any }[] = [
    { id: "newest", label: "Terbaru", icon: "arrow-down" },
    { id: "oldest", label: "Terlama", icon: "arrow-up" },
    { id: "highest", label: "Tertinggi", icon: "trending-up" },
    { id: "lowest", label: "Terendah", icon: "trending-down" },
  ];

  const handlePresetSelect = (preset: DatePreset) => {
    const today = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (preset) {
      case "today":
        startDate = today;
        endDate = today;
        break;
      case "week":
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "year":
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        break;
      case "custom":
        // Keep existing dates or set defaults
        startDate = tempFilters.startDate || subDays(today, 30);
        endDate = tempFilters.endDate || today;
        break;
      default:
        startDate = null;
        endDate = null;
    }

    setTempFilters({
      ...tempFilters,
      datePreset: preset,
      startDate,
      endDate,
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(null);
    }

    if (selectedDate && showDatePicker) {
      setTempFilters({
        ...tempFilters,
        [showDatePicker === "start" ? "startDate" : "endDate"]: selectedDate,
        datePreset: "custom",
      });
    }
  };

  const applyFilters = () => {
    onFiltersChange(tempFilters);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    const reset = { ...defaultFilters };
    setTempFilters(reset);
    onFiltersChange(reset);
    setShowFilterModal(false);
  };

  const getFilterLabel = () => {
    if (filters.datePreset === "all") return "Filter";
    const preset = datePresets.find((p) => p.id === filters.datePreset);
    return preset?.label || "Filter";
  };

  const getSortLabel = () => {
    const option = sortOptions.find((o) => o.id === filters.sortBy);
    return option?.label || "Urutkan";
  };

  const hasActiveFilter = filters.datePreset !== "all";

  return (
    <View style={styles.container}>
      {!showSortOnly && (
        <TouchableOpacity
          style={[styles.filterButton, hasActiveFilter && styles.filterButtonActive]}
          onPress={() => {
            setTempFilters(filters);
            setShowFilterModal(true);
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={hasActiveFilter ? "#fff" : "#6B7280"}
          />
          <Text style={[styles.filterText, hasActiveFilter && styles.filterTextActive]}>
            {getFilterLabel()}
          </Text>
          {hasActiveFilter && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setShowSortModal(true)}
      >
        <Ionicons name="swap-vertical" size={18} color="#6B7280" />
        <Text style={styles.sortText}>{getSortLabel()}</Text>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Tanggal</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.presetContainer}>
              {datePresets.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetButton,
                    tempFilters.datePreset === preset.id && styles.presetButtonActive,
                  ]}
                  onPress={() => handlePresetSelect(preset.id)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      tempFilters.datePreset === preset.id && styles.presetTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tempFilters.datePreset === "custom" && (
              <View style={styles.customDateContainer}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker("start")}
                >
                  <Text style={styles.dateLabel}>Dari</Text>
                  <Text style={styles.dateValue}>
                    {tempFilters.startDate
                      ? format(tempFilters.startDate, "dd MMM yyyy")
                      : "Pilih tanggal"}
                  </Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />

                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker("end")}
                >
                  <Text style={styles.dateLabel}>Sampai</Text>
                  <Text style={styles.dateValue}>
                    {tempFilters.endDate
                      ? format(tempFilters.endDate, "dd MMM yyyy")
                      : "Pilih tanggal"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={showDatePicker === "start"
                  ? (tempFilters.startDate || new Date())
                  : (tempFilters.endDate || new Date())}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sortModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Urutkan</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.sortOption,
                  filters.sortBy === option.id && styles.sortOptionActive,
                ]}
                onPress={() => {
                  onFiltersChange({ ...filters, sortBy: option.id });
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={filters.sortBy === option.id ? "#10B981" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.sortOptionText,
                    filters.sortBy === option.id && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {filters.sortBy === option.id && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  filterText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#fff",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
    marginLeft: 4,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sortText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  sortModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  presetContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  presetButtonActive: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  presetText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  presetTextActive: {
    color: "#10B981",
  },
  customDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  resetText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
  },
  applyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sortOptionActive: {
    backgroundColor: "#D1FAE5",
  },
  sortOptionText: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
  },
  sortOptionTextActive: {
    color: "#10B981",
    fontWeight: "600",
  },
});

// Export filter utility function
export function applyFiltersAndSort<T extends { date: string; amount: number; transaction_type: string }>(
  data: T[],
  filters: FilterState,
  tabFilter?: "all" | "income" | "expense"
): T[] {
  let filtered = [...data];

  // Apply tab filter first
  if (tabFilter && tabFilter !== "all") {
    filtered = filtered.filter((item) => item.transaction_type === tabFilter);
  }

  // Apply date filter
  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);

    filtered = filtered.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= start && itemDate <= end;
    });
  }

  // Apply sort
  switch (filters.sortBy) {
    case "newest":
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      break;
    case "oldest":
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      break;
    case "highest":
      filtered.sort((a, b) => b.amount - a.amount);
      break;
    case "lowest":
      filtered.sort((a, b) => a.amount - b.amount);
      break;
  }

  return filtered;
}
