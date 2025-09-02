import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator.jsx";

const WatchlistItemCard = ({ item, onRemove }) => {
    return (
        <Card className="w-full">
            <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center">
                    <span className="font-medium">{item.platform}</span>
                    <Separator className="mx-2 h-4 w-px" orientation="vertical" />
                    <span className="text-sm">{item.symbol}</span>
                </div>

                <Button variant="outline" size="icon" onClick={() => onRemove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
};

export default WatchlistItemCard;
