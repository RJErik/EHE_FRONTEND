import {createContext, useContext, useState, useEffect, useRef, useCallback} from 'react';
import { useToast } from '../hooks/use-toast';
import webSocketService from '../services/websocketService';

// Create WebSocket Context
const WebSocketContext = createContext(null);

// Global persistent subscription manager for tracking active subscriptions
const SubscriptionManager = {
    // Active subscription tracking for both types
    activeSubscriptions: {
        chart: null,
        indicator: null
    },

    currentSubscription: {
        platformName: null,
        stockSymbol: null,
        timeframe: null
    },

    // Heartbeat tracking
    lastHeartbeatTime: null,
    heartbeatCount: 0,

    // WebSocket connection state
    isConnected: false,
    userQueueSubscription: null,

    // Track message handlers
    messageHandlers: {
        chart: new Set(),
        indicator: new Set()
    },

    // Pending subscription requests for deduplication
    pendingSubscriptionRequests: {},

    // Store subscription for reuse
    setActiveSubscription(type, id) {
        if (!type || !id) return;

        console.log(`[SubscriptionManager] Setting active ${type} subscription to: ${id}`);
        this.activeSubscriptions[type] = id;
    },

    // Clear active subscription by type
    clearActiveSubscription(type) {
        if (!type) return;

        console.log(`[SubscriptionManager] Clearing active ${type} subscription: ${this.activeSubscriptions[type]}`);
        this.activeSubscriptions[type] = null;
    },

    // Update current symbol/platform/timeframe info
    updateCurrentSubscriptionInfo(details) {
        if (details) {
            this.currentSubscription = { ...details };
            console.log(`[SubscriptionManager] Updated subscription details:`, this.currentSubscription);
        }
    },

    // Register a message handler for a specific type
    registerHandler(type, handler) {
        if (!type || !handler) return () => {};

        console.log(`[SubscriptionManager] Registering new ${type} message handler`);
        this.messageHandlers[type].add(handler);
        return () => this.unregisterHandler(type, handler);
    },

    // Unregister a message handler for a specific type
    unregisterHandler(type, handler) {
        if (!type || !handler) return;

        console.log(`[SubscriptionManager] Unregistering ${type} message handler`);
        this.messageHandlers[type].delete(handler);
    },

    // Record heartbeat information
    recordHeartbeat(subscriptionId) {
        this.lastHeartbeatTime = new Date();
        this.heartbeatCount++;

        const isChartActive = subscriptionId === this.activeSubscriptions.chart;
        const isIndicatorActive = subscriptionId === this.activeSubscriptions.indicator;
        const timestamp = new Date().toISOString().substr(11, 12);

        let subscriptionType = "stale";
        if (isChartActive) subscriptionType = "chart";
        if (isIndicatorActive) subscriptionType = "indicator";

        console.log(`[${timestamp}] Heartbeat #${this.heartbeatCount} for ${subscriptionType} subscription: ${subscriptionId}`);

        // Clean up stale subscriptions that are still sending heartbeats
        if (!isChartActive && !isIndicatorActive && subscriptionId) {
            console.log(`[SubscriptionManager] Cleaning up stale subscription: ${subscriptionId}`);
            webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: subscriptionId
            }).catch(() => {});
        }

        return isChartActive || isIndicatorActive;
    },
};

