// src/hooks/useJwtRefresh.js
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./use-toast";

// Module-level variable to deduplicate refresh requests across ALL hook instances
let refreshPromiseRef = null;

export function useJwtRefresh() {
    const { toast } = useToast();
    const navigate = useNavigate();

    const refreshToken = useCallback(async () => {
        // If a refresh is already in progress, wait for it instead of starting a new one
        if (refreshPromiseRef) {
            console.log("Refresh already in progress, reusing existing promise...");
            return refreshPromiseRef;
        }

        console.log("Starting new token refresh...");

        refreshPromiseRef = (async () => {
            try {
                const response = await fetch("http://localhost:8080/api/user/renew-token", {
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
                console.log("Token refresh response:", data);

                if (data.success) {
                    // Don't show success toast - token refresh should be silent
                    return true;
                } else {
                    throw new Error(data.message || "Token refresh failed");
                }
            } catch (err) {
                console.error("Token refresh error:", err);

                toast({
                    title: "Session Expired",
                    description: "Your session has expired. Please login again.",
                    variant: "destructive",
                });

                // Redirect to login page
                navigate("/login");

                throw err;
            } finally {
                // Clear the reference so future refresh requests can start a new one
                refreshPromiseRef = null;
            }
        })();

        return refreshPromiseRef;
    }, []);

    return {
        refreshToken,
    };
}