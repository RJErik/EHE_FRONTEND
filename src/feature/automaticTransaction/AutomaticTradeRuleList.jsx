import { Card, CardContent } from "../../components/ui/card.jsx";
import { useAutomaticTradeContext } from "../../context/AutomaticTradeRulesContext.jsx";
import { useAutomatedTradeWebSocket } from "../../context/AutomatedTradeRuleWebSocketContext.jsx";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import AutomaticTradeRuleItemCard from "./AutomaticTradeRuleItemCard.jsx";

const AutomaticTradeRuleList = () => {
    const { automaticTradeRules, isLoading, error, removeAutomaticTradeRule, fetchAutomaticTradeRules, refreshLatestSearch, lastUpdate } = useAutomaticTradeContext();
    const { registerAutomatedTradeCallback } = useAutomatedTradeWebSocket();

    // Use a ref to prevent multiple fetches on initial render
    const initialFetchDoneRef = useRef(false);

    // Fetch automatic trade rules only on initial mount
    useEffect(() => {
        if (!initialFetchDoneRef.current) {
            console.log("AutomaticTradeRuleList mounted - fetching rules");
            fetchAutomaticTradeRules();
            initialFetchDoneRef.current = true;
        }
    }, [fetchAutomaticTradeRules]);

    // Memoize the callback to prevent effect regeneration
    const automatedTradeCallback = useCallback((tradeNotification) => {
        console.log('[AutomaticTradeRuleList] Received automated trade notification, refreshing list');
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
                            <AutomaticTradeRuleItemCard
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

export default AutomaticTradeRuleList;