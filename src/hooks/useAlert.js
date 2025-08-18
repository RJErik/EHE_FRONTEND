// src/hooks/useAlert.js
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";

export function useAlert() {
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Fetch all alerts
    const fetchAlerts = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching alerts...");
            const response = await fetch("http://localhost:8080/api/user/alerts", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Alerts received:", data);

            if (data.success) {
                setAlerts(data.alerts || []);
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch alerts",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch alerts");
            }
        } catch (err) {
            console.error("Error fetching alerts:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to fetch alerts. Server may be unavailable.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    // Add alert
    const addAlert = async (platform, symbol, conditionType, thresholdValue) => {
        if (!platform || !symbol || !conditionType || !thresholdValue) {
            toast({
                title: "Validation Error",
                description: "All fields are required",
                variant: "destructive",
            });
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`Adding alert for ${symbol} from ${platform}...`);
            const response = await fetch("http://localhost:8080/api/user/alerts", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    platform,
                    symbol,
                    conditionType,
                    thresholdValue: parseFloat(thresholdValue)
                }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Add response:", data);

            if (data.success) {
                // ✨ CHANGE: Update state directly instead of re-fetching
                setAlerts(prevAlerts => [...prevAlerts, data.alert]);
                toast({
                    title: "Success",
                    description: data.message || `Added alert for ${symbol} from ${platform}`,
                });
                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to add alert",
                    variant: "destructive",
                });
                setError(data.message || "Failed to add alert");
                return false;
            }
        } catch (err) {
            console.error("Error adding alert:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to add alert. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Remove alert
    const removeAlert = async (id) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Removing alert ${id}...`);
            const response = await fetch("http://localhost:8080/api/user/alerts", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Remove response:", data);

            if (data.success) {
                // Update local state
                setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== id));

                toast({
                    title: "Success",
                    description: data.message || "Alert removed successfully",
                });
                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to remove alert",
                    variant: "destructive",
                });
                setError(data.message || "Failed to remove alert");
                return false;
            }
        } catch (err) {
            console.error("Error removing alert:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to remove alert. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Search alerts
    const searchAlerts = async (platform, symbol, conditionType) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Searching alerts: platform=${platform}, symbol=${symbol}, conditionType=${conditionType}`);

            const response = await fetch("http://localhost:8080/api/user/alerts/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    platform: platform === "_any_" ? "" : platform,
                    symbol: symbol === "_any_" ? "" : symbol,
                    conditionType: conditionType === "_any_" ? "" : conditionType
                }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Search results:", data);

            if (data.success) {
                setAlerts(data.alerts || []);
                return data.alerts || [];
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to search alerts",
                    variant: "destructive",
                });
                setError(data.message || "Failed to search alerts");
                return [];
            }
        } catch (err) {
            console.error("Error searching alerts:", err);
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to search alerts. Server may be unavailable.",
                variant: "destructive",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        console.log("Initial alerts fetch...");
        fetchAlerts();
    }, [fetchAlerts]);

    return {
        alerts,
        isLoading,
        error,
        fetchAlerts,
        addAlert,
        removeAlert,
        searchAlerts
    };
}
