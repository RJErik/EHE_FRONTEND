import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";

const SearchAlerts = () => {
    // Mock data for platforms, stocks, and comparison types
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
    const comparisons = ["Greater than", "Lower than"];

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg text-muted-foreground">Search</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Platform</p>
                    <Select>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {platforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs text-muted-foreground mb-1">Stock</p>
                    <Select>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs text-muted-foreground mb-1">Greater or Lower</p>
                    <Select>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {comparisons.map((comp) => (
                                <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Amount to be crossed from</p>
                        <Input placeholder="Amount" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Amount to be crossed to</p>
                        <Input placeholder="Amount" />
                    </div>
                </div>

                <Button className="w-full">
                    Search
                </Button>
            </CardContent>
        </Card>
    );
};

export default SearchAlerts;
