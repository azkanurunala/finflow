import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";

interface BottomNavWithAddModalProps {
  onScanReceipt?: () => void;
  onVoiceLog?: () => void;
}

export default function BottomNavWithAddModal({ 
  onScanReceipt, 
  onVoiceLog 
}: BottomNavWithAddModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);

  const isActive = (route: string) => {
    if (route === "/(app)" || route === "/(app)/index") {
      return pathname === "/(app)" || pathname === "/" || pathname === "/(app)/index";
    }
    return pathname.includes(route);
  };

  return (
    <>
      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)")}
        >
          <Ionicons
            name={isActive("/(app)") ? "home" : "home-outline"}
            size={24}
            color={isActive("/(app)") ? "#4DB6AC" : "#9CA3AF"}
          />
          <Text
            style={[styles.navLabel, isActive("/(app)") && styles.navLabelActive]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/history")}
        >
          <Ionicons
            name={isActive("history") ? "time" : "time-outline"}
            size={24}
            color={isActive("history") ? "#4DB6AC" : "#9CA3AF"}
          />
          <Text
            style={[styles.navLabel, isActive("history") && styles.navLabelActive]}
          >
            History
          </Text>
        </TouchableOpacity>

        {/* Center Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/insights")}
        >
          <Ionicons
            name={isActive("insights") ? "pie-chart" : "pie-chart-outline"}
            size={24}
            color={isActive("insights") ? "#4DB6AC" : "#9CA3AF"}
          />
          <Text
            style={[styles.navLabel, isActive("insights") && styles.navLabelActive]}
          >
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/(app)/profile")}
        >
          <Ionicons
            name={isActive("profile") ? "person" : "person-outline"}
            size={24}
            color={isActive("profile") ? "#4DB6AC" : "#9CA3AF"}
          />
          <Text
            style={[styles.navLabel, isActive("profile") && styles.navLabelActive]}
          >
            Profile
          </Text>
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
                if (onScanReceipt) {
                  onScanReceipt();
                } else {
                  router.push("/(app)/add?mode=receipt");
                }
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
                if (onVoiceLog) {
                  onVoiceLog();
                } else {
                  router.push("/(app)/add?mode=voice");
                }
              }}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="mic" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Voice Log</Text>
                <Text style={styles.modalOptionDesc}>Record your expense by voice</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  navLabelActive: {
    color: "#4DB6AC",
    fontWeight: "600",
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4DB6AC",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
    shadowColor: "#4DB6AC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
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
    maxHeight: "70%",
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
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
});
