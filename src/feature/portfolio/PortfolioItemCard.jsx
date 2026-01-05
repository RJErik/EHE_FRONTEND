import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator.jsx";

const PortfolioItemCard = ({ portfolio, onDelete}) => {
    const handleDeleteClick = (e) => {
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