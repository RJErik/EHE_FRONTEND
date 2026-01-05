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

    // Sync internal stock data hook with parent platform state
    useEffect(() => {
        if (selectedPlatform) {
            setStockDataPlatform(selectedPlatform);
        }
    }, [selectedPlatform, setStockDataPlatform]);

    useEffect(() => {
        if (selectedPlatform && selectedStock) {
            console.log("[StockSelectors] Broadcasting selection:", selectedPlatform, selectedStock);
            stockSelectionEvents.notify(selectedPlatform, selectedStock);
        }
    }, [selectedPlatform, selectedStock]);

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
            case "1M": return 60000;
            case "5M": return 5 * 60000;
            case "15M": return 15 * 60000;
            case "1H": return 60 * 60000;
            case "4H": return 4 * 60 * 60000;
            case "1D": return 24 * 60 * 60000;
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

    const handlePlatformChange = (platform) => {
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