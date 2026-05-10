/**
 * G10 — About screen. Replaces the inline Alert.alert with a real route so
 * existing entry on the Profile menu lands on a styled screen instead of a
 * native alert dialog.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../contexts/LanguageContext';

const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="about-back">
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.about') || 'About'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.appName}>FinFlow</Text>
          <Text style={styles.version}>v{APP_VERSION}</Text>
          <Text style={styles.tagline}>Voice-, receipt-, and chat-driven personal finance.</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('https://finflow.app/help')}
            testID="about-help-link"
          >
            <Text style={styles.rowText}>Help center</Text>
            <Ionicons name="open-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('https://finflow.app/privacy')}
            testID="about-privacy-link"
          >
            <Text style={styles.rowText}>Privacy policy</Text>
            <Ionicons name="open-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('https://finflow.app/terms')}
            testID="about-terms-link"
          >
            <Text style={styles.rowText}>Terms of service</Text>
            <Ionicons name="open-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.copy}>© 2024 FinFlow Inc. All rights reserved.</Text>
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
  content: { padding: 16, gap: 16 },
  brand: { alignItems: 'center', paddingVertical: 24 },
  appName: { fontSize: 28, fontWeight: '700', color: '#4DB6AC' },
  version: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  tagline: { fontSize: 14, color: '#9CA3AF', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowText: { fontSize: 15, color: '#1F2937' },
  copy: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
});
