import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

const SearchPaperTrading = () => {
    return (
        <Card className="bg-gray-200 w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-gray-500 text-lg">Search</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Starting Amount From</p>
                        <Input placeholder="Amount" className="bg-white" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Starting Amount To</p>
                        <Input placeholder="Amount" className="bg-white" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Current Amount From</p>
                        <Input placeholder="Amount" className="bg-white" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Current Amount To</p>
                        <Input placeholder="Amount" className="bg-white" />
                    </div>
                </div>

                <Button className="w-full bg-gray-500 hover:bg-gray-600">
                    Search
                </Button>
            </CardContent>
        </Card>
    );
};

export default SearchPaperTrading;
