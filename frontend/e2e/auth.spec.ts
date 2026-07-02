import { test, expect } from "@playwright/test";
import { uniqueEmail, registerFixtureUser, activateTrial, TEST_PASSWORD } from "./fixtures/test-user";

test.describe("email/password auth", () => {
  test("register: creates account and moves past signup", async ({ page }) => {
    await page.goto("/signup");
    await page.getByTestId("signup-name-input").fill("E2E New User");
    await page.getByTestId("signup-email-input").fill(uniqueEmail("register"));
    await page.getByTestId("signup-password-input").fill(TEST_PASSWORD);
    await page.getByTestId("signup-terms-checkbox").click();
    await page.getByTestId("signup-submit-button").click();

    await expect(page).not.toHaveURL(/\/signup$/, { timeout: 15_000 });
  });

  test("register: shows validation error for short password", async ({ page }) => {
    await page.goto("/signup");
    await page.getByTestId("signup-name-input").fill("E2E Short Pw");
    await page.getByTestId("signup-email-input").fill(uniqueEmail("shortpw"));
    await page.getByTestId("signup-password-input").fill("123");
    await page.getByTestId("signup-terms-checkbox").click();
    await page.getByTestId("signup-submit-button").click();

    await expect(page.getByTestId("signup-error-message")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("login: valid credentials navigate away from login", async ({ page }) => {
    const fixtureUser = await registerFixtureUser("login-ok");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(fixtureUser.email);
    await page.getByTestId("login-password-input").fill(fixtureUser.password);
    await page.getByTestId("login-submit-button").click();

    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  });

  test("login: invalid credentials show error and stay on login", async ({ page }) => {
    const fixtureUser = await registerFixtureUser("login-bad");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(fixtureUser.email);
    await page.getByTestId("login-password-input").fill("WrongPassword!123");
    await page.getByTestId("login-submit-button").click();

    await expect(page.getByTestId("login-error-message")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("session persistence: reload keeps user authenticated", async ({ page }) => {
    const fixtureUser = await registerFixtureUser("session-persist");

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(fixtureUser.email);
    await page.getByTestId("login-password-input").fill(fixtureUser.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });

    const authedUrl = page.url();
    await page.reload();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
    expect(page.url()).toBe(authedUrl);
  });

  test("logout: clears session and redirects to login", async ({ page }) => {
    const fixtureUser = await registerFixtureUser("logout");
    await activateTrial(fixtureUser.sessionToken);

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(fixtureUser.email);
    await page.getByTestId("login-password-input").fill(fixtureUser.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile$/);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("logout-button").click();

    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("protected routes", () => {
  test("unauthenticated access to /profile redirects to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/profile");
    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});
