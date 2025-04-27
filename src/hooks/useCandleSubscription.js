// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import webSocketService from '../services/websocketService';
import { useToast } from './use-toast';

// Global persistent subscription manager - lives outside React lifecycle
const SubscriptionManager = {
    // Active subscription tracking
    activeSubscriptionId: null,
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

    // Track initialization and message handlers
    initialized: false,
    messageHandlers: new Set(),

    // Initialize the global websocket connection (once)
    async initialize() {
        if (this.initialized) {
            console.log("[SubscriptionManager] Already initialized");
            return;
        }

        try {
            // Connect to WebSocket
            await webSocketService.connect();
            console.log("[SubscriptionManager] WebSocket connected globally");
            this.isConnected = true;

            // Subscribe to the user queue for candle data
            this.userQueueSubscription = await webSocketService.subscribe(
                '/user/queue/candles',
                this.handleGlobalMessage.bind(this)
            );

            this.initialized = true;
            console.log("[SubscriptionManager] Global WebSocket initialization complete");
        } catch (err) {
            console.error("[SubscriptionManager] Failed to initialize global WebSocket:", err);
            throw err;
        }
    },

    // Global message handler that distributes to all registered handlers
    handleGlobalMessage(message) {
        // Parse the message if it's a string
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Track heartbeats
        if (data.updateType === "HEARTBEAT") {
            this.recordHeartbeat(data.subscriptionId);
        }

        // Distribute message to all registered handlers
        this.messageHandlers.forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error("[SubscriptionManager] Error in message handler:", err);
            }
        });
    },

    // Record heartbeat information
    recordHeartbeat(subscriptionId) {
        this.lastHeartbeatTime = new Date();
        this.heartbeatCount++;

        const isActive = subscriptionId === this.activeSubscriptionId;
        const timestamp = new Date().toISOString().substr(11, 12);
        console.log(`[${timestamp}] Heartbeat #${this.heartbeatCount} for ${isActive ? 'active' : 'stale'} subscription: ${subscriptionId}`);

        // Clean up stale subscriptions that are still sending heartbeats
        if (!isActive && subscriptionId) {
            console.log(`[SubscriptionManager] Cleaning up stale subscription: ${subscriptionId}`);
            webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: subscriptionId
            }).catch(() => {});
        }

        return isActive;
    },

    // Set active subscription
    setActiveSubscription(id, details = null) {
        console.log(`[SubscriptionManager] Setting active subscription to: ${id}`);
        this.activeSubscriptionId = id;

        if (details) {
            this.currentSubscription = { ...details };
        }
    },

    // Clear active subscription
    clearActiveSubscription() {
        console.log(`[SubscriptionManager] Clearing active subscription: ${this.activeSubscriptionId}`);
        this.activeSubscriptionId = null;
    },

    // Register a message handler
    registerHandler(handler) {
        console.log("[SubscriptionManager] Registering new message handler");
        this.messageHandlers.add(handler);
        return () => this.unregisterHandler(handler);
    },

    // Unregister a message handler
    unregisterHandler(handler) {
        console.log("[SubscriptionManager] Unregistering message handler");
        this.messageHandlers.delete(handler);
    },

    // Explicitly unsubscribe (only when requested, not on component unmount)
    async unsubscribe() {
        if (!this.activeSubscriptionId) {
            return Promise.resolve(true);
        }

        try {
            console.log(`[SubscriptionManager] Explicitly unsubscribing from: ${this.activeSubscriptionId}`);

            await webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: this.activeSubscriptionId
            });

            this.clearActiveSubscription();
            return true;
        } catch (err) {
            console.error("[SubscriptionManager] Error unsubscribing:", err);
            return false;
        }
    }
};

