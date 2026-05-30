import { Platform } from "react-native";

// RevenueCat is a native module — absent in Expo Go. Everything here is guarded
// so the app still runs in Expo Go (billing just reports "unavailable").
let Purchases: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

let configured = false;

const apiKey = (): string | undefined =>
  Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });

/** True only when the native SDK is present AND an API key is configured. */
export const billingAvailable = (): boolean => !!Purchases && !!apiKey();

/** Configure RC once and identify the signed-in user (appUserID = our user_id). */
export async function configurePurchases(appUserId?: string): Promise<void> {
  if (!billingAvailable()) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: apiKey(), appUserID: appUserId });
      configured = true;
    } else if (appUserId) {
      await Purchases.logIn(appUserId);
    }
  } catch {
    // Native module unavailable at runtime (e.g. Expo Go) — ignore.
  }
}

export async function getOfferings(): Promise<any | null> {
  if (!billingAvailable()) return null;
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

/** Find a package across all offerings by its store product identifier. */
export async function findPackage(productId: string): Promise<any | null> {
  const offerings = await getOfferings();
  if (!offerings) return null;
  const all = [
    offerings.current,
    ...Object.values(offerings.all || {}),
  ].filter(Boolean);
  for (const offering of all as any[]) {
    const pkg = (offering.availablePackages || []).find(
      (p: any) => p.product?.identifier === productId
    );
    if (pkg) return pkg;
  }
  return null;
}

export async function purchasePackage(pkg: any): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!billingAvailable()) return { success: false, error: "Billing unavailable" };
  try {
    await Purchases.purchasePackage(pkg);
    return { success: true };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, cancelled: true };
    return { success: false, error: e?.message || "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!billingAvailable()) return { success: false, error: "Billing unavailable" };
  try {
    await Purchases.restorePurchases();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Restore failed" };
  }
}
