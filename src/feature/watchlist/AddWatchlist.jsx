import { useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { useWatchlist } from "../../context/WatchlistContext.jsx";
import { Loader2 } from "lucide-react";

const AddWatchlist = () => {
    const [isAdding, setIsAdding] = useState(false);

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

    const { addWatchlistItem, refreshLatestSearch } = useWatchlist();

    const handleAdd = async () => {
        if (!selectedPlatform || !selectedStock) {
            return;
        }

        setIsAdding(true);
        try {
            const success = await addWatchlistItem(selectedPlatform, selectedStock);
            if (success) {
                // Reset stock selection after successful add
                setSelectedStock("");

                // Force refresh using the last search
                console.log("Add successful - forcing refresh");
                refreshLatestSearch();
            }
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Add</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs mb-1">Platform</p>
                    <Select
                        value={selectedPlatform}
                        onValueChange={setSelectedPlatform}
                        disabled={isLoadingPlatforms || isAdding}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                            {platforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs mb-1">Stock</p>
                    <Select
                        value={selectedStock}
                        onValueChange={setSelectedStock}
                        disabled={isLoadingStocks || isAdding || !selectedPlatform}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={selectedPlatform ? "Select stock" : "Select platform first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    className="w-full"
                    onClick={handleAdd}
                    disabled={!selectedPlatform || !selectedStock || isAdding}
                >
                    {isAdding ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                        </>
                    ) : (
                        "Add"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

export default AddWatchlist;