export function WebSocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const { toast } = useToast();
    const initialized = useRef(false);

    // Global message handler that distributes to appropriate handlers based on subscription ID
    const handleGlobalMessage = (message) => {
        // Parse the message if it's a string
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Track heartbeats
        if (data.updateType === "HEARTBEAT") {
            SubscriptionManager.recordHeartbeat(data.subscriptionId);
            return; // Skip further processing for heartbeats
        }

        // Determine which subscription this message belongs to
        const isChartSubscription = data.subscriptionId === SubscriptionManager.activeSubscriptions.chart;
        const isIndicatorSubscription = data.subscriptionId === SubscriptionManager.activeSubscriptions.indicator;

        // Route message to appropriate handlers
        if (isChartSubscription) {
            console.log(`[WebSocketContext] Routing message to chart handlers for subscription ${data.subscriptionId}`);
            SubscriptionManager.messageHandlers.chart.forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error("[WebSocketContext] Error in chart message handler:", err);
                }
            });
        }
        else if (isIndicatorSubscription) {
            console.log(`[WebSocketContext] Routing message to indicator handlers for subscription ${data.subscriptionId}`);
            SubscriptionManager.messageHandlers.indicator.forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error("[WebSocketContext] Error in indicator message handler:", err);
                }
            });
        }
        // For subscription responses or initial data without known subscription ID
        else if (!data.subscriptionId || data.updateType === undefined) {
            // For new subscriptions, check if we need to parse the response by subscription type
            if (data.subscriptionType === 'CHART') {
                SubscriptionManager.messageHandlers.chart.forEach(handler => {
                    try {
                        handler(data);
                    } catch (err) {
                        console.error("[WebSocketContext] Error in chart message handler:", err);
                    }
                });
            }
            else if (data.subscriptionType === 'INDICATOR') {
                SubscriptionManager.messageHandlers.indicator.forEach(handler => {
                    try {
                        handler(data);
                    } catch (err) {
                        console.error("[WebSocketContext] Error in indicator message handler:", err);
                    }
                });
            }
            // If no type marker is present, send to both (legacy compatibility)
            else {
                console.log("[WebSocketContext] Unidentified message, routing to all handlers");
                [...SubscriptionManager.messageHandlers.chart, ...SubscriptionManager.messageHandlers.indicator].forEach(handler => {
                    try {
                        handler(data);
                    } catch (err) {
                        console.error("[WebSocketContext] Error in shared message handler:", err);
                    }
                });
            }
        }
        else {
            console.log(`[WebSocketContext] Message with unknown subscription ID: ${data.subscriptionId}`);
        }
    };

    // Initialize WebSocket connection
    const initializeWebSocket = async () => {
        if (initialized.current) {
            console.log("[WebSocketContext] Already initialized");
            return;
        }

        try {
            // Connect to WebSocket
            await webSocketService.connect();
            console.log("[WebSocketContext] WebSocket connected globally");
            SubscriptionManager.isConnected = true;
            setIsConnected(true);
            setConnectionError(null);

            // Subscribe to the user queue for candle data
            SubscriptionManager.userQueueSubscription = await webSocketService.subscribe(
                '/user/queue/candles',
                handleGlobalMessage
            );

            initialized.current = true;
            setIsInitialized(true);
            console.log("[WebSocketContext] Global WebSocket initialization complete");
        } catch (err) {
            console.error("[WebSocketContext] Failed to initialize global WebSocket:", err);
            setConnectionError(err.message);
            setIsConnected(false);
            
            toast({
                title: "Connection Error",
                description: "Failed to connect to WebSocket server: " + err.message,
                variant: "destructive",
                duration: 5000
            });
            
            throw err;
        }
    };

    // Request a subscription with deduplication
    const requestSubscription = async (type, details) => {
        if (!type || !details) {
            console.warn(`[WebSocketContext] Missing parameters for ${type} subscription request`);
            return Promise.reject(new Error("Missing subscription parameters"));
        }

        // Create a unique key for this request
        const requestKey = `${type}:${details.platformName}:${details.stockSymbol}:${details.timeframe}:${details.startDate}:${details.endDate}`;

        // If this exact request is already pending, return the existing promise
        if (SubscriptionManager.pendingSubscriptionRequests[requestKey]) {
            console.log(`[WebSocketContext] Duplicate ${type} request detected - reusing existing promise`);
            return SubscriptionManager.pendingSubscriptionRequests[requestKey];
        }

        console.log(`[WebSocketContext] Creating new ${type} subscription request: ${requestKey}`);

        // Create and store the promise
        SubscriptionManager.pendingSubscriptionRequests[requestKey] = (async () => {
            try {
                await webSocketService.send('/app/candles/subscribe', {
                    ...details,
                    subscriptionType: type.toUpperCase()
                });
                console.log(`[WebSocketContext] ${type} subscription request sent successfully`);
                return "pending";
            } catch (err) {
                console.error(`[WebSocketContext] Error making ${type} subscription request:`, err);
                throw err;
            } finally {
                // Clean up after a short delay (to prevent race conditions if the same request comes in)
                setTimeout(() => {
                    delete SubscriptionManager.pendingSubscriptionRequests[requestKey];
                }, 1000);
            }
        })();

        return SubscriptionManager.pendingSubscriptionRequests[requestKey];
    };

    // Explicitly unsubscribe a specific type
    const unsubscribe = async (type) => {
        if (!type || !SubscriptionManager.activeSubscriptions[type]) {
            return Promise.resolve(true);
        }

        try {
            console.log(`[WebSocketContext] Explicitly unsubscribing ${type} subscription: ${SubscriptionManager.activeSubscriptions[type]}`);

            await webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: SubscriptionManager.activeSubscriptions[type]
            });

            SubscriptionManager.clearActiveSubscription(type);
            return true;
        } catch (err) {
            console.error(`[WebSocketContext] Error unsubscribing ${type}:`, err);
            return false;
        }
    };

    // Unsubscribe from all active subscriptions
    const unsubscribeAll = async () => {
        const results = [];

        if (SubscriptionManager.activeSubscriptions.chart) {
            results.push(await unsubscribe('chart'));
        }

        if (SubscriptionManager.activeSubscriptions.indicator) {
            results.push(await unsubscribe('indicator'));
        }

        return results.every(success => success);
    };

    // Connect WebSocket on component mount
    useEffect(() => {
        console.log("[WebSocketContext] Setting up global WebSocket connection");
        
        if (!initialized.current) {
            initializeWebSocket().catch(err => {
                console.error("[WebSocketContext] Initialization error:", err);
            });
        }

        // Cleanup function
        return () => {
            // Note: We intentionally don't disconnect from WebSocket on unmount
            // as we want the connection to persist throughout the app
            console.log("[WebSocketContext] Provider unmounting - keeping connection alive");
        };
    }, []);

    // Disconnect and cleanup WebSocket connections
    const disconnectWebSocket = useCallback(() => {
        if (SubscriptionManager.isConnected) {
            console.log("[WebSocketContext] Explicitly disconnecting from WebSocket");
            
            // First unsubscribe from all active subscriptions
            unsubscribeAll().then(() => {
                console.log("[WebSocketContext] Unsubscribed from all active subscriptions");
                
                // Then unsubscribe from the user queue if it exists
                if (SubscriptionManager.userQueueSubscription) {
                    console.log("[WebSocketContext] Unsubscribing from user queue");
                    webSocketService.unsubscribe('/user/queue/candles');
                    SubscriptionManager.userQueueSubscription = null;
                }
                
                // Finally, disconnect from the WebSocket
                webSocketService.disconnect();
                
                // Update state
                SubscriptionManager.isConnected = false;
                setIsConnected(false);
                initialized.current = false;
                setIsInitialized(false);
                
                console.log("[WebSocketContext] Successfully disconnected from WebSocket");
            }).catch(err => {
                console.error("[WebSocketContext] Error during disconnect:", err);
                // Still try to disconnect even if unsubscribe fails
                webSocketService.disconnect();
                SubscriptionManager.isConnected = false;
                setIsConnected(false);
                initialized.current = false;
                setIsInitialized(false);
            });
        } else {
            console.log("[WebSocketContext] Already disconnected from WebSocket");
        }
    }, [unsubscribeAll]);

    // Context value containing the WebSocket state and operations
    const contextValue = {
        isConnected,
        connectionError,
        isInitialized,
        
        // Methods to manage subscriptions
        registerHandler: SubscriptionManager.registerHandler.bind(SubscriptionManager),
        unregisterHandler: SubscriptionManager.unregisterHandler.bind(SubscriptionManager),
        requestSubscription,
        unsubscribe,
        unsubscribeAll,
        disconnectWebSocket,
        setActiveSubscription: SubscriptionManager.setActiveSubscription.bind(SubscriptionManager),
        clearActiveSubscription: SubscriptionManager.clearActiveSubscription.bind(SubscriptionManager),
        updateCurrentSubscriptionInfo: SubscriptionManager.updateCurrentSubscriptionInfo.bind(SubscriptionManager),
        
        // Expose subscription IDs and current subscription details
        subscriptionIds: SubscriptionManager.activeSubscriptions,
        currentSubscription: SubscriptionManager.currentSubscription,
        
        // Direct access to WebSocket service
        webSocketService
    };

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
}

// Custom hook to use the WebSocket context
export function useWebSocket() {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}

export { WebSocketContext };