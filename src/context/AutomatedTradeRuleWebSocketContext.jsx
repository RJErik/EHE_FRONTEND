import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '../hooks/use-toast';
import webSocketService from '../services/websocketService';

// Create context
const AutomatedTradeRuleWebSocketContext = createContext(null);

export function AutomatedTradeWebSocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const subscriptionIdRef = useRef(null);
    const subscribedCallbacks = useRef([]);
    const { toast } = useToast();

    // Connect to WebSocket and subscribe to automated trades
    useEffect(() => {
        console.log('[AutomatedTradeWebSocket] Setting up connection and subscription');

        const setupConnection = async () => {
            try {
                await webSocketService.connect();
                setIsConnected(true);
                console.log('[AutomatedTradeWebSocket] Connected to WebSocket');

                // After connecting, create a subscription for automated trade notifications
                subscribeToAutomatedTrades();
            } catch (err) {
                console.error('[AutomatedTradeWebSocket] Connection error:', err);
                setIsConnected(false);
            }
        };

        setupConnection();

        // Cleanup function
        return () => {
            console.log('[AutomatedTradeWebSocket] Cleaning up...');

            // Unsubscribe using the ref value (not stale state)
            if (subscriptionIdRef.current) {
                console.log('[AutomatedTradeWebSocket] Unsubscribing with ID:', subscriptionIdRef.current);

                // Send unsubscription request
                webSocketService.safeSend(
                    '/app/automated-trades/unsubscribe',
                    { subscriptionId: subscriptionIdRef.current }
                );
            }

            // Unsubscribe from the destination
            webSocketService.unsubscribe('/user/queue/automated-trades');

            console.log('[AutomatedTradeWebSocket] Cleanup complete');
        };
    }, []);

    // Function to subscribe to automated trades
    const subscribeToAutomatedTrades = async () => {
        if (subscriptionIdRef.current) {
            console.log('[AutomatedTradeWebSocket] Already subscribed');
            return;
        }

        try {
            console.log('[AutomatedTradeWebSocket] Subscribing to automated trades');

            // Send subscription request
            await webSocketService.send(
                '/app/automated-trades/subscribe',
                {}
            );
            webSocketService.subscribe('/user/queue/automated-trades', (data) => {
                console.log('[AutomatedTradeWebSocket] Received message:', data);

                // Handle trade notifications
                if (data.automatedTradeRuleId) {
                    console.log('[AutomatedTradeWebSocket] Received trade notification');

                    toast({
                        title: data.success ? "Automated Trade Executed" : "Automated Trade Failed",
                        description: data.message,
                        variant: data.success ? "default" : "destructive"
                    });

                    // Notify all registered callbacks
                    notifySubscribers(data);
                }

                // This is a subscription confirmation
                if (data.subscriptionId && !subscriptionIdRef.current) {
                    const actualSubscriptionId = data.subscriptionId.subscriptionId;

                    console.log('[AutomatedTradeWebSocket] Subscription confirmed:', actualSubscriptionId);

                    subscriptionIdRef.current = actualSubscriptionId;
                    setIsSubscribed(true);
                }
            });

            console.log('[AutomatedTradeWebSocket] Subscription request sent');
        } catch (err) {
            console.error('[AutomatedTradeWebSocket] Subscription error:', err);
            toast({
                title: "WebSocket Error",
                description: "Failed to subscribe to automated trade notifications",
                variant: "destructive"
            });
        }
    };

    // Register a callback to be notified of automated trade events
    const registerAutomatedTradeCallback = useCallback((callback) => {
        if (typeof callback !== 'function') {
            console.error('[AutomatedTradeWebSocket] Attempted to register non-function callback');
            return () => {};
        }

        console.log('[AutomatedTradeWebSocket] Registering callback');
        subscribedCallbacks.current.push(callback);

        return () => {
            console.log('[AutomatedTradeWebSocket] Unregistering callback');
            subscribedCallbacks.current = subscribedCallbacks.current.filter(cb => cb !== callback);
        };
    }, []);

    // Notify all registered callbacks of an event
    const notifySubscribers = (data) => {
        console.log(`[AutomatedTradeWebSocket] Notifying ${subscribedCallbacks.current.length} subscribers`);
        subscribedCallbacks.current.forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error('[AutomatedTradeWebSocket] Error in subscriber callback:', err);
            }
        });
    };

    // Create context value
    const contextValue = {
        isConnected,
        isSubscribed,
        subscriptionId: subscriptionIdRef.current,
        registerAutomatedTradeCallback
    };

    return (
        <AutomatedTradeRuleWebSocketContext.Provider value={contextValue}>
            {children}
        </AutomatedTradeRuleWebSocketContext.Provider>
    );
}

// Hook to use the automated trade WebSocket context
export function useAutomatedTradeWebSocket() {
    const context = useContext(AutomatedTradeRuleWebSocketContext);
    if (!context) {
        throw new Error('useAutomatedTradeWebSocket must be used within an AutomatedTradeWebSocketProvider');
    }
    return context;
}