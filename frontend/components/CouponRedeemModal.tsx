/**
 * Coupon Redeem Modal
 * Allows users to input and redeem coupon codes
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useLanguage } from "../contexts/LanguageContext";

interface CouponRedeemModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CouponRedeemModal({
  visible,
  onClose,
  onSuccess,
}: CouponRedeemModalProps) {
  const { actions } = useSubscription();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      setError(t('subscription.enterCoupon') || "Please enter a coupon code");
      return;
    }

    // Validate coupon format (FINFLOW-XXXX-XXXX)
    const couponRegex = /^FINFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!couponRegex.test(code)) {
      setError(t('subscription.invalidCouponFormat') || "Invalid coupon format. Use: FINFLOW-XXXX-XXXX");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await actions.redeemCoupon(code);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
          resetState();
        }, 1500);
      } else {
        setError(result.error || t('subscription.couponFailed') || "Failed to redeem coupon");
      }
    } catch (err: any) {
      setError(err.message || t('subscription.couponFailed') || "Failed to redeem coupon");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setCode("");
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons
              name={success ? "checkmark-circle" : "gift"}
              size={56}
              color={success ? "#10B981" : "#6366F1"}
            />
          </View>

          <Text style={styles.title}>
            {success ? t('subscription.couponRedeemed') || "Coupon Redeemed!" : t('subscription.redeemCoupon') || "Redeem Coupon"}
          </Text>
          <Text style={styles.subtitle}>
            {success
              ? t('subscription.couponRedeemedDesc') || "You now have 1 month of Pro access!"
              : t('subscription.redeemCouponDesc') || "Enter your coupon code to unlock Pro features"}
          </Text>

          {!success && (
            <>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder="FINFLOW-XXXX-XXXX"
                placeholderTextColor="#9CA3AF"
                value={code}
                onChangeText={(text) => {
                  setCode(text.toUpperCase());
                  setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.redeemButton, loading && styles.buttonDisabled]}
                onPress={handleRedeem}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.redeemButtonText}>{t('subscription.redeemCode') || 'Redeem Code'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: "#1F2937",
    letterSpacing: 1,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
  },
  redeemButton: {
    width: "100%",
    backgroundColor: "#6366F1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  redeemButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
