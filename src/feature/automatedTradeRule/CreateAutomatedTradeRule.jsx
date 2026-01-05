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
import { useAutomatedTradeRuleContext } from "../../context/AutomatedTradeRulesContext.jsx";

const CreateAutomatedTradeRule = () => {
    const { toast } = useToast();

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

    const {
        portfolios,
        tradingCapacity,
        isLoadingPortfolios,
        isLoadingCapacity,
        fetchPortfoliosByPlatform,
        getTradingCapacity
    } = useTrading();

    const { addAutomaticTradeRule, refreshLatestSearch } = useAutomatedTradeRuleContext();

    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [selectedConditionType, setSelectedConditionType] = useState("");
    const [selectedActionType, setSelectedActionType] = useState("BUY");
    const [selectedQuantityType, setSelectedQuantityType] = useState("QUANTITY");
    const [thresholdValue, setThresholdValue] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [inputValue, setInputValue] = useState("0");
    const [setIsInputFocused] = useState(false);
    const [maxValue, setMaxValue] = useState(0);
    const [isCreating, setIsCreating] = useState(false);

    const handlePlatformChange = (value) => {
        setSelectedPlatform(value);

        setSelectedPortfolioId("");
        setQuantity(0);
        setInputValue("0");

        if (value) {
            fetchPortfoliosByPlatform(value);
        }
    };

    useEffect(() => {
        if (selectedPortfolioId && selectedStock) {
            getTradingCapacity(selectedPortfolioId, selectedStock);
        }
    }, [selectedPortfolioId, selectedStock]);

    useEffect(() => {
        if (tradingCapacity) {
            updateMaxValue(tradingCapacity);
        }
    }, [tradingCapacity, selectedActionType, selectedQuantityType]);

    const updateMaxValue = (capacity) => {
        if (!capacity) return;

        if (selectedActionType === "BUY") {
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

    const handlePortfolioChange = (value) => {
        setSelectedPortfolioId(value);
    };

    const handleActionTypeChange = (value) => {
        setSelectedActionType(value);
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

    const getFormattedMaxValue = () => {
        if (selectedQuantityType === "QUANTITY") {
            return maxValue.toFixed(8);
        } else {
            return `$${maxValue.toFixed(2)}`;
        }
    };

    const handleCreate = async () => {
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
                setSelectedStock("");
                setSelectedConditionType("");
                setThresholdValue("");
                setQuantity(0);
                setInputValue("0");

                console.log("Automatic trade rule created successfully - forcing refresh");
                refreshLatestSearch();
            }
        } finally {
            setIsCreating(false);
        }
    };

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

export default CreateAutomatedTradeRule;
