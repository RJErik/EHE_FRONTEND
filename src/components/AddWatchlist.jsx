import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const AddWatchlist = () => {
    // Mock data for platforms and stocks
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

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
                    <p className="text-xs text-gray-500 mb-1">Stock</p>
                    <Select>
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
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

export default AddWatchlist;
