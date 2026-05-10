import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function OnboardingBalanceScreen() {
    const router = useRouter();
    const { currencySymbol, formatInputValue, parseInputValue } = useCurrency();
    const [balance, setBalance] = useState("");

  const { t } = useLanguage();

    const handleContinue = async () => {
        // Save initial balance preference locally
        // This will be used by AuthContext to create an initial transaction after login
        if (balance) {
            const numericBalance = parseInputValue(balance);
            await AsyncStorage.setItem("initial_balance", numericBalance.toString());
        } else {
            await AsyncStorage.setItem("initial_balance", "0");
        }

        // Go to trial page
        router.push("/onboarding-trial");
    };

    const handleTextChange = (text: string) => {
        const formatted = formatInputValue(text);
        setBalance(formatted);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: "80%" }]} />
                    </View>
                    <Text style={styles.stepText}>{t('onboarding.step3of4')}</Text>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="wallet" size={48} color="#4DB6AC" />
                    </View>

                    <Text style={styles.title}>{t('onboarding.currentBalance')}</Text>
                    <Text style={styles.subtitle}>
                        {t('onboarding.currentBalanceDesc')}
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                        <TextInput
                            style={styles.input}
                            value={balance}
                            onChangeText={handleTextChange}
                            placeholder="0"
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            autoFocus={true}
                        />
                    </View>

                    <Text style={styles.helperText}>
                        {t('onboarding.balanceSkip')}
                    </Text>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.continueButtonText}>{t('common.next') || 'Continue'}</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: "#E5E7EB",
        borderRadius: 2,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#4DB6AC",
    },
    stepText: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 8,
        textAlign: "center",
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 24,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#E0F2F1",
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#1F2937",
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: "#6B7280",
        textAlign: "center",
        marginBottom: 40,
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderWidth: 2,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 16,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: "600",
        color: "#1F2937",
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: "600",
        color: "#1F2937",
        padding: 0,
    },
    helperText: {
        fontSize: 13,
        color: "#9CA3AF",
        textAlign: "center",
    },
    footer: {
        flexDirection: "row",
        paddingHorizontal: 24,
        paddingBottom: 16,
        gap: 12,
    },
    backButton: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        justifyContent: "center",
        alignItems: "center",
    },
    continueButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#4DB6AC",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
});
