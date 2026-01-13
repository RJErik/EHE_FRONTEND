import { useState, useEffect, useCallback } from "react";
import { useJwtRefresh } from "./useJwtRefresh";

export function useChangeEmail() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastEmailRequested, setLastEmailRequested] = useState(() => {
        return localStorage.getItem('lastEmailChangeRequested') || "";
    });
    const { refreshToken } = useJwtRefresh();

    useEffect(() => {
        if (lastEmailRequested) {
            localStorage.setItem('lastEmailChangeRequested', lastEmailRequested);
        }
    }, [lastEmailRequested]);

    const changeEmail = useCallback(async (newEmail) => {
        setIsLoading(true);
        setError(null);

        setLastEmailRequested(newEmail);
        localStorage.setItem('lastEmailChangeRequested', newEmail);

        try {
            let response = await fetch("http://localhost:8080/api/user/email-change-requests", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ newEmail }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/email-change-requests", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ newEmail }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (!data.success) {
                console.log("Email change unsuccessful, but keeping email for resend");
            }

            return data;
        } catch (err) {
            console.error("Email change request error:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to request email change. Please try again later.");
            }

            return {
                success: false,
                message: "Failed to request email change. Please try again later."
            };
        } finally {
            setIsLoading(false);
        }
    }, [refreshToken]);

    const resendChangeEmail = useCallback(() => {
        const emailToResend = lastEmailRequested || localStorage.getItem('lastEmailChangeRequested');

        console.log("Attempting to resend to email:", emailToResend);

        if (emailToResend) {
            return changeEmail(emailToResend);
        }
        return Promise.resolve({
            success: false,
            message: "No email change request to resend"
        });
    }, [lastEmailRequested, changeEmail]);

    return {
        changeEmail,
        resendChangeEmail,
        isLoading,
        error,
        lastEmailRequested
    };
}