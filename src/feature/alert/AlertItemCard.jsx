// src/components/alert/AlertItemCard.jsx
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Separator } from "@/components/ui/separator.jsx";
import { cn } from "@/lib/utils.js";

const AlertItemCard = ({ alert, onRemove }) => {
    const isPriceAbove = alert.conditionType === "PRICE_ABOVE";
    const isPriceBelow = alert.conditionType === "PRICE_BELOW";

    return (
        <Card className="w-full">
            <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <span className="font-medium">{alert.platform}</span>
                        <Separator className="mx-2 h-4 w-px" orientation="vertical" />
                        <span className="text-sm">{alert.symbol}</span>
                    </div>

                    <div className={cn(
                        "flex items-center",
                        isPriceAbove ? "text-green-500" : "",
                        isPriceBelow ? "text-red-500" : ""
                    )}>
                        {isPriceAbove && <ArrowUp className="h-4 w-4 mr-1" />}
                        {isPriceBelow && <ArrowDown className="h-4 w-4 mr-1" />}
                        <span>
                            ${alert.thresholdValue}
                        </span>
                    </div>
                </div>

                <Button variant="outline" size="icon" onClick={() => onRemove(alert.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
};

export default AlertItemCard;
