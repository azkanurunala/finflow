import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";


import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import RecordingModal from "../../components/RecordingModal";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const { t } = useLanguage();
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"voice" | "scan">("voice");

  useEffect(() => {
    if (mode === "voice") {
      setRecordingMode("voice");
      setShowRecordingModal(true);
    } else if (mode === "camera") {
      setRecordingMode("scan");
      setShowRecordingModal(true);
    }
  }, [mode]);

  const handleModalClose = () => {
    setShowRecordingModal(false);
    // Clear mode param to avoid reopening on refresh/back
    router.setParams({ mode: undefined });
  };

  const handleRecordingComplete = (result: any) => {
    setShowRecordingModal(false);
    // Navigate to history or stay here? The modal usually handles navigation to edit.
    // RecordingModal implementation navigates to edit-transaction internally.
    // so we just need to close the modal and clear params.
    router.setParams({ mode: undefined });
  };



  const renderModeSelection = () => (
    <View style={styles.modeSelection}>
      <Text style={styles.sectionTitle}>{t('add.chooseMethod')}</Text>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => router.push("/(app)/chat")}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["#E0F2F1", "#B2DFDB"]}
          style={styles.modeGradient}
        >
          <View style={styles.modeIconContainer}>
            <Ionicons name="chatbubble-ellipses" size={32} color="#4DB6AC" />
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>{t('actions.askAssistant')}</Text>
            <Text style={styles.modeDescription}>
              {t('actions.askAssistantDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#4DB6AC" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => router.push("/(app)/manual")}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["#DBEAFE", "#BFDBFE"]}
          style={styles.modeGradient}
        >
          <View style={styles.modeIconContainer}>
            <Ionicons name="create" size={32} color="#3B82F6" />
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>{t('add.manual.title')}</Text>
            <Text style={styles.modeDescription}>
              {t('add.manual.desc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => router.push("/(app)/add?mode=camera")}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["#FEF3C7", "#FDE68A"]}
          style={styles.modeGradient}
        >
          <View style={styles.modeIconContainer}>
            <Ionicons name="camera" size={32} color="#F59E0B" />
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>{t('actions.scanReceipt')}</Text>
            <Text style={styles.modeDescription}>
              {t('actions.scanReceiptDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#F59E0B" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => router.push("/(app)/add?mode=voice")}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["#EDE9FE", "#DDD6FE"]}
          style={styles.modeGradient}
        >
          <View style={styles.modeIconContainer}>
            <Ionicons name="mic" size={32} color="#8B5CF6" />
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>{t('actions.voiceLog')}</Text>
            <Text style={styles.modeDescription}>
              {t('actions.voiceLogDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#8B5CF6" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );



  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('add.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {renderModeSelection()}
      </View>

      <RecordingModal
        visible={showRecordingModal}
        mode={recordingMode}
        onClose={handleModalClose}
        onComplete={handleRecordingComplete}
      />
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
    backgroundColor: "#F3F4F6",
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
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 20,
  },
  modeSelection: {
    flex: 1,
    gap: 16,
  },
  modeCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  modeGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  modeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  // Camera Mode Styles
  cameraMode: {
    flex: 1,
  },
  cameraOptions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cameraIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  cameraTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  cameraSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  cameraButtons: {
    flexDirection: "row",
    gap: 16,
  },
  cameraButton: {
    alignItems: "center",
    gap: 8,
  },
  cameraButtonIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  receiptImage: {
    width: "100%",
    height: "100%",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 2,
    flexDirection: "row",
    backgroundColor: "#4DB6AC",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  // Voice Mode Styles
  voiceMode: {
    flex: 1,
    justifyContent: "space-between",
  },
  voiceVisualizer: {
    alignItems: "center",
    paddingTop: 40,
  },
  micCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  micCircleRecording: {
    backgroundColor: "#FEE2E2",
  },
  micInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  micInnerRecording: {
    backgroundColor: "#EF4444",
  },
  recordingInfo: {
    alignItems: "center",
    marginTop: 24,
  },
  recordingDuration: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#EF4444",
  },
  recordingLabel: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 4,
  },
  voiceInstructions: {
    alignItems: "center",
    marginTop: 24,
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  voiceSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  voiceExamples: {
    paddingHorizontal: 24,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 12,
  },
  exampleBubble: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  exampleText: {
    fontSize: 14,
    color: "#4B5563",
    fontStyle: "italic",
  },
  voiceActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  recordButton: {
    flexDirection: "row",
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  stopButton: {
    flexDirection: "row",
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
