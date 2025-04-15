// src/hooks/useChangeEmail.js
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast.js";

export function useChangeEmail() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Initialize from localStorage if available
    const [lastEmailRequested, setLastEmailRequested] = useState(() => {
        return localStorage.getItem('lastEmailChangeRequested') || "";
    });
    const { toast } = useToast();

    // Sync the state with localStorage whenever it changes
    useEffect(() => {
        if (lastEmailRequested) {
            localStorage.setItem('lastEmailChangeRequested', lastEmailRequested);
        }
    }, [lastEmailRequested]);

    const changeEmail = async (newEmail) => {
        setIsLoading(true);
        setError(null);

        // Store the requested email for potential resend
        setLastEmailRequested(newEmail);
        localStorage.setItem('lastEmailChangeRequested', newEmail);

        try {
            const response = await fetch("http://localhost:8080/api/user/change-email", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ newEmail }),
            });

            const data = await response.json();

            // Make sure we preserve the email even on failure
            if (!data.success) {
                console.log("Email change unsuccessful, but keeping email for resend");
            }

            return data;
        } catch (err) {
            console.error("Email change request error:", err);
            setError("Failed to request email change. Please try again later.");

            return {
                success: false,
                message: "Failed to request email change. Please try again later."
            };
        } finally {
            setIsLoading(false);
        }
    };

    const resendChangeEmail = () => {
        // Get the latest email from localStorage as a fallback
        const emailToResend = lastEmailRequested || localStorage.getItem('lastEmailChangeRequested');

        console.log("Attempting to resend to email:", emailToResend);

        if (emailToResend) {
            return changeEmail(emailToResend);
        }
        return Promise.resolve({
            success: false,
            message: "No email change request to resend"
        });
    };

    return {
        changeEmail,
        resendChangeEmail,
        isLoading,
        error,
        lastEmailRequested
    };
}
