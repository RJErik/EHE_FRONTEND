import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

const CreatePaperTrading = () => {
    return (
        <Card className="bg-gray-200 w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-gray-500 text-lg">Create</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Starting Amount</p>
                    <Input placeholder="Amount" className="bg-white" />
                </div>

                <Button className="w-full bg-gray-500 hover:bg-gray-600">
                    Create
                </Button>
            </CardContent>
        </Card>
    );
};

export default CreatePaperTrading;
