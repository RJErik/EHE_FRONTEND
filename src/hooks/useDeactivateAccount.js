// src/hooks/useDeactivateAccount.js
import { useState } from "react";
import { useToast } from "@/hooks/use-toast.js";
import { useLogout } from "./useLogout";

export function useDeactivateAccount() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { logout } = useLogout();
    const { toast } = useToast();

    const deactivateAccount = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/deactivate", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

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
            setError("Failed to deactivate account. Please try again later.");

            // Show error toast
            toast({
                title: "Error",
                description: "Failed to deactivate account. Please try again later.",
                variant: "destructive",
                duration: 5000
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return { deactivateAccount, isLoading, error };
}
