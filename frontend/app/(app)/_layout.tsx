import { Stack, useRouter, usePathname } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    // Check onboarding status
    if (!loading && user) {
      if (user.onboarding_completed === false) {
        router.replace("/onboarding-language");
        return;
      }

      // Check subscription status - allow access to subscription page always
      if (!user.is_subscription_active && pathname !== "/subscription") {
        router.replace("/(app)/subscription");
      }
    }
  }, [user, loading, pathname]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F9FAFB" },
        gestureEnabled: true,
        animation: 'default',
      }}
    >
      <Stack.Screen 
        name="manual" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }} 
      />
      <Stack.Screen 
        name="edit-transaction" 
        options={{ 
          gestureEnabled: true,
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
}
