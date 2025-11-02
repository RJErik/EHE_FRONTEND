// src/hooks/useTrading.js
import { useState, useCallback } from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function useTrading() {
    const [portfolios, setPortfolios] = useState([]);
    const [tradingCapacity, setTradingCapacity] = useState(null);
    const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(false);
    const [isLoadingCapacity, setIsLoadingCapacity] = useState(false);
    const [isExecutingTrade, setIsExecutingTrade] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    // Fetch portfolios by platform
    const fetchPortfoliosByPlatform = useCallback(async (platform) => {
        if (!platform) return [];

        setIsLoadingPortfolios(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/portfolios/by-platform", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platform }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/portfolios/by-platform", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ platform }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Portfolios by platform response:", data);

            if (data.success) {
                setPortfolios(data.portfolios || []);
                return data.portfolios || [];
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch portfolios",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch portfolios");
                return [];
            }
        } catch (err) {
            console.error("Error fetching portfolios by platform:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch portfolios. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return [];
        } finally {
            setIsLoadingPortfolios(false);
        }
    }, [toast, refreshToken]);

    // Fetch trading capacity for a portfolio and stock
    const getTradingCapacity = useCallback(async (portfolioId, stockSymbol) => {
        if (!portfolioId || !stockSymbol) return null;

        setIsLoadingCapacity(true);
        setError(null);

        try {
            let response = await fetch("http://localhost:8080/api/user/trading-capacity", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ portfolioId, stockSymbol }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/trading-capacity", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ portfolioId, stockSymbol }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Trading capacity response:", data);

            if (data.success) {
                setTradingCapacity(data.capacity || null);
                return data.capacity || null;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch trading capacity",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch trading capacity");
                return null;
            }
        } catch (err) {
            console.error("Error fetching trading capacity:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch trading capacity. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return null;
        } finally {
            setIsLoadingCapacity(false);
        }
    }, [toast, refreshToken]);

    // Execute a trade
    const executeTrade = useCallback(async (portfolioId, stockSymbol, action, amount, quantityType) => {
        if (!portfolioId || !stockSymbol || !action || !amount || !quantityType) return false;

        setIsExecutingTrade(true);
        setError(null);

        try {
            console.log(`Executing trade: ${action} ${amount} ${stockSymbol} via ${quantityType}`);

            let response = await fetch("http://localhost:8080/api/user/trade", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    portfolioId,
                    stockSymbol,
                    action,
                    amount,
                    quantityType,
                }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/trade", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        portfolioId,
                        stockSymbol,
                        action,
                        amount,
                        quantityType,
                    }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Trade execution response:", data);

            if (data.success) {
                toast({
                    title: "Success",
                    description: data.message || `${action} order executed successfully!`,
                });
                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to execute trade",
                    variant: "destructive",
                });
                setError(data.message || "Failed to execute trade");
                return false;
            }
        } catch (err) {
            console.error("Error executing trade:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to execute trade. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsExecutingTrade(false);
        }
    }, [toast, refreshToken]);

    return {
        portfolios,
        tradingCapacity,
        isLoadingPortfolios,
        isLoadingCapacity,
        isExecutingTrade,
        error,
        fetchPortfoliosByPlatform,
        getTradingCapacity,
        executeTrade,
    };
}