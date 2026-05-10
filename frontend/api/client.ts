import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { router } from "expo-router";

import { CONFIG } from "../constants/Config";

const BACKEND_URL = CONFIG.BACKEND_URL;

// Create axios instance
export const apiClient = axios.create({
    baseURL: BACKEND_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem("session_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// G1 — Response interceptor: try silent session rotation BEFORE falling through
// to the existing /login redirect. The redirect path is preserved unchanged for
// terminal failure cases (no rotation possible / rotation rejected).
import { rotateSession } from "../services/SessionManager";

// Marker to avoid infinite rotation loops on a request that itself failed.
const ROTATION_RETRY_FLAG = "__rotationRetry";

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status;
        const original: any = error.config;

        if (status === 401 && original && !original[ROTATION_RETRY_FLAG]) {
            const newToken = await rotateSession();
            if (newToken) {
                original[ROTATION_RETRY_FLAG] = true;
                original.headers = original.headers ?? {};
                original.headers.Authorization = `Bearer ${newToken}`;
                return apiClient.request(original);
            }
        }

        if (status === 401) {
            // Existing terminal-failure branch (preserved behaviour).
            console.log("Session expired (401), logging out...");
            await AsyncStorage.removeItem("session_token");
            router.replace("/login");
        }
        return Promise.reject(error);
    }
);