export function useCandleSubscription() {
    const [isConnected, setIsConnected] = useState(SubscriptionManager.isConnected);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Get chart context for data management
    const {
        setDisplayCandles,
        setIndicatorCandles,
        calculateRequiredDataRange,
        setViewStartIndex,
        displayedCandles,
        setIsWaitingForData,
        applyIndicatorsToCandleDisplay
    } = useContext(ChartContext);

    // Calculate start date based on timeframe and number of candles
    const calculateStartDate = useCallback((endDate, timeframe, candleCount) => {
        let timeframeMinutes = 1; // default to 1 minute

        // Convert timeframe to lowercase for case-insensitive matching
        const normalizedTimeframe = timeframe.toLowerCase();

        // Parse timeframe to get minutes
        if (normalizedTimeframe.endsWith('m')) {
            timeframeMinutes = parseInt(timeframe);
        } else if (normalizedTimeframe.endsWith('h')) {
            timeframeMinutes = parseInt(timeframe) * 60;
        } else if (normalizedTimeframe.endsWith('d')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24;
        } else if (normalizedTimeframe.endsWith('w')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24 * 7;
        }

        // Calculate how far back to go based on candle count and timeframe
        const minutesBack = timeframeMinutes * candleCount;
        return new Date(endDate.getTime() - (minutesBack * 60 * 1000));
    }, []);

    // Handle incoming candle data
    const handleCandleMessage = useCallback((data) => {
        // Skip heartbeats - already handled in SubscriptionManager
        if (data.updateType === "HEARTBEAT") return;

        // Handle subscription response
        if (data.subscriptionId && data.updateType === undefined) {
            if (data.success === false) {
                console.error("[useCandleSubscription] Subscription error:", data.message);
                setError(data.message);

                toast({
                    title: "Subscription Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 5000
                });
                return;
            }

            // Store the new subscription ID
            SubscriptionManager.setActiveSubscription(data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed with ID: ${data.subscriptionId}`);
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received candle updates:", data.updatedCandles.length);

            // Get timestamps from first and last candles to log data range received
            const firstCandleTime = new Date(data.updatedCandles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.updatedCandles[data.updatedCandles.length-1].timestamp).toISOString();
            console.log(`[WebSocket Data] Received candle update range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, SubscriptionManager.currentSubscription.stockSymbol));

            // Update both display and indicator candles
            updateBothCandleStores(newCandles);
        }
        // Handle initial data load
        else if (data.candles) {
            console.log("[useCandleSubscription] Received initial candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                return;
            }

            // Log the received data range
            if (data.candles.length > 0) {
                const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
                const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
                console.log(`[WebSocket Data] Received initial data range: ${firstCandleTime} to ${lastCandleTime}`);
                console.log(`[WebSocket Data] Platform: ${data.platformName}, Symbol: ${data.stockSymbol}, Timeframe: ${data.timeframe}`);
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol));

            // Update both display and indicator candles with new data
            updateBothCandleStores(newCandles, true);

            setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            setError(null);
            setIsWaitingForData(false);
        }
    }, [setDisplayCandles, setIndicatorCandles, applyIndicatorsToCandleDisplay, setViewStartIndex, displayedCandles, setIsWaitingForData, toast]);

    // Helper function to update both candle stores
    const updateBothCandleStores = useCallback((newCandles, isInitialLoad = false) => {
        // First, update the display candles for chart rendering
        setDisplayCandles(prevCandles => {
            console.log('####################UPDATED DISPLAY CANDLES1.##################################');
            // For initial load or when explicitly refreshing, replace the entire buffer
            if (isInitialLoad) {
                return [...newCandles].sort((a, b) => a.timestamp - b.timestamp);
            }

            console.log('####################UPDATED DISPLAY CANDLES2.##################################');
            // Create a copy of the buffer to modify
            const updatedBuffer = [...prevCandles];

            // Update or add each candle
            newCandles.forEach(newCandle => {
                const existingIndex = updatedBuffer.findIndex(
                    c => c.timestamp === newCandle.timestamp
                );

                if (existingIndex >= 0) {
                    updatedBuffer[existingIndex] = newCandle;
                } else {
                    updatedBuffer.push(newCandle);
                }
            });

            // Sort by timestamp
            return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
        });

        // Then update the indicator candles for calculations
        setIndicatorCandles(prevCandles => {
            // For initial load or when explicitly refreshing, replace the entire buffer
            if (isInitialLoad) {
                return [...newCandles].sort((a, b) => a.timestamp - b.timestamp);
            }

            // Create a copy of the buffer to modify
            const updatedBuffer = [...prevCandles];

            // Update or add each candle
            newCandles.forEach(newCandle => {
                const existingIndex = updatedBuffer.findIndex(
                    c => c.timestamp === newCandle.timestamp
                );

                if (existingIndex >= 0) {
                    updatedBuffer[existingIndex] = newCandle;
                } else {
                    updatedBuffer.push(newCandle);
                }
            });

            // Sort by timestamp
            return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
        });
    }, [setDisplayCandles, setIndicatorCandles]);

    // Transform candle data from backend format to frontend format
    const transformCandleData = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp: new Date(backendCandle.timestamp).getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || SubscriptionManager.currentSubscription.stockSymbol,
            indicatorValues: {}
        };
    }, []);

    // Subscribe to candles with specific parameters
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        // If we're already subscribed to this exact combination, no need to resubscribe
        if (
            SubscriptionManager.currentSubscription.platformName === platformName &&
            SubscriptionManager.currentSubscription.stockSymbol === stockSymbol &&
            SubscriptionManager.currentSubscription.timeframe === timeframe &&
            SubscriptionManager.activeSubscriptionId
        ) {
            console.log("[useCandleSubscription] Already subscribed to this data");
            return Promise.resolve(SubscriptionManager.activeSubscriptionId);
        }

        setIsSubscribing(true);
        setIsWaitingForData(true);

        try {
            // First, unsubscribe from any existing subscription
            if (SubscriptionManager.activeSubscriptionId) {
                console.log(`[useCandleSubscription] Unsubscribing from current subscription before creating new one`);
                await SubscriptionManager.unsubscribe();
                // Small delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Update subscription details
            SubscriptionManager.currentSubscription = {
                platformName,
                stockSymbol,
                timeframe
            };

            // Get data range needed
            const range = calculateRequiredDataRange();
            const now = new Date();

            // If we have existing data, use the calculated range
            // Otherwise, request exactly displayedCandles worth of data based on the timeframe
            const endDate = range.end ? new Date(range.end) : now;
            const startDate = range.start ?
                new Date(range.start) :
                calculateStartDate(endDate, timeframe, displayedCandles);

            console.log("--------- CANDLE DATA REQUEST ---------");
            console.log(`[Data Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Data Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Data Request] End date: ${endDate.toISOString()}`);

            if (range.lookbackNeeded) {
                console.log(`[Data Request] Lookback required: ${range.lookbackNeeded} candles`);
            }

            if (range.isViewingLatest) {
                console.log(`[Data Request] Including future candles: ${range.extraFutureCandles}`);
            }

            console.log(`[Data Request] Total candles needed: ${range.totalCandlesNeeded || displayedCandles}`);
            console.log("--------------------------------------");

            const subscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            };

            console.log("[useCandleSubscription] Subscribing to candles:", subscriptionRequest);

            await webSocketService.send('/app/candles/subscribe', subscriptionRequest);
            console.log("[useCandleSubscription] Subscription request sent");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [calculateRequiredDataRange, setIsWaitingForData, displayedCandles, calculateStartDate, updateBothCandleStores]);


    // Listen for indicator requirement changes
    useEffect(() => {
        // Define event handler for indicator requirement changes
        const handleIndicatorRequirementsChanged = async (event) => {
            if (!SubscriptionManager.activeSubscriptionId) {
                console.log("[Indicator Monitor] No active subscription to update");
                return; // No active subscription to update
            }

            console.log(`[Indicator Monitor] Detected indicator requirements change event`);
            const { range, indicatorCount } = event.detail;

            // Only update if we have valid range data
            if (range && range.start && range.end) {
                try {
                    // Get the current subscription details
                    const { platformName, stockSymbol, timeframe } = SubscriptionManager.currentSubscription;
                    if (!platformName || !stockSymbol || !timeframe) {
                        console.log("[Indicator Monitor] Missing subscription parameters");
                        return; // Missing required data
                    }

                    console.log("--------- SUBSCRIPTION UPDATE ---------");
                    console.log(`[Subscription Update] Updating for ${indicatorCount} indicators`);
                    console.log(`[Subscription Update] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
                    console.log(`[Subscription Update] New start date: ${new Date(range.start).toISOString()}`);
                    console.log(`[Subscription Update] New end date: ${new Date(range.end).toISOString()}`);
                    console.log(`[Subscription Update] Lookback needed: ${range.lookbackNeeded} candles`);

                    if (range.isViewingLatest) {
                        console.log(`[Subscription Update] Including future candles: ${range.extraFutureCandles}`);
                    }

                    console.log(`[Subscription Update] Total candles needed: ${range.totalCandlesNeeded || "unknown"}`);
                    console.log("--------------------------------------");

                    // Create the update request - this will update indicator candles without affecting display candles
                    const updateRequest = {
                        subscriptionId: SubscriptionManager.activeSubscriptionId,
                        newStartDate: new Date(range.start).toISOString(),
                        newEndDate: new Date(range.end).toISOString(),
                        resetData: true // Don't reset data, just update the necessary range
                    };

                    // Send the update request to the server
                    await webSocketService.safeSend('/app/candles/update-subscription', updateRequest);
                    console.log("[Indicator Monitor] Subscription update request sent successfully");
                } catch (err) {
                    console.error("[Indicator Monitor] Error updating subscription for indicators:", err);
                    setError("Failed to update subscription: " + err.message);

                    toast({
                        title: "Indicator Update Error",
                        description: "Failed to update data requirements for indicators.",
                        variant: "destructive",
                        duration: 3000
                    });
                }
            } else {
                console.log("[Indicator Monitor] Invalid range data received, cannot update subscription", range);
            }
        };

        // Register event listener for indicator changes
        window.addEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);

        // Clean up event listener
        return () => {
            window.removeEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);
        };
    }, [setError, toast]);

    // Initialize and setup effect
    useEffect(() => {
        console.log("[useCandleSubscription] Setting up WebSocket connection");

        const setup = async () => {
            try {
                // Initialize the global WebSocket if not already done
                await SubscriptionManager.initialize();
                setIsConnected(true);
                setError(null);
            } catch (err) {
                console.error("[useCandleSubscription] Setup error:", err);
                setIsConnected(false);
                setError("Failed to connect: " + err.message);

                toast({
                    title: "Connection Error",
                    description: "Failed to connect to server for live data.",
                    variant: "destructive",
                    duration: 5000
                });
            }
        };

        setup();

        // Register our handler
        const unregister = SubscriptionManager.registerHandler(handleCandleMessage);

        // Cleanup function - just unregister our handler, don't disconnect
        return () => {
            console.log("[useCandleSubscription] Component unmounting - keeping WebSocket alive");
            unregister();
        };
    }, [handleCandleMessage, toast]);

    // Special handler for indicator-only data updates
    const handleIndicatorOnlyData = useCallback((data) => {
        if (!data || !data.candles || data.candles.length === 0) return;
        
        console.log("[useCandleSubscription] Received indicator-only data update:", data.candles.length);
        
        // Transform candles for indicator calculations
        const indicatorCandles = data.candles.map(c => 
            transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol));
        
        // Update only the indicator candles buffer
        setIndicatorCandles(prevCandles => {
            // Create a copy of the buffer to modify
            const updatedBuffer = [...prevCandles];
            
            // Update or add each candle
            indicatorCandles.forEach(newCandle => {
                const existingIndex = updatedBuffer.findIndex(
                    c => c.timestamp === newCandle.timestamp
                );
                
                if (existingIndex >= 0) {
                    updatedBuffer[existingIndex] = newCandle;
                } else {
                    updatedBuffer.push(newCandle);
                }
            });
            
            // Sort by timestamp
            return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
        });
        
        // Trigger indicator recalculation
        setTimeout(() => {
            applyIndicatorsToCandleDisplay();
        }, 0);
        
    }, [setIndicatorCandles, transformCandleData, applyIndicatorsToCandleDisplay]);

    // Expose the unsubscribe function for explicit use
    const unsubscribeFromCandles = useCallback(async () => {
        return SubscriptionManager.unsubscribe();
    }, []);

    return {
        isConnected,
        isSubscribing,
        subscriptionId: SubscriptionManager.activeSubscriptionId,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        handleIndicatorOnlyData
    };
}
