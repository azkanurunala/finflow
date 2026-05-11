/**
 * Payment Processing Page
 * Handles transaction processing without package selection
 * Task 7.1 & 7.2
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

type ProcessingState = 'initiating' | 'processing' | 'validating' | 'success' | 'error';

export default function PaymentProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { actions } = useSubscription();
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  
  const [processingState, setProcessingState] = useState<ProcessingState>('initiating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get selected tier from route params
  const selectedProductId = params.productId as string;
  const selectedTierName = params.tierName as string;
  const selectedPrice = params.price as string;

  useEffect(() => {
    if (!selectedProductId) {
      Alert.alert(t('common.error') || 'Error', 'No subscription selected', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    // Start purchase process
    processPurchase();
  }, [selectedProductId]);

  const processPurchase = async () => {
    try {
      // Step 1: Initiating
      setProcessingState('initiating');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Processing payment
      setProcessingState('processing');
      const result = await actions.purchaseSubscription(selectedProductId);

      if (!result.success) {
        if (result.cancelled) {
          // User cancelled, go back silently
          router.back();
          return;
        }
        throw new Error(result.error || 'Purchase failed');
      }

      // Step 3: Validating
      setProcessingState('validating');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Success
      setProcessingState('success');
      
      // Refresh user data
      await refreshUser();
      await actions.refreshEntitlements();

      // Show success and redirect
      setTimeout(() => {
        Alert.alert(
          'Success!',
          `You are now subscribed to ${selectedTierName}. Enjoy your Pro features!`,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(app)/subscription')
            }
          ]
        );
      }, 1000);

    } catch (error: any) {
      console.error('[PaymentProcessing] Purchase failed:', error);
      setProcessingState('error');
      setErrorMessage(error.message || 'An unexpected error occurred');
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    processPurchase();
  };

  const handleCancel = () => {
    router.back();
  };

  const getStateIcon = (): string => {
    switch (processingState) {
      case 'initiating':
      case 'processing':
      case 'validating':
        return 'hourglass-outline';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      default:
        return 'hourglass-outline';
    }
  };

  const getStateColor = (): string => {
    switch (processingState) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      default:
        return '#6366F1';
    }
  };

  const getStateMessage = (): string => {
    switch (processingState) {
      case 'initiating':
        return 'Initiating payment...';
      case 'processing':
        return 'Processing payment...';
      case 'validating':
        return 'Validating purchase...';
      case 'success':
        return 'Purchase successful!';
      case 'error':
        return 'Purchase failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Package Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Selected Package</Text>
          <Text style={styles.tierName}>{selectedTierName}</Text>
          <Text style={styles.price}>{selectedPrice}</Text>
        </View>

        {/* Processing Status */}
        <View style={styles.statusContainer}>
          {processingState !== 'error' ? (
            <ActivityIndicator size="large" color={getStateColor()} />
          ) : (
            <Ionicons name={getStateIcon()} size={64} color={getStateColor()} />
          )}
          
          <Text style={[styles.statusText, { color: getStateColor() }]}>
            {getStateMessage()}
          </Text>

          {processingState === 'error' && errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        {/* Progress Indicator */}
        {processingState !== 'error' && processingState !== 'success' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                processingState === 'initiating' && styles.progressDotActive
              ]} />
              <Text style={styles.progressLabel}>Initiating</Text>
            </View>
            
            <View style={styles.progressLine} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                processingState === 'processing' && styles.progressDotActive
              ]} />
              <Text style={styles.progressLabel}>Processing</Text>
            </View>
            
            <View style={styles.progressLine} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                processingState === 'validating' && styles.progressDotActive
              ]} />
              <Text style={styles.progressLabel}>Validating</Text>
            </View>
          </View>
        )}

        {/* Error Actions */}
        {processingState === 'error' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: '#6366F1',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  progressDotActive: {
    backgroundColor: '#6366F1',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
