import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Playwright's Node process doesn't get Expo's babel-injected EXPO_PUBLIC_* env
// vars, so read frontend/.env directly to know whether Google is configured.
function loadEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs
    .readFileSync(envPath, "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line?.split("=").slice(1).join("=").trim();
}

const GOOGLE_WEB_CLIENT_ID = loadEnvVar("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");

test.describe("google oauth request construction", () => {
  test.skip(
    !GOOGLE_WEB_CLIENT_ID,
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set in frontend/.env — Google sign-in is disabled until Google Cloud Console clients are created (see plan)."
  );

  // This intentionally does NOT complete the Google consent screen — Google's
  // bot detection reliably blocks default-fingerprint Playwright/Chromium
  // automation there. What IS worth automating is verifying the app builds the
  // OAuth request correctly (right client_id / redirect_uri / response_type),
  // since a wrong value here is the most common real-world misconfiguration.
  // Full consent completion is covered by the manual smoke-test checklist.
  test("clicking Google button opens accounts.google.com with correct params", async ({ page, context }) => {
    await page.goto("/login");

    // Capture the actual authorization request, not wherever Google's own
    // redirect chain (e.g. its invalid_client error page) ends up navigating to.
    const authRequestPromise = new Promise<URL>((resolve) => {
      const handler = (req: import("@playwright/test").Request) => {
        const reqUrl = req.url();
        if (reqUrl.includes("accounts.google.com/o/oauth2")) {
          context.off("request", handler);
          resolve(new URL(reqUrl));
        }
      };
      context.on("request", handler);
    });

    await page.getByTestId("login-google-button").click();
    const url = await authRequestPromise;

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe(GOOGLE_WEB_CLIENT_ID);
    expect(url.searchParams.get("response_type") || "").toContain("id_token");
    expect(url.searchParams.get("redirect_uri")).toBeTruthy();
  });
});
