/**
 * CouponInput Component
 * Input field for coupon code redemption with validation
 * Task 9.3
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUPON_CODE_PATTERN } from '../types/subscription';

interface CouponInputProps {
  onRedeem: (code: string) => Promise<void>;
  disabled?: boolean;
}

export default function CouponInput({ onRedeem, disabled = false }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validateFormat = (input: string): boolean => {
    return COUPON_CODE_PATTERN.test(input);
  };

  const handleCodeChange = (text: string) => {
    // Auto-format to uppercase and add dashes
    let formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Add dashes automatically
    if (formatted.length > 7) {
      formatted = `${formatted.slice(0, 7)}-${formatted.slice(7, 11)}-${formatted.slice(11, 15)}`;
    } else if (formatted.length > 7) {
      formatted = `${formatted.slice(0, 7)}-${formatted.slice(7)}`;
    }
    
    // Limit to pattern length
    if (formatted.length <= 19) { // FINFLOW-XXXX-XXXX = 19 chars
      setCode(formatted);
      setError(null);
      setSuccess(null);
    }
  };

  const handleRedeem = async () => {
    // Clear previous messages
    setError(null);
    setSuccess(null);

    // Validate format
    if (!validateFormat(code)) {
      setError('Invalid format. Use: FINFLOW-XXXX-XXXX');
      return;
    }

    setIsLoading(true);
    try {
      await onRedeem(code);
      setSuccess('Coupon redeemed successfully!');
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to redeem coupon');
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = validateFormat(code);
  const canRedeem = isValid && !isLoading && !disabled;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Have a coupon code?</Text>
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="gift-outline" size={20} color="#6B7280" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="FINFLOW-XXXX-XXXX"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading && !disabled}
            maxLength={19}
          />
        </View>
        
        <TouchableOpacity
          style={[
            styles.redeemButton,
            !canRedeem && styles.redeemButtonDisabled,
          ]}
          onPress={handleRedeem}
          disabled={!canRedeem}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.redeemButtonText}>Redeem</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Format hint */}
      {code.length > 0 && !isValid && !error && (
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
          <Text style={styles.hintText}>Format: FINFLOW-XXXX-XXXX</Text>
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.messageContainer}>
          <Ionicons name="close-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success message */}
      {success && (
        <View style={[styles.messageContainer, styles.successContainer]}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  redeemButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  redeemButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  successContainer: {
    backgroundColor: '#D1FAE5',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  successText: {
    fontSize: 13,
    color: '#059669',
    flex: 1,
  },
});
