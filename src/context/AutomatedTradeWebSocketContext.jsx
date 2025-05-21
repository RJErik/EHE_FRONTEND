// src/context/AutomatedTradeWebSocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '../hooks/use-toast';
import webSocketService from '../services/websocketService';

// Create context
const AutomatedTradeWebSocketContext = createContext(null);

export function AutomatedTradeWebSocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState(null);
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
            // Don't disconnect as other components might be using the WebSocket
            if (subscriptionId) {
                unsubscribeFromAutomatedTrades();
            }
        };
    }, []);

    // Function to subscribe to automated trades
    const subscribeToAutomatedTrades = async () => {
        if (isSubscribed) {
            console.log('[AutomatedTradeWebSocket] Already subscribed');
            return;
        }

        try {
            console.log('[AutomatedTradeWebSocket] Subscribing to automated trades');

            // Send subscription request
            const response = await webSocketService.send(
                '/app/automated-trades/subscribe',
                {}
            );

            // After sending the request, we expect a message to be sent to our user destination
            // This is handled in the WebSocketService message handling

            // Set up a destination subscription for receiving messages
            webSocketService.subscribe('/user/queue/automated-trades', (data) => {
                console.log('[AutomatedTradeWebSocket] Received message:', data);

                // Handle trade notifications
                if (data.automatedTradeRuleId) {
                    console.log('[AutomatedTradeWebSocket] Received trade notification');

                    // Show toast notification
                    toast({
                        title: data.success ? "Automated Trade Executed" : "Automated Trade Failed",
                        description: data.message,
                        variant: data.success ? "default" : "destructive"
                    });

                    // Notify all registered callbacks
                    notifySubscribers(data);
                }

                // If this is the subscription confirmation
                if (data.subscriptionId && !subscriptionId) {
                    console.log('[AutomatedTradeWebSocket] Subscription confirmed:', data.subscriptionId);
                    setSubscriptionId(data.subscriptionId);
                    setIsSubscribed(true);
                    return;
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

    // Function to unsubscribe from automated trades
    const unsubscribeFromAutomatedTrades = async () => {
        if (!isSubscribed || !subscriptionId) {
            console.log('[AutomatedTradeWebSocket] Not currently subscribed');
            return;
        }

        try {
            console.log('[AutomatedTradeWebSocket] Unsubscribing from automated trades');

            // Send unsubscription request
            await webSocketService.send(
                '/app/automated-trades/unsubscribe',
                { subscriptionId }
            );

            // Unsubscribe from the destination
            webSocketService.unsubscribe('/user/queue/automated-trades');

            setSubscriptionId(null);
            setIsSubscribed(false);
            console.log('[AutomatedTradeWebSocket] Unsubscribed successfully');
        } catch (err) {
            console.error('[AutomatedTradeWebSocket] Unsubscription error:', err);
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

        // Return unregister function
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
        subscriptionId,
        registerAutomatedTradeCallback
    };

    return (
        <AutomatedTradeWebSocketContext.Provider value={contextValue}>
            {children}
        </AutomatedTradeWebSocketContext.Provider>
    );
}

// Hook to use the automated trade WebSocket context
export function useAutomatedTradeWebSocket() {
    const context = useContext(AutomatedTradeWebSocketContext);
    if (!context) {
        throw new Error('useAutomatedTradeWebSocket must be used within an AutomatedTradeWebSocketProvider');
    }
    return context;
}