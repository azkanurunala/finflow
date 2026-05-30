import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  DevSettings,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../../contexts/LanguageContext";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

// Only languages with a complete translation dictionary are offered, so the UI
// never silently falls back to English. To add a language, ship its locale file
// and register it in utils/i18n.ts (SUPPORTED_LOCALES), then list it here.
const SUGGESTED_LANGUAGES: Language[] = [
  { code: "en", name: "English (US)", nativeName: "English (US)", flag: "🇺🇸" },
  { code: "id", name: "Bahasa Indonesia", nativeName: "Indonesian", flag: "🇮🇩" },
];

const OTHER_LANGUAGES: Language[] = [
  { code: "ar", name: "العربية", nativeName: "Arabic", flag: "🇸🇦" },
];

const ALL_LANGUAGES = [...SUGGESTED_LANGUAGES, ...OTHER_LANGUAGES];

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [searchQuery, setSearchQuery] = useState("");
  // The language in effect when this screen opened, to detect a real change.
  const initialLanguage = useRef(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const handleSelectLanguage = async (code: string) => {
    setSelectedLanguage(code);
    // Apply immediately so the picker reflects the choice; full propagation
    // (and RTL) happens on commit via a reload.
    await setLanguage(code);
  };

  // Reload the whole app so every already-mounted screen (home, bottom nav,
  // etc.) re-renders in the new language — and so Arabic's RTL layout applies.
  const reloadApp = () => {
    if (DevSettings && typeof DevSettings.reload === "function") {
      DevSettings.reload();
    } else {
      router.back();
    }
  };

  const finish = () => {
    if (selectedLanguage !== initialLanguage.current) {
      reloadApp();
    } else {
      router.back();
    }
  };

  const handleApply = () => {
    finish();
  };

  const matches = (lang: Language) =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredLanguages = ALL_LANGUAGES.filter(matches);

  const renderItem = (lang: Language) => (
    <TouchableOpacity
      key={lang.code}
      style={styles.languageItem}
      onPress={() => handleSelectLanguage(lang.code)}
      activeOpacity={0.7}
    >
      <View style={styles.languageFlag}>
        <Text style={styles.flagText}>{lang.flag}</Text>
      </View>
      <View style={styles.languageInfo}>
        <Text style={styles.languageName}>{lang.name}</Text>
        <Text style={styles.languageNative}>{lang.nativeName}</Text>
      </View>
      {selectedLanguage === lang.code ? (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={24} color="#4DB6AC" />
        </View>
      ) : (
        <View style={styles.radioUnchecked} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={finish}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("language.displayLanguage")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("language.searchLanguage")}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {searchQuery ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("language.allLanguages")}</Text>
            {filteredLanguages.map(renderItem)}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("language.suggested")}</Text>
              {SUGGESTED_LANGUAGES.map(renderItem)}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("language.allLanguages")}</Text>
              {OTHER_LANGUAGES.map(renderItem)}
            </View>
          </>
        )}
      </ScrollView>

      {/* Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApply}
          activeOpacity={0.8}
        >
          <Text style={styles.applyButtonText}>{t("language.applyLanguage")}</Text>
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
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  languageFlag: {
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
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 2,
  },
  languageNative: {
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
  applyButton: {
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
