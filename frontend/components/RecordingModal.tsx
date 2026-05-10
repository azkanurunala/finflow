import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, useAudioRecorder, RecordingPresets } from "expo-audio";
import { apiClient } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useRefreshStore } from "../store/useRefreshStore";

import { CONFIG } from "../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

interface RecordingModalProps {
  visible: boolean;
  mode: "voice" | "scan";
  onClose: () => void;
  onComplete?: (result: {
    transaction?: any;
    transcription?: string;
    imageBase64?: string;
    parsedData?: any;
  }) => void;
}

export default function RecordingModal({
  visible,
  mode,
  onClose,
  onComplete,
}: RecordingModalProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { currency } = useCurrency();

  // Voice state - expo-audio hook
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);

  // Scan state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);

  // Reset state when modal opens/closes
  // AUTO-START: Voice recording or Camera when modal opens
  useEffect(() => {
    if (!visible) {
      // Cleanup when closing
      if (isRecording) {
        stopRecordingCleanup();
      }
      setIsRecording(false);
      setProcessingVoice(false);
      setSelectedImage(null);
      setProcessingReceipt(false);
    }
  }, [visible]);

  // Separate effect for auto-start to avoid dependency issues
  useEffect(() => {
    if (visible) {
      if (mode === "voice") {
        const timer = setTimeout(async () => {
          await startRecordingAuto();
        }, 500);
        return () => clearTimeout(timer);
      }
      // For scan mode, we DO NOT auto-start camera anymore.
      // We wait for user selection (Camera vs Gallery).
    }
  }, [visible, mode]);

  // Auto open camera function
  const handleOpenCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          language === "id" ? "Izin Diperlukan" : "Permission Required",
          language === "id"
            ? "Akses kamera diperlukan untuk scan struk"
            : "Camera access is needed to scan receipts"
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert(t('common.error') || "Error", "Failed to open camera");
    }
  };

  const handleOpenGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          language === "id" ? "Izin Diperlukan" : "Permission Required",
          language === "id"
            ? "Akses galeri diperlukan untuk memilih foto"
            : "Gallery access is needed to select photos"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert(t('common.error') || "Error", "Failed to open gallery");
    }
  };

  // Auto-start recording function with better error handling
  const startRecordingAuto = async () => {
    try {
      console.log("Starting auto recording...");

      const status = await AudioModule.requestRecordingPermissionsAsync();
      console.log("Permission status:", status);

      if (status.status !== "granted") {
        Alert.alert(
          language === "id" ? "Izin Diperlukan" : "Permission Required",
          language === "id"
            ? "Akses mikrofon diperlukan untuk merekam suara"
            : "Microphone access is needed to record voice"
        );
        onClose();
        return;
      }

      await AudioModule.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
      });

      console.log("Preparing recording...");
      await audioRecorder.prepareToRecordAsync();
      
      console.log("Starting recording...");
      audioRecorder.record();

      console.log("Recording started successfully");
      setIsRecording(true);
    } catch (error) {
      console.error("Auto recording start error:", error);
      Alert.alert(
        language === "id" ? "Error" : "Error",
        language === "id"
          ? "Gagal memulai rekaman. Pastikan mikrofon tersedia."
          : "Failed to start recording. Please ensure microphone is available."
      );
      onClose();
    }
  };

  // ==================== VOICE HANDLERS ====================

  const stopRecordingCleanup = async () => {
     try {
       await audioRecorder.stop();
       setIsRecording(false);
     } catch (e) {
       console.log("Error stopping recording in cleanup", e);
     }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      Alert.alert(
        language === "id" ? "Info" : "Info",
        language === "id"
          ? "Tidak ada rekaman untuk diproses."
          : "No recording to process."
      );
      return;
    }

    setIsRecording(false);
    setProcessingVoice(true);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("No recording URI");
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size < 1000) {
        Alert.alert(
          language === "id" ? "Audio Terlalu Pendek" : "Audio Too Short",
          language === "id"
            ? "Rekaman terlalu pendek untuk ditranskripsi."
            : "Recording is too short to transcribe."
        );
        setProcessingVoice(false);
        return;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          if (!base64String) {
            reject(new Error("Failed to convert audio"));
            return;
          }
          const base64Data = base64String.split(",")[1];
          if (!base64Data) {
            reject(new Error("Invalid audio data"));
            return;
          }
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error("Failed to read audio file"));
        reader.readAsDataURL(blob);
      });

      const audioBase64 = await base64Promise;

      if (!audioBase64 || audioBase64.length < 100) {
        throw new Error("Empty audio data");
      }

      const sessionToken = await AsyncStorage.getItem("session_token");

      const apiResponse = await apiClient.post(
        `/api/transactions/voice`,
        {
          audio_base64: audioBase64,
          currency: currency,
        },
        {
          timeout: 60000,
        }
      );

      // Call onComplete callback with result
      if (onComplete) {
        onComplete({
          transaction: apiResponse.data.transaction,
          transcription: apiResponse.data.transcription,
        });
        useRefreshStore.getState().triggerRefresh();
      }

      onClose();

      // Navigate to edit screen for verification
      const transaction = apiResponse.data.transaction;
      router.push(
        `/(app)/edit-transaction?id=${transaction.id}&source=voice&transcription=${encodeURIComponent(
          apiResponse.data.transcription || ""
        )}`
      );
    } catch (error: any) {
      console.error("Voice transcription error:", error);

      let errorMessage =
        language === "id"
          ? "Gagal memproses rekaman suara"
          : "Failed to process voice recording";

      if (
        error.message?.includes("float()") ||
        error.message?.includes("NoneType")
      ) {
        errorMessage =
          language === "id"
            ? "Tidak ada audio yang bisa ditranskripsi."
            : "No audio could be transcribed.";
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      Alert.alert(language === "id" ? "Gagal" : "Error", errorMessage);
    } finally {
      setProcessingVoice(false);
    }
  };

  const cancelRecording = async () => {
    if (isRecording) {
      try {
        await audioRecorder.stop();
      } catch (e) {
        // Ignore errors when canceling
      }
    }
    setIsRecording(false);
    onClose();
  };

  // ==================== SCAN HANDLERS ====================

  const handleProcessReceipt = async () => {
    if (!selectedImage) return;

    setProcessingReceipt(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");

      const response = await apiClient.post(
        `/api/transactions/receipt`,
        {
          image_base64: selectedImage,
          currency: currency,
        }
      );

      // Call onComplete callback with result
      if (onComplete) {
        onComplete({
          transaction: response.data.transaction,
          imageBase64: selectedImage.substring(0, 100), // Thumbnail
          parsedData: response.data.transaction,
        });
        useRefreshStore.getState().triggerRefresh();
      }

      onClose();
      setSelectedImage(null);

      // Navigate to edit screen for verification
      const transaction = response.data.transaction;
      router.push(`/(app)/edit-transaction?id=${transaction.id}&source=receipt`);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to process receipt"
      );
    } finally {
      setProcessingReceipt(false);
    }
  };

  // ==================== RENDER ====================
  const renderVoiceContent = () => (
    <View style={styles.voiceContainer}>
      {processingVoice ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text style={styles.processingText}>
            {language === "id" ? "Memproses rekaman..." : "Processing recording..."}
          </Text>
        </View>
      ) : isRecording ? (
        <>
          <View style={[styles.recordButton, styles.recordButtonActive]}>
            <TouchableOpacity
              onPress={stopRecording}
              style={styles.recordButtonInner}
            >
              <Ionicons name="stop" size={40} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <Text style={styles.recordingStatus}>
            {language === "id" ? "Merekam... Tekan untuk berhenti" : "Recording... Tap to stop"}
          </Text>

          <Text style={styles.recordingHint}>
            {language === "id"
              ? 'Contoh: "Beli makan siang 50 ribu"'
              : 'Example: "Spent $15 on lunch"'}
          </Text>
        </>
      ) : (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text style={styles.processingText}>
            {language === "id" ? "Memulai rekaman..." : "Starting recording..."}
          </Text>
        </View>
      )}
    </View>
  );

  const renderScanContent = () => (
    <>
      {selectedImage ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.retakeButtonText}>
                {language === "id" ? "Foto Ulang" : "Retake"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.processButton}
              onPress={handleProcessReceipt}
              disabled={processingReceipt}
            >
              {processingReceipt ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.processButtonText}>
                  {language === "id" ? "Proses Struk" : "Process Receipt"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.scanSelectionContainer}>
          <Text style={styles.scanSelectionTitle}>
            {language === 'id' ? "Pilih Sumber Gambar" : "Select Image Source"}
          </Text>
          <View style={styles.scanSelectionButtons}>
            <TouchableOpacity
              style={styles.scanSelectionButton}
              onPress={handleOpenCamera}
            >
              <View style={[styles.scanIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="camera" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.scanButtonText}>
                {language === 'id' ? "Kamera" : "Camera"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanSelectionButton}
              onPress={handleOpenGallery}
            >
              <View style={[styles.scanIconCircle, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="images" size={32} color="#EC4899" />
              </View>
              <Text style={styles.scanButtonText}>
                {language === 'id' ? "Galeri" : "Gallery"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={mode === "voice" ? cancelRecording : onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={mode === "voice" ? cancelRecording : onClose}
      >
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {mode === "voice"
              ? language === "id"
                ? "Rekam Suara"
                : "Voice Log"
              : language === "id"
                ? "Scan Struk"
                : "Scan Receipt"}
          </Text>

          {mode === "voice" ? renderVoiceContent() : renderScanContent()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 20,
    textAlign: "center",
  },
  // Voice styles
  voiceContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 20,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E0F2F1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#4DB6AC",
  },
  recordButtonActive: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  recordButtonInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingStatus: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  recordingHint: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    fontStyle: "italic",
  },
  processingContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
  },
  processingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  // Scan styles
  scanOptions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
  scanOption: {
    alignItems: "center",
    gap: 12,
  },
  scanOptionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scanOptionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  previewContainer: {
    alignItems: "center",
    gap: 16,
  },
  previewImage: {
    width: "100%",
    height: 250,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  retakeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  processButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4DB6AC",
    alignItems: "center",
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  scanSelectionContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 24,
  },
  scanSelectionTitle: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  scanSelectionButtons: {
    flexDirection: "row",
    gap: 40,
  },
  scanSelectionButton: {
    alignItems: "center",
    gap: 8,
  },
  scanIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
});
