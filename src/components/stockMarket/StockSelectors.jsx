// src/components/stockMarket/StockSelectors.jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Button } from "../ui/button.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast.js";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import TimeIntervalButtons from "./TimeIntervalButtons.jsx";
import { useCandleSubscription } from "../../hooks/useCandleSubscription.js";
import { ChartContext } from "./ChartContext.jsx";

// Create a simple event system to share stock/platform selection
// This is a workaround since we can't rely on context for these values
const stockSelectionEvents = {
    listeners: [],
    subscribe: (callback) => {
        stockSelectionEvents.listeners.push(callback);
        return () => {
            stockSelectionEvents.listeners = stockSelectionEvents.listeners
                .filter(cb => cb !== callback);
        };
    },
    notify: (platform, stock) => {
        stockSelectionEvents.listeners.forEach(callback =>
            callback(platform, stock)
        );
    }
};

// Export the event system so other components can subscribe
export { stockSelectionEvents };

const StockSelectors = () => {
    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform: setStockDataPlatform,
        selectedStock,
        setSelectedStock: setStockDataStock,
        isLoadingPlatforms,
        isLoadingStocks,
        error: stockDataError
    } = useStockData();

    const [selectedTimeframe, setSelectedTimeframe] = useState("1D"); // Default to 1D

    // Import only setTimeframeInMs from ChartContext - it's the only one we're sure exists
    const { setTimeframeInMs } = useContext(ChartContext);

    // Set default timeframe on mount
    useEffect(() => {
        // Apply default timeframe in milliseconds
        setTimeframeInMs(timeframeToMilliseconds("1D"));
    }, [setTimeframeInMs]);

    // Notify other components when platform or stock changes
    useEffect(() => {
        if (selectedPlatform && selectedStock) {
            console.log("[StockSelectors] Broadcasting selection:", selectedPlatform, selectedStock);
            stockSelectionEvents.notify(selectedPlatform, selectedStock);
        }
    }, [selectedPlatform, selectedStock]);

    const {
        isConnected,
        isSubscribing,
        error: subscriptionError,
        subscribeToCandles
    } = useCandleSubscription();

    const { toast } = useToast();

    // Used to track if we've already attempted subscription with current selections
    const subscriptionRef = useRef({
        platform: null,
        stock: null,
        timeframe: null
    });

    // Function to convert timeframe string to milliseconds
    const timeframeToMilliseconds = (timeframe) => {
        if (!timeframe) return 60000; // Default to 1 minute

        switch (timeframe) {
            case "1M": return 60000; // 1 minute
            case "5M": return 5 * 60000; // 5 minutes
            case "15M": return 15 * 60000; // 15 minutes
            case "1H": return 60 * 60000; // 1 hour
            case "4H": return 4 * 60 * 60000; // 4 hours
            case "1D": return 24 * 60 * 60000; // 1 day
            default: return 60000; // Default to 1 minute
        }
    };

    // Handle timeframe change
    const handleTimeframeChange = (timeframe) => {
        setSelectedTimeframe(timeframe);
        setTimeframeInMs(timeframeToMilliseconds(timeframe));
    };

    // Combine errors from different sources
    const error = stockDataError || subscriptionError;

    // Show error toast if there's an error
    useEffect(() => {
        if (error) {
            toast({
                title: "Error",
                description: error,
                variant: "destructive",
                duration: 5000
            });
        }
    }, [error, toast]);

    // Memoized subscription function to avoid recreating on each render
    const handleSubscription = useCallback(() => {
        if (
            selectedPlatform &&
            selectedStock &&
            selectedTimeframe &&
            !isSubscribing &&
            (
                selectedPlatform !== subscriptionRef.current.platform ||
                selectedStock !== subscriptionRef.current.stock ||
                selectedTimeframe !== subscriptionRef.current.timeframe
            )
        ) {
            console.log("[StockSelectors] Subscribing to candles with:", {
                platform: selectedPlatform,
                stock: selectedStock,
                timeframe: selectedTimeframe
            });

            // Update ref to current selections
            subscriptionRef.current = {
                platform: selectedPlatform,
                stock: selectedStock,
                timeframe: selectedTimeframe
            };

            subscribeToCandles(selectedPlatform, selectedStock, selectedTimeframe)
                .catch(err => {
                    console.error("[StockSelectors] Subscription error:", err);
                });
        }
    }, [selectedPlatform, selectedStock, selectedTimeframe, isSubscribing, subscribeToCandles]);

    // Subscribe to candles when all selections are made
    useEffect(() => {
        handleSubscription();
    }, [handleSubscription]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-auto flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Platform</p>
                    <Select
                        value={selectedPlatform}
                        onValueChange={setStockDataPlatform}
                        disabled={isLoadingPlatforms || isSubscribing}
                    >
                        <SelectTrigger className="w-full">
                            {isLoadingPlatforms ? (
                                <div className="flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Loading...</span>
                                </div>
                            ) : (
                                <SelectValue placeholder="Select platform" />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {platforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full sm:w-auto flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Stock</p>
                    <Select
                        value={selectedStock}
                        onValueChange={setStockDataStock}
                        disabled={isLoadingStocks || !selectedPlatform || isSubscribing}
                    >
                        <SelectTrigger className="w-full">
                            {isLoadingStocks ? (
                                <div className="flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Loading...</span>
                                </div>
                            ) : (
                                <SelectValue placeholder={selectedPlatform ? "Select stock" : "Select platform first"} />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-end">
                    <Button>
                        Add API Key
                    </Button>
                </div>
            </div>

            {/* Time interval buttons */}
            <TimeIntervalButtons
                value={selectedTimeframe}
                onChange={handleTimeframeChange}
                isLoading={isSubscribing}
                disabled={!selectedStock || !selectedPlatform}
            />

            {/* Connection status indicator */}
            {/*<div className="flex items-center justify-between px-2">*/}
            {/*    <span className="text-xs text-muted-foreground">*/}
            {/*        WebSocket: {isConnected ? "Connected" : "Disconnected"}*/}
            {/*    </span>*/}
            {/*    {isSubscribing && (*/}
            {/*        <span className="text-xs flex items-center">*/}
            {/*            <Loader2 className="h-3 w-3 mr-1 animate-spin" />*/}
            {/*            Subscribing...*/}
            {/*        </span>*/}
            {/*    )}*/}
            {/*</div>*/}
        </div>
    );
};

export default StockSelectors;
