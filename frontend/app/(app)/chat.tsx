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
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiClient } from "../../api/client";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import RecordingModal from "../../components/RecordingModal";

import { CONFIG } from "../../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

const CATEGORY_CHIPS: { id: string; label: string; icon: any }[] = [
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
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Recording Modal State - Single component for both Voice & Scan
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"voice" | "scan">("voice");

  // Reset confirmation modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Load chat history on mount (persisted like WhatsApp)
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await apiClient.get(`/api/chat/history`);

      if (response.data.messages && response.data.messages.length > 0) {
        const loadedMessages = response.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(loadedMessages);
      } else {
        const welcomeMessage = language === 'id'
          ? `Halo ${user?.name?.split(" ")[0] || ""}! Saya siap membantu mencatat pengeluaranmu.`
          : `Hi ${user?.name?.split(" ")[0] || "there"}! I'm ready to help you log your expenses.`;

        const welcomeMsg = {
          id: "welcome",
          type: "assistant",
          text: welcomeMessage,
          timestamp: new Date(),
        };
        setMessages([welcomeMsg]);
        await saveMessageToServer(welcomeMsg);
      }
    } catch (error) {
      console.error("Load chat history error:", error);
      const welcomeMessage = language === 'id'
        ? `Halo ${user?.name?.split(" ")[0] || ""}! Saya siap membantu mencatat pengeluaranmu.`
        : `Hi ${user?.name?.split(" ")[0] || "there"}! I'm ready to help you log your expenses.`;

      setMessages([{
        id: "welcome",
        type: "assistant",
        text: welcomeMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setLoadingHistory(false);
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  };

  const saveMessageToServer = async (message: any) => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await apiClient.post(
        `/api/chat/message`,
        {
          type: message.type,
          text: message.text,
          transcription: message.transcription,
          image_base64: message.image_base64,
          parsed_data: message.parsed_data,
          transaction_id: message.transaction_id,
          transaction_data: message.transaction_data,
        }
      );
    } catch (error) {
      console.error("Save message error:", error);
    }
  };

  const handleResetChat = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      await apiClient.delete(`/api/chat/history`);

      const welcomeMessage = language === 'id'
        ? `Chat direset. Saya siap membantu mencatat pengeluaranmu kembali!`
        : `Chat reset. I'm ready to help you log your expenses again!`;

      const welcomeMsg = {
        id: "welcome_reset",
        type: "assistant",
        text: welcomeMessage,
        timestamp: new Date(),
      };

      setMessages([welcomeMsg]);
      await saveMessageToServer(welcomeMsg);
      setShowResetModal(false);
      Alert.alert(
        language === 'id' ? "Berhasil" : "Success",
        language === 'id' ? "Riwayat chat telah dihapus" : "Chat history has been cleared"
      );
    } catch (error) {
      Alert.alert("Error", "Failed to reset chat");
    }
  };

  // Handle recording modal completion - save to chat history
  const handleRecordingComplete = async (result: {
    transaction?: any;
    transcription?: string;
    imageBase64?: string;
    parsedData?: any;
  }) => {
    // Create chat message for voice/scan result
    const messageType = recordingMode === "voice" ? "voice" : "ocr";
    const chatMessage = {
      id: Date.now().toString(),
      type: messageType,
      text: recordingMode === "voice"
        ? result.transcription || "Voice message recorded"
        : "Receipt scanned",
      transcription: result.transcription,
      image_base64: result.imageBase64,
      parsed_data: result.parsedData,
      transaction_id: result.transaction?.id,
      transaction_data: result.transaction,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, chatMessage]);
    await saveMessageToServer(chatMessage);

    // Add assistant response
    if (result.transaction) {
      const assistantMsg = {
        id: Date.now().toString() + "_assistant",
        type: "assistant",
        text: recordingMode === "voice"
          ? `Recorded: "${result.transcription}". Transaction logged successfully!`
          : `Receipt processed! ${result.transaction.merchant || "Transaction"} - ${formatAmount(result.transaction.amount)}`,
        transaction: result.transaction,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      await saveMessageToServer(assistantMsg);
    }
  };

  const handleSendMessage = async () => {
    if (!chatText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: "user",
      text: chatText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    // Save user message to server
    saveMessageToServer(userMessage);

    const messageText = chatText;
    setChatText("");
    setLoading(true);

    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      const response = await apiClient.post(
        `/api/transactions/chat`,
        { text: messageText }
      );

      const assistantMessage = {
        id: Date.now().toString() + "_assistant",
        type: "assistant",
        text: response.data.message,
        transaction: response.data.transaction,
        transaction_id: response.data.transaction?.id,
        transaction_data: response.data.transaction,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      // Save assistant message to server
      saveMessageToServer(assistantMessage);
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



  // Loading state for chat history
  if (loadingHistory) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.fullScreenLoadingContainer}>
          <ActivityIndicator size="large" color="#4DB6AC" />
          <Text style={styles.loadingText}>
            {language === 'id' ? "Memuat riwayat chat..." : "Loading chat history..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowResetModal(true)}
        >
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Reset Chat Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.resetModalOverlay}>
          <View style={styles.resetModalContent}>
            <Ionicons name="warning" size={48} color="#EF4444" />
            <Text style={styles.resetModalTitle}>
              {language === 'id' ? "Reset Chat?" : "Reset Chat?"}
            </Text>
            <Text style={styles.resetModalText}>
              {language === 'id'
                ? "Semua riwayat percakapan akan dihapus permanen. Transaksi yang sudah tersimpan tidak akan terpengaruh."
                : "All conversation history will be permanently deleted. Saved transactions will not be affected."
              }
            </Text>
            <View style={styles.resetModalButtons}>
              <TouchableOpacity
                style={styles.resetCancelButton}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.resetCancelText}>
                  {language === 'id' ? "Batal" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetConfirmButton}
                onPress={handleResetChat}
              >
                <Text style={styles.resetConfirmText}>
                  {language === 'id' ? "Hapus Semua" : "Delete All"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            onPress={() => {
              setRecordingMode("scan");
              setShowRecordingModal(true);
            }}
          >
            <Ionicons name="scan-outline" size={24} color="#6B7280" />
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
            onPress={() => {
              setRecordingMode("voice");
              setShowRecordingModal(true);
            }}
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

      {/* Recording Modal - Single component for Voice & Scan */}
      <RecordingModal
        visible={showRecordingModal}
        mode={recordingMode}
        onClose={() => setShowRecordingModal(false)}
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
  // Modal Styles
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
  // Scan Receipt Modal Styles
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
  // Voice Modal Styles
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
  // Loading state
  fullScreenLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  // Reset Modal Styles
  resetModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  resetModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  resetModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  resetModalText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  resetModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  resetCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  resetCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  resetConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  resetConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
