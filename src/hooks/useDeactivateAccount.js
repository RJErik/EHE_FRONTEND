// src/hooks/useDeactivateAccount.js
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast.js";
import { useLogout } from "./useLogout";
import { useJwtRefresh } from "./useJwtRefresh";

export function useDeactivateAccount() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { logout } = useLogout();
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    const deactivateAccount = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/deactivate-account", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    // Refresh failed - redirects to login automatically
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/deactivate-account", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            // Show toast with the response message
            toast({
                title: data.success ? "Account Deactivated" : "Error",
                description: data.message,
                variant: data.success ? "default" : "destructive",
                duration: 5000
            });

            if (data.success) {
                // If deactivation was successful, log the user out after a delay
                setTimeout(() => {
                    logout();
                }, 3000); // Wait 3 seconds so the user can see the success message
                return true;
            } else {
                return false;
            }
        } catch (err) {
            console.error("Account deactivation error:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to deactivate account. Please try again later.");

                // Show error toast
                toast({
                    title: "Error",
                    description: "Failed to deactivate account. Please try again later.",
                    variant: "destructive",
                    duration: 5000
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [refreshToken, logout, toast]);

    return { deactivateAccount, isLoading, error };
}