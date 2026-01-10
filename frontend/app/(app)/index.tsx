import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Transaction {
  id: string;
  amount: number;
  currency?: string;
  merchant?: string;
  category: string;
  date: string;
  transaction_type: string;
  source: string;
  created_at?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatAmount, currency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTransaction, setSuccessTransaction] = useState<any>(null);
  
  // Receipt states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  
  // Voice states
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState("");

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

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

  // Auto-start recording when voice modal opens
  useEffect(() => {
    if (showVoiceModal && !isRecording && !processingVoice) {
      // Small delay to ensure modal is fully visible
      const timer = setTimeout(() => {
        startRecording();
      }, 300);
      return () => clearTimeout(timer);
    }
    // Reset live transcription when modal closes
    if (!showVoiceModal) {
      setLiveTranscription("");
    }
  }, [showVoiceModal]);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

  const fetchData = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      const transactionsRes = await axios.get(
        `${BACKEND_URL}/api/transactions?limit=5`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      
      const insightsRes = await axios.get(
        `${BACKEND_URL}/api/insights?days=30`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      // Sort transactions by created_at (newest first)
      const sortedTransactions = transactionsRes.data.transactions.sort((a: Transaction, b: Transaction) => {
        const dateA = new Date(a.created_at || a.date);
        const dateB = new Date(b.created_at || b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setTransactions(sortedTransactions);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 18) return t('home.goodAfternoon');
    return t('home.goodEvening');
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      "Groceries": "cart",
      "Dining & Coffee": "restaurant",
      "Transportation": "car",
      "Rent & Utilities": "home",
      "Subscriptions": "refresh",
      "Healthcare": "medical",
      "Insurance": "shield-checkmark",
      "Entertainment": "game-controller",
      "Shopping": "bag",
      "Travel": "airplane",
      "Income": "cash",
      "Freelance": "briefcase",
      "Other": "ellipsis-horizontal",
    };
    return icons[category] || "ellipsis-horizontal";
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      "Groceries": "#F87171",
      "Dining & Coffee": "#F87171",
      "Transportation": "#A3E635",
      "Rent & Utilities": "#60A5FA",
      "Subscriptions": "#C084FC",
      "Healthcare": "#F472B6",
      "Insurance": "#2DD4BF",
      "Entertainment": "#FB923C",
      "Shopping": "#F87171",
      "Travel": "#38BDF8",
      "Income": "#4ADE80",
      "Freelance": "#4ADE80",
      "Other": "#9CA3AF",
    };
    return colors[category] || "#9CA3AF";
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return format(date, "MMM dd");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Receipt handlers
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

    setProcessingReceipt(true);
    try {
      const sessionToken = await AsyncStorage.getItem("session_token");
      
      const response = await axios.post(
        `${BACKEND_URL}/api/transactions/receipt`,
        { image_base64: selectedImage },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      setShowReceiptModal(false);
      setSelectedImage(null);
      
      // Redirect to edit mode for correction
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

  // Voice handlers
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
    setProcessingVoice(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error("No recording URI");
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const audioBase64 = await base64Promise;
      const sessionToken = await AsyncStorage.getItem("session_token");

      const apiResponse = await axios.post(
        `${BACKEND_URL}/api/transactions/voice`,
        { audio_base64: audioBase64 },
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
      
      // Redirect to edit mode for correction
      const transaction = apiResponse.data.transaction;
      router.push(`/(app)/edit-transaction?id=${transaction.id}&source=voice&transcription=${encodeURIComponent(apiResponse.data.transcription || '')}`);
      
    } catch (error: any) {
      console.error("Voice transcription error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to process voice recording"
      );
    } finally {
      setProcessingVoice(false);
    }
  };

  const totalBalance = insights 
    ? insights.total_income - insights.total_expenses 
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4DB6AC" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4DB6AC"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Image
                source={{ uri: user?.picture || `https://ui-avatars.com/api/?name=${user?.name}&background=random` }}
                style={styles.avatarImage}
              />
              <View style={styles.onlineIndicator} />
            </View>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#1F2937" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Total Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatAmount(totalBalance)}
          </Text>
        </View>

        {/* Income & Expenses Cards - New Layout */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={styles.statIconDown}>
                <Ionicons name="arrow-down" size={14} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Income</Text>
            </View>
            <Text style={styles.incomeAmount}>
              +{formatAmount(insights?.total_income || 0)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={styles.statIconUp}>
                <Ionicons name="arrow-up" size={14} color="#EF4444" />
              </View>
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
            <Text style={styles.expenseAmount}>
              -{formatAmount(insights?.total_expenses || 0)}
            </Text>
          </View>
        </View>

        {/* Quick Actions - Chat, Voice Log, Scan */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButtonSmall}
            onPress={() => router.push("/(app)/chat")}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: "#10B981" }]}>
              <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
            </View>
            <Text style={styles.actionButtonText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonLarge}
            onPress={() => setShowVoiceModal(true)}
          >
            <View style={styles.voiceIconCircle}>
              <View style={styles.voiceIconInner}>
                <Ionicons name="mic" size={44} color="#fff" />
              </View>
            </View>
            <Text style={styles.actionButtonTextLarge}>Voice Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonSmall}
            onPress={() => setShowReceiptModal(true)}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: "#F59E0B" }]}>
              <Ionicons name="scan" size={26} color="#fff" />
            </View>
            <Text style={styles.actionButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/history")}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t('home.noTransactions')}</Text>
              <Text style={styles.emptySubtext}>
                {t('home.startLogging')}
              </Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <TouchableOpacity 
                key={transaction.id} 
                style={styles.transactionItem}
                onPress={() => router.push(`/(app)/edit-transaction?id=${transaction.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.transactionIconContainer, { backgroundColor: getCategoryColor(transaction.category) + "20" }]}>
                  <Ionicons
                    name={getCategoryIcon(transaction.category) as any}
                    size={24}
                    color={getCategoryColor(transaction.category)}
                  />
                </View>
                <View style={styles.transactionContent}>
                  <Text style={styles.transactionMerchant}>
                    {transaction.merchant || "Unknown"}
                  </Text>
                  <Text style={styles.transactionMeta}>
                    {transaction.category} • {getTimeAgo(transaction.created_at || transaction.date)}
                  </Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.transaction_type === "income" && styles.transactionIncome,
                    ]}
                  >
                    {transaction.transaction_type === "income" ? "+" : "-"}
                    {formatAmount(transaction.amount, transaction.currency || 'USD')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#10B981" />
          <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/history")}
        >
          <Ionicons name="swap-horizontal" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() => setShowAddModal(true)}
        >
          <View style={styles.navCenterButton}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/insights")}
        >
          <Ionicons name="bar-chart" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/profile")}
        >
          <Ionicons name="person" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Add Transaction Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Transaction</Text>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddModal(false);
                router.push("/(app)/chat");
              }}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#10B981" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Chat with AI</Text>
                <Text style={styles.modalOptionDesc}>Type your expense naturally</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddModal(false);
                router.push("/(app)/manual");
              }}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="create" size={24} color="#3B82F6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Manual Input</Text>
                <Text style={styles.modalOptionDesc}>Enter transaction details manually</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddModal(false);
                setShowReceiptModal(true);
              }}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="camera" size={24} color="#F59E0B" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Scan Receipt</Text>
                <Text style={styles.modalOptionDesc}>Take a photo of your receipt</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddModal(false);
                setShowVoiceModal(true);
              }}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="mic" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Voice Log</Text>
                <Text style={styles.modalOptionDesc}>Speak your expense</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Receipt Scan Modal */}
      <Modal
        visible={showReceiptModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowReceiptModal(false);
          setSelectedImage(null);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowReceiptModal(false);
            setSelectedImage(null);
          }}
        >
          <View style={styles.bottomSheetContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Scan Receipt</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReceiptModal(false);
                  setSelectedImage(null);
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedImage ? (
              <View style={styles.receiptPreviewContainer}>
                <View style={styles.imagePreviewSmall}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
                    style={styles.previewImageSmall}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.receiptActionsRow}>
                  <TouchableOpacity
                    style={styles.retakeButtonSmall}
                    onPress={() => setSelectedImage(null)}
                  >
                    <Ionicons name="refresh" size={18} color="#6B7280" />
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.processButtonSmall, processingReceipt && styles.buttonDisabled]}
                    onPress={handleProcessReceipt}
                    disabled={processingReceipt}
                  >
                    {processingReceipt ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.processButtonText}>Process</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.cameraOptionsCompact}>
                <View style={styles.cameraIconMedium}>
                  <Ionicons name="receipt" size={48} color="#F59E0B" />
                </View>
                <Text style={styles.cameraTitleSmall}>Take a photo or select from gallery</Text>
                <View style={styles.cameraButtonsRow}>
                  <TouchableOpacity style={styles.cameraBtnCompact} onPress={handleTakePhoto}>
                    <View style={styles.cameraBtnIcon}>
                      <Ionicons name="camera" size={24} color="#10B981" />
                    </View>
                    <Text style={styles.cameraBtnTextSmall}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraBtnCompact} onPress={handlePickImage}>
                    <View style={styles.cameraBtnIcon}>
                      <Ionicons name="images" size={24} color="#10B981" />
                    </View>
                    <Text style={styles.cameraBtnTextSmall}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Voice Recording Modal */}
      <Modal
        visible={showVoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!processingVoice) {
            setShowVoiceModal(false);
            if (recording) {
              recording.stopAndUnloadAsync();
              setRecording(null);
              setIsRecording(false);
            }
          }
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!isRecording && !processingVoice) {
              setShowVoiceModal(false);
              if (recording) {
                recording.stopAndUnloadAsync();
                setRecording(null);
              }
            }
          }}
        >
          <View style={styles.voiceBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Voice Log</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isRecording && !processingVoice) {
                    setShowVoiceModal(false);
                    if (recording) {
                      recording.stopAndUnloadAsync();
                      setRecording(null);
                    }
                  }
                }}
                disabled={isRecording || processingVoice}
              >
                <Ionicons name="close" size={24} color={isRecording || processingVoice ? "#D1D5DB" : "#6B7280"} />
              </TouchableOpacity>
            </View>

            <View style={styles.voiceContentCompact}>
              <View style={[styles.micCircleSmall, isRecording && styles.micCircleRecording]}>
                <View style={[styles.micInnerSmall, isRecording && styles.micInnerRecording]}>
                  <Ionicons
                    name="mic"
                    size={36}
                    color={isRecording ? "#fff" : "#8B5CF6"}
                  />
                </View>
              </View>

              {processingVoice ? (
                <View style={styles.processingContainerCompact}>
                  <ActivityIndicator size="small" color="#8B5CF6" />
                  <Text style={styles.processingTextSmall}>Processing your voice...</Text>
                </View>
              ) : isRecording ? (
                <View style={styles.recordingInfoCompact}>
                  <Text style={styles.recordingDurationSmall}>{formatDuration(recordingDuration)}</Text>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingLabelSmall}>Recording... Speak now!</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.voiceSubtitleCompact}>
                  Starting recorder...
                </Text>
              )}

              <View style={styles.voiceExamplesCompact}>
                <Text style={styles.examplesTitleSmall}>
                  {language === 'id' 
                    ? 'Contoh: "Beli makan 50rb" atau "Gaji masuk 5 juta"'
                    : 'Try: "Spent $20 on lunch" or "Got paid $500"'}
                </Text>
              </View>

              <View style={styles.voiceActionsCompact}>
                {processingVoice ? (
                  <View style={styles.waitingContainer}>
                    <Text style={styles.waitingText}>Please wait...</Text>
                  </View>
                ) : isRecording ? (
                  <TouchableOpacity style={styles.stopButtonCompact} onPress={stopRecording}>
                    <Ionicons name="stop" size={20} color="#fff" />
                    <Text style={styles.stopButtonTextSmall}>Stop & Process</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.waitingContainer}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text style={styles.waitingText}>Initializing...</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Transaction Saved!</Text>
            
            {successTransaction && (
              <View style={styles.successDetails}>
                {successTransaction.transcription && (
                  <Text style={styles.transcriptionText}>
                    "{successTransaction.transcription}"
                  </Text>
                )}
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Amount</Text>
                  <Text style={styles.successValue}>
                    {formatAmount(successTransaction.amount, successTransaction.currency)}
                  </Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Category</Text>
                  <Text style={styles.successValue}>{successTransaction.category}</Text>
                </View>
                {successTransaction.merchant && (
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Merchant</Text>
                    <Text style={styles.successValue}>{successTransaction.merchant}</Text>
                  </View>
                )}
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Type</Text>
                  <Text style={[
                    styles.successValue,
                    successTransaction.transaction_type === "income" ? styles.incomeText : styles.expenseText
                  ]}>
                    {successTransaction.transaction_type === "income" ? "Income" : "Expense"}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessTransaction(null);
              }}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    position: "relative",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#F9FAFB",
  },
  greeting: {
    fontSize: 12,
    color: "#6B7280",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  balanceSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1F2937",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statIconDown: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  statIconUp: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  incomeAmount: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#10B981",
  },
  expenseAmount: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#EF4444",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 8,
    marginBottom: 32,
    gap: 40,
  },
  actionButtonSmall: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonLarge: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceIconInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 10,
    fontWeight: "500",
  },
  actionButtonTextLarge: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 10,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  viewAllText: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "500",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 8,
  },
  transactionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  transactionMeta: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EF4444",
  },
  transactionIncome: {
    color: "#10B981",
  },
  transactionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 8,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    paddingTop: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navItemCenter: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  navCenterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -28,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navText: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  navTextActive: {
    color: "#10B981",
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 12,
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontSize: 13,
    color: "#6B7280",
  },
  // Full modal styles
  fullModalOverlay: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fullModalContent: {
    flex: 1,
  },
  fullModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  fullModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  // Receipt styles
  receiptContent: {
    flex: 1,
    padding: 20,
  },
  imagePreview: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  receiptActions: {
    flexDirection: "row",
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  processButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#10B981",
    borderRadius: 12,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cameraOptions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconLarge: {
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
    marginBottom: 32,
  },
  cameraButtons: {
    flexDirection: "row",
    gap: 48,
  },
  cameraBtn: {
    alignItems: "center",
    gap: 8,
  },
  cameraBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  // Voice styles
  voiceContent: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  micCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
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
  },
  voiceExamples: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 32,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 12,
  },
  exampleBubble: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: "#4B5563",
    fontStyle: "italic",
  },
  voiceActions: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: "auto",
    paddingBottom: 24,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#EF4444",
    borderRadius: 12,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  processingContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  processingText: {
    fontSize: 14,
    color: "#8B5CF6",
    marginTop: 12,
  },
  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  successDetails: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptionText: {
    fontSize: 14,
    color: "#6B7280",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  successRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  successLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  successValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  incomeText: {
    color: "#10B981",
  },
  expenseText: {
    color: "#EF4444",
  },
  successButton: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: "#10B981",
    borderRadius: 12,
    alignItems: "center",
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  // Bottom Sheet Styles
  bottomSheetContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  // Receipt Bottom Sheet Styles
  receiptPreviewContainer: {
    alignItems: "center",
  },
  imagePreviewSmall: {
    width: "100%",
    height: 200,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewImageSmall: {
    width: "100%",
    height: "100%",
  },
  receiptActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  retakeButtonSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  processButtonSmall: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: "#10B981",
    borderRadius: 12,
  },
  cameraOptionsCompact: {
    alignItems: "center",
    paddingVertical: 16,
  },
  cameraIconMedium: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  cameraTitleSmall: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  cameraButtonsRow: {
    flexDirection: "row",
    gap: 32,
  },
  cameraBtnCompact: {
    alignItems: "center",
    gap: 8,
  },
  cameraBtnIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBtnTextSmall: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
  },
  // Voice Bottom Sheet Styles
  voiceBottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  voiceContentCompact: {
    alignItems: "center",
    paddingVertical: 8,
  },
  micCircleSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  micInnerSmall: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingInfoCompact: {
    alignItems: "center",
    marginTop: 16,
  },
  recordingDurationSmall: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#EF4444",
  },
  recordingLabelSmall: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 2,
  },
  voiceSubtitleCompact: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
  voiceExamplesCompact: {
    marginTop: 16,
    marginBottom: 20,
  },
  examplesTitleSmall: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
  },
  voiceActionsCompact: {
    width: "100%",
  },
  processingContainerCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 10,
  },
  processingTextSmall: {
    fontSize: 14,
    color: "#8B5CF6",
  },
  recordButtonCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
  },
  recordButtonTextSmall: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  stopButtonCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#EF4444",
    borderRadius: 12,
  },
  stopButtonTextSmall: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  waitingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  waitingText: {
    fontSize: 14,
    color: "#6B7280",
  },
});
