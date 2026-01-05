import { useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { useAlert } from "../../context/AlertsContext.jsx";
import { Loader2, RefreshCw } from "lucide-react";

const SearchAlerts = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchPlatform, setSearchPlatform] = useState("_any_");
    const [searchSymbol, setSearchSymbol] = useState("_any_");
    const [searchConditionType, setSearchConditionType] = useState("_any_");
    const [hasSearched, setHasSearched] = useState(false);

    const {
        platforms,
        stocks,
        setSelectedPlatform,
        isLoadingPlatforms,
        isLoadingStocks
    } = useStockData();

    const { searchAlerts, fetchAlerts } = useAlert();

    const handleSearch = async () => {
        setIsSearching(true);
        setHasSearched(true);

        try {
            if (searchPlatform === "_any_" && searchSymbol === "_any_" && searchConditionType === "_any_") {
                await fetchAlerts();
            } else {
                const apiPlatform = searchPlatform === "_any_" ? "" : searchPlatform;
                const apiSymbol = searchSymbol === "_any_" ? "" : searchSymbol;
                const apiConditionType = searchConditionType === "_any_" ? "" : searchConditionType;
                await searchAlerts(apiPlatform, apiSymbol, apiConditionType);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setSearchPlatform("_any_");
        setSearchSymbol("_any_");
        setSearchConditionType("_any_");
        setHasSearched(false);
        fetchAlerts();
    };

    const handleRefresh = () => {
        if (hasSearched) {
            handleSearch();
        } else {
            fetchAlerts();
        }
    };

    const handlePlatformChange = (value) => {
        setSearchPlatform(value);
        if (value !== "_any_") {
            setSelectedPlatform(value);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Search</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs mb-1">Platform</p>
                    <Select
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
                    <p className="text-xs mb-1">Stock</p>
                    <Select
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

                <div>
                    <p className="text-xs mb-1">Condition Type</p>
                    <Select
                        value={searchConditionType}
                        onValueChange={setSearchConditionType}
                        disabled={isSearching}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select condition type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any condition</SelectItem>
                            <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
                            <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
                        </SelectContent>
                    </Select>
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

export default SearchAlerts;
