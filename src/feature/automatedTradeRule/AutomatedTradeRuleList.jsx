import { Card, CardContent } from "../../components/ui/card.jsx";
import { useAutomatedTradeRuleContext } from "../../context/AutomatedTradeRulesContext.jsx";
import { useAutomatedTradeWebSocket } from "../../context/AutomatedTradeRuleWebSocketContext.jsx";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import AutomatedTradeRuleItemCard from "./AutomatedTradeRuleItemCard.jsx";

const AutomatedTradeRuleList = () => {
    const { automaticTradeRules, isLoading, error, removeAutomaticTradeRule, refreshLatestSearch, lastUpdate } = useAutomatedTradeRuleContext();
    const { registerAutomatedTradeCallback } = useAutomatedTradeWebSocket();

    const callbackRef = useRef(() => {
        console.log('[AutomatedTradeRuleList] Received automated trade notification, refreshing list');
    });

    useEffect(() => {
        callbackRef.current = () => {
            console.log('[AutomatedTradeRuleList] Received automated trade notification, refreshing list');
            refreshLatestSearch();
        };
    }, [refreshLatestSearch]);

    useEffect(() => {
        console.log("Registering for automated trade notifications");
        const unregister = registerAutomatedTradeCallback(() => callbackRef.current());

        return () => {
            console.log("Unregistering from automated trade notifications");
            unregister();
        };
    }, [registerAutomatedTradeCallback]);

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
                            <AutomatedTradeRuleItemCard
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

export default AutomatedTradeRuleList;