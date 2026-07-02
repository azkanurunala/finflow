import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useSocialAuth } from "../hooks/useSocialAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { LinearGradient } from "expo-linear-gradient";

export default function SignupScreen() {
  const router = useRouter();
  const { user, loading, register } = useAuth();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const { signInGoogle, signInApple, googleReady, appleAvailable, busy } = useSocialAuth((r) => {
    if (!r.success && r.error) setError(r.error);
  });

  useEffect(() => {
    if (user && !loading) {
      // Check if onboarding is completed
      if (user.onboarding_completed === false) {
        router.replace("/onboarding-language");
      } else {
        router.replace("/(app)");
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  const handleEmailSignup = async () => {
    // Validate inputs
    if (!name.trim()) {
      setError(t('auth.errEnterName'));
      return;
    }
    if (!email.trim()) {
      setError(t('auth.errEnterEmail'));
      return;
    }
    if (!password.trim()) {
      setError(t('auth.errCreatePassword'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errPasswordShort'));
      return;
    }
    if (!acceptedTerms) {
      setError(t('auth.errAcceptTerms'));
      return;
    }

    setError("");
    setIsRegistering(true);

    try {
      const result = await register(name.trim(), email.trim(), password);
      if (!result.success) {
        setError(result.error || t('auth.registrationFailed'));
      }
      // If successful, the useEffect will handle navigation
    } catch (err) {
      setError(t('auth.genericError'));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{t('auth.createAccount')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.startTrialToday')}
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer} testID="signup-error-message">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Social Login Buttons */}
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialButton, (!googleReady || busy) && styles.socialButtonDisabled]}
              testID="signup-google-button"
              accessibilityLabel="signup-google-button"
              onPress={signInGoogle}
              disabled={!googleReady || busy}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={20} color="#1F2937" />
              <Text style={styles.socialButtonText}>{t('auth.google')}</Text>
            </TouchableOpacity>

            {appleAvailable && (
              <TouchableOpacity
                style={[styles.socialButton, busy && styles.socialButtonDisabled]}
                testID="signup-apple-button"
                accessibilityLabel="signup-apple-button"
                onPress={signInApple}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={20} color="#1F2937" />
                <Text style={styles.socialButtonText}>{t('auth.apple')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orRegisterWithEmail')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                testID="signup-name-input"
                placeholder={t('auth.enterName')}
                placeholderTextColor="#CBD5E1"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.email')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                testID="signup-email-input"
                placeholder={t('auth.enterEmail')}
                placeholderTextColor="#CBD5E1"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.password')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                testID="signup-password-input"
                placeholder={t('auth.createPassword')}
                placeholderTextColor="#CBD5E1"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordHint}>
              {t('auth.passwordHint')}
            </Text>
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            testID="signup-terms-checkbox"
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                acceptedTerms && styles.checkboxChecked,
              ]}
            >
              {acceptedTerms && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.checkboxText}>
              {t('auth.agreeToTerms')}{" "}
              <Text style={styles.checkboxLink}>{t('auth.termsOfService')}</Text> {t('auth.and')}{" "}
              <Text style={styles.checkboxLink}>{t('auth.privacyPolicy')}</Text>
            </Text>
          </TouchableOpacity>

          {/* Create Account Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              (!acceptedTerms || isRegistering) && styles.createButtonDisabled,
            ]}
            testID="signup-submit-button"
            disabled={!acceptedTerms || isRegistering}
            onPress={handleEmailSignup}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                acceptedTerms && !isRegistering
                  ? ["#4DB6AC", "#45A599"]
                  : ["#E5E7EB", "#D1D5DB"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButtonGradient}
            >
              {isRegistering ? (
                <ActivityIndicator size="small" color="#9CA3AF" />
              ) : (
                <Text
                  style={[
                    styles.createButtonText,
                    !acceptedTerms && styles.createButtonTextDisabled,
                  ]}
                >
                  {t('auth.createAccount')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              {t('auth.alreadyHaveAccount')}{" "}
            </Text>
            <TouchableOpacity testID="signup-login-link" onPress={() => router.back()}>
              <Text style={styles.loginLinkTextBold}>{t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 8,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#EF4444",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  socialButtonTextDisabled: {
    color: "#9CA3AF",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    color: "#9CA3AF",
    paddingHorizontal: 16,
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  eyeIcon: {
    padding: 4,
  },
  passwordHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#4DB6AC",
    borderColor: "#4DB6AC",
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  checkboxLink: {
    color: "#4DB6AC",
    fontWeight: "600",
  },
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#4DB6AC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  createButtonTextDisabled: {
    color: "#9CA3AF",
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: {
    fontSize: 14,
    color: "#6B7280",
  },
  loginLinkTextBold: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "600",
  },
});
