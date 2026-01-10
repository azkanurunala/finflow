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

export default function HomeScreen() {
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
        text: "Hi! I'm your AI Finance Assistant. Tell me about your expenses or income, like 'Spent $23 at Starbucks' or 'Got paid $1,800'.",
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
      
      // Check if quota exceeded
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Finance</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(app)/history")}
          >
            <Ionicons name="list" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(app)/insights")}
          >
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(app)/subscription")}
          >
            <Ionicons name="person-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((message) => (
            <View
              key={message.id}
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
                  <Text style={styles.transactionAmount}>
                    ${message.transaction.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.transactionDetail}>
                    {message.transaction.category}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {format(
                      new Date(message.transaction.date),
                      "MMM dd, yyyy"
                    )}
                  </Text>
                </View>
              )}
            </View>
          ))}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#667eea" />
            </View>
          )}
        </ScrollView>

        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Add:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => router.push("/(app)/add?mode=camera")}
            >
              <Ionicons name="camera" size={24} color="#667eea" />
              <Text style={styles.quickAddText}>Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => router.push("/(app)/add?mode=voice")}
            >
              <Ionicons name="mic" size={24} color="#667eea" />
              <Text style={styles.quickAddText}>Voice</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={chatText}
            onChangeText={setChatText}
            placeholder="Type your expense..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={500}
          />
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
              color={!chatText.trim() || loading ? "#64748b" : "#fff"}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
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
    gap: 12,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#667eea",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
  },
  messageText: {
    fontSize: 16,
    color: "#e2e8f0",
    lineHeight: 22,
  },
  userMessageText: {
    color: "#fff",
  },
  transactionCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "rgba(102, 126, 234, 0.2)",
    borderRadius: 8,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#667eea",
  },
  transactionDetail: {
    fontSize: 14,
    color: "#cbd5e1",
    marginTop: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  loadingContainer: {
    alignSelf: "flex-start",
    padding: 16,
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  quickActionsTitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  quickAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    marginRight: 12,
  },
  quickAddText: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "#1e293b",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#1e293b",
  },
});
