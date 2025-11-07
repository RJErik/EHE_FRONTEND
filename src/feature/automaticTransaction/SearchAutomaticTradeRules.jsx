// src/components/automaticTransaction/SearchAutomaticTradeRules.jsx
import { useState } from "react";
import { Input } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Loader2, RefreshCw } from "lucide-react";
import { useStockData } from "../../hooks/useStockData.js";
import { useTrading } from "../../hooks/useTrading.js";
import { useAutomaticTradeContext } from "../../context/AutomaticTradeRulesContext.jsx";

const SearchAutomaticTradeRules = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Stock data hook for platform and stock selection
    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        isLoadingPlatforms,
        isLoadingStocks
    } = useStockData();

    // Trading hook for portfolio data
    const {
        portfolios,
        isLoadingPortfolios,
        fetchPortfoliosByPlatform
    } = useTrading();

    // Automatic trade context for searching rules
    const { searchAutomaticTradeRules, fetchAutomaticTradeRules } = useAutomaticTradeContext();

    // Search form state
    const [searchPlatform, setSearchPlatform] = useState("_any_");
    const [searchPortfolioId, setSearchPortfolioId] = useState("_any_");
    const [searchSymbol, setSearchSymbol] = useState("_any_");
    const [searchConditionType, setSearchConditionType] = useState("_any_");
    const [searchActionType, setSearchActionType] = useState("_any_");
    const [searchQuantityType, setSearchQuantityType] = useState("_any_");
    const [minThresholdValue, setMinThresholdValue] = useState("");
    const [maxThresholdValue, setMaxThresholdValue] = useState("");

    // Update portfolios when platform changes
    const handlePlatformChange = (value) => {
        setSearchPlatform(value);
        setSearchPortfolioId("_any_");
        if (value !== "_any_") {
            setSelectedPlatform(value);
            fetchPortfoliosByPlatform(value);
        }
    };

    const handleSearch = async () => {
        setIsSearching(true);
        setHasSearched(true);

        try {
            // If all fields are "any" or empty, fetch all items
            if (searchPlatform === "_any_" &&
                searchPortfolioId === "_any_" &&
                searchSymbol === "_any_" &&
                searchConditionType === "_any_" &&
                searchActionType === "_any_" &&
                searchQuantityType === "_any_" &&
                !minThresholdValue &&
                !maxThresholdValue) {
                await fetchAutomaticTradeRules();
            } else {
                // Convert special values for API
                const apiPortfolioId = searchPortfolioId === "_any_" ? null : parseInt(searchPortfolioId);
                const apiPlatform = searchPlatform === "_any_" ? null : searchPlatform;
                const apiSymbol = searchSymbol === "_any_" ? null : searchSymbol;
                const apiConditionType = searchConditionType === "_any_" ? null : searchConditionType;
                const apiActionType = searchActionType === "_any_" ? null : searchActionType;
                const apiQuantityType = searchQuantityType === "_any_" ? null : searchQuantityType;
                const apiMinThreshold = minThresholdValue ? parseFloat(minThresholdValue) : null;
                const apiMaxThreshold = maxThresholdValue ? parseFloat(maxThresholdValue) : null;

                await searchAutomaticTradeRules(
                    apiPortfolioId,
                    apiPlatform,
                    apiSymbol,
                    apiConditionType,
                    apiActionType,
                    apiQuantityType,
                    apiMinThreshold,
                    apiMaxThreshold
                );
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setSearchPlatform("_any_");
        setSearchPortfolioId("_any_");
        setSearchSymbol("_any_");
        setSearchConditionType("_any_");
        setSearchActionType("_any_");
        setSearchQuantityType("_any_");
        setMinThresholdValue("");
        setMaxThresholdValue("");
        setHasSearched(false);
        fetchAutomaticTradeRules();
    };

    const handleRefresh = () => {
        if (hasSearched) {
            // Repeat the last search
            handleSearch();
        } else {
            // Just refresh all items
            fetchAutomaticTradeRules();
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Search Automated Trade Rules</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="search-platform">Platform</Label>
                    <Select
                        id="search-platform"
                        value={searchPlatform}
                        onValueChange={handlePlatformChange}
                        disabled={isLoadingPlatforms || isSearching}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any platform</SelectItem>
                            {platforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="search-portfolio">Portfolio</Label>
                    <Select
                        id="search-portfolio"
                        value={searchPortfolioId}
                        onValueChange={setSearchPortfolioId}
                        disabled={isLoadingPortfolios || isSearching || searchPlatform === "_any_"}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={searchPlatform !== "_any_" ? "Select portfolio" : "Select platform first"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any portfolio</SelectItem>
                            {portfolios.map((portfolio) => (
                                <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                                    {portfolio.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="search-symbol">Stock</Label>
                    <Select
                        id="search-symbol"
                        value={searchSymbol}
                        onValueChange={setSearchSymbol}
                        disabled={isLoadingStocks || isSearching}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select stock" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any stock</SelectItem>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="search-condition-type">Condition Type</Label>
                        <Select
                            id="search-condition-type"
                            value={searchConditionType}
                            onValueChange={setSearchConditionType}
                            disabled={isSearching}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_any_">Any condition</SelectItem>
                                <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
                                <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="search-action-type">Action Type</Label>
                        <Select
                            id="search-action-type"
                            value={searchActionType}
                            onValueChange={setSearchActionType}
                            disabled={isSearching}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_any_">Any action</SelectItem>
                                <SelectItem value="BUY">Buy</SelectItem>
                                <SelectItem value="SELL">Sell</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <Label htmlFor="search-quantity-type">Quantity Type</Label>
                    <Select
                        id="search-quantity-type"
                        value={searchQuantityType}
                        onValueChange={setSearchQuantityType}
                        disabled={isSearching}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select quantity type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any quantity type</SelectItem>
                            <SelectItem value="QUANTITY">Quantity</SelectItem>
                            <SelectItem value="QUOTE_ORDER_QTY">Quote Order Quantity</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="min-threshold">Min Threshold Value</Label>
                        <Input
                            id="min-threshold"
                            type="number"
                            placeholder="Minimum"
                            value={minThresholdValue}
                            onChange={(e) => setMinThresholdValue(e.target.value)}
                            disabled={isSearching}
                        />
                    </div>
                    <div>
                        <Label htmlFor="max-threshold">Max Threshold Value</Label>
                        <Input
                            id="max-threshold"
                            type="number"
                            placeholder="Maximum"
                            value={maxThresholdValue}
                            onChange={(e) => setMaxThresholdValue(e.target.value)}
                            disabled={isSearching}
                        />
                    </div>
                </div>

                <div className="flex space-x-2">
                    <Button
                        className="flex-1"
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        {isSearching ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                            </>
                        ) : (
                            "Search"
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClear}
                        disabled={isSearching}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isSearching}
                        title="Refresh results"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default SearchAutomaticTradeRules;