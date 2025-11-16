// src/context/CandleWebSocketContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '../hooks/use-toast';
import webSocketService from '../services/websocketService';

// Create WebSocket Context
const CandleWebSocketContext = createContext(null);

// Global persistent subscription manager for tracking active subscription
const SubscriptionManager = {
    // Single active subscription (chart only)
    activeSubscription: null,

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

    // Track message handlers (single subscription - chart only)
    messageHandlers: new Set(),

    // Pending subscription requests for deduplication
    pendingSubscriptionRequests: {},

    // Track if we're awaiting activation
    awaitingActivation: false,

    // Track pending unsubscribe request ID
    pendingUnsubscribeId: null,

    // React state updaters (will be set by the provider)
    reactStateUpdaters: {
        setActiveSubscriptionId: null,
        setCurrentSubscriptionDetails: null
    },

    // Store subscription for reuse
    setActiveSubscription(id) {
        if (!id) return;

        console.log(`[SubscriptionManager] Setting active subscription to: ${id}`);
        this.activeSubscription = id;

        // Update React state if updater is available
        if (this.reactStateUpdaters.setActiveSubscriptionId) {
            this.reactStateUpdaters.setActiveSubscriptionId(id);
        }
    },

    // Clear active subscription
    clearActiveSubscription() {
        console.log(`[SubscriptionManager] Clearing active subscription: ${this.activeSubscription}`);
        this.activeSubscription = null;

        // Update React state if updater is available
        if (this.reactStateUpdaters.setActiveSubscriptionId) {
            this.reactStateUpdaters.setActiveSubscriptionId(null);
        }
    },

    // Update current symbol/platform/timeframe info
    updateCurrentSubscriptionInfo(details) {
        if (details) {
            this.currentSubscription = { ...details };
            console.log(`[SubscriptionManager] Updated subscription details:`, this.currentSubscription);

            // Update React state if updater is available
            if (this.reactStateUpdaters.setCurrentSubscriptionDetails) {
                this.reactStateUpdaters.setCurrentSubscriptionDetails({ ...details });
            }
        }
    },

    // Register a message handler
    registerHandler(handler) {
        if (!handler) return () => {};

        this.messageHandlers.add(handler);
        return () => this.unregisterHandler(handler);
    },

    // Unregister a message handler
    unregisterHandler(handler) {
        if (!handler) return;

        this.messageHandlers.delete(handler);
    },

    // Record heartbeat information
    recordHeartbeat(subscriptionId) {
        this.lastHeartbeatTime = new Date();
        this.heartbeatCount++;

        const isActive = subscriptionId === this.activeSubscription;
        const timestamp = new Date().toISOString().substr(11, 12);

        const subscriptionType = isActive ? "chart" : "stale";

        console.log(`[${timestamp}] Heartbeat #${this.heartbeatCount} for ${subscriptionType} subscription: ${subscriptionId}`);

        // Clean up stale subscriptions that are still sending heartbeats
        if (!isActive && subscriptionId) {
            console.log("[SubscriptionManager] Cleaning up stale subscription with ID:", subscriptionId);
            webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: subscriptionId
            }).catch(() => {});
        }

        return isActive;
    },

    // Broadcast message to all handlers
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

    // ✅ React state for subscription tracking
    const [activeSubscriptionId, setActiveSubscriptionId] = useState(null);
    const [currentSubscriptionDetails, setCurrentSubscriptionDetails] = useState({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    const { toast } = useToast();
    const initialized = useRef(false);

    // ✅ Sync SubscriptionManager with React state
    useEffect(() => {
        SubscriptionManager.reactStateUpdaters.setActiveSubscriptionId = setActiveSubscriptionId;
        SubscriptionManager.reactStateUpdaters.setCurrentSubscriptionDetails = setCurrentSubscriptionDetails;

        // Sync initial state if SubscriptionManager already has values
        if (SubscriptionManager.activeSubscription) {
            setActiveSubscriptionId(SubscriptionManager.activeSubscription);
        }
        if (SubscriptionManager.currentSubscription.platformName) {
            setCurrentSubscriptionDetails({ ...SubscriptionManager.currentSubscription });
        }

        return () => {
            SubscriptionManager.reactStateUpdaters.setActiveSubscriptionId = null;
            SubscriptionManager.reactStateUpdaters.setCurrentSubscriptionDetails = null;
        };
    }, []);

    // Handle incoming WebSocket messages
    const handleGlobalMessage = (message) => {
        // Parse the message if it's a string
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Handle subscription/unsubscription/update responses (wrapped in success/message structure)
        if (data.success !== undefined) {
            // Handle subscription response
            if (data.subscription && data.subscription.subscriptionId) {
                const subscriptionResponse = data.subscription;

                // Only activate if we actually requested this subscription
                if (SubscriptionManager.awaitingActivation) {
                    SubscriptionManager.setActiveSubscription(subscriptionResponse.subscriptionId);
                    SubscriptionManager.awaitingActivation = false;

                    console.log('[SubscriptionManager] Subscription activated:', subscriptionResponse.subscriptionId);

                    // Broadcast to handlers with the full response
                    const responseData = {
                        ...data,
                        subscriptionId: subscriptionResponse.subscriptionId,
                        subscriptionType: subscriptionResponse.subscriptionType
                    };

                    SubscriptionManager.broadcastMessage(responseData);
                } else {
                    console.log('[SubscriptionManager] Ignoring unsolicited subscription activation:', subscriptionResponse.subscriptionId);
                }
                return;
            }

            // Handle unsubscription response
            if (data.subscriptionId && data.subscriptionId.subscriptionId) {
                const unsubResponse = data.subscriptionId;

                // Clear if this matches our pending unsubscribe
                if (SubscriptionManager.pendingUnsubscribeId === unsubResponse.subscriptionId) {
                    if (SubscriptionManager.activeSubscription === unsubResponse.subscriptionId) {
                        SubscriptionManager.clearActiveSubscription();
                    }
                    SubscriptionManager.pendingUnsubscribeId = null;
                }
                // Fallback: clear if it matches our active subscription
                else if (SubscriptionManager.activeSubscription === unsubResponse.subscriptionId) {
                    SubscriptionManager.clearActiveSubscription();
                }

                console.log('[SubscriptionManager] Unsubscription confirmed:', unsubResponse.subscriptionId);
                return;
            }

            // Handle general responses - broadcast to all handlers
            SubscriptionManager.broadcastMessage(data);
            return;
        }

        // Handle heartbeats
        if (data.updateType === "HEARTBEAT") {
            SubscriptionManager.recordHeartbeat(data.subscriptionId);
            return;
        }

        // Determine if this message belongs to our active subscription
        const isActiveSubscription = data.subscriptionId === SubscriptionManager.activeSubscription;

        // Route message to handlers
        if (isActiveSubscription) {
            console.log(`[WebSocketContext] Routing message to handlers for subscription ${data.subscriptionId}`);
            SubscriptionManager.broadcastMessage(data);
        }
        // Handle initial data responses or messages without known subscription ID
        else if (!data.subscriptionId || data.updateType === undefined) {
            console.log("[WebSocketContext] Received message without subscription ID - broadcasting");
            SubscriptionManager.broadcastMessage(data);
        }
        else {
            console.log(`[WebSocketContext] Message with unknown subscription ID: ${data.subscriptionId}`);
        }
    };

    // Initialize WebSocket connection
    const initializeWebSocket = async () => {
        if (initialized.current) {
            console.log("[CandleWebSocketContext] Already initialized");
            return;
        }

        try {
            // Connect to WebSocket
            await webSocketService.connect();
            console.log("[CandleWebSocketContext] WebSocket connected globally");
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
            console.log("[CandleWebSocketContext] Global WebSocket initialization complete");
        } catch (err) {
            console.error("[CandleWebSocketContext] Failed to initialize global WebSocket:", err);
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
        if (!details) {
            console.warn(`[WebSocketContext] Missing parameters for subscription request`);
            return Promise.reject(new Error("Missing subscription parameters"));
        }

        // Create a unique key for this request
        const requestKey = `${type}:${details.platformName}:${details.stockSymbol}:${details.timeframe}:${details.startDate}:${details.endDate}`;

        // If this exact request is already pending, return the existing promise
        if (SubscriptionManager.pendingSubscriptionRequests[requestKey]) {
            console.log(`[WebSocketContext] Duplicate request detected - reusing existing promise`);
            return SubscriptionManager.pendingSubscriptionRequests[requestKey];
        }

        console.log(`[WebSocketContext] Creating new subscription request: ${requestKey}`);

        // Create and store the promise
        SubscriptionManager.pendingSubscriptionRequests[requestKey] = (async () => {
            try {
                // Mark that we're awaiting activation
                SubscriptionManager.awaitingActivation = true;

                await webSocketService.send('/app/candles/subscribe', {
                    ...details,
                    subscriptionType: 'CHART'
                });

                console.log(`[WebSocketContext] Subscription request sent successfully`);
                return "pending";
            } catch (err) {
                console.error(`[WebSocketContext] Error making subscription request:`, err);
                SubscriptionManager.awaitingActivation = false;
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

    // Update an existing subscription
    const updateSubscription = async ({
                                          subscriptionId,
                                          newStartDate,
                                          newEndDate,
                                          resetData = false,
                                          subscriptionType = 'CHART',
                                          bufferDirection = null,
                                          referenceTimestamp = null,
                                          referenceOffset = null,
                                          isBufferUpdate = false,
                                          isIndicatorUpdate = false
                                      }) => {
        if (!subscriptionId) {
            console.warn('[WebSocketContext] Missing subscriptionId for update-subscription');
            return Promise.reject(new Error('Missing subscriptionId'));
        }

        // Compose a dedupe key for in-flight updates
        const key = `update:${subscriptionId}:${newStartDate || ''}:${newEndDate || ''}:${resetData}:${bufferDirection}`;
        if (SubscriptionManager.pendingSubscriptionRequests[key]) {
            console.log('[WebSocketContext] Duplicate update request - reusing existing promise');
            return SubscriptionManager.pendingSubscriptionRequests[key];
        }

        console.log('[WebSocketContext] Creating new update-subscription request');

        SubscriptionManager.pendingSubscriptionRequests[key] = (async () => {
            try {
                const payload = {
                    subscriptionId,
                    newStartDate: newStartDate ? new Date(newStartDate).toISOString() : null,
                    newEndDate: newEndDate ? new Date(newEndDate).toISOString() : null,
                    resetData,
                    subscriptionType
                };

                // Add optional fields if provided
                if (bufferDirection !== null) {
                    payload.bufferDirection = bufferDirection;
                }
                if (referenceTimestamp !== null) {
                    payload.referenceTimestamp = referenceTimestamp;
                }
                if (referenceOffset !== null) {
                    payload.referenceOffset = referenceOffset;
                }
                if (isBufferUpdate !== false) {
                    payload.isBufferUpdate = isBufferUpdate;
                }
                if (isIndicatorUpdate !== false) {
                    payload.isIndicatorUpdate = isIndicatorUpdate;
                }

                await webSocketService.safeSend('/app/candles/update-subscription', payload);
                console.log('[WebSocketContext] Update-subscription request sent successfully');
                return 'pending';
            } catch (err) {
                console.error('[WebSocketContext] Error sending update-subscription:', err);
                throw err;
            } finally {
                setTimeout(() => {
                    delete SubscriptionManager.pendingSubscriptionRequests[key];
                }, 750);
            }
        })();

        return SubscriptionManager.pendingSubscriptionRequests[key];
    };

    // Unsubscribe from the active subscription
    const unsubscribe = async (type = 'chart') => {
        if (!SubscriptionManager.activeSubscription) {
            console.log('[WebSocketContext] No active subscription to unsubscribe from');
            return Promise.resolve(true);
        }

        try {
            const id = SubscriptionManager.activeSubscription;
            console.log(`[WebSocketContext] Unsubscribing from subscription with ID:`, id);

            // Record the pending unsubscribe ID
            SubscriptionManager.pendingUnsubscribeId = id;

            await webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: id,
                subscriptionType: 'CHART'
            });

            return true;
        } catch (err) {
            console.error(`[WebSocketContext] Error unsubscribing:`, err);
            SubscriptionManager.pendingUnsubscribeId = null;
            return false;
        }
    };

    // Unsubscribe from all active subscriptions (same as unsubscribe since we only have one)
    const unsubscribeAll = async () => {
        return await unsubscribe();
    };

    // Connect WebSocket on component mount
    useEffect(() => {
        console.log("[CandleWebSocketContext] Setting up global WebSocket connection");

        if (!initialized.current) {
            initializeWebSocket().catch(err => {
                console.error("[CandleWebSocketContext] Initialization error:", err);
            });
        }

        // Cleanup function
        return () => {
            // Note: We intentionally don't disconnect from WebSocket on unmount
            // as we want the connection to persist throughout the app
            console.log("[CandleWebSocketContext] Provider unmounting - keeping connection alive");
        };
    }, []);

    // Context value containing the WebSocket state and operations
    const contextValue = {
        isConnected,
        connectionError,
        isInitialized,

        // Methods to manage subscription
        registerHandler: (type, handler) => {
            // Type parameter kept for API compatibility but ignored since we only have one subscription
            return SubscriptionManager.registerHandler(handler);
        },
        unregisterHandler: (type, handler) => {
            // Type parameter kept for API compatibility but ignored
            return SubscriptionManager.unregisterHandler(handler);
        },
        requestSubscription,
        updateSubscription,
        unsubscribe,
        unsubscribeAll,
        setActiveSubscription: SubscriptionManager.setActiveSubscription.bind(SubscriptionManager),
        clearActiveSubscription: SubscriptionManager.clearActiveSubscription.bind(SubscriptionManager),
        updateCurrentSubscriptionInfo: SubscriptionManager.updateCurrentSubscriptionInfo.bind(SubscriptionManager),

        // ✅ Use React state instead of direct SubscriptionManager access
        subscriptionIds: {
            chart: activeSubscriptionId,
            indicator: null // Kept for API compatibility but always null
        },
        currentSubscription: currentSubscriptionDetails,

        // Direct access to WebSocket service
        webSocketService,
        currentPage
    };

    return (
        <CandleWebSocketContext.Provider value={contextValue}>
            {children}
        </CandleWebSocketContext.Provider>
    );
}

// Custom hook to use the WebSocket context
export function useWebSocket() {
    const context = useContext(CandleWebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}

export { CandleWebSocketContext };