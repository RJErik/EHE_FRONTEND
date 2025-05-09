// src/hooks/useApiKeys.js
import { useState, useEffect } from "react";
import { useToast } from "./use-toast.js";

export function useApiKeys() {
    const [apiKeys, setApiKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Fetch API keys
    const fetchApiKeys = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

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
            setError("Failed to fetch API keys. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to fetch API keys. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Add API key
    const addApiKey = async (platformName, apiKeyValue) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platformName, apiKeyValue }),
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: "API key added successfully",
                });
                await fetchApiKeys(); // Refresh the list
            } else {
                setError(data.message || "Failed to add API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to add API key",
                    variant: "destructive",
                });
            }
        } catch (err) {
            console.error("Error adding API key:", err);
            setError("Failed to add API key. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to add API key. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Update API key
    const updateApiKey = async (apiKeyId, platformName, apiKeyValue) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ apiKeyId, platformName, apiKeyValue }),
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: "API key updated successfully",
                });
                await fetchApiKeys(); // Refresh the list
            } else {
                setError(data.message || "Failed to update API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to update API key",
                    variant: "destructive",
                });
            }
        } catch (err) {
            console.error("Error updating API key:", err);
            setError("Failed to update API key. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to update API key. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Delete API key
    const deleteApiKey = async (apiKeyId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/api-keys", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ apiKeyId }),
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: "API key deleted successfully",
                });
                await fetchApiKeys(); // Refresh the list
            } else {
                setError(data.message || "Failed to delete API key");
                toast({
                    title: "Error",
                    description: data.message || "Failed to delete API key",
                    variant: "destructive",
                });
            }
        } catch (err) {
            console.error("Error deleting API key:", err);
            setError("Failed to delete API key. Please try again later.");
            toast({
                title: "Error",
                description: "Failed to delete API key. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Load API keys on component mount
    useEffect(() => {
        fetchApiKeys();
    }, []);

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
