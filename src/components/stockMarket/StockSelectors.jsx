import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Button } from "../ui/button.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast.js";
import { useEffect } from "react";

const StockSelectors = () => {
    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        selectedStock,
        setSelectedStock,
        isLoadingPlatforms,
        isLoadingStocks,
        error
    } = useStockData();

    const { toast } = useToast();

    // Show error toast if there's an error
    useEffect(() => {
        if (error) {
            toast({
                title: "Error",
                description: error,
                variant: "destructive",
                duration: 5000
            });
        }
    }, [error, toast]);

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full sm:w-auto flex-1">
                <p className="text-sm text-muted-foreground mb-1">Platform</p>
                <Select
                    value={selectedPlatform}
                    onValueChange={setSelectedPlatform}
                    disabled={isLoadingPlatforms}
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

            <div className="w-full sm:w-auto flex-1">
                <p className="text-sm text-muted-foreground mb-1">Stock</p>
                <Select
                    value={selectedStock}
                    onValueChange={setSelectedStock}
                    disabled={isLoadingStocks || !selectedPlatform}
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

            <div className="flex items-end">
                <Button>
                    Add API Key
                </Button>
            </div>
        </div>
    );
};

export default StockSelectors;
