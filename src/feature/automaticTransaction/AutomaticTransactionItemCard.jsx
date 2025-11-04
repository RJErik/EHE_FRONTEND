import { Card, CardContent } from "../../components/ui/card.jsx";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Separator } from "../../components/ui/separator.jsx";
import { cn } from "../../lib/utils.js";

const AutomaticTransactionItemCard = ({ rule, onRemove }) => {
    const isPriceAbove = rule.conditionType === "PRICE_ABOVE";
    const isPriceBelow = rule.conditionType === "PRICE_BELOW";
    const isBuy = rule.actionType === "BUY";
    const isSell = rule.actionType === "SELL";

    // Format quantity type for better readability
    const formatQuantityType = (type) => {
        switch (type) {
            case "QUANTITY":
                return "Quantity";
            case "QUOTE_ORDER_QTY":
                return "Quote Order Qty";
            default:
                return type;
        }
    };

    return (
        <Card className="w-full">
            <CardContent className="flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                        <span className="font-medium">{rule.platform}</span>
                        <Separator className="mx-2 h-4 w-px" orientation="vertical" />
                        <span className="text-sm">{rule.symbol}</span>
                        <Separator className="mx-2 h-4 w-px" orientation="vertical" />
                        <span className="text-xs text-muted-foreground">{rule.portfolioName}</span>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => onRemove(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="text-sm mr-2">When price is</span>
                        <span className={cn(
                            "flex items-center",
                            isPriceAbove ? "text-green-500" : "",
                            isPriceBelow ? "text-red-500" : ""
                        )}>
                            {isPriceAbove && <ArrowUp className="h-4 w-4 mr-1" />}
                            {isPriceBelow && <ArrowDown className="h-4 w-4 mr-1" />}
                            <span className="font-medium">
                                {isPriceAbove ? "above" : "below"} ${rule.thresholdValue}
                            </span>
                        </span>
                    </div>

                    <div className={cn(
                        "flex items-center font-medium",
                        isBuy ? "text-green-500" : "",
                        isSell ? "text-red-500" : ""
                    )}>
                        {isBuy ? "Buy" : "Sell"} {rule.quantity} ({formatQuantityType(rule.quantityType)})
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AutomaticTransactionItemCard;