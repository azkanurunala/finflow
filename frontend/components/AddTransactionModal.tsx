import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * The "+" add-transaction sheet shown from the bottom navbar. Home renders its
 * own inline copy (it owns the Scan/Voice modals); every OTHER screen uses this
 * shared component so the "+" behaves identically everywhere. Scan/Voice route
 * to Home with a param that opens the matching modal there (see index.tsx's
 * useLocalSearchParams handling), avoiding duplicating the camera/recorder UI.
 */
export function AddTransactionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  const go = (action: () => void) => {
    onClose();
    action();
  };

  const options = [
    {
      icon: "chatbubble-ellipses" as const,
      bg: "#D1FAE5",
      color: "#10B981",
      title: t("addModal.chatWithAI"),
      desc: t("addModal.chatWithAIDesc"),
      onPress: () => router.push("/(app)/chat"),
    },
    {
      icon: "create" as const,
      bg: "#DBEAFE",
      color: "#3B82F6",
      title: t("addModal.manualInput"),
      desc: t("addModal.manualInputDesc"),
      onPress: () => router.push("/(app)/manual"),
    },
    {
      icon: "camera" as const,
      bg: "#FEF3C7",
      color: "#F59E0B",
      title: t("addModal.scanReceipt"),
      desc: t("addModal.scanReceiptDesc"),
      onPress: () => router.push("/(app)?openScan=true"),
    },
    {
      icon: "mic" as const,
      bg: "#EDE9FE",
      color: "#8B5CF6",
      title: t("addModal.voiceLog"),
      desc: t("addModal.voiceLogDesc"),
      onPress: () => router.push("/(app)?openVoice=true"),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t("addModal.title")}</Text>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.title}
              style={styles.modalOption}
              onPress={() => go(opt.onPress)}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: opt.bg }]}>
                <Ionicons name={opt.icon} size={24} color={opt.color} />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>{opt.title}</Text>
                <Text style={styles.modalOptionDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
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
  modalOptionContent: { flex: 1 },
  modalOptionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 2 },
  modalOptionDesc: { fontSize: 13, color: "#6B7280" },
});
