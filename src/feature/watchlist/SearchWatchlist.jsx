import { useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { useWatchlist } from "../../context/WatchlistContext.jsx";
import { Loader2, RefreshCw } from "lucide-react";

const SearchWatchlist = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchPlatform, setSearchPlatform] = useState("_any_");
    const [searchSymbol, setSearchSymbol] = useState("_any_");
    const [hasSearched, setHasSearched] = useState(false);

    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        isLoadingPlatforms,
        isLoadingStocks
    } = useStockData();

    const { searchWatchlistItems, fetchWatchlistItems, refreshLatestSearch } = useWatchlist();

    const handleSearch = async () => {
        setIsSearching(true);
        setHasSearched(true);

        try {
            // If both fields are "any", fetch all items
            if (searchPlatform === "_any_" && searchSymbol === "_any_") {
                await fetchWatchlistItems();
            } else {
                // Convert special values for API
                const apiPlatform = searchPlatform === "_any_" ? "" : searchPlatform;
                const apiSymbol = searchSymbol === "_any_" ? "" : searchSymbol;
                await searchWatchlistItems(apiPlatform, apiSymbol);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setSearchPlatform("_any_");
        setSearchSymbol("_any_");
        setHasSearched(false);
        fetchWatchlistItems();
    };

    const handleRefresh = () => {
        refreshLatestSearch();
    };

    // Update the platform in stock data hook when search platform changes
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

export default SearchWatchlist;
