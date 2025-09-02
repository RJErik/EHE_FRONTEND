import { Input } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";

const SearchPaperTrading = () => {
    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Search</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Starting Amount From</p>
                        <Input placeholder="Amount" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Starting Amount To</p>
                        <Input placeholder="Amount" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Amount From</p>
                        <Input placeholder="Amount" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Amount To</p>
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

export default SearchPaperTrading;
