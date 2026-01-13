import { useState, useEffect, useCallback } from "react";
import { useJwtRefresh } from "./useJwtRefresh";

export function useStockData() {
    const [platforms, setPlatforms] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [selectedStock, setSelectedStock] = useState("");
    const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(false);
    const [isLoadingStocks, setIsLoadingStocks] = useState(false);
    const [error, setError] = useState(null);
    const { refreshToken } = useJwtRefresh();

    // Fetch platforms from API
    const fetchPlatforms = useCallback(async () => {
        setIsLoadingPlatforms(true);
        setError(null);

        try {
            let response = await fetch("/api/user/platforms", {
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
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("/api/user/platforms", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (data.success) {
                setPlatforms(data.platforms || []);
            } else {
                setError(data.message || "Failed to fetch platforms");
                setPlatforms([]);
            }
        } catch (err) {
            console.error("Error fetching platforms:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to fetch platforms. Please try again later.");
            }
            setPlatforms([]);
        } finally {
            setIsLoadingPlatforms(false);
        }
    }, [refreshToken]);

    // Fetch stocks for a specific platform
    const fetchStocks = useCallback(async (platform) => {
        if (!platform) return;

        setIsLoadingStocks(true);
        setError(null);
        setStocks([]);

        try {
            let response = await fetch(`/api/user/platforms/${platform}/stocks`, {
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
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch(`/api/user/platforms/${platform}/stocks`, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            const data = await response.json();

            if (data.success) {
                const stocksArray = data.stocks?.stocks || [];
                setStocks(stocksArray);

                console.log("Received stocks data:", data.stocks);
                console.log("Extracted stocks array:", stocksArray);
            } else {
                setError(data.message || "Failed to fetch stocks");
                setStocks([]);
            }
        } catch (err) {
            console.error("Error fetching stocks:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to fetch stocks. Please try again later.");
            }
            setStocks([]);
        } finally {
            setIsLoadingStocks(false);
        }
    }, [refreshToken]);

    // Fetch platforms on component mount
    useEffect(() => {
        fetchPlatforms();
    }, [fetchPlatforms]);

    // Fetch stocks when selected platform changes
    useEffect(() => {
        if (selectedPlatform) {
            fetchStocks(selectedPlatform);
            setSelectedStock("");
        } else {
            setStocks([]);
            setSelectedStock("");
        }
    }, [selectedPlatform, fetchStocks]);

    return {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        selectedStock,
        setSelectedStock,
        isLoadingPlatforms,
        isLoadingStocks,
        error,
        fetchPlatforms,
    };
}