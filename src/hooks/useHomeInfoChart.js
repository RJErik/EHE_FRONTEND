import { useState, useCallback } from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function useHomeInfoChart() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    const fetchWorstStocks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("Fetching worst stock data.");
            let response = await fetch("http://localhost:8080/api/home/worst-stock", {
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
                response = await fetch("http://localhost:8080/api/home/worst-stock", {
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

            if (data.success) {
                return data.worstStocks;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch worst performing stock list",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch worst performing stock list");
                return null;
            }
        } catch (err) {
            console.error("Error fetching worst performing stock list:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch worst stocks. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    const fetchBestStocks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("Fetching best stock data.");
            let response = await fetch("http://localhost:8080/api/home/best-stock", {
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
                response = await fetch("http://localhost:8080/api/home/best-stock", {
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

            if (data.success) {
                return data.bestStocks;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch best performing stock list",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch best performing stock list");
                return null;
            }
        } catch (err) {
            console.error("Error fetching best performing stock list:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch best stocks. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    const fetchLatestTransactions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("Fetching latest transactions data.");
            let response = await fetch("http://localhost:8080/api/home/latest-transactions", {
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
                response = await fetch("http://localhost:8080/api/home/latest-transactions", {
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

            if (data.success) {
                return data.latestTransactions;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch latest transactions",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch latest transactions");
                return null;
            }
        } catch (err) {
            console.error("Error fetching latest transactions:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch latest transactions. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    return {
        fetchWorstStocks,
        fetchBestStocks,
        fetchLatestTransactions,
        isLoading,
        error,
    };
}