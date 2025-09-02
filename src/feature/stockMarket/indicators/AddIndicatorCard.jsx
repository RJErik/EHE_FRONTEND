// src/components/stockMarket/indicators/AddIndicatorCard.jsx
import { Card, CardContent } from "../../../components/ui/card.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Plus } from "lucide-react";

const AddIndicatorCard = ({ onClick }) => {
    return (
        <Card className="w-full h-[180px] flex-shrink-0">
            <CardContent className="flex items-center justify-center h-full">
                <Button
                    variant="outline"
                    className="w-12 h-12 rounded-full"
                    onClick={onClick}
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </CardContent>
        </Card>
    );
};

export default AddIndicatorCard;
