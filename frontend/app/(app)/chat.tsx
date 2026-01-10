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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";

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
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: "welcome",
        type: "assistant",
        text: `Hi ${user?.name?.split(" ")[0] || "there"}! I'm ready to help you log your expenses. You can say things like "Spent $15 on lunch" or "Paid $50 for gas".`,
        timestamp: new Date(),
      },
    ]);
  }, []);

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
                  <View style={styles.transactionCard}>
                    <View style={styles.transactionHeader}>
                      <View style={styles.transactionIcon}>
                        <Ionicons name="fast-food" size={20} color="#F59E0B" />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionCategory}>
                          {message.transaction.category}
                        </Text>
                        <Text style={styles.transactionLimit}>
                          Daily Limit: $40.00
                        </Text>
                      </View>
                    </View>
                    <View style={styles.transactionAmounts}>
                      <Text style={styles.transactionAmount}>
                        -${message.transaction.amount.toFixed(2)}
                      </Text>
                      <Text style={styles.transactionRemaining}>
                        $17.00 left
                      </Text>
                    </View>
                  </View>
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
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="camera-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={chatText}
            onChangeText={setChatText}
            placeholder="Type an expense..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity style={styles.micButton}>
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
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  transactionLimit: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#EF4444",
  },
  transactionRemaining: {
    fontSize: 14,
    color: "#6B7280",
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
