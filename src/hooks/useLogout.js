import { useState } from "react";

export function useLogout() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const logout = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Try to call the API but don't wait for the response
            fetch("/api/session", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            }).catch(err => {
                console.error("Logout API error:", err);
            }).finally(() => {
                window.location.href = "https://www.eventhorizonexchange.com";
            });
        } catch (err) {
            console.error("Error during logout:", err);
            window.location.href = "https://www.eventhorizonexchange.com";
        } finally {
            setIsLoading(false);
        }

        return true;
    };

    return { logout, isLoading, error };
}