import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const AddPortfolio = () => {
    // Mock data for platforms and API keys
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const apiKeys = ["API Key 1", "API Key 2", "API Key 3"];

    return (
        <Card className="bg-gray-200 w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-gray-500 text-lg">Add</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Platform</p>
                    <Select>
                        <SelectTrigger className="w-full bg-white">
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
                    <p className="text-xs text-gray-500 mb-1">API Key</p>
                    <Select>
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {apiKeys.map((key) => (
                                <SelectItem key={key} value={key}>{key}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button className="w-full bg-gray-500 hover:bg-gray-600">
                    Add
                </Button>
            </CardContent>
        </Card>
    );
};

export default AddPortfolio;
