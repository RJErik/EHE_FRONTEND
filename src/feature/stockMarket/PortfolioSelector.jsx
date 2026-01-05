import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Loader2, AlertCircle } from "lucide-react";
import { useTrading } from "@/hooks/useTrading.js";
import { useEffect } from "react";

const PortfolioSelector = ({ platform, selectedPortfolioId, onPortfolioChange }) => {
    const {
        portfolios,
        isLoadingPortfolios,
        fetchPortfoliosByPlatform
    } = useTrading();

    // Fetch portfolios when platform changes
    useEffect(() => {
        if (platform) {
            console.log("[PortfolioSelector] Fetching portfolios for platform:", platform);
            fetchPortfoliosByPlatform(platform);
        }
    }, [platform, fetchPortfoliosByPlatform]);

    // Reset selected portfolio when platform changes
    useEffect(() => {
        if (platform) {
            onPortfolioChange(null);
        }
    }, [platform, onPortfolioChange]);

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Select Portfolio</h3>
            </CardHeader>
            <CardContent>
                <div>
                    <Label htmlFor="portfolio-select">Portfolio</Label>
                    {!platform ? (
                        <div className="flex items-center gap-2 p-3 mt-1 border rounded-md bg-muted/50">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                                Please select a platform first
                            </span>
                        </div>
                    ) : (
                        <Select
                            id="portfolio-select"
                            value={selectedPortfolioId || ""}
                            onValueChange={onPortfolioChange}
                            disabled={isLoadingPortfolios || !platform}
                        >
                            <SelectTrigger className="w-full">
                                {isLoadingPortfolios ? (
                                    <div className="flex items-center">
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        <span>Loading portfolios...</span>
                                    </div>
                                ) : (
                                    <SelectValue placeholder={
                                        portfolios.length === 0
                                            ? "No portfolios available"
                                            : "Choose a portfolio"
                                    } />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {portfolios.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                        No portfolios found for {platform}
                                    </div>
                                ) : (
                                    portfolios.map((portfolio) => (
                                        <SelectItem key={portfolio.id} value={portfolio.id.toString()}>
                                            {portfolio.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default PortfolioSelector;