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
import { Camera } from "expo-camera";
import { Audio } from "expo-av";
import axios from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Audio.requestPermissionsAsync();
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
      Alert.alert("Error", "Failed to take photo");
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
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleProcessReceipt = async () => {
    if (!selectedImage) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image_base64", selectedImage);

      const response = await axios.post(
        `${BACKEND_URL}/api/transactions/receipt`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Alert.alert("Success", response.data.message, [
        {
          text: "OK",
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to process receipt"
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
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    setLoading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // For now, voice transcription is not available with Emergent LLM key
      // Show an informative message to the user
      Alert.alert(
        "Voice Feature Unavailable",
        "Voice transcription requires a separate OpenAI API key (not included with Emergent LLM key).\n\nPlease use text chat or receipt photo instead, or contact support to add OpenAI Whisper support.",
        [
          {
            text: "Use Text Chat",
            onPress: () => {
              router.back();
            },
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );

      setRecording(null);
      setLoading(false);
    } catch (error) {
      Alert.alert("Error", "Failed to process recording");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {mode === "camera" || selectedImage ? (
          <View style={styles.receiptMode}>
            {selectedImage ? (
              <>
                <View style={styles.imageContainer}>
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
                    <Ionicons name="close" size={24} color="#ef4444" />
                    <Text style={styles.secondaryButtonText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleProcessReceipt}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={24} color="#fff" />
                        <Text style={styles.primaryButtonText}>Process</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.cameraOptions}>
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera" size={48} color="#667eea" />
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionDescription}>
                    Capture receipt with camera
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handlePickImage}
                >
                  <Ionicons name="images" size={48} color="#667eea" />
                  <Text style={styles.optionTitle}>Choose from Gallery</Text>
                  <Text style={styles.optionDescription}>
                    Select existing photo
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : mode === "voice" ? (
          <View style={styles.voiceMode}>
            <View style={styles.voiceVisualizer}>
              <View
                style={[
                  styles.micIcon,
                  isRecording && styles.micIconRecording,
                ]}
              >
                <Ionicons
                  name="mic"
                  size={64}
                  color={isRecording ? "#ef4444" : "#667eea"}
                />
              </View>
              {isRecording && (
                <Text style={styles.recordingText}>Recording...</Text>
              )}
            </View>

            <View style={styles.actionButtons}>
              {isRecording ? (
                <TouchableOpacity
                  style={[styles.primaryButton, styles.stopButton]}
                  onPress={stopRecording}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="stop" size={24} color="#fff" />
                      <Text style={styles.primaryButtonText}>Stop</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={startRecording}
                >
                  <Ionicons name="mic" size={24} color="#fff" />
                  <Text style={styles.primaryButtonText}>Start Recording</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.voiceHint}>
              Tap to record your expense, like "I spent thirty bucks on gas
              yesterday"
            </Text>
          </View>
        ) : (
          <View style={styles.modeSelection}>
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => router.push("/add?mode=camera")}
            >
              <Ionicons name="camera" size={64} color="#667eea" />
              <Text style={styles.modeTitle}>Scan Receipt</Text>
              <Text style={styles.modeDescription}>
                Take a photo of your receipt and AI will extract the details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => router.push("/add?mode=voice")}
            >
              <Ionicons name="mic" size={64} color="#667eea" />
              <Text style={styles.modeTitle}>Voice Note</Text>
              <Text style={styles.modeDescription}>
                Record your expense naturally - AI will understand and log it
              </Text>
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
    backgroundColor: "#0A0E27",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  modeSelection: {
    flex: 1,
    gap: 16,
  },
  modeCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
  receiptMode: {
    flex: 1,
  },
  cameraOptions: {
    flex: 1,
    gap: 16,
  },
  optionCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  optionDescription: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  imageContainer: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  receiptImage: {
    width: "100%",
    height: "100%",
  },
  voiceMode: {
    flex: 1,
    justifyContent: "space-between",
  },
  voiceVisualizer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  micIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  micIconRecording: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  recordingText: {
    fontSize: 18,
    color: "#ef4444",
    fontWeight: "600",
    marginTop: 24,
  },
  voiceHint: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#667eea",
    paddingVertical: 16,
    paddingHorizontal: 24,
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
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
});
