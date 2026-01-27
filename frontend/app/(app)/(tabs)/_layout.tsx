import { Tabs } from "expo-router";
import BottomNavWithAddModal from "../../../components/BottomNavWithAddModal";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // We use our custom BottomNavWithAddModal
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
