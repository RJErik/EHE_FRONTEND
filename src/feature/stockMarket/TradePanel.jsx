import { useEffect, useState, useRef } from "react";
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
import { usePortfolioContext } from "@/context/PortfoliosContext.jsx";

const TradePanel = ({ selectedPortfolioId }) => {
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [selectedStock, setSelectedStock] = useState("");
    const { fetchPortfolioDetails } = usePortfolioContext();

    const previousSelectionRef = useRef({ platform: null, stock: null });

    useEffect(() => {
        console.log("[TradePanel] Setting up subscription");
        const unsubscribe = stockSelectionEvents.subscribe((platform, stock) => {
            console.log("[TradePanel] Received selection update:", platform, stock);

            const prev = previousSelectionRef.current;

            if (!platform || !stock) {
                setSelectedPlatform("");
                setSelectedStock("");
                previousSelectionRef.current = { platform: null, stock: null };
                return;
            }

            const isPlatformOnlyChange = platform !== prev.platform &&
                stock === prev.stock &&
                prev.platform !== null;

            if (isPlatformOnlyChange) {
                console.log("[TradePanel] Detected platform change with stale stock, clearing selection");
                setSelectedPlatform("");
                setSelectedStock("");
                previousSelectionRef.current = { platform: null, stock: null };
                return;
            }

            setSelectedPlatform(platform);
            setSelectedStock(stock);
            previousSelectionRef.current = { platform, stock };
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

    useEffect(() => {
        const fetchData = async () => {
            if (selectedPortfolioId && selectedStock && selectedPlatform) {
                console.log("[TradePanel] Fetching trading capacity for:", selectedPortfolioId, selectedPlatform, selectedStock);
                await fetchPortfolioDetails(selectedPortfolioId);
                const capacity = await getTradingCapacity(selectedPortfolioId, selectedStock);
                if (capacity) {
                    updateMaxValue(capacity);
                }
            }
        };
        fetchData();
    }, [selectedPortfolioId, selectedStock, selectedPlatform, fetchPortfolioDetails, getTradingCapacity]);

    useEffect(() => {
        if (tradingCapacity) {
            updateMaxValue(tradingCapacity);
        }
    }, [tradingCapacity, isBuyMode, selectedQuantityType]);

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

    const handleModeToggle = (mode) => {
        setIsBuyMode(mode === 'buy');
        setSelectedQuantityType(mode === 'buy' ? 'QUOTE_ORDER_QTY' : 'QUANTITY');
    };

    const handleQuantityTypeChange = (value) => {
        setSelectedQuantityType(value);
    };

    const handleQuantitySlider = (values) => {
        const newQuantity = values[0];
        setQuantity(newQuantity);
        setInputValue(newQuantity.toString());
    };

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

    const handleInputFocus = () => {
        setIsInputFocused(true);
        if (inputValue === "0") {
            setInputValue("");
        }
    };

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

    const getFormattedMaxValue = () => {
        if (selectedQuantityType === "QUANTITY") {
            return maxValue.toFixed(8);
        } else {
            return `$${maxValue.toFixed(2)}`;
        }
    };

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