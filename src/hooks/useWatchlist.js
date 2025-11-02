// src/hooks/useWatchlist.js
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function useWatchlist() {
    const [watchlistItems, setWatchlistItems] = useState([]);
    const [watchlistCandles, setWatchlistCandles] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    // Fetch all watchlist items
    const fetchWatchlistItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching watchlist items...");
            let response = await fetch("http://localhost:8080/api/user/watchlists", {
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
                response = await fetch("http://localhost:8080/api/user/watchlists", {
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

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Watchlist items received:", data);

            if (data.success) {
                setWatchlistItems(data.watchlists || []);

                // Explicitly fetch candles after items are updated
                if (data.watchlists && data.watchlists.length > 0) {
                    console.log("Fetching candles for updated watchlist...");
                    await fetchWatchlistCandles();
                }
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch watchlist items",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch watchlist items");
            }
        } catch (err) {
            console.error("Error fetching watchlist items:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch watchlist items. Server may be unavailable.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Fetch latest candles for watchlist items
    const fetchWatchlistCandles = useCallback(async () => {
        if (watchlistItems.length === 0) return;

        try {
            console.log("Fetching candles for watchlist items...");
            let response = await fetch("http://localhost:8080/api/user/watchlists/candles", {
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
                    console.error("Token refresh failed during candles fetch:", refreshError);
                    return;
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/watchlists/candles", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (response.status === 401) {
                    console.error("Session expired. Unable to fetch candles.");
                    return;
                }
            }

            if (!response.ok) {
                console.error(`Error fetching candles: ${response.status} ${response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log("Candles received:", data);

            if (data.success) {
                const candlesMap = {};
                (data.candles || []).forEach(candle => {
                    candlesMap[candle.watchlistItemId] = candle;
                });
                setWatchlistCandles(candlesMap);
            }
        } catch (err) {
            console.error("Error fetching watchlist candles:", err);
        }
    }, [watchlistItems, refreshToken]);

    // Add item to watchlist
    const addWatchlistItem = useCallback(async (platform, symbol) => {
        if (!platform || !symbol) {
            toast({
                title: "Validation Error",
                description: "Both platform and symbol are required",
                variant: "destructive",
            });
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`Adding ${symbol} from ${platform} to watchlist...`);
            let response = await fetch("http://localhost:8080/api/user/watchlists", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platform, symbol }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/watchlists", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ platform, symbol }),
                });

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
                setWatchlistItems(prev => [...prev, data.watchlist]);

                // Fetch candles for the new item if needed
                await fetchWatchlistCandles();
                toast({
                    title: "Success",
                    description: data.message || `Added ${symbol} from ${platform} to watchlist`,
                });

                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to add item to watchlist",
                    variant: "destructive",
                });
                setError(data.message || "Failed to add item to watchlist");
                return false;
            }
        } catch (err) {
            console.error("Error adding watchlist item:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to add item to watchlist. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Remove item from watchlist
    const removeWatchlistItem = useCallback(async (id) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Removing item ${id} from watchlist...`);
            let response = await fetch("http://localhost:8080/api/user/watchlists", {
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
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/watchlists", {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id }),
                });

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
                // First update local state for immediate UI feedback
                setWatchlistItems(prev => prev.filter(item => item.id !== id));
                setWatchlistCandles(prev => {
                    const updated = {...prev};
                    delete updated[id];
                    return updated;
                });

                toast({
                    title: "Success",
                    description: data.message || "Item removed from watchlist",
                });

                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to remove item from watchlist",
                    variant: "destructive",
                });
                setError(data.message || "Failed to remove item from watchlist");
                return false;
            }
        } catch (err) {
            console.error("Error removing watchlist item:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to remove item from watchlist. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Search watchlist items
    const searchWatchlistItems = useCallback(async (platform, symbol) => {
        setIsLoading(true);
        setError(null);

        try {
            const apiPlatform = platform === "_any_" ? "" : platform;
            const apiSymbol = symbol === "_any_" ? "" : symbol;

            console.log(`Searching watchlist: platform=${apiPlatform}, symbol=${apiSymbol}`);
            let response = await fetch("http://localhost:8080/api/user/watchlists/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    platform: apiPlatform,
                    symbol: apiSymbol
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
                response = await fetch("http://localhost:8080/api/user/watchlists/search", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        platform: apiPlatform,
                        symbol: apiSymbol
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
            console.log("Search results:", data);

            if (data.success) {
                setWatchlistItems(data.watchlists || []);

                if (data.watchlists && data.watchlists.length > 0) {
                    await fetchWatchlistCandles();
                }

                return data.watchlists || [];
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to search watchlist items",
                    variant: "destructive",
                });
                setError(data.message || "Failed to search watchlist items");
                return [];
            }
        } catch (err) {
            console.error("Error searching watchlist items:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to search watchlist items. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Initial fetch
    useEffect(() => {
        console.log("Initial watchlist fetch...");
        fetchWatchlistItems();
    }, [fetchWatchlistItems]);

    return {
        watchlistItems,
        watchlistCandles,
        isLoading,
        error,
        fetchWatchlistItems,
        addWatchlistItem,
        removeWatchlistItem,
        searchWatchlistItems,
        fetchWatchlistCandles,
    };
}