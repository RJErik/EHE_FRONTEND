// src/components/portfolio/PortfolioItemCard.jsx
import { Card, CardContent } from "../ui/card.jsx";
import { Button } from "../ui/button.jsx";
import { RefreshCw, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const PortfolioItemCard = ({ portfolio, onDelete, onUpdate }) => {
    const handleDeleteClick = (e) => {
        // Make sure the event doesn't bubble up
        e.stopPropagation();
        onDelete(e);
    };

    return (
        <Card className="w-full mb-3">
            <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                    <div className="flex items-center">
                        <span className="font-medium">{portfolio.name}</span>
                        <Separator className="mx-2 h-4 w-px" orientation="vertical"/>
                        <span className="text-sm">{portfolio.platform}</span>
                        <Separator className="mx-2 h-4 w-px" orientation="vertical"/>
                        <span className="text-sm">{portfolio.type}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Value: {portfolio.value} $
                    </div>
                </div>

                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleDeleteClick}
                        title="Delete portfolio"
                        // Adding an additional class to help with styling/identifying
                        className="portfolio-delete-btn"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default PortfolioItemCard;