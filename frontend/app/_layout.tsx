import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../contexts/AuthContext";
import { CurrencyProvider } from "../contexts/CurrencyContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { NetworkProvider } from "../contexts/NetworkContext";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { useEffect } from "react";
import { initDb } from "../services/localDb";
import "../services/syncService"; // Import to initialize listener

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NetworkProvider>
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#F9FAFB" },
                  }}
                >
                  <Stack.Screen name="login" />
                  <Stack.Screen name="(app)" />
                </Stack>
              </SubscriptionProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}
