// src/hooks/useAccountProfile.js
import { useState, useCallback } from "react";
import { useToast } from "./use-toast";

export function useAccountProfile() {
    const [userData, setUserData] = useState({
        name: "Your_Name",
        email: "Your_Email"
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestingReset, setIsRequestingReset] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Fetch user information
    const fetchUserInfo = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching user information...");
            const response = await fetch("http://localhost:8080/api/user/user-info", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("User info received:", data);

            if (data.success) {
                setUserData({
                    name: data.userInfo.userName || "Your_Name",
                    email: data.userInfo.email || "Your_Email"
                });
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to load user information",
                    variant: "destructive",
                });
                setError(data.message || "Failed to load user information");
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to load user information. Using placeholder data.",
                variant: "destructive",
            });
            // Keep the default placeholder data
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    // Request password reset
    const requestPasswordReset = useCallback(async () => {
        if (isRequestingReset) return false;

        setIsRequestingReset(true);
        setError(null);

        try {
            console.log("Requesting password reset...");
            const response = await fetch("http://localhost:8080/api/user/request-password-reset", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Password reset response:", data);

            toast({
                title: data.success ? "Success" : "Error",
                description: data.message,
                variant: data.success ? "default" : "destructive",
            });

            return {
                success: data.success,
                message: data.message,
                showResendButton: data.showResendButton
            };

        } catch (err) {
            console.error("Password reset request error:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to request password reset. Please try again later.",
                variant: "destructive",
            });
            return {
                success: false,
                message: "Failed to request password reset. Please try again later.",
                showResendButton: false
            };
        } finally {
            setIsRequestingReset(false);
        }
    }, [isRequestingReset, toast]);

    return {
        userData,
        isLoading,
        error,
        isRequestingReset,
        fetchUserInfo,
        requestPasswordReset
    };
}