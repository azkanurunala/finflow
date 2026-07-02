import axios from "axios";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://finflow-backend-fshd.onrender.com";

export function uniqueEmail(tag: string): string {
  return `e2e_${tag}_${Date.now()}@finflow-test.dev`;
}

export const TEST_PASSWORD = "TestPass123!";

/** Registers a fixture user directly against the backend, bypassing the UI. */
export async function registerFixtureUser(tag: string, name = "E2E Test User") {
  const email = uniqueEmail(tag);
  const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
    name,
    email,
    password: TEST_PASSWORD,
  });
  return { email, password: TEST_PASSWORD, name, sessionToken: res.data.session_token as string };
}

/** Activates the free trial so the fixture user can reach (app)/* routes (e.g. to test logout). */
export async function activateTrial(sessionToken: string) {
  await axios.post(
    `${BACKEND_URL}/api/auth/start-trial`,
    {},
    { headers: { Authorization: `Bearer ${sessionToken}` } }
  );
}
