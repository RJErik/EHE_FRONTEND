// src/components/automaticTransaction/CreateAutomaticTradeRule.jsx
import { useState, useEffect } from "react";
import { Input } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { useToast } from "../../hooks/use-toast.js";
import { Loader2 } from "lucide-react";
import { useStockData } from "../../hooks/useStockData.js";
import { useTrading } from "../../hooks/useTrading.js";
import { useAutomaticTradeContext } from "../../context/AutomaticTradeRulesContext.jsx";

const CreateAutomaticTradeRule = () => {
    // Toast for notifications
    const { toast } = useToast();

    // Stock data hook for platform and stock selection
    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        selectedStock,
        setSelectedStock,
        isLoadingPlatforms,
        isLoadingStocks
    } = useStockData();

    // Trading hook for portfolio data and trading capacity
    const {
        portfolios,
        tradingCapacity,
        isLoadingPortfolios,
        isLoadingCapacity,
        fetchPortfoliosByPlatform,
        getTradingCapacity
    } = useTrading();

    // Automatic trade context for adding rules
    const { addAutomaticTradeRule, refreshLatestSearch } = useAutomaticTradeContext();

    // Form state
    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [selectedConditionType, setSelectedConditionType] = useState("");
    const [selectedActionType, setSelectedActionType] = useState("BUY");
    const [selectedQuantityType, setSelectedQuantityType] = useState("QUANTITY");
    const [thresholdValue, setThresholdValue] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [inputValue, setInputValue] = useState("0");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [maxValue, setMaxValue] = useState(0);
    const [isCreating, setIsCreating] = useState(false);

    // Handle platform change directly, similar to search component
    const handlePlatformChange = (value) => {
        setSelectedPlatform(value);

        // Reset form values when platform changes
        setSelectedPortfolioId("");
        setQuantity(0);
        setInputValue("0");

        // Only fetch portfolios if we have a valid platform
        if (value) {
            fetchPortfoliosByPlatform(value);
        }
    };

    // Get trading capacity when portfolio and stock are selected
    useEffect(() => {
        if (selectedPortfolioId && selectedStock) {
            getTradingCapacity(selectedPortfolioId, selectedStock);
        }
    }, [selectedPortfolioId, selectedStock]);

    // Update max value when trading capacity, action type, or quantity type changes
    useEffect(() => {
        if (tradingCapacity) {
            updateMaxValue(tradingCapacity);
        }
    }, [tradingCapacity, selectedActionType, selectedQuantityType]);

    // Update max value based on action type and quantity type
    const updateMaxValue = (capacity) => {
        if (!capacity) return;

        if (selectedActionType === "BUY") {
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

    // Handle action type change
    const handleActionTypeChange = (value) => {
        setSelectedActionType(value);
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

    // Get the appropriate unit label based on action and quantity types
    const getQuantityUnitLabel = () => {
        if (selectedQuantityType === "QUANTITY") {
            return getBaseCurrency(selectedStock);
        } else {
            return "$";
        }
    };

    // Get the appropriate slider label
    const getSliderLabel = () => {
        if (selectedActionType === "BUY") {
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

    // Handle create button click
    const handleCreate = async () => {
        // Validate all required fields
        if (!selectedPlatform || !selectedStock || !selectedPortfolioId ||
            !selectedConditionType || !selectedActionType || !selectedQuantityType ||
            !thresholdValue || quantity <= 0) {
            toast({
                title: "Validation Error",
                description: "All fields are required and quantity must be greater than zero",
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);
        try {
            const success = await addAutomaticTradeRule(
                parseInt(selectedPortfolioId),
                selectedPlatform,
                selectedStock,
                selectedConditionType,
                selectedActionType,
                selectedQuantityType,
                quantity,
                thresholdValue
            );

            if (success) {
                // Reset form after successful creation
                setSelectedStock("");
                setSelectedConditionType("");
                setThresholdValue("");
                setQuantity(0);
                setInputValue("0");

                // Force refresh the automatic trade rules list
                console.log("Automatic trade rule created successfully - forcing refresh");
                refreshLatestSearch();
            }
        } finally {
            setIsCreating(false);
        }
    };

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

    // Calculate if form is valid
    const isFormValid = !!selectedPlatform && !!selectedStock && !!selectedPortfolioId &&
        !!selectedConditionType && !!selectedActionType &&
        !!selectedQuantityType && !!thresholdValue && quantity > 0;

    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Create Automated Trade Rule</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="platform-select">Platform</Label>
                    <Select
                        id="platform-select"
                        value={selectedPlatform}
                        onValueChange={handlePlatformChange}
                        disabled={isLoadingPlatforms || isCreating}
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

                <div>
                    <Label htmlFor="portfolio-select">Portfolio</Label>
                    <Select
                        id="portfolio-select"
                        value={selectedPortfolioId}
                        onValueChange={handlePortfolioChange}
                        disabled={isLoadingPortfolios || isCreating || !selectedPlatform}
                    >
                        <SelectTrigger className="w-full">
                            {isLoadingPortfolios ? (
                                <div className="flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Loading...</span>
                                </div>
                            ) : (
                                <SelectValue placeholder={selectedPlatform ? "Select portfolio" : "Select platform first"} />
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

                <div>
                    <Label htmlFor="stock-select">Stock</Label>
                    <Select
                        id="stock-select"
                        value={selectedStock}
                        onValueChange={setSelectedStock}
                        disabled={isLoadingStocks || isCreating || !selectedPlatform}
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

                <div>
                    <Label htmlFor="condition-type-select">Condition Type</Label>
                    <Select
                        id="condition-type-select"
                        value={selectedConditionType}
                        onValueChange={setSelectedConditionType}
                        disabled={isCreating}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
                            <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="threshold-value">Threshold Value</Label>
                    <Input
                        id="threshold-value"
                        type="number"
                        placeholder="Enter price threshold"
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(e.target.value)}
                        disabled={isCreating}
                    />
                </div>

                <div>
                    <Label htmlFor="action-type-select">Action Type</Label>
                    <Select
                        id="action-type-select"
                        value={selectedActionType}
                        onValueChange={handleActionTypeChange}
                        disabled={isCreating}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="BUY">Buy</SelectItem>
                            <SelectItem value="SELL">Sell</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="quantity-type-select">Quantity Type</Label>
                    <Select
                        id="quantity-type-select"
                        value={selectedQuantityType}
                        onValueChange={handleQuantityTypeChange}
                        disabled={isCreating}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select quantity type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="QUANTITY">Quantity</SelectItem>
                            <SelectItem value="QUOTE_ORDER_QTY">Quote Order Quantity</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Quantity selection - show only if portfolio and stock are selected */}
                {selectedPortfolioId && selectedStock && (
                    <>
                        {isLoadingCapacity ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : (
                            tradingCapacity && (
                                <div className="mt-4">
                                    <div className="flex justify-between mb-1">
                                        <Label>{getSliderLabel()}</Label>
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
                                        disabled={maxValue <= 0 || isCreating}
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
                                        disabled={maxValue <= 0 || isCreating}
                                    />
                                </div>
                            )
                        )}
                    </>
                )}

                <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={!isFormValid || isCreating}
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        "Create Automated Trade Rule"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

export default CreateAutomaticTradeRule;
