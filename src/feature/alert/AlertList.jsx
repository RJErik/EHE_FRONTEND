import { Card, CardContent } from "../../components/ui/card.jsx";
import { useAlert } from "../../context/AlertsContext.jsx";
import { useAlertWebSocket } from "../../context/AlertWebSocketContext.jsx";
import { Loader2 } from "lucide-react";
import AlertItemCard from "./AlertItemCard.jsx";
import { useEffect, useCallback, useRef } from "react";

const AlertList = () => {
    const { alerts, isLoading, error, removeAlert, refreshLatestSearch, lastUpdate } = useAlert();
    const { registerAlertCallback } = useAlertWebSocket();

    const alertCallback = useCallback(() => {
        console.log('[AlertList] Received alert notification, refreshing list');
        refreshLatestSearch();
    }, [refreshLatestSearch]);

    const callbackRef = useRef(alertCallback);

    useEffect(() => {
        callbackRef.current = alertCallback;
    }, [alertCallback]);

    useEffect(() => {
        console.log("Registering for alert notifications");
        const unregister = registerAlertCallback(() => callbackRef.current());

        return () => {
            console.log("Unregistering from alert notifications");
            unregister();
        };
    }, [registerAlertCallback]);

    return (
        <Card className="w-full h-full">
            <CardContent className="p-6 h-full min-h-[600px]">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full flex-col">
                        <p className="text-lg text-destructive">Error loading alerts</p>
                        <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-lg text-muted-foreground">No alerts found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <AlertItemCard
                                key={`alert-${alert.id}-${lastUpdate}`}
                                alert={alert}
                                onRemove={removeAlert}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AlertList;
