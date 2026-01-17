import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const CATEGORY_CHIPS = [
  { id: "groceries", label: "Groceries", icon: "cart" },
  { id: "dining", label: "Dining", icon: "restaurant" },
  { id: "transport", label: "Transport", icon: "car" },
  { id: "entertainment", label: "Fun", icon: "game-controller" },
];

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatAmount, currency } = useCurrency();
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Scan Receipt Modal State
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  
  // Voice Log Modal State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);

  useEffect(() => {
    // Add welcome message based on language
    const welcomeMessage = language === 'id' 
      ? `Halo ${user?.name?.split(" ")[0] || ""}! Saya siap membantu mencatat pengeluaranmu. Coba bilang "Beli makan 50rb" atau "Gaji masuk 5 juta".`
      : `Hi ${user?.name?.split(" ")[0] || "there"}! I'm ready to help you log your expenses. Try saying "Spent $15 on lunch" or "Got paid $500".`;
    
    setMessages([
      {
        id: "welcome",
        type: "assistant",
        text: welcomeMessage,
        timestamp: new Date(),
      },
    ]);
    
    // Auto focus input after a short delay
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
  }, [language]);

  const handleSendMessage = async () => {
    if (!chatText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: "user",
      text: chatText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = chatText;
    setChatText("");
    setLoading(true);

    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await axios.post(
        `${BACKEND_URL}/api/transactions/chat`,
        { text: messageText },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      const assistantMessage = {
        id: Date.now().toString() + "_assistant",
        type: "assistant",
        text: response.data.message,
        transaction: response.data.transaction,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to process transaction";
      
      if (error.response?.status === 403 && errorMsg.includes("Quota exceeded")) {
        Alert.alert(
          "Quota Exceeded",
          "You've reached your daily limit. Upgrade your plan to continue!",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Upgrade", onPress: () => router.push("/(app)/subscription") }
          ]
        );
      } else {
        Alert.alert("Error", errorMsg);
      }
      
      const errorMessage = {
        id: Date.now().toString() + "_error",
        type: "assistant",
        text: "Sorry, I couldn't process that. Could you try rephrasing?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChip = (category: string) => {
    setChatText(`I want to log ${category}`);
  };

  // ==================== SCAN RECEIPT HANDLERS ====================
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera access is needed to scan receipts");
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
      Alert.alert("Error", "Failed to open camera");
    }
  };

  const handlePickImage = async () => {
    try {
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
      Alert.alert("Error", "Failed to open gallery");
    }
  };

  const handleProcessReceipt = async () => {
    if (!selectedImage) return;

    setProcessingReceipt(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      const response = await axios.post(
        `${BACKEND_URL}/api/transactions/receipt`,
        { 
          image_base64: selectedImage,
          currency: currency
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      setShowScanModal(false);
      setSelectedImage(null);
      
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

  // ==================== VOICE LOG HANDLERS (with A-1 & A-2 fixes) ====================
  const startRecording = async () => {
    try {
      // A-2: Proper initialization with permission check
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed to record voice");
        return;
      }

      // A-2: Reset audio mode before starting
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // A-2: Create recording with error handling
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error("Recording start error:", error);
      Alert.alert(
        language === 'id' ? "Error" : "Error",
        language === 'id' 
          ? "Gagal memulai rekaman. Pastikan mikrofon tersedia." 
          : "Failed to start recording. Please ensure microphone is available."
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      // A-1: User-friendly message for no recording
      Alert.alert(
        language === 'id' ? "Info" : "Info",
        language === 'id' 
          ? "Tidak ada rekaman untuk diproses. Silakan rekam terlebih dahulu." 
          : "No recording to process. Please record first."
      );
      return;
    }

    setIsRecording(false);
    setProcessingVoice(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // A-1: Check if URI exists
      if (!uri) {
        Alert.alert(
          language === 'id' ? "Info" : "Info",
          language === 'id' 
            ? "Tidak ada audio yang terekam. Silakan coba lagi." 
            : "No audio was recorded. Please try again."
        );
        setRecording(null);
        setProcessingVoice(false);
        return;
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      
      // A-1: Check blob size - if too small, likely empty recording
      if (blob.size < 1000) {
        Alert.alert(
          language === 'id' ? "Audio Terlalu Pendek" : "Audio Too Short",
          language === 'id' 
            ? "Rekaman terlalu pendek untuk ditranskripsi. Silakan rekam lebih lama." 
            : "Recording is too short to transcribe. Please record longer."
        );
        setRecording(null);
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
          const base64Data = base64String.split(',')[1];
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
      
      // A-1: Additional check for empty base64
      if (!audioBase64 || audioBase64.length < 100) {
        Alert.alert(
          language === 'id' ? "Info" : "Info",
          language === 'id' 
            ? "Tidak ada audio yang bisa ditranskripsi. Silakan coba rekam lagi." 
            : "No audio could be transcribed. Please try recording again."
        );
        setRecording(null);
        setProcessingVoice(false);
        return;
      }
      
      const sessionToken = await AsyncStorage.getItem("session_token");

      const apiResponse = await axios.post(
        `${BACKEND_URL}/api/transactions/voice`,
        { 
          audio_base64: audioBase64,
          currency: currency
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      setShowVoiceModal(false);
      setRecording(null);
      
      const transaction = apiResponse.data.transaction;
      router.push(`/(app)/edit-transaction?id=${transaction.id}&source=voice&transcription=${encodeURIComponent(apiResponse.data.transcription || '')}`);
      
    } catch (error: any) {
      console.error("Voice transcription error:", error);
      
      // A-1: User-friendly error messages
      let errorMessage = language === 'id' 
        ? "Gagal memproses rekaman suara" 
        : "Failed to process voice recording";
      
      if (error.message?.includes("float()") || error.message?.includes("NoneType")) {
        errorMessage = language === 'id' 
          ? "Tidak ada audio yang bisa ditranskripsi. Silakan rekam ulang dengan suara yang jelas." 
          : "No audio could be transcribed. Please record again with clear voice.";
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert(
        language === 'id' ? "Gagal" : "Error",
        errorMessage
      );
    } finally {
      setProcessingVoice(false);
      setRecording(null);
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (e) {
        // Ignore errors when canceling
      }
    }
    setRecording(null);
    setIsRecording(false);
    setShowVoiceModal(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={styles.onlineStatus}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Date Header */}
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>TODAY</Text>
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.type === "user" && styles.userMessageContainer,
              ]}
            >
              {message.type === "assistant" && (
                <View style={styles.assistantAvatar}>
                  <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                </View>
              )}
              
              <View
                style={[
                  styles.messageBubble,
                  message.type === "user"
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.type === "user" && styles.userMessageText,
                  ]}
                >
                  {message.text}
                </Text>
                
                {message.transaction && (
                  <TouchableOpacity 
                    style={styles.transactionCard}
                    onPress={() => router.push(`/(app)/edit-transaction?id=${message.transaction.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.transactionHeader}>
                      <View style={[
                        styles.transactionIcon,
                        message.transaction.transaction_type === "income" && styles.incomeIcon
                      ]}>
                        <Ionicons 
                          name={message.transaction.transaction_type === "income" ? "arrow-down" : "fast-food"} 
                          size={20} 
                          color={message.transaction.transaction_type === "income" ? "#10B981" : "#F59E0B"} 
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionCategory}>
                          {message.transaction.category}
                        </Text>
                        <Text style={styles.transactionMerchant}>
                          {message.transaction.merchant || "Transaction recorded"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.transactionAmounts}>
                      <Text style={[
                        styles.transactionAmount,
                        message.transaction.transaction_type === "income" && styles.incomeAmount
                      ]}>
                        {message.transaction.transaction_type === "income" ? "+" : "-"}
                        {formatAmount(message.transaction.amount, message.transaction.currency)}
                      </Text>
                      <View style={styles.editHint}>
                        <Ionicons name="create-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.editHintText}>Tap to edit</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {message.type === "assistant" && (
                <Text style={styles.messageTime}>
                  {format(message.timestamp, "hh:mm a")}
                </Text>
              )}
              {message.type === "user" && (
                <Text style={styles.messageTimeUser}>
                  {format(message.timestamp, "hh:mm a")}
                </Text>
              )}
            </View>
          ))}
          
          {loading && (
            <View style={styles.loadingContainer}>
              <View style={styles.assistantAvatar}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#4DB6AC" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Category Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {CATEGORY_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={styles.chip}
                onPress={() => handleCategoryChip(chip.label)}
                activeOpacity={0.7}
              >
                <Ionicons name={chip.icon} size={16} color="#4DB6AC" />
                <Text style={styles.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Container */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={() => router.push("/(app)?openScan=true")}
          >
            <Ionicons name="camera-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
          
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={chatText}
            onChangeText={setChatText}
            placeholder={language === 'id' ? "Ketik pengeluaran..." : "Type an expense..."}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            autoFocus={true}
          />
          
          <TouchableOpacity 
            style={styles.micButton}
            onPress={() => router.push("/(app)?openVoice=true")}
          >
            <Ionicons name="mic-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!chatText.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!chatText.trim() || loading}
          >
            <Ionicons
              name="send"
              size={20}
              color={!chatText.trim() || loading ? "#9CA3AF" : "#fff"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  onlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  onlineText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "500",
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  dateHeader: {
    alignItems: "center",
    marginVertical: 16,
  },
  dateText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  messageContainer: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  userMessageContainer: {
    flexDirection: "row-reverse",
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  assistantMessage: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  userMessage: {
    backgroundColor: "#E0F2F1",
  },
  messageText: {
    fontSize: 15,
    color: "#1F2937",
    lineHeight: 22,
  },
  userMessageText: {
    color: "#1F2937",
  },
  messageTime: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    marginLeft: 40,
  },
  messageTimeUser: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    marginRight: 8,
  },
  transactionCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  incomeIcon: {
    backgroundColor: "#D1FAE5",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  transactionMerchant: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionAmounts: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#EF4444",
  },
  incomeAmount: {
    color: "#10B981",
  },
  editHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  editHintText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  loadingBubble: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipsContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#E0F2F1",
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4DB6AC",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "#F9FAFB",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  micButton: {
    padding: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
});
