import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button.jsx";
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "../../context/WatchlistContext";

const WatchlistTicker = () => {
    const [isOpen, setIsOpen] = useState(true);
    const scrollRef = useRef(null);
    const { watchlistItems, watchlistCandles, fetchWatchlistCandles, lastUpdate } = useWatchlist();

    // Setup ticker animation for scrolling
    useEffect(() => {
        if (!scrollRef.current || !isOpen || watchlistItems.length <= 5) return;

        const scrollContainer = scrollRef.current;
        let scrollAmount = 0;
        const speed = 1; // pixels per frame
        let animationFrameId;

        const scroll = () => {
            scrollContainer.scrollLeft = scrollAmount;
            scrollAmount += speed;

            // Reset scroll position when we reach the end
            if (scrollAmount >= scrollContainer.scrollWidth - scrollContainer.clientWidth) {
                scrollAmount = 0;
            }

            animationFrameId = requestAnimationFrame(scroll);
        };

        animationFrameId = requestAnimationFrame(scroll);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isOpen, watchlistItems, lastUpdate]); // Added lastUpdate dependency

    // Refresh candles periodically when ticker is open
    useEffect(() => {
        if (!isOpen || watchlistItems.length === 0) return;

        // Initial fetch
        fetchWatchlistCandles();

        const interval = setInterval(() => {
            fetchWatchlistCandles();
        }, 30000); // Refresh every 30 seconds for better responsiveness

        return () => clearInterval(interval);
    }, [isOpen, fetchWatchlistCandles, watchlistItems, lastUpdate]); // Added lastUpdate dependency

    return (
        <div className={cn(
            "fixed left-0 right-0 bg-background border-b z-40 transition-all duration-300",
            "top-[60px]", // Position below header
            isOpen ? "h-14" : "h-7"
        )}>
            <div className="container mx-auto h-full flex flex-col">
                {/* Toggle button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 flex justify-center items-center rounded-none"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {/* Ticker content */}
                {isOpen && (
                    <div
                        ref={scrollRef}
                        className="ticker-scroll flex-1 flex items-center overflow-x-auto"
                    >
                        {watchlistItems.length === 0 ? (
                            <div className="mx-auto text-sm text-muted-foreground">
                                Your watchlist is empty
                            </div>
                        ) : (
                            <div className="flex space-x-6 px-4">
                                {watchlistItems.map(item => {
                                    const candle = watchlistCandles[item.id];
                                    const isPriceUp = candle && candle.close > candle.open;
                                    const isPriceDown = candle && candle.close < candle.open;
                                    const percentChange = candle
                                        ? ((candle.close - candle.open) / candle.open * 100).toFixed(2)
                                        : null;

                                    return (
                                        <div key={`ticker-${item.id}-${lastUpdate}`} className="flex items-center whitespace-nowrap">
                                            <span className="font-semibold">{item.symbol}</span>

                                            {candle ? (
                                                <div className="ml-2 flex items-center">
                                                    <span className={cn(
                                                        "font-medium",
                                                        isPriceUp ? "text-green-500" : "",
                                                        isPriceDown ? "text-red-500" : ""
                                                    )}>
                                                        ${candle.close}
                                                    </span>

                                                    <div className={cn(
                                                        "ml-1 flex items-center text-xs",
                                                        isPriceUp ? "text-green-500" : "",
                                                        isPriceDown ? "text-red-500" : ""
                                                    )}>
                                                        {isPriceUp && <ArrowUp className="h-3 w-3" />}
                                                        {isPriceDown && <ArrowDown className="h-3 w-3" />}
                                                        <span>
                                                            {percentChange}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="ml-2 text-muted-foreground text-xs">
                                                    Loading...
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WatchlistTicker;
