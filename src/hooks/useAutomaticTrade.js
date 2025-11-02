// src/hooks/useAutomaticTrade.js
import { useState, useCallback } from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function useAutomaticTrade() {
    const [automaticTradeRules, setAutomaticTradeRules] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    // Fetch all automatic trade rules
    const fetchAutomaticTradeRules = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching automatic trade rules...");
            let response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
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
                response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
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

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Automatic trade rules received:", data);

            if (data.success) {
                setAutomaticTradeRules(data.automatedTradeRules || []);
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch automatic trade rules",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch automatic trade rules");
            }
        } catch (err) {
            console.error("Error fetching automatic trade rules:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch automatic trade rules. Server may be unavailable.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Add automatic trade rule
    const addAutomaticTradeRule = useCallback(async (portfolioId, platform, symbol, conditionType, actionType, quantityType, quantity, thresholdValue) => {
        if (!portfolioId || !platform || !symbol || !conditionType || !actionType || !quantityType || !quantity || !thresholdValue) {
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
            console.log(`Adding automatic trade rule for ${symbol} from ${platform}...`);
            let response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    portfolioId,
                    platform,
                    symbol,
                    conditionType,
                    actionType,
                    quantityType,
                    quantity: parseFloat(quantity),
                    thresholdValue: parseFloat(thresholdValue)
                }),
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
                response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        portfolioId,
                        platform,
                        symbol,
                        conditionType,
                        actionType,
                        quantityType,
                        quantity: parseFloat(quantity),
                        thresholdValue: parseFloat(thresholdValue)
                    }),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Add response:", data);

            if (data.success) {
                // ✨ CHANGE: Add the new rule directly to the local state
                setAutomaticTradeRules(prevRules => [...prevRules, data.automatedTradeRule]);
                toast({
                    title: "Success",
                    description: data.message || `Added automatic trade rule for ${symbol} from ${platform}`,
                });
                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to add automatic trade rule",
                    variant: "destructive",
                });
                setError(data.message || "Failed to add automatic trade rule");
                return false;
            }
        } catch (err) {
            console.error("Error adding automatic trade rule:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to add automatic trade rule. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Remove automatic trade rule
    const removeAutomaticTradeRule = useCallback(async (id) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Removing automatic trade rule ${id}...`);
            let response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id }),
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
                response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id }),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Remove response:", data);

            if (data.success) {
                // ✨ CHANGE: Filter out the deleted rule from the local state
                setAutomaticTradeRules(prevRules => prevRules.filter(rule => rule.id !== id));

                toast({
                    title: "Success",
                    description: data.message || "Automatic trade rule removed successfully",
                });
                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to remove automatic trade rule",
                    variant: "destructive",
                });
                setError(data.message || "Failed to remove automatic trade rule");
                return false;
            }
        } catch (err) {
            console.error("Error removing automatic trade rule:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to remove automatic trade rule. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Search automatic trade rules
    const searchAutomaticTradeRules = useCallback(async (
        portfolioId,
        platform,
        symbol,
        conditionType,
        actionType,
        quantityType,
        minThresholdValue,
        maxThresholdValue
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Searching automatic trade rules...`);

            const searchParams = {
                portfolioId: portfolioId || null,
                platform: platform || null,
                symbol: symbol || null,
                conditionType: conditionType || null,
                actionType: actionType || null,
                quantityType: quantityType || null,
                minThresholdValue: minThresholdValue || null,
                maxThresholdValue: maxThresholdValue || null
            };

            // Remove null values for cleaner request
            Object.keys(searchParams).forEach(key =>
                searchParams[key] === null && delete searchParams[key]
            );

            let response = await fetch("http://localhost:8080/api/user/automated-trade-rules/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(searchParams),
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
                response = await fetch("http://localhost:8080/api/user/automated-trade-rules/search", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(searchParams),
                });

                // If still 401 after refresh, session is truly expired
                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Search results:", data);

            if (data.success) {
                setAutomaticTradeRules(data.automatedTradeRules || []);
                return data.automatedTradeRules || [];
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to search automatic trade rules",
                    variant: "destructive",
                });
                setError(data.message || "Failed to search automatic trade rules");
                return [];
            }
        } catch (err) {
            console.error("Error searching automatic trade rules:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to search automatic trade rules. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    return {
        automaticTradeRules,
        isLoading,
        error,
        fetchAutomaticTradeRules,
        addAutomaticTradeRule,
        removeAutomaticTradeRule,
        searchAutomaticTradeRules
    };
}