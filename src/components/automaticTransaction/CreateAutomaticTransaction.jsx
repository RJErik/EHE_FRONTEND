import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";

const CreateAutomaticTransaction = () => {
    // Mock data for platforms, stocks, comparisons, and API keys
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
    const comparisons = ["Greater than", "Lower than"];
    const apiKeys = ["API Key 1", "API Key 2", "API Key 3"];

    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Create</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs mb-1">Platform</p>
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
                    <p className="text-xs mb-1">Stock</p>
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
                    <p className="text-xs mb-1">Greater or Lower</p>
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

                <div>
                    <p className="text-xs mb-1">Amount to be crossed</p>
                    <Input placeholder="Amount" />
                </div>

                <div>
                    <p className="text-xs mb-1">API Key</p>
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
                    Create
                </Button>
            </CardContent>
        </Card>
    );
};

export default CreateAutomaticTransaction;
