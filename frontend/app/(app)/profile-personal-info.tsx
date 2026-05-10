/**
 * G10 — Personal Info screen.
 *
 * Read-only view of the user's account data already in AuthContext. Replaces
 * the previous `handleComingSoon` placeholder on the Profile menu. Editing
 * personal info is intentionally deferred until a backend PUT endpoint exists
 * (no PUT /api/auth/me in the current contract).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Back"
          testID="personal-info-back"
        >
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.personalInfo') || 'Personal info'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Row label="Name" value={user?.name ?? '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="User ID" value={(user as any)?.user_id ?? '—'} />
          <Row label="Joined" value={formatDate((user as any)?.created_at)} />
          <Row label="Subscription" value={(user as any)?.subscription_tier ?? 'free'} />
        </View>

        <Text style={styles.note}>
          Editing your personal info will be available in a future update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 8 },
  title: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
  headerSpacer: { width: 36 },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: { color: '#6B7280', fontSize: 14 },
  rowValue: { color: '#1F2937', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  note: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
