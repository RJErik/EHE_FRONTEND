// src/components/alert/AlertsList.jsx
import { Card, CardContent } from "../../components/ui/card.jsx";
import { useAlert } from "../../context/AlertContext.jsx";
import { useAlertWebSocket } from "../../context/AlertWebSocketContext.jsx";
import { Loader2 } from "lucide-react";
import AlertItemCard from "./AlertItemCard.jsx";
import { useEffect, useCallback, useRef } from "react";

const AlertsList = () => {
    const { alerts, isLoading, error, removeAlert, fetchAlerts, refreshLatestSearch, lastUpdate } = useAlert();
    const { registerAlertCallback } = useAlertWebSocket();

    // Use a ref to prevent multiple fetches on initial render
    const initialFetchDoneRef = useRef(false);

    // Fetch alerts only on initial mount
    useEffect(() => {
        if (!initialFetchDoneRef.current) {
            console.log("AlertsList mounted - fetching alerts");
            fetchAlerts();
            initialFetchDoneRef.current = true;
        }
    }, [fetchAlerts]);

    // Memoize the alert callback to prevent effect regeneration
    const alertCallback = useCallback((alertMessage) => {
        console.log('[AlertsList] Received alert notification, refreshing list');
        refreshLatestSearch();
    }, [refreshLatestSearch]);

    // Register for alert notifications once
    useEffect(() => {
        console.log("Registering for alert notifications");
        const unregister = registerAlertCallback(alertCallback);

        return () => {
            console.log("Unregistering from alert notifications");
            unregister();
        };
    }, [registerAlertCallback, alertCallback]);

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

export default AlertsList;
