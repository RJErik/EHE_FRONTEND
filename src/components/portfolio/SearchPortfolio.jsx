import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";

const SearchPortfolio = () => {
    // Mock data for platforms and API keys
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const apiKeys = ["API Key 1", "API Key 2", "API Key 3"];

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Search</h3>
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Value from</p>
                        <Input placeholder="Amount" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Value to</p>
                        <Input placeholder="Amount" />
                    </div>
                </div>

                <div>
                    <p className="text-xs text-muted-foreground mb-1">API Key</p>
                    <Select>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {apiKeys.map((key) => (
                                <SelectItem key={key} value={key}>{key}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button className="w-full">
                    Search
                </Button>
            </CardContent>
        </Card>
    );
};

export default SearchPortfolio;
