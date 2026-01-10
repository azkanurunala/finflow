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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

export default function SignupScreen() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.replace("/(app)");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  const handleEmailSignup = () => {
    Alert.alert(
      "Email Signup",
      "Email/password signup will be available soon. For now, please use Google authentication."
    );
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Start your 30-day free trial today
            </Text>
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={login}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={20} color="#1F2937" />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonDisabled]}
              disabled
              activeOpacity={0.7}
            >
              <Ionicons name="logo-apple" size={20} color="#9CA3AF" />
              <Text
                style={[styles.socialButtonText, styles.socialButtonTextDisabled]}
              >
                Apple
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR REGISTER WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Aska Nurun Ali"
                placeholderTextColor="#CBD5E1"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#CBD5E1"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="#CBD5E1"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
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
              Must be at least 8 characters
            </Text>
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
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
              I agree to the{" "}
              <Text style={styles.checkboxLink}>Terms of Service</Text> and{" "}
              <Text style={styles.checkboxLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Create Account Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              !acceptedTerms && styles.createButtonDisabled,
            ]}
            disabled={!acceptedTerms}
            onPress={handleEmailSignup}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                acceptedTerms
                  ? ["#4DB6AC", "#45A599"]
                  : ["#E5E7EB", "#D1D5DB"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButtonGradient}
            >
              <Text
                style={[
                  styles.createButtonText,
                  !acceptedTerms && styles.createButtonTextDisabled,
                ]}
              >
                Create Account
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLinkTextBold}>Log In</Text>
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
    marginBottom: 32,
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
