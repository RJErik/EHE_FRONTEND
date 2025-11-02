// src/hooks/useJwtRefresh.js
import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./use-toast";

export function useJwtRefresh() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const refreshPromiseRef = useRef(null);

    const refreshToken = useCallback(async () => {
        // If already refreshing, return the existing promise
        if (refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        refreshPromiseRef.current = (async () => {
            try {
                console.log("Refreshing token...");
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
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
    }, []); // Empty dependency array - function never changes

    return {
        refreshToken,
    };
}