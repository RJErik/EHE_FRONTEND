// src/components/stockMarket/TradePanel.jsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Loader2, AlertCircle } from "lucide-react";
import { useTrading } from "../../hooks/useTrading.js";
import { stockSelectionEvents } from "./stockSelectionEvents.js";
import { Alert, AlertDescription } from "../../components/ui/alert.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Label } from "../../components/ui/label.jsx";

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
    const [selectedQuantityType, setSelectedQuantityType] = useState("QUOTE_ORDER_QTY"); // Default to QUOTE_ORDER_QTY for buy
    const [quantity, setQuantity] = useState(0);
    const [inputValue, setInputValue] = useState("0");
    const [setIsInputFocused] = useState(false);
    const [maxValue, setMaxValue] = useState(0);

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
                        // Set max value based on buy/sell mode and quantity type
                        updateMaxValue(capacity);
                    }
                });
        }
    }, [selectedPortfolioId, selectedStock]);

    // Update max value whenever trading capacity, buy/sell mode, or quantity type changes
    useEffect(() => {
        if (tradingCapacity) {
            updateMaxValue(tradingCapacity);
        }
    }, [tradingCapacity, isBuyMode, selectedQuantityType]);

    // Update max value based on buy/sell mode and quantity type
    const updateMaxValue = (capacity) => {
        if (!capacity) return;

        if (isBuyMode) {
            if (selectedQuantityType === "QUANTITY") {
                // Buy mode, Quantity - use max buy quantity (cash/price)
                setMaxValue(capacity.maxBuyQuantity);
            } else {
                // Buy mode, Quote Order Qty - use reserved cash
                setMaxValue(capacity.reservedCash);
            }
        } else {
            if (selectedQuantityType === "QUANTITY") {
                // Sell mode, Quantity - use current holdings
                setMaxValue(capacity.currentHolding);
            } else {
                // Sell mode, Quote Order Qty - use current holdings * price
                const holdingValue = capacity.currentHolding * capacity.currentPrice;
                setMaxValue(holdingValue);
            }
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
        // Set a sensible default for the quantity type based on the action
        setSelectedQuantityType(mode === 'buy' ? 'QUOTE_ORDER_QTY' : 'QUANTITY');
        // Max value will be updated by the useEffect
    };

    // Handle quantity type change
    const handleQuantityTypeChange = (value) => {
        setSelectedQuantityType(value);
        // Max value will be updated by the useEffect
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

    // Get the appropriate slider label
    const getSliderLabel = () => {
        if (isBuyMode) {
            if (selectedQuantityType === "QUANTITY") {
                return `Amount to Buy (${getBaseCurrency(selectedStock)})`;
            } else {
                return 'Cash to Spend ($)';
            }
        } else {
            if (selectedQuantityType === "QUANTITY") {
                return `Amount to Sell (${getBaseCurrency(selectedStock)})`;
            } else {
                return 'Cash Value to Sell ($)';
            }
        }
    };

    // Format the max value display
    const getFormattedMaxValue = () => {
        if (selectedQuantityType === "QUANTITY") {
            // For quantity, use more decimal places for crypto
            return maxValue.toFixed(8);
        } else {
            // For cash values, use 2 decimal places
            return `$${maxValue.toFixed(2)}`;
        }
    };

    // Execute trade
    const handleTrade = async () => {
        if (!isTradingEnabled) return;

        const action = isBuyMode ? "BUY" : "SELL";

        const result = await executeTrade(
            selectedPortfolioId,
            selectedStock,
            action,
            quantity,
            selectedQuantityType
        );

        if (result) {
            // Refresh capacity after successful trade
            await getTradingCapacity(selectedPortfolioId, selectedStock);
            // The slider max will be updated automatically through the useEffect
        }
    };

    // Calculate display values based on mode and quantity type
    const calculateTradeValues = () => {
        if (!tradingCapacity || quantity <= 0) {
            return { displayValue: 0, stockQuantity: 0 };
        }

        if (isBuyMode) {
            if (selectedQuantityType === "QUOTE_ORDER_QTY") {
                // Buy mode with QUOTE_ORDER_QTY - quantity is cash amount
                return {
                    displayValue: quantity, // Money to spend
                    stockQuantity: quantity / tradingCapacity.currentPrice // How many stocks that buys
                };
            } else {
                // Buy mode with QUANTITY - quantity is stock amount
                return {
                    displayValue: quantity * tradingCapacity.currentPrice, // Money to spend
                    stockQuantity: quantity // How many stocks to buy
                };
            }
        } else {
            if (selectedQuantityType === "QUANTITY") {
                // Sell mode with QUANTITY - quantity is stock amount
                return {
                    displayValue: quantity * tradingCapacity.currentPrice, // Money to receive
                    stockQuantity: quantity // How many stocks to sell
                };
            } else {
                // Sell mode with QUOTE_ORDER_QTY - quantity is cash amount
                return {
                    displayValue: quantity, // Money to receive
                    stockQuantity: quantity / tradingCapacity.currentPrice // How many stocks that sells
                };
            }
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

                                            {/* Quantity Type selection */}
                                            <div className="mt-4">
                                                <Label htmlFor="quantity-type-select">Order Type</Label>
                                                <Select
                                                    id="quantity-type-select"
                                                    value={selectedQuantityType}
                                                    onValueChange={handleQuantityTypeChange}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select quantity type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="QUANTITY">
                                                            Quantity
                                                        </SelectItem>
                                                        <SelectItem value="QUOTE_ORDER_QTY">
                                                            Quote Order Quantity
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Quantity selection */}
                                            <div className="mt-4">
                                                <div className="flex justify-between mb-1">
                                                    <Label>
                                                        {getSliderLabel()}
                                                    </Label>
                                                    <span className="text-sm text-muted-foreground">
                                                        Max: {getFormattedMaxValue()}
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[quantity]}
                                                    onValueChange={handleQuantitySlider}
                                                    max={maxValue}
                                                    step={maxValue > 1 ? 0.01 : 0.00000001}
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
                                                {selectedQuantityType === "QUOTE_ORDER_QTY" ? (
                                                    <div>
                                                        <Label>{isBuyMode ? "You will get:" : "You will sell:"}</Label>
                                                        <Badge className={`ml-2 ${isBuyMode ? "bg-green-600" : "bg-red-600"}`}>
                                                            {stockQuantity.toFixed(8)} {getBaseCurrency(selectedStock)}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Label>{isBuyMode ? "Cost:" : "You will receive:"}</Label>
                                                        <Badge className={`ml-2 ${isBuyMode ? "bg-green-600" : "bg-red-600"}`}>
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
