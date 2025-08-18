// src/hooks/useLogout.js
import { useState } from "react";

export function useLogout() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const logout = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Try to call the API but don't wait for the response
            fetch("http://localhost:8080/api/user/logout", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            }).catch(err => {
                console.error("Logout API error:", err);
                // Ignore errors, we'll redirect anyway
            }).finally(() => {
                // Always redirect regardless of API response
                window.location.href = "http://localhost:5173/";
            });
        } catch (err) {
            console.error("Error during logout:", err);
            // Still redirect on any error
            window.location.href = "http://localhost:5173/";
        } finally {
            setIsLoading(false);
        }

        return true;
    };

    return { logout, isLoading, error };
}
