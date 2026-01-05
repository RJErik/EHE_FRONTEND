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

const TradePanel = ({ selectedPortfolioId }) => {
    const [selectedStock, setSelectedStock] = useState("");

    useEffect(() => {
        console.log("[TradePanel] Setting up subscription");
        const unsubscribe = stockSelectionEvents.subscribe((platform, stock) => {
            console.log("[TradePanel] Received selection update:", platform, stock);
            setSelectedStock(stock);
        });

        return () => {
            console.log("[TradePanel] Cleaning up subscription");
            unsubscribe();
        };
    }, []);

    const {
        tradingCapacity,
        isLoadingCapacity,
        isExecutingTrade,
        getTradingCapacity,
        executeTrade
    } = useTrading();

    const [isBuyMode, setIsBuyMode] = useState(true);
    const [selectedQuantityType, setSelectedQuantityType] = useState("QUOTE_ORDER_QTY");
    const [quantity, setQuantity] = useState(0);
    const [inputValue, setInputValue] = useState("0");
    const [setIsInputFocused] = useState(false);
    const [maxValue, setMaxValue] = useState(0);

    const isTradingEnabled = !!selectedPortfolioId &&
        !!selectedStock &&
        quantity > 0;

    // Helper function to extract base currency from trading pair
    const getBaseCurrency = (symbol) => {
        if (!symbol) return "";
        const quoteCurrencies = ["USDT", "USD", "BTC", "ETH", "BNB"];

        for (const quote of quoteCurrencies) {
            if (symbol.endsWith(quote)) {
                return symbol.slice(0, -quote.length);
            }
        }

        return symbol;
    };

    // Fetch trading capacity when portfolio and stock are selected
    useEffect(() => {
        if (selectedPortfolioId && selectedStock) {
            console.log("Fetching trading capacity for:", selectedPortfolioId, selectedStock);
            getTradingCapacity(selectedPortfolioId, selectedStock)
                .then(capacity => {
                    if (capacity) {
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
                setMaxValue(capacity.maxBuyQuantity);
            } else {
                setMaxValue(capacity.reservedCash);
            }
        } else {
            if (selectedQuantityType === "QUANTITY") {
                setMaxValue(capacity.currentHolding);
            } else {
                const holdingValue = capacity.currentHolding * capacity.currentPrice;
                setMaxValue(holdingValue);
            }
        }

        setQuantity(0);
        setInputValue("0");
    };

    // Handle buy/sell toggle
    const handleModeToggle = (mode) => {
        setIsBuyMode(mode === 'buy');
        setSelectedQuantityType(mode === 'buy' ? 'QUOTE_ORDER_QTY' : 'QUANTITY');
    };

    // Handle quantity type change
    const handleQuantityTypeChange = (value) => {
        setSelectedQuantityType(value);
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
        if (inputValue === "0") {
            setInputValue("");
        }
    };

    // Handle input blur
    const handleInputBlur = () => {
        setIsInputFocused(false);
        if (inputValue === "") {
            setInputValue("0");
        } else {
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
            return maxValue.toFixed(8);
        } else {
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
            await getTradingCapacity(selectedPortfolioId, selectedStock);
        }
    };

    // Calculate display values based on mode and quantity type
    const calculateTradeValues = () => {
        if (!tradingCapacity || quantity <= 0) {
            return { displayValue: 0, stockQuantity: 0 };
        }

        if (isBuyMode) {
            if (selectedQuantityType === "QUOTE_ORDER_QTY") {
                return {
                    displayValue: quantity,
                    stockQuantity: quantity / tradingCapacity.currentPrice
                };
            } else {
                return {
                    displayValue: quantity * tradingCapacity.currentPrice,
                    stockQuantity: quantity
                };
            }
        } else {
            if (selectedQuantityType === "QUANTITY") {
                return {
                    displayValue: quantity * tradingCapacity.currentPrice,
                    stockQuantity: quantity
                };
            } else {
                return {
                    displayValue: quantity,
                    stockQuantity: quantity / tradingCapacity.currentPrice
                };
            }
        }
    };

    const { displayValue, stockQuantity } = calculateTradeValues();

    if (!selectedPortfolioId && !selectedStock) {
        return (
            <Card className="w-full">
                <CardHeader className="text-center pb-2">
                    <h3 className="text-muted-foreground text-lg">Buy / Sell</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please select a portfolio and a stock to start trading.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!selectedPortfolioId) {
        return (
            <Card className="w-full">
                <CardHeader className="text-center pb-2">
                    <h3 className="text-muted-foreground text-lg">Buy / Sell</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please select a portfolio to start trading.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!selectedStock) {
        return (
            <Card className="w-full">
                <CardHeader className="text-center pb-2">
                    <h3 className="text-muted-foreground text-lg">Buy / Sell</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please select a stock to start trading.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Buy / Sell</h3>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
        </Card>
    );
};

export default TradePanel;