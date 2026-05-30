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
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('receipt.failTakePhoto'));
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('receipt.failPickImage'));
    }
  };

  const handleProcessReceipt = async () => {
    if (!selectedImage) return;

    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      const response = await axios.post(
        `${BACKEND_URL}/api/transactions/receipt`,
        { image_base64: selectedImage, currency },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      Alert.alert(t('common.success'), t('add.receiptProcessed'), [
        {
          text: t('add.viewTransaction'),
          onPress: () => router.replace("/(app)/history"),
        },
        {
          text: t('manual.addAnother'),
          onPress: () => setSelectedImage(null),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error.response?.data?.detail || t('receipt.failProcess')
      );
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      Alert.alert(t('common.error'), t('voice.failStartRecording'));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    setLoading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error("No recording URI");
      }

      // Read the audio file and convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const audioBase64 = await base64Promise;
      const sessionToken = await AsyncStorage.getItem("session_token");

      // Send to backend for transcription
      const apiResponse = await axios.post(
        `${BACKEND_URL}/api/transactions/voice`,
        { audio_base64: audioBase64, currency },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          timeout: 60000, // 60 seconds timeout for transcription
        }
      );

      Alert.alert(
        t('common.success'),
        t('add.transcribed', {
          text: apiResponse.data.transcription,
          message: apiResponse.data.message,
        }),
        [
          {
            text: t('add.viewTransactions'),
            onPress: () => router.replace("/(app)/history"),
          },
          {
            text: t('add.recordAnother'),
            style: "cancel",
          },
        ]
      );

      setRecording(null);
    } catch (error: any) {
      console.error("Voice transcription error:", error);
      Alert.alert(
        t('common.error'),
        error.response?.data?.detail || t('add.failVoiceRetry')
      );
    } finally {
      setLoading(false);
    }
  };

  const renderModeSelection = () => (
    <View style={styles.modeSelection}>
      <Text style={styles.sectionTitle}>{t('add.chooseInputMethod')}</Text>
      
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
            <Text style={styles.modeTitle}>{t('addModal.manualInput')}</Text>
            <Text style={styles.modeDescription}>
              {t('addModal.manualInputDesc')}
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

  const renderCameraMode = () => (
    <View style={styles.cameraMode}>
      {selectedImage ? (
        <>
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
              style={styles.receiptImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="refresh" size={20} color="#6B7280" />
              <Text style={styles.secondaryButtonText}>{t('common.retake')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleProcessReceipt}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>{t('add.processReceipt')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.cameraOptions}>
          <View style={styles.cameraIconContainer}>
            <Ionicons name="receipt" size={64} color="#F59E0B" />
          </View>
          <Text style={styles.cameraTitle}>{t('add.scanYourReceipt')}</Text>
          <Text style={styles.cameraSubtitle}>
            {t('add.scanReceiptSubtitle')}
          </Text>
          
          <View style={styles.cameraButtons}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleTakePhoto}
            >
              <View style={styles.cameraButtonIcon}>
                <Ionicons name="camera" size={28} color="#4DB6AC" />
              </View>
              <Text style={styles.cameraButtonText}>{t('add.takePhoto')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handlePickImage}
            >
              <View style={styles.cameraButtonIcon}>
                <Ionicons name="images" size={28} color="#4DB6AC" />
              </View>
              <Text style={styles.cameraButtonText}>{t('receipt.gallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderVoiceMode = () => (
    <View style={styles.voiceMode}>
      <View style={styles.voiceVisualizer}>
        <View style={[styles.micCircle, isRecording && styles.micCircleRecording]}>
          <View style={[styles.micInner, isRecording && styles.micInnerRecording]}>
            <Ionicons
              name="mic"
              size={48}
              color={isRecording ? "#fff" : "#8B5CF6"}
            />
          </View>
        </View>
        
        {isRecording ? (
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingDuration}>
              {formatDuration(recordingDuration)}
            </Text>
            <Text style={styles.recordingLabel}>{t('add.recording')}</Text>
          </View>
        ) : (
          <View style={styles.voiceInstructions}>
            <Text style={styles.voiceTitle}>{t('add.voiceRecording')}</Text>
            <Text style={styles.voiceSubtitle}>
              {t('add.voiceRecordingSubtitle')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.voiceExamples}>
        <Text style={styles.examplesTitle}>{t('add.trySaying')}</Text>
        <View style={styles.exampleBubble}>
          <Text style={styles.exampleText}>{t('add.example1')}</Text>
        </View>
        <View style={styles.exampleBubble}>
          <Text style={styles.exampleText}>{t('add.example2')}</Text>
        </View>
      </View>

      <View style={styles.voiceActions}>
        {isRecording ? (
          <TouchableOpacity
            style={[styles.stopButton, loading && styles.buttonDisabled]}
            onPress={stopRecording}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="stop" size={24} color="#fff" />
                <Text style={styles.stopButtonText}>{t('add.stopRecording')}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
          >
            <Ionicons name="mic" size={24} color="#fff" />
            <Text style={styles.recordButtonText}>{t('add.startRecording')}</Text>
          </TouchableOpacity>
        )}
      </View>
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
        <Text style={styles.headerTitle}>
          {mode === "camera" ? t('addModal.scanReceipt') : mode === "voice" ? t('voice.voiceLog') : t('addModal.title')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {mode === "camera" ? renderCameraMode() : mode === "voice" ? renderVoiceMode() : renderModeSelection()}
      </View>
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
