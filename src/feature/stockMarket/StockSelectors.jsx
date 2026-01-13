import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Button } from "../../components/ui/button.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast.js";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import TimeIntervalButtons from "./TimeIntervalButtons.jsx";
import { useCandleSubscription } from "../../hooks/useCandleSubscription.js";
import { ChartContext } from "./ChartContext.jsx";
import { stockSelectionEvents } from "./stockSelectionEvents.js";

const StockSelectors = ({ selectedPlatform, onPlatformChange }) => {
    const {
        platforms,
        stocks,
        setSelectedPlatform: setStockDataPlatform,
        selectedStock,
        setSelectedStock: setStockDataStock,
        isLoadingPlatforms,
        isLoadingStocks,
        error: stockDataError
    } = useStockData();

    const [selectedTimeframe, setSelectedTimeframe] = useState("1D");

    const { setTimeframeInMs, timeframeInMs } = useContext(ChartContext);

    const [stocksLoadedForPlatform, setStocksLoadedForPlatform] = useState(null);

    const platformTransitionRef = useRef(false);

    // Sync internal stock data hook with parent platform state
    useEffect(() => {
        if (selectedPlatform) {
            setStockDataPlatform(selectedPlatform);
        }
    }, [selectedPlatform, setStockDataPlatform]);

    // Track when stocks have finished loading for a platform
    useEffect(() => {
        if (!isLoadingStocks && selectedPlatform) {
            console.log("[StockSelectors] Stocks loaded for platform:", selectedPlatform, "stocks:", stocks);
            setStocksLoadedForPlatform(selectedPlatform);
            platformTransitionRef.current = false;

            if (selectedStock && stocks.length > 0 && !stocks.includes(selectedStock)) {
                console.log("[StockSelectors] Clearing invalid stock selection:", selectedStock);
                setStockDataStock(null);
            }
        }
    }, [isLoadingStocks, selectedPlatform, stocks, selectedStock, setStockDataStock]);

    // Only broadcast when stocks are confirmed loaded for current platform
    useEffect(() => {
        const isStocksCurrentForPlatform = stocksLoadedForPlatform === selectedPlatform;
        const isValidSelection = selectedPlatform &&
            selectedStock &&
            stocks.length > 0 &&
            stocks.includes(selectedStock) &&
            isStocksCurrentForPlatform &&
            !isLoadingStocks &&
            !platformTransitionRef.current;

        if (isValidSelection) {
            console.log("[StockSelectors] Broadcasting selection:", selectedPlatform, selectedStock);
            stockSelectionEvents.notify(selectedPlatform, selectedStock);
        }
    }, [selectedPlatform, selectedStock, stocks, stocksLoadedForPlatform, isLoadingStocks]);

    const {
        isSubscribing,
        error: subscriptionError,
        subscribeToCandles
    } = useCandleSubscription();

    const { toast } = useToast();

    const subscriptionRef = useRef({
        platform: null,
        stock: null,
        timeframe: null
    });

    const timeframeToMilliseconds = (timeframe) => {
        if (!timeframe) return 60000;

        switch (timeframe) {
            case "1m": return 60000;
            case "5m": return 5 * 60000;
            case "15m": return 15 * 60000;
            case "1h": return 60 * 60000;
            case "4h": return 4 * 60 * 60000;
            case "1d": return 24 * 60 * 60000;
            default: return 60000;
        }
    };

    const millisecondsToTimeframe = (ms) => {
        switch (ms) {
            case 1 * 60 * 1000: return "1m";
            case 5 * 60 * 1000: return "5m";
            case 15 * 60 * 1000: return "15m";
            case 60 * 60 * 1000: return "1h";
            case 4 * 60 * 60 * 1000: return "4h";
            case 24 * 60 * 60 * 1000: return "1d";
            default: return selectedTimeframe;
        }
    };

    useEffect(() => {
        if (typeof timeframeInMs === 'number' && timeframeInMs > 0) {
            const mapped = millisecondsToTimeframe(timeframeInMs);
            if (mapped !== selectedTimeframe) {
                setSelectedTimeframe(mapped);
            }
        }
    }, [timeframeInMs]);

    const handleTimeframeChange = (timeframe) => {
        if (!timeframe || timeframe === selectedTimeframe) return;
        setSelectedTimeframe(timeframe);
        setTimeframeInMs(timeframeToMilliseconds(timeframe));
    };

    // Mark transition and clear stock when platform changes
    const handlePlatformChange = (platform) => {
        if (platform === selectedPlatform) return;

        console.log("[StockSelectors] Platform changing from", selectedPlatform, "to", platform);
        platformTransitionRef.current = true;

        subscriptionRef.current = {
            platform: null,
            stock: null,
            timeframe: null
        };

        setStockDataStock(null);

        onPlatformChange(platform);
    };

    const error = stockDataError || subscriptionError;

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

    // Validation before subscribing
    const handleSubscription = useCallback(() => {
        if (!selectedPlatform || !selectedStock || !selectedTimeframe) {
            return;
        }

        if (isSubscribing) {
            return;
        }

        if (isLoadingStocks) {
            console.log("[StockSelectors] Waiting for stocks to load...");
            return;
        }

        if (stocksLoadedForPlatform !== selectedPlatform) {
            console.log("[StockSelectors] Stocks not yet loaded for platform:", selectedPlatform,
                "currently loaded for:", stocksLoadedForPlatform);
            return;
        }

        if (!stocks.includes(selectedStock)) {
            console.log("[StockSelectors] Stock", selectedStock, "not found in", stocks);
            return;
        }

        if (platformTransitionRef.current) {
            console.log("[StockSelectors] Platform transition in progress, skipping subscription");
            return;
        }

        if (
            selectedPlatform === subscriptionRef.current.platform &&
            selectedStock === subscriptionRef.current.stock &&
            selectedTimeframe === subscriptionRef.current.timeframe
        ) {
            return;
        }

        console.log("[StockSelectors] Subscribing to candles with:", {
            platform: selectedPlatform,
            stock: selectedStock,
            timeframe: selectedTimeframe,
            validatedAgainstStocks: stocks
        });

        subscriptionRef.current = {
            platform: selectedPlatform,
            stock: selectedStock,
            timeframe: selectedTimeframe
        };

        subscribeToCandles(selectedPlatform, selectedStock, selectedTimeframe)
            .catch(err => {
                console.error("[StockSelectors] Subscription error:", err);
                subscriptionRef.current = {
                    platform: null,
                    stock: null,
                    timeframe: null
                };
            });
    }, [
        selectedPlatform,
        selectedStock,
        selectedTimeframe,
        isSubscribing,
        subscribeToCandles,
        stocks,
        isLoadingStocks,
        stocksLoadedForPlatform
    ]);

    useEffect(() => {
        handleSubscription();
    }, [handleSubscription]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="w-full sm:w-auto flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Platform</p>
                    <Select
                        value={selectedPlatform || ""}
                        onValueChange={handlePlatformChange}
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
                        value={selectedStock || ""}
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

            <TimeIntervalButtons
                value={selectedTimeframe}
                onChange={handleTimeframeChange}
                isLoading={isSubscribing}
                disabled={!selectedStock || !selectedPlatform}
            />
        </div>
    );
};

export default StockSelectors;