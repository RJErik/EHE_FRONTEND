// src/hooks/useAutomaticTrade.js
import { useState, useCallback } from "react";
import { useToast } from "./use-toast";

export function useAutomaticTrade() {
    const [automaticTradeRules, setAutomaticTradeRules] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Fetch all automatic trade rules
    const fetchAutomaticTradeRules = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching automatic trade rules...");
            const response = await fetch("http://localhost:8080/api/user/automated-trade-rules", {
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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to fetch automatic trade rules. Server may be unavailable.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    // Add automatic trade rule
    const addAutomaticTradeRule = async (portfolioId, platform, symbol, conditionType, actionType, quantityType, quantity, thresholdValue) => {
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
            const response = await fetch("http://localhost:8080/api/user/automated-trade-rules/add", {
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

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Add response:", data);

            if (data.success) {
                toast({
                    title: "Success",
                    description: `Added automatic trade rule for ${symbol} from ${platform}`,
                });

                await fetchAutomaticTradeRules();
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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to add automatic trade rule. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Remove automatic trade rule
    const removeAutomaticTradeRule = async (id) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Removing automatic trade rule ${id}...`);
            const response = await fetch("http://localhost:8080/api/user/automated-trade-rules/remove", {
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
                setAutomaticTradeRules(prev => prev.filter(rule => rule.id !== id));

                toast({
                    title: "Success",
                    description: "Automatic trade rule removed successfully",
                });

                await fetchAutomaticTradeRules();
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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to remove automatic trade rule. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Search automatic trade rules
    const searchAutomaticTradeRules = async (
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

            const response = await fetch("http://localhost:8080/api/user/automated-trade-rules/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(searchParams),
            });

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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to search automatic trade rules. Server may be unavailable.",
                variant: "destructive",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

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