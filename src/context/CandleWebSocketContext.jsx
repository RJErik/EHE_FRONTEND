import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../hooks/use-toast';
import webSocketService from '../services/websocketService';

// Create WebSocket Context
const CandleWebSocketContext = createContext(null);

const SubscriptionManager = {
    activeSubscription: null,

    // Current subscription details
    currentSubscription: {
        platformName: null,
        stockSymbol: null,
        timeframe: null
    },

    // Latest candle info from WebSocket
    latestCandleInfo: {
        sequence: null,
        timestamp: null,
        candle: null
    },

    // WebSocket connection state
    isConnected: false,
    userQueueSubscription: null,

    messageHandlers: new Set(),

    pendingRequests: {},

    awaitingActivation: false,

    reactStateUpdaters: {
        setActiveSubscriptionId: null,
        setCurrentSubscriptionDetails: null,
        setLatestCandleInfo: null
    },

    setActiveSubscription(id) {
        if (!id) return;
        console.log(`[SubscriptionManager] Setting active subscription: ${id}`);
        this.activeSubscription = id;

        if (this.reactStateUpdaters.setActiveSubscriptionId) {
            this.reactStateUpdaters.setActiveSubscriptionId(id);
        }
    },

    clearActiveSubscription() {
        console.log(`[SubscriptionManager] Clearing active subscription`);
        this.activeSubscription = null;
        this.latestCandleInfo = { sequence: null, timestamp: null, candle: null };

        if (this.reactStateUpdaters.setActiveSubscriptionId) {
            this.reactStateUpdaters.setActiveSubscriptionId(null);
        }
        if (this.reactStateUpdaters.setLatestCandleInfo) {
            this.reactStateUpdaters.setLatestCandleInfo({ sequence: null, timestamp: null, candle: null });
        }
    },

    updateCurrentSubscriptionInfo(details) {
        if (details) {
            this.currentSubscription = { ...details };
            console.log(`[SubscriptionManager] Updated subscription details:`, this.currentSubscription);

            if (this.reactStateUpdaters.setCurrentSubscriptionDetails) {
                this.reactStateUpdaters.setCurrentSubscriptionDetails({ ...details });
            }
        }
    },

    updateLatestCandleInfo(info) {
        this.latestCandleInfo = { ...info };

        if (this.reactStateUpdaters.setLatestCandleInfo) {
            this.reactStateUpdaters.setLatestCandleInfo({ ...info });
        }
    },

    registerHandler(handler) {
        if (!handler) return () => {};
        this.messageHandlers.add(handler);
        return () => this.unregisterHandler(handler);
    },

    unregisterHandler(handler) {
        if (handler) {
            this.messageHandlers.delete(handler);
        }
    },

    broadcastMessage(data) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error("[SubscriptionManager] Error in message handler:", err);
            }
        });
    }
};

