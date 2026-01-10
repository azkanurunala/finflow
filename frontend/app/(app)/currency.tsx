import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  POPULAR_CURRENCIES,
  OTHER_CURRENCIES,
  Currency,
  getUserCurrency,
  setUserCurrency,
} from "../../utils/currency";

export default function CurrencySelectionScreen() {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSelectedCurrency();
  }, []);

  const loadSelectedCurrency = async () => {
    const saved = await getUserCurrency();
    setSelectedCurrency(saved);
  };

  const handleSelectCurrency = (code: string) => {
    setSelectedCurrency(code);
  };

  const handleConfirm = async () => {
    await setUserCurrency(selectedCurrency);
    
    Alert.alert(
      "Currency Changed",
      "All amounts will be converted to your selected currency using real-time exchange rates.",
      [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]
    );
  };

  const allCurrencies = [...POPULAR_CURRENCIES, ...OTHER_CURRENCIES];
  const filteredCurrencies = allCurrencies.filter(
    (curr) =>
      curr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      curr.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayCurrencies = searchQuery ? filteredCurrencies : allCurrencies;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Currency</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search currencies..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Popular Currencies */}
        {!searchQuery && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Currencies</Text>
            {POPULAR_CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={styles.currencyItem}
                onPress={() => handleSelectCurrency(currency.code)}
                activeOpacity={0.7}
              >
                <View style={styles.currencyFlag}>
                  <Text style={styles.flagText}>{currency.flag}</Text>
                </View>
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyName}>{currency.name}</Text>
                  <Text style={styles.currencyCode}>{currency.code} ({currency.symbol})</Text>
                </View>
                {selectedCurrency === currency.code && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#4DB6AC" />
                  </View>
                )}
                {selectedCurrency !== currency.code && (
                  <View style={styles.radioUnchecked} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Others */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? "Results" : "Others"}
          </Text>
          {(searchQuery ? filteredCurrencies : OTHER_CURRENCIES).map((currency) => (
            <TouchableOpacity
              key={currency.code}
              style={styles.currencyItem}
              onPress={() => handleSelectCurrency(currency.code)}
              activeOpacity={0.7}
            >
              <View style={styles.currencyFlag}>
                <Text style={styles.flagText}>{currency.flag}</Text>
              </View>
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyName}>{currency.name}</Text>
                <Text style={styles.currencyCode}>{currency.code} ({currency.symbol})</Text>
              </View>
              {selectedCurrency === currency.code && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color="#4DB6AC" />
                </View>
              )}
              {selectedCurrency !== currency.code && (
                <View style={styles.radioUnchecked} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirm Selection</Text>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    paddingHorizontal: 20,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  currencyFlag: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  flagText: {
    fontSize: 24,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 2,
  },
  currencyCode: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  checkmark: {
    marginLeft: 12,
  },
  radioUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginLeft: 12,
  },
  footer: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  confirmButton: {
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
