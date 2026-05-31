import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../contexts/AuthContext";

// Required so the auth popup can close itself on web/dev.
WebBrowser.maybeCompleteAuthSession();

type Result = { success: boolean; error?: string };

/**
 * Google (expo-auth-session) + Apple (expo-apple-authentication) sign-in.
 * Both obtain a verified ID token that AuthContext.signInWithProvider sends to
 * the backend (/api/auth/oauth/{provider}) for verification.
 *
 * Google client IDs come from env (set EXPO_PUBLIC_GOOGLE_* — created in the
 * Google Cloud console). Apple needs no client config (uses the app bundle id),
 * and is only offered on iOS where it's available.
 */
export function useSocialAuth(onResult?: (r: Result) => void) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // expo-auth-session's Google hook THROWS during render if no client id is
  // defined for the platform (invariantClientId). That would crash the login
  // screen in a release build. So only pass real ids when configured; otherwise
  // pass a harmless placeholder so the hook never throws, and keep the button
  // disabled (googleReady=false) until env vars are set.
  const googleConfigured = !!(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );
  const [request, response, promptGoogle] = Google.useIdTokenAuthRequest(
    googleConfigured
      ? {
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
          androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        }
      : { clientId: "unconfigured.apps.googleusercontent.com" }
  );

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  // Handle the Google redirect result.
  useEffect(() => {
    const run = async () => {
      if (response?.type === "success") {
        const idToken =
          (response.params as any)?.id_token ??
          (response as any).authentication?.idToken;
        if (idToken) {
          setBusy(true);
          const r = await signInWithProvider("google", idToken);
          setBusy(false);
          onResult?.(r);
        } else {
          onResult?.({ success: false, error: "No Google ID token returned" });
        }
      } else if (response?.type === "error") {
        onResult?.({ success: false, error: "Google sign-in failed" });
      }
    };
    run();
    // Only react to a new Google response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const signInGoogle = useCallback(async () => {
    if (!request) return;
    await promptGoogle();
  }, [request, promptGoogle]);

  const signInApple = useCallback(async () => {
    try {
      setBusy(true);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) {
        onResult?.({ success: false, error: "No Apple identity token" });
        return;
      }
      const fullName =
        [cred.fullName?.givenName, cred.fullName?.familyName]
          .filter(Boolean)
          .join(" ") || undefined;
      const r = await signInWithProvider("apple", cred.identityToken, fullName);
      onResult?.(r);
    } catch (e: any) {
      // ERR_REQUEST_CANCELED = user dismissed the sheet; ignore.
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        const detail = [e?.code, e?.message].filter(Boolean).join(" — ");
        onResult?.({ success: false, error: detail ? `Apple: ${detail}` : "Apple sign-in failed" });
      }
    } finally {
      setBusy(false);
    }
  }, [signInWithProvider, onResult]);

  return {
    signInGoogle,
    signInApple,
    googleReady: googleConfigured && !!request,
    appleAvailable,
    busy,
  };
}
