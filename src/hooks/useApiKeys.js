// src/hooks/useApiKeys.js
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast.js";
import { useJwtRefresh } from "./useJwtRefresh";

export function useApiKeys() {
    const [apiKeys, setApiKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    // Fetch API keys
    const fetchApiKeys = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "GET",
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
                response = await fetch("http://localhost:8080/api/user/api-keys", {
                    method: "GET",
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

            if (data.success) {
                setApiKeys(data.apiKeys || []);
            } else {
                setError(data.message || "Failed to fetch API keys");
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch API keys",
                    variant: "destructive",
                });
            }
        } catch (err) {
            console.error("Error fetching API keys:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to fetch API keys. Please try again later.");
                toast({
                    title: "Error",
                    description: "Failed to fetch API keys. Please try again later.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Add API key with secret key
    const addApiKey = useCallback(async (platformName, apiKeyValue, secretKey) => {
        setIsLoading(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platformName, apiKeyValue, secretKey }),
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
                response = await fetch("http://localhost:8080/api/user/api-keys", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ platformName, apiKeyValue, secretKey }),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (data.success) {
                // Create a properly formatted API key object for the local state
                // The backend now returns the full response with masked values
                const newApiKey = {
                    apiKeyId: data.apiKey.apiKeyId,
                    platformName: data.apiKey.platformName,
                    maskedApiKeyValue: data.apiKey.maskedApiKeyValue,
                    maskedSecretKey: data.apiKey.maskedSecretKey
                };

                setApiKeys(prevKeys => [...prevKeys, newApiKey]);
                toast({
                    title: "Success",
                    description: data.message || "API key added successfully",
                });
                return true; // Return success indicator
            } else {
                setError(data.message || "Failed to add API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to add API key",
                    variant: "destructive",
                });
                return false;
            }
        } catch (err) {
            console.error("Error adding API key:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to add API key. Please try again later.");
                toast({
                    title: "Error",
                    description: "Failed to add API key. Please try again later.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Update API key with optional secret key
    const updateApiKey = useCallback(async (apiKeyId, platformName, apiKeyValue, secretKey) => {
        setIsLoading(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ apiKeyId, platformName, apiKeyValue, secretKey }),
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
                response = await fetch("http://localhost:8080/api/user/api-keys", {
                    method: "PUT",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ apiKeyId, platformName, apiKeyValue, secretKey }),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (data.success) {
                // Update the local state with the updated API key data
                // The backend now returns the full response with masked values
                setApiKeys(prevKeys =>
                    prevKeys.map(key =>
                        key.apiKeyId === apiKeyId
                            ? {
                                apiKeyId: data.apiKey.apiKeyId,
                                platformName: data.apiKey.platformName,
                                maskedApiKeyValue: data.apiKey.maskedApiKeyValue,
                                maskedSecretKey: data.apiKey.maskedSecretKey
                            }
                            : key
                    )
                );

                toast({
                    title: "Success",
                    description: data.message || "API key updated successfully",
                });
                return true; // Return success indicator
            } else {
                setError(data.message || "Failed to update API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to update API key",
                    variant: "destructive",
                });
                return false;
            }
        } catch (err) {
            console.error("Error updating API key:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to update API key. Please try again later.");
                toast({
                    title: "Error",
                    description: "Failed to update API key. Please try again later.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Delete API key
    const deleteApiKey = useCallback(async (apiKeyId) => {
        setIsLoading(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ apiKeyId }),
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
                response = await fetch("http://localhost:8080/api/user/api-keys", {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ apiKeyId }),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (data.success) {
                // Filter out the deleted key from the local state
                setApiKeys(prevKeys => prevKeys.filter(key => key.apiKeyId !== apiKeyId));
                toast({
                    title: "Success",
                    description: data.message || "API key deleted successfully",
                });
                return true; // Return success indicator
            } else {
                setError(data.message || "Failed to delete API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to delete API key",
                    variant: "destructive",
                });
                return false;
            }
        } catch (err) {
            console.error("Error deleting API key:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to delete API key. Please try again later.");
                toast({
                    title: "Error",
                    description: "Failed to delete API key. Please try again later.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Load API keys on component mount
    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    return {
        apiKeys,
        isLoading,
        error,
        fetchApiKeys,
        addApiKey,
        updateApiKey,
        deleteApiKey,
    };
}