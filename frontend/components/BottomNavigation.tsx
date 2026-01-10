import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";

interface BottomNavigationProps {
  onAddPress?: () => void;
}

export default function BottomNavigation({ onAddPress }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/(app)" || path === "/") {
      return pathname === "/" || pathname === "/(app)" || pathname === "/(app)/index";
    }
    return pathname.includes(path.replace("/(app)", ""));
  };

  const handleAddPress = () => {
    if (onAddPress) {
      onAddPress();
    } else {
      router.push("/(app)/manual");
    }
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push("/(app)")}
      >
        <Ionicons
          name={isActive("/(app)") ? "home" : "home-outline"}
          size={24}
          color={isActive("/(app)") ? "#10B981" : "#9CA3AF"}
        />
        <Text style={[styles.navText, isActive("/(app)") && styles.navTextActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push("/(app)/history")}
      >
        <Ionicons
          name={isActive("/history") ? "swap-horizontal" : "swap-horizontal-outline"}
          size={24}
          color={isActive("/history") ? "#10B981" : "#9CA3AF"}
        />
        <Text style={[styles.navText, isActive("/history") && styles.navTextActive]}>
          Transactions
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItemCenter} onPress={handleAddPress}>
        <View style={styles.navCenterButton}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push("/(app)/insights")}
      >
        <Ionicons
          name={isActive("/insights") ? "bar-chart" : "bar-chart-outline"}
          size={24}
          color={isActive("/insights") ? "#10B981" : "#9CA3AF"}
        />
        <Text style={[styles.navText, isActive("/insights") && styles.navTextActive]}>
          Analytics
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => router.push("/(app)/profile")}
      >
        <Ionicons
          name={isActive("/profile") ? "person" : "person-outline"}
          size={24}
          color={isActive("/profile") ? "#10B981" : "#9CA3AF"}
        />
        <Text style={[styles.navText, isActive("/profile") && styles.navTextActive]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
