// src/components/automaticTransaction/AutomaticTransactionList.jsx
import { Card, CardContent } from "../../components/ui/card.jsx";
import { useAutomaticTradeContext } from "../../context/AutomaticTradeContext.jsx";
import { useAutomatedTradeWebSocket } from "../../context/AutomatedTradeWebSocketContext.jsx";
import { Loader2, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Separator } from "../../components/ui/separator.jsx";
import { cn } from "../../lib/utils.js";
import { useCallback, useEffect, useRef } from "react";

const AutomaticTradeItemCard = ({ rule, onRemove }) => {
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

const AutomaticTransactionList = () => {
    const { automaticTradeRules, isLoading, error, removeAutomaticTradeRule, fetchAutomaticTradeRules, refreshLatestSearch, lastUpdate } = useAutomaticTradeContext();
    const { registerAutomatedTradeCallback } = useAutomatedTradeWebSocket();

    // Use a ref to prevent multiple fetches on initial render
    const initialFetchDoneRef = useRef(false);

    // Fetch automatic trade rules only on initial mount
    useEffect(() => {
        if (!initialFetchDoneRef.current) {
            console.log("AutomaticTransactionList mounted - fetching rules");
            fetchAutomaticTradeRules();
            initialFetchDoneRef.current = true;
        }
    }, [fetchAutomaticTradeRules]);

    // Memoize the callback to prevent effect regeneration
    const automatedTradeCallback = useCallback((tradeNotification) => {
        console.log('[AutomaticTransactionList] Received automated trade notification, refreshing list');
        refreshLatestSearch();
    }, [refreshLatestSearch]);

    // Register for automated trade notifications once
    useEffect(() => {
        console.log("Registering for automated trade notifications");
        const unregister = registerAutomatedTradeCallback(automatedTradeCallback);

        return () => {
            console.log("Unregistering from automated trade notifications");
            unregister();
        };
    }, [registerAutomatedTradeCallback, automatedTradeCallback]);

    const handleRemove = async (id) => {
        await removeAutomaticTradeRule(id);
    };

    return (
        <Card className="w-full h-full">
            <CardContent className="p-6 h-full min-h-[600px]">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full flex-col">
                        <p className="text-lg text-destructive">Error loading automated trade rules</p>
                        <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    </div>
                ) : automaticTradeRules.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-lg text-muted-foreground">No automated trade rules found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {automaticTradeRules.map((rule) => (
                            <AutomaticTradeItemCard
                                key={`rule-${rule.id}-${lastUpdate}`}
                                rule={rule}
                                onRemove={handleRemove}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AutomaticTransactionList;