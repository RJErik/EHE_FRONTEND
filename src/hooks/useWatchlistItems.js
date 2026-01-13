import {useState, useCallback} from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function useWatchlistItems() {
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
            let response = await fetch("/api/user/watchlist-items", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                response = await fetch("/api/user/watchlist-items", {
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
            console.log("WatchlistItems items received:", data);

            if (data.success) {
                setWatchlistItems(data.watchlistItems || []);
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
        if (watchlistItems.length === 0) {
            console.log("No watchlist items to fetch candles for");
            return;
        }

        try {
            console.log("Fetching candles for watchlist items...");
            let response = await fetch("/api/user/watchlist-items/candles", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    console.error("Token refresh failed during candles fetch:", refreshError);
                    return;
                }

                response = await fetch("/api/user/watchlist-items/candles", {
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
            let response = await fetch("/api/user/watchlist-items", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platform, symbol }),
            });

            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                response = await fetch("/api/user/watchlist-items", {
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
                setWatchlistItems(prev => [...prev, data.watchlistItem]);

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
            let response = await fetch(`/api/user/watchlist-items/${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                response = await fetch(`/api/user/watchlist-items/${id}`, {
                    method: "DELETE",
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
            console.log("Remove response:", data);

            if (data.success) {
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

            // Build query parameters
            const params = new URLSearchParams();
            if (apiPlatform) {
                params.append("platform", apiPlatform);
            }
            if (apiSymbol) {
                params.append("symbol", apiSymbol);
            }

            const url = `/api/user/watchlist-items/search?${params.toString()}`;

            console.log(`Searching watchlist: platform=${apiPlatform}, symbol=${apiSymbol}`);
            let response = await fetch(url, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                response = await fetch(url, {
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
            console.log("Search results:", data);

            if (data.success) {
                setWatchlistItems(data.watchlistItems || []);

                return data.watchlistItems || [];
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