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
        setHistoricalBuffer,
        calculateRequiredDataRange,
        setViewStartIndex,
        displayedCandles,
        setIsWaitingForData
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

            setHistoricalBuffer(prevBuffer => {
                // Transform backend candles to frontend format
                const newCandles = data.updatedCandles.map(candle =>
                    transformCandleData(candle, SubscriptionManager.currentSubscription.stockSymbol));

                // Create a copy of the buffer to modify
                const updatedBuffer = [...prevBuffer];
                
                // Check if we're receiving older candles (for indicators)
                const receivingOlderCandles = newCandles.some(newCandle => {
                    return prevBuffer.length > 0 && newCandle.timestamp < prevBuffer[0].timestamp;
                });
                
                if (receivingOlderCandles) {
                    console.log("[useCandleSubscription] Receiving older candles for indicator requirements");
                }

                // Update or add each candle
                newCandles.forEach(newCandle => {
                    const existingIndex = updatedBuffer.findIndex(
                        c => c.timestamp === newCandle.timestamp
                    );

                    if (existingIndex >= 0) {
                        // Update existing candle
                        updatedBuffer[existingIndex] = {
                            ...updatedBuffer[existingIndex],
                            ...newCandle,
                            // Preserve existing indicator values if any
                            indicatorValues: {
                                ...updatedBuffer[existingIndex].indicatorValues,
                                ...newCandle.indicatorValues
                            }
                        };
                    } else {
                        // Add new candle
                        updatedBuffer.push(newCandle);
                    }
                });

                // Sort by timestamp
                const sortedBuffer = updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
                
                // Log info about the buffer expansion
                if (receivingOlderCandles && sortedBuffer.length > 0 && prevBuffer.length > 0) {
                    const oldestPrevious = new Date(prevBuffer[0].timestamp).toISOString();
                    const oldestNew = new Date(sortedBuffer[0].timestamp).toISOString();
                    console.log(`[useCandleSubscription] Buffer expanded: oldest candle was ${oldestPrevious}, now ${oldestNew}`);
                    console.log(`[useCandleSubscription] Buffer size increased from ${prevBuffer.length} to ${sortedBuffer.length} candles`);
                }
                
                return sortedBuffer;
            });
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

            // Transform and store the candles
            const candles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol))
                .sort((a, b) => a.timestamp - b.timestamp);

            setHistoricalBuffer(prevBuffer => {
                // If we already have data, merge with existing buffer (subscription update case)
                if (prevBuffer.length > 0 && candles.length > 0) {
                    console.log(`[useCandleSubscription] Merging ${candles.length} candles with existing buffer of ${prevBuffer.length} candles`);
                    
                    // Create a map for quick lookup of existing candles by timestamp
                    const existingCandleMap = new Map();
                    prevBuffer.forEach(candle => {
                        existingCandleMap.set(candle.timestamp, candle);
                    });
                    
                    // Merge new candles with existing ones
                    const mergedCandles = [...prevBuffer];
                    let addedCount = 0;
                    let updatedCount = 0;
                    
                    candles.forEach(newCandle => {
                        const existingCandle = existingCandleMap.get(newCandle.timestamp);
                        
                        if (existingCandle) {
                            // Update existing candle (preserve indicator values)
                            const index = mergedCandles.findIndex(c => c.timestamp === newCandle.timestamp);
                            if (index >= 0) {
                                mergedCandles[index] = {
                                    ...existingCandle,
                                    ...newCandle,
                                    indicatorValues: {
                                        ...existingCandle.indicatorValues,
                                        ...newCandle.indicatorValues
                                    }
                                };
                                updatedCount++;
                            }
                        } else {
                            // Add new candle
                            mergedCandles.push(newCandle);
                            addedCount++;
                        }
                    });
                    
                    // Sort the merged candles
                    const sortedCandles = mergedCandles.sort((a, b) => a.timestamp - b.timestamp);
                    
                    console.log(`[useCandleSubscription] Merged candles: ${addedCount} added, ${updatedCount} updated, total ${sortedCandles.length}`);
                    
                    if (sortedCandles.length > 0) {
                        const oldestCandle = new Date(sortedCandles[0].timestamp).toISOString();
                        const newestCandle = new Date(sortedCandles[sortedCandles.length - 1].timestamp).toISOString();
                        console.log(`[useCandleSubscription] Buffer now spans from ${oldestCandle} to ${newestCandle}`);
                    }
                    
                    return sortedCandles;
                }
                
                // Otherwise, just use the new candles
                return candles;
            });
            
            // Only adjust the view index if this is the initial data load, not a subscription update
            if (data.success && !data.updateType) {
                setViewStartIndex(prevIndex => {
                    // If we're already viewing data, don't change the view
                    if (prevIndex > 0) return prevIndex;
                    // Otherwise set to show the most recent candles
                    return Math.max(0, candles.length - displayedCandles);
                });
            }
            
            setError(null);
            setIsWaitingForData(false);
        }
    }, [setHistoricalBuffer, setViewStartIndex, displayedCandles, setIsWaitingForData, toast]);

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

            console.log("[useCandleSubscription] Requesting candles from", startDate.toISOString(), "to", endDate.toISOString());

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
    }, [calculateRequiredDataRange, setIsWaitingForData, displayedCandles, calculateStartDate]);

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

    // Listen for indicator requirements changes
    useEffect(() => {
        const handleIndicatorRequirementsChanged = async (event) => {
            const { range } = event.detail;
            
            if (!range || !SubscriptionManager.activeSubscriptionId) return;
            
            console.log('[useCandleSubscription] Indicator requirements changed, updating subscription');
            console.log(`[useCandleSubscription] New range: ${new Date(range.start).toISOString()} to ${new Date(range.end).toISOString()}`);
            
            try {
                // Only update if we're already subscribed to something
                if (SubscriptionManager.currentSubscription.platformName &&
                    SubscriptionManager.currentSubscription.stockSymbol &&
                    SubscriptionManager.currentSubscription.timeframe) {
                    
                    const startDate = new Date(range.start);
                    const endDate = new Date(range.end);
                    
                    console.log('[useCandleSubscription] Updating subscription with new date range');
                    
                    const updateRequest = {
                        subscriptionId: SubscriptionManager.activeSubscriptionId,
                        newStartDate: startDate.toISOString(),
                        newEndDate: endDate.toISOString(),
                        resetData: false // Don't reset existing data, just extend it
                    };
                    
                    setIsWaitingForData(true);
                    await webSocketService.send('/app/candles/update-subscription', updateRequest);
                    console.log('[useCandleSubscription] Subscription update request sent');
                }
            } catch (err) {
                console.error('[useCandleSubscription] Error updating subscription:', err);
                toast({
                    title: "Subscription Update Error",
                    description: "Failed to update subscription for indicator requirements.",
                    variant: "destructive",
                    duration: 3000
                });
            }
        };
        
        // Add event listener for indicator requirements changed
        window.addEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);
        
        return () => {
            window.removeEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);
        };
    }, [toast, setIsWaitingForData]);

    // Expose the unsubscribe function for explicit use
    const unsubscribeFromCandles = useCallback(async () => {
        return SubscriptionManager.unsubscribe();
    }, []);
    
    // Function to manually update subscription date range
    const updateSubscriptionDateRange = useCallback(async (newStartDate, newEndDate, resetData = false) => {
        if (!SubscriptionManager.activeSubscriptionId) {
            console.warn("[useCandleSubscription] No active subscription to update");
            return Promise.resolve(false);
        }
        
        try {
            console.log('[useCandleSubscription] Manually updating subscription date range');
            console.log(`[useCandleSubscription] New range: ${new Date(newStartDate).toISOString()} to ${new Date(newEndDate).toISOString()}`);
            
            const updateRequest = {
                subscriptionId: SubscriptionManager.activeSubscriptionId,
                newStartDate: new Date(newStartDate).toISOString(),
                newEndDate: new Date(newEndDate).toISOString(),
                resetData: resetData
            };
            
            setIsWaitingForData(true);
            await webSocketService.send('/app/candles/update-subscription', updateRequest);
            console.log('[useCandleSubscription] Subscription update request sent');
            return true;
        } catch (err) {
            console.error('[useCandleSubscription] Error updating subscription date range:', err);
            toast({
                title: "Update Error",
                description: "Failed to update candle data range.",
                variant: "destructive",
                duration: 3000
            });
            return false;
        }
    }, [toast, setIsWaitingForData]);

    return {
        isConnected,
        isSubscribing,
        subscriptionId: SubscriptionManager.activeSubscriptionId,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        updateSubscriptionDateRange
    };
}