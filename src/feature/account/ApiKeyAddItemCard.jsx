import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Plus } from "lucide-react";

const ApiKeyAddItemCard = ({ onClick }) => {
    return (
        <Card className="w-full mb-3 border-dashed">
            <CardContent className="flex items-center justify-center p-4 cursor-pointer" onClick={onClick}>
                <Button variant="outline" size="icon" className="rounded-full">
                    <Plus className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
};

export default ApiKeyAddItemCard;
