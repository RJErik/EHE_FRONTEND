import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Loader2 } from "lucide-react";
import { usePortfolio } from "../../hooks/usePortfolio.js";

const PortfolioSelector = ({ selectedPortfolioId, onPortfolioChange }) => {
    const { portfolios, isLoading } = usePortfolio();

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Select Portfolio</h3>
            </CardHeader>
            <CardContent>
                <div>
                    <Label htmlFor="portfolio-select">Portfolio</Label>
                    <Select
                        id="portfolio-select"
                        value={selectedPortfolioId || ""}
                        onValueChange={onPortfolioChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full">
                            {isLoading ? (
                                <div className="flex items-center">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Loading...</span>
                                </div>
                            ) : (
                                <SelectValue placeholder="Choose a portfolio" />
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
            </CardContent>
        </Card>
    );
};

export default PortfolioSelector;