export function WebSocketProvider({ children, currentPage }) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const [activeSubscriptionId, setActiveSubscriptionId] = useState(null);
    const [currentSubscriptionDetails, setCurrentSubscriptionDetails] = useState({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });
    const [latestCandleInfo, setLatestCandleInfo] = useState({
        sequence: null,
        timestamp: null,
        candle: null
    });

    const { toast } = useToast();
    const initialized = useRef(false);

    // Sync SubscriptionManager with React state
    useEffect(() => {
        SubscriptionManager.reactStateUpdaters.setActiveSubscriptionId = setActiveSubscriptionId;
        SubscriptionManager.reactStateUpdaters.setCurrentSubscriptionDetails = setCurrentSubscriptionDetails;
        SubscriptionManager.reactStateUpdaters.setLatestCandleInfo = setLatestCandleInfo;

        if (SubscriptionManager.activeSubscription) {
            setActiveSubscriptionId(SubscriptionManager.activeSubscription);
        }
        if (SubscriptionManager.currentSubscription.platformName) {
            setCurrentSubscriptionDetails({ ...SubscriptionManager.currentSubscription });
        }

        return () => {
            SubscriptionManager.reactStateUpdaters.setActiveSubscriptionId = null;
            SubscriptionManager.reactStateUpdaters.setCurrentSubscriptionDetails = null;
            SubscriptionManager.reactStateUpdaters.setLatestCandleInfo = null;
        };
    }, []);

    // Handle incoming WebSocket messages
    const handleGlobalMessage = useCallback((message) => {
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Handle subscription confirmation response
        if (data.success !== undefined && data.subscription?.subscriptionId) {
            const subscriptionResponse = data.subscription;

            if (SubscriptionManager.awaitingActivation) {
                SubscriptionManager.setActiveSubscription(subscriptionResponse.subscriptionId);
                SubscriptionManager.awaitingActivation = false;

                console.log('[WebSocketContext] Subscription activated:', subscriptionResponse.subscriptionId);
                SubscriptionManager.broadcastMessage({
                    type: 'SUBSCRIPTION_CONFIRMED',
                    subscriptionId: subscriptionResponse.subscriptionId,
                    ...data
                });
            }
            return;
        }

        // Handle unsubscription response
        if (data.success !== undefined && data.subscriptionId?.subscriptionId) {
            const unsubResponse = data.subscriptionId;
            if (SubscriptionManager.activeSubscription === unsubResponse.subscriptionId) {
                SubscriptionManager.clearActiveSubscription();
            }
            console.log('[WebSocketContext] Unsubscription confirmed:', unsubResponse.subscriptionId);
            return;
        }

        // Handle heartbeats
        if (data.updateType === "HEARTBEAT") {
            const timestamp = new Date().toISOString().substr(11, 12);
            console.log(`[${timestamp}] Heartbeat received for subscription: ${data.subscriptionId}`);
            return;
        }

        // Handle INITIAL candle
        if (data.updateType === "INITIAL" && data.updatedCandles?.length > 0) {
            const latestCandle = data.updatedCandles[data.updatedCandles.length - 1];

            console.log('[WebSocketContext] Received INITIAL candle:', {
                sequence: latestCandle.sequence,
                timestamp: latestCandle.timestamp
            });

            // Update latest candle info
            SubscriptionManager.updateLatestCandleInfo({
                sequence: latestCandle.sequence,
                timestamp: new Date(latestCandle.timestamp + 'Z').getTime(),
                candle: latestCandle
            });

            // Broadcast to handlers
            SubscriptionManager.broadcastMessage({
                type: 'INITIAL_CANDLE',
                subscriptionId: data.subscriptionId,
                candle: latestCandle,
                sequence: latestCandle.sequence
            });
            return;
        }

        // Handle UPDATE candles
        if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            const candles = data.updatedCandles;
            const latestCandle = candles[candles.length - 1];

            console.log('[WebSocketContext] Received UPDATE:', {
                candleCount: candles.length,
                latestSequence: latestCandle.sequence,
                latestTimestamp: latestCandle.timestamp
            });

            // Update latest candle info
            SubscriptionManager.updateLatestCandleInfo({
                sequence: latestCandle.sequence,
                timestamp: new Date(latestCandle.timestamp + 'Z').getTime(),
                candle: latestCandle
            });
            
            const previousLatest = SubscriptionManager.latestCandleInfo;
            const isNewCandle = !previousLatest.sequence || latestCandle.sequence > previousLatest.sequence;

            // Broadcast to handlers
            SubscriptionManager.broadcastMessage({
                type: isNewCandle ? 'NEW_CANDLE' : 'CANDLE_UPDATE',
                subscriptionId: data.subscriptionId,
                candles: candles,
                latestSequence: latestCandle.sequence,
                isNewCandle
            });
            return;
        }
        
        if (data.subscriptionId === SubscriptionManager.activeSubscription) {
            SubscriptionManager.broadcastMessage(data);
        }
    }, []);

    // Initialize WebSocket connection
    const initializeWebSocket = async () => {
        if (initialized.current) {
            console.log("[WebSocketContext] Already initialized");
            return;
        }

        try {
            await webSocketService.connect();
            console.log("[WebSocketContext] WebSocket connected");
            SubscriptionManager.isConnected = true;
            setIsConnected(true);
            setConnectionError(null);

            // Subscribe to user queue for candle updates
            SubscriptionManager.userQueueSubscription = await webSocketService.subscribe(
                '/user/queue/candles',
                handleGlobalMessage
            );

            initialized.current = true;
            setIsInitialized(true);
            console.log("[WebSocketContext] WebSocket initialization complete");
        } catch (err) {
            console.error("[WebSocketContext] Failed to initialize WebSocket:", err);
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

    /**
     * Subscribe to live candle updates for a symbol/timeframe
     */
    const subscribeToCandleUpdates = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn('[WebSocketContext] Missing parameters for subscription');
            return Promise.reject(new Error("Missing subscription parameters"));
        }

        // Check if already subscribed to the same
        if (
            SubscriptionManager.activeSubscription &&
            SubscriptionManager.currentSubscription.platformName === platformName &&
            SubscriptionManager.currentSubscription.stockSymbol === stockSymbol &&
            SubscriptionManager.currentSubscription.timeframe === timeframe
        ) {
            console.log('[WebSocketContext] Already subscribed to this symbol/timeframe');
            return SubscriptionManager.activeSubscription;
        }

        // Create deduplication key
        const requestKey = `subscribe:${platformName}:${stockSymbol}:${timeframe}`;

        if (SubscriptionManager.pendingRequests[requestKey]) {
            console.log('[WebSocketContext] Duplicate request detected, reusing existing promise');
            return SubscriptionManager.pendingRequests[requestKey];
        }

        console.log('[WebSocketContext] Creating subscription request:', { platformName, stockSymbol, timeframe });

        SubscriptionManager.pendingRequests[requestKey] = (async () => {
            try {
                if (SubscriptionManager.activeSubscription) {
                    await unsubscribeFromCandleUpdates();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                SubscriptionManager.awaitingActivation = true;
                SubscriptionManager.updateCurrentSubscriptionInfo({ platformName, stockSymbol, timeframe });

                await webSocketService.send('/app/candles/subscribe', {
                    platformName,
                    stockSymbol,
                    timeframe
                });

                console.log('[WebSocketContext] Subscription request sent');
                return "pending";
            } catch (err) {
                console.error('[WebSocketContext] Error subscribing:', err);
                SubscriptionManager.awaitingActivation = false;
                throw err;
            } finally {
                setTimeout(() => {
                    delete SubscriptionManager.pendingRequests[requestKey];
                }, 1000);
            }
        })();

        return SubscriptionManager.pendingRequests[requestKey];
    }, []);

    /**
     * Unsubscribe from live candle updates
     */
    const unsubscribeFromCandleUpdates = useCallback(async () => {
        if (!SubscriptionManager.activeSubscription) {
            console.log('[WebSocketContext] No active subscription to unsubscribe from');
            return true;
        }

        try {
            const id = SubscriptionManager.activeSubscription;
            console.log('[WebSocketContext] Unsubscribing from:', id);

            await webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: id
            });

            SubscriptionManager.clearActiveSubscription();
            return true;
        } catch (err) {
            console.error('[WebSocketContext] Error unsubscribing:', err);
            return false;
        }
    }, []);

    // Connect WebSocket on mount
    useEffect(() => {
        console.log("[WebSocketContext] Setting up WebSocket connection");

        if (!initialized.current) {
            initializeWebSocket().catch(err => {
                console.error("[WebSocketContext] Initialization error:", err);
            });
        }

        return () => {
            console.log("[WebSocketContext] Provider unmounting - cleaning up");

            // Unsubscribe from active candle subscription
            if (SubscriptionManager.activeSubscription) {
                console.log('[WebSocketContext] Unsubscribing from active subscription:',
                    SubscriptionManager.activeSubscription);
                webSocketService.safeSend('/app/candles/unsubscribe', {
                    subscriptionId: SubscriptionManager.activeSubscription
                });
            }

            // Unsubscribe from user queue
            if (SubscriptionManager.userQueueSubscription) {
                console.log('[WebSocketContext] Unsubscribing from user queue');
                webSocketService.unsubscribe('/user/queue/candles');
                SubscriptionManager.userQueueSubscription = null;  // ✅ Reset ref
            }

            // Clear all message handlers
            SubscriptionManager.messageHandlers.clear();

            // Clear pending requests
            SubscriptionManager.pendingRequests = {};

            // Reset SubscriptionManager state
            SubscriptionManager.clearActiveSubscription();
            SubscriptionManager.currentSubscription = {
                platformName: null,
                stockSymbol: null,
                timeframe: null
            };
            SubscriptionManager.awaitingActivation = false;
            SubscriptionManager.isConnected = false;

            // Reset initialization flag
            initialized.current = false;

            console.log("[WebSocketContext] Cleanup complete");
        };
    }, []);

    const contextValue = {
        // Connection state
        isConnected,
        connectionError,
        isInitialized,

        // Subscription management
        subscribeToCandleUpdates,
        unsubscribeFromCandleUpdates,

        // Handler registration
        registerHandler: (handler) => SubscriptionManager.registerHandler(handler),
        unregisterHandler: (handler) => SubscriptionManager.unregisterHandler(handler),

        // Current state
        activeSubscriptionId,
        currentSubscription: currentSubscriptionDetails,
        latestCandleInfo,

        // Direct access
        webSocketService,
        currentPage
    };

    return (
        <CandleWebSocketContext.Provider value={contextValue}>
            {children}
        </CandleWebSocketContext.Provider>
    );
}

// Custom hook
export function useWebSocket() {
    const context = useContext(CandleWebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}

export { CandleWebSocketContext };