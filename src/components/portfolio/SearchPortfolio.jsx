// src/components/portfolio/SearchPortfolio.jsx
import { useState } from "react";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { usePortfolioContext } from "../../context/PortfolioContext";
import { useStockData } from "../../hooks/useStockData.js";
import { Loader2, RefreshCw } from "lucide-react";

const SearchPortfolio = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchPlatform, setSearchPlatform] = useState("_any_");
    const [minValue, setMinValue] = useState("");
    const [maxValue, setMaxValue] = useState("");
    const [portfolioType, setPortfolioType] = useState("_any_");

    const { searchPortfolios, fetchPortfolios, refreshLatestSearch } = usePortfolioContext();

    const {
        platforms,
        selectedPlatform,
        setSelectedPlatform,
        isLoadingPlatforms
    } = useStockData();

    const handleSearch = async () => {
        setIsSearching(true);

        try {
            // Handle special case when all fields are empty
            if (searchPlatform === "_any_" && !minValue && !maxValue && portfolioType === "_any_") {
                await fetchPortfolios();
            } else {
                // Convert inputs to appropriate formats for API
                const typeParam = portfolioType === "_any_" ? null : portfolioType;
                const platformParam = searchPlatform === "_any_" ? null : searchPlatform;
                const minValueParam = minValue ? parseFloat(minValue) : null;
                const maxValueParam = maxValue ? parseFloat(maxValue) : null;

                await searchPortfolios(typeParam, platformParam, minValueParam, maxValueParam);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setSearchPlatform("_any_");
        setMinValue("");
        setMaxValue("");
        setPortfolioType("_any_");
        fetchPortfolios();
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
                    <p className="text-xs mb-1">Portfolio Type</p>
                    <Select
                        value={portfolioType}
                        onValueChange={setPortfolioType}
                        disabled={isSearching}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_any_">Any type</SelectItem>
                            <SelectItem value="Real">Real</SelectItem>
                            <SelectItem value="Simulated">Simulated</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs mb-1">Min Value</p>
                        <Input
                            placeholder="Minimum"
                            type="number"
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                            disabled={isSearching}
                        />
                    </div>
                    <div>
                        <p className="text-xs mb-1">Max Value</p>
                        <Input
                            placeholder="Maximum"
                            type="number"
                            value={maxValue}
                            onChange={(e) => setMaxValue(e.target.value)}
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

export default SearchPortfolio;
