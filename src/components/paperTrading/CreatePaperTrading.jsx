import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";

const CreatePaperTrading = () => {
    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Create</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Starting Amount</p>
                    <Input placeholder="Amount" />
                </div>

                <Button className="w-full">
                    Create
                </Button>
            </CardContent>
        </Card>
    );
};

export default CreatePaperTrading;
