import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Button } from "../ui/button.jsx";

const StockSelectors = () => {
    // Mock data for platforms and stocks
    const platforms = ["NYSE", "NASDAQ", "LSE", "TSE"];
    const stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full sm:w-auto flex-1">
                <p className="text-sm text-gray-500 mb-1">Platform</p>
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

            <div className="w-full sm:w-auto flex-1">
                <p className="text-sm text-gray-500 mb-1">Stock</p>
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

            <div className="flex items-end">
                <Button className="bg-gray-500 hover:bg-gray-600">
                    Add API Key
                </Button>
            </div>
        </div>
    );
};

export default StockSelectors;
