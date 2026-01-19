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

// Response interceptor to handle 401
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            console.log("Session expired (401), logging out...");

            // 1. Clear storage
            await AsyncStorage.removeItem("session_token");

            // 2. Notify user (optional, can be silent)
            // Alert.alert("Session Expired", "Please login again.");

            // 3. Redirect to login
            router.replace("/login");
        }
        return Promise.reject(error);
    }
);
