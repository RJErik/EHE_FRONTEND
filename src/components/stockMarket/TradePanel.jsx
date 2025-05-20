// src/components/stockMarket/TradePanel.jsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Slider } from "../ui/slider.jsx";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Loader2, AlertCircle } from "lucide-react";
import { useTrading } from "../../hooks/useTrading.js";
import { stockSelectionEvents } from "./StockSelectors.jsx";
import { useToast } from "../../hooks/use-toast.js";
import { Alert, AlertDescription } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Label } from "../ui/label.jsx";

const TradePanel = () => {
    // Local state for selected platform and stock
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [selectedStock, setSelectedStock] = useState("");

    // Subscribe to stock selection events
    useEffect(() => {
        console.log("[TradePanel] Setting up subscription");
        const unsubscribe = stockSelectionEvents.subscribe((platform, stock) => {
            console.log("[TradePanel] Received selection update:", platform, stock);
            setSelectedPlatform(platform);
            setSelectedStock(stock);
        });

        return () => {
            console.log("[TradePanel] Cleaning up subscription");
            unsubscribe();
        };
    }, []);

    // Trading hook for backend interactions
    const {
        portfolios,
        tradingCapacity,
        isLoadingPortfolios,
        isLoadingCapacity,
        isExecutingTrade,
        fetchPortfoliosByPlatform,
        getTradingCapacity,
        executeTrade
    } = useTrading();

    // Local state
    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [isBuyMode, setIsBuyMode] = useState(true);
    const [quantity, setQuantity] = useState(0);
    const [inputValue, setInputValue] = useState("0");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [maxValue, setMaxValue] = useState(0);

    const { toast } = useToast();

    // Calculate if panel should be enabled
    const isPanelEnabled = !!selectedPlatform && !!selectedStock;

    // Calculate if trading is enabled
    const isTradingEnabled = isPanelEnabled &&
        !!selectedPortfolioId &&
        quantity > 0;

    // Helper function to extract base currency from trading pair
    const getBaseCurrency = (symbol) => {
        if (!symbol) return "";
        // Common quote currencies to remove from the end
        const quoteCurrencies = ["USDT", "USD", "BTC", "ETH", "BNB"];

        for (const quote of quoteCurrencies) {
            if (symbol.endsWith(quote)) {
                return symbol.slice(0, -quote.length);
            }
        }

        // Default fallback - return the original symbol
        return symbol;
    };

    // Fetch portfolios when platform changes
    useEffect(() => {
        if (selectedPlatform) {
            console.log("Fetching portfolios for platform:", selectedPlatform);
            fetchPortfoliosByPlatform(selectedPlatform);
            // Reset portfolio selection when platform changes
            setSelectedPortfolioId("");
            setQuantity(0);
            setInputValue("0");
        }
    }, [selectedPlatform]);

    // Fetch trading capacity when portfolio and stock are selected (only once)
    useEffect(() => {
        if (selectedPortfolioId && selectedStock) {
            console.log("Fetching trading capacity for:", selectedPortfolioId, selectedStock);
            getTradingCapacity(selectedPortfolioId, selectedStock)
                .then(capacity => {
                    if (capacity) {
                        // Set max value based on buy/sell mode
                        updateMaxValue(capacity);
                    }
                });
        }
    }, [selectedPortfolioId, selectedStock]);

    // Update max value whenever trading capacity changes
    useEffect(() => {
        if (tradingCapacity) {
            updateMaxValue(tradingCapacity);
        }
    }, [tradingCapacity, isBuyMode]);

    // Update max value based on buy/sell mode
    const updateMaxValue = (capacity) => {
        if (!capacity) return;

        if (isBuyMode) {
            // Buy mode - use reserved cash
            setMaxValue(capacity.reservedCash);
        } else {
            // Sell mode - use current holdings
            setMaxValue(capacity.currentHolding);
        }

        // Reset quantity to 0 when updating max values
        setQuantity(0);
        setInputValue("0");
    };

    // Handle portfolio selection
    const handlePortfolioChange = (value) => {
        setSelectedPortfolioId(value);
    };

    // Handle buy/sell toggle
    const handleModeToggle = (mode) => {
        setIsBuyMode(mode === 'buy');
        // Max value will be updated by the useEffect that watches tradingCapacity and isBuyMode
    };

    // Handle quantity changes from slider
    const handleQuantitySlider = (values) => {
        const newQuantity = values[0];
        setQuantity(newQuantity);
        setInputValue(newQuantity.toString());
    };

    // Handle quantity changes from input
    const handleQuantityInput = (e) => {
        const value = e.target.value;

        // Allow empty input when focused
        if (value === "") {
            setInputValue("");
            setQuantity(0);
            return;
        }

        const numericValue = parseFloat(value) || 0;
        const limitedValue = Math.min(numericValue, maxValue);

        setQuantity(limitedValue);
        setInputValue(value);
    };

    // Handle input focus
    const handleInputFocus = () => {
        setIsInputFocused(true);
        // Clear the input if it's "0" to allow user to type from scratch
        if (inputValue === "0") {
            setInputValue("");
        }
    };

    // Handle input blur
    const handleInputBlur = () => {
        setIsInputFocused(false);
        // If input is empty, set it back to "0"
        if (inputValue === "") {
            setInputValue("0");
        } else {
            // Ensure the displayed value respects the max limit
            const numericValue = parseFloat(inputValue) || 0;
            const limitedValue = Math.min(numericValue, maxValue);
            setInputValue(limitedValue.toString());
            setQuantity(limitedValue);
        }
    };

    // Execute trade
    const handleTrade = async () => {
        if (!isTradingEnabled) return;

        const action = isBuyMode ? "BUY" : "SELL";

        // For buy, we send the cash amount directly
        // For sell, we send the stock quantity
        const result = await executeTrade(
            selectedPortfolioId,
            selectedStock,
            action,
            quantity, // Always use the raw quantity value from input/slider
            isBuyMode ? "QUOTE_ORDER_QTY" : "QUANTITY" // Use QUOTE_ORDER_QTY for buy mode, QUANTITY for sell mode
        );

        if (result) {
            // Refresh capacity after successful trade
            await getTradingCapacity(selectedPortfolioId, selectedStock);
            // The slider max will be updated automatically through the useEffect
        }
    };

    // Calculate display values based on mode
    const calculateTradeValues = () => {
        if (!tradingCapacity || quantity <= 0) {
            return { displayValue: 0, stockQuantity: 0 };
        }

        if (isBuyMode) {
            // Buy mode - quantity is cash amount
            return {
                displayValue: quantity, // Money to spend
                stockQuantity: quantity / tradingCapacity.currentPrice // How many stocks that buys
            };
        } else {
            // Sell mode - quantity is stock amount
            return {
                displayValue: quantity * tradingCapacity.currentPrice, // Money to receive
                stockQuantity: quantity // How many stocks to sell
            };
        }
    };

    const { displayValue, stockQuantity } = calculateTradeValues();

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Buy / Sell</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                {!isPanelEnabled && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please select a platform and stock first.
                        </AlertDescription>
                    </Alert>
                )}

                {isPanelEnabled && (
                    <>
                        <div>
                            <Label htmlFor="portfolio-select">Select Portfolio</Label>
                            <Select
                                id="portfolio-select"
                                value={selectedPortfolioId}
                                onValueChange={handlePortfolioChange}
                                disabled={isLoadingPortfolios}
                            >
                                <SelectTrigger className="w-full">
                                    {isLoadingPortfolios ? (
                                        <div className="flex items-center">
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            <span>Loading...</span>
                                        </div>
                                    ) : (
                                        <SelectValue placeholder="Choose a portfolio" />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {portfolios.map((portfolio) => (
                                        <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                                            {portfolio.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedPortfolioId && (
                            <>
                                {isLoadingCapacity ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                ) : (
                                    tradingCapacity && (
                                        <>
                                            {/* Display trading information */}
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <Label>Holdings</Label>
                                                    <div className="font-semibold">{tradingCapacity.currentHolding} {getBaseCurrency(selectedStock)}</div>
                                                </div>
                                                <div>
                                                    <Label>Cash Available</Label>
                                                    <div className="font-semibold">${tradingCapacity.reservedCash}</div>
                                                </div>
                                            </div>

                                            {/* Buy/Sell toggle */}
                                            <div className="flex border rounded-md overflow-hidden mt-4">
                                                <button
                                                    type="button"
                                                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors 
                                                        ${isBuyMode
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-800'}`}
                                                    onClick={() => handleModeToggle('buy')}
                                                >
                                                    Buy
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors 
                                                        ${!isBuyMode
                                                        ? 'bg-red-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-800'}`}
                                                    onClick={() => handleModeToggle('sell')}
                                                >
                                                    Sell
                                                </button>
                                            </div>

                                            {/* Quantity selection */}
                                            <div className="mt-4">
                                                <div className="flex justify-between mb-1">
                                                    <Label>
                                                        {isBuyMode ? 'Cash to Spend ($)' : `Quantity (${getBaseCurrency(selectedStock)})`}
                                                    </Label>
                                                    <span className="text-sm text-muted-foreground">
                                                        Max: {isBuyMode ? `$${maxValue.toFixed(2)}` : maxValue.toFixed(8)}
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[quantity]}
                                                    onValueChange={handleQuantitySlider}
                                                    max={maxValue}
                                                    step={1}
                                                    className="mt-2"
                                                    disabled={maxValue <= 0}
                                                />
                                                <Input
                                                    type="number"
                                                    value={inputValue}
                                                    onChange={handleQuantityInput}
                                                    onFocus={handleInputFocus}
                                                    onBlur={handleInputBlur}
                                                    className="mt-2"
                                                    min="0"
                                                    max={maxValue}
                                                    disabled={maxValue <= 0}
                                                />
                                            </div>

                                            {/* Trade information */}
                                            <div className="mt-2 text-right">
                                                {isBuyMode ? (
                                                    <div>
                                                        <Label>You will get:</Label>
                                                        <Badge className="ml-2" variant="default">
                                                            {stockQuantity.toFixed(8)} {getBaseCurrency(selectedStock)}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Label>You will receive:</Label>
                                                        <Badge className="ml-2" variant="destructive">
                                                            ${displayValue.toFixed(2)}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Trade button */}
                                            <div className="mt-4">
                                                {isBuyMode ? (
                                                    <Button
                                                        className="w-full bg-green-600 hover:bg-green-700"
                                                        disabled={!isTradingEnabled || isExecutingTrade}
                                                        onClick={handleTrade}
                                                    >
                                                        {isExecutingTrade && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                        Buy {getBaseCurrency(selectedStock)}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="destructive"
                                                        className="w-full"
                                                        disabled={!isTradingEnabled || isExecutingTrade}
                                                        onClick={handleTrade}
                                                    >
                                                        {isExecutingTrade && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                        Sell {getBaseCurrency(selectedStock)}
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )
                                )}
                            </>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default TradePanel;