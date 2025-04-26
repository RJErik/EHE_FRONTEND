// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import webSocketService from '../services/websocketService';
import { useToast } from './use-toast';

// Helper function to convert timeframe to milliseconds
const timeframeToMilliseconds = (timeframe) => {
    if (!timeframe) return 60000; // Default to 1 minute

    // Convert timeframe to lowercase for case-insensitive matching
    const normalizedTimeframe = timeframe.toLowerCase();

    // Parse timeframe to get milliseconds
    if (normalizedTimeframe.endsWith('m')) {
        return parseInt(timeframe) * 60 * 1000;
    } else if (normalizedTimeframe.endsWith('h')) {
        return parseInt(timeframe) * 60 * 60 * 1000;
    } else if (normalizedTimeframe.endsWith('d')) {
        return parseInt(timeframe) * 24 * 60 * 60 * 1000;
    } else if (normalizedTimeframe.endsWith('w')) {
        return parseInt(timeframe) * 7 * 24 * 60 * 60 * 1000;
    }

    return 60000; // Default to 1 minute if parsing fails
};

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
        setIsWaitingForData,
        isWaitingForData,
        needsMoreHistoricalData,
        setNeedsMoreHistoricalData,
        needsMoreFutureData,
        setNeedsMoreFutureData,
        historicalBuffer,
        isLoadingMoreData,
        setIsLoadingMoreData,
        requiredLookbackCandles,
        viewStartIndex
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

    // Function to fetch more historical data - updated to get just 1 more candle
    const fetchMoreHistoricalData = useCallback(async () => {
        if (!SubscriptionManager.activeSubscriptionId || isLoadingMoreData) {
            console.log("[useCandleSubscription] Skipping historical data fetch - no active subscription or already loading");
            return false;
        }

        try {
            console.log("[useCandleSubscription] Fetching more historical data");
            setIsLoadingMoreData(true);

            // Find the earliest candle in our buffer
            if (historicalBuffer.length === 0) {
                console.log("[useCandleSubscription] No historical data to extend from");
                setIsLoadingMoreData(false);
                return false;
            }

            const earliestCandle = historicalBuffer[0];
            const earliestTimestamp = earliestCandle.timestamp;

            // Just request 1 more candle before the current earliest
            const additionalCandles = 1;
            console.log(`[useCandleSubscription] Will fetch ${additionalCandles} more candle before ${new Date(earliestTimestamp).toISOString()}`);

            // Calculate new start date for 1 more candle
            const timeframeDuration = timeframeToMilliseconds(SubscriptionManager.currentSubscription.timeframe);
            const newStartDate = new Date(earliestTimestamp - (additionalCandles * timeframeDuration));

            console.log(`[useCandleSubscription] Requesting historical data from ${newStartDate.toISOString()} to ${new Date(earliestTimestamp).toISOString()}`);

            // Request more data with subscription update
            await webSocketService.send('/app/candles/update-subscription', {
                subscriptionId: SubscriptionManager.activeSubscriptionId,
                newStartDate: newStartDate.toISOString(),
                newEndDate: new Date(earliestTimestamp).toISOString(),
                resetData: false // Don't reset existing data
            });

            console.log("[useCandleSubscription] Historical data request sent, waiting for response...");
            return true;
        } catch (err) {
            console.error("[useCandleSubscription] Error fetching more historical data:", err);
            setError("Failed to load more historical data: " + err.message);
            setIsLoadingMoreData(false);
            return false;
        }
    }, [historicalBuffer, isLoadingMoreData, setIsLoadingMoreData, setError]);

    // Function to fetch more future data - updated to get just 1 more candle
    const fetchMoreFutureData = useCallback(async () => {
        if (!SubscriptionManager.activeSubscriptionId || isLoadingMoreData) {
            console.log("[useCandleSubscription] Skipping future data fetch - no active subscription or already loading");
            return false;
        }

        try {
            console.log("[useCandleSubscription] Fetching more future data");
            setIsLoadingMoreData(true);

            // Find the latest candle in our buffer
            if (historicalBuffer.length === 0) {
                console.log("[useCandleSubscription] No historical data to extend from");
                setIsLoadingMoreData(false);
                return false;
            }

            const latestCandle = historicalBuffer[historicalBuffer.length - 1];
            const latestTimestamp = latestCandle.timestamp;

            // Request just 1 more candle into the future
            const timeframeDuration = timeframeToMilliseconds(SubscriptionManager.currentSubscription.timeframe);
            const newEndDate = new Date(latestTimestamp + timeframeDuration);

            console.log(`[useCandleSubscription] Requesting future data from ${new Date(latestTimestamp).toISOString()} to ${newEndDate.toISOString()}`);

            // Request more data with subscription update
            await webSocketService.send('/app/candles/update-subscription', {
                subscriptionId: SubscriptionManager.activeSubscriptionId,
                newStartDate: new Date(latestTimestamp).toISOString(),
                newEndDate: newEndDate.toISOString(),
                resetData: false // Don't reset existing data
            });

            console.log("[useCandleSubscription] Future data request sent, waiting for response...");
            return true;
        } catch (err) {
            console.error("[useCandleSubscription] Error fetching more future data:", err);
            setError("Failed to load more future data: " + err.message);
            setIsLoadingMoreData(false);
            return false;
        }
    }, [historicalBuffer, isLoadingMoreData, setIsLoadingMoreData, setError]);

    // Handle incoming candle data - improved with better logging and view adjustments
    const handleCandleMessage = useCallback((data) => {
        // Debug log message contents
        console.log("[useCandleSubscription] Received message:",
            JSON.stringify(data).substring(0, 200) + (JSON.stringify(data).length > 200 ? "..." : ""));

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
                setIsLoadingMoreData(false);
                return;
            }

            // Store the new subscription ID
            SubscriptionManager.setActiveSubscription(data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed with ID: ${data.subscriptionId}`);
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received candle updates:", data.updatedCandles.length);

            // Track if we're adding historical data (before the current view)
            let newCandlesBeforeStart = 0;
            const firstBufferTimestamp = historicalBuffer[0]?.timestamp;

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, SubscriptionManager.currentSubscription.stockSymbol));

            // Count how many new candles are before our current buffer start
            if (firstBufferTimestamp) {
                newCandlesBeforeStart = newCandles.filter(c => c.timestamp < firstBufferTimestamp).length;
                if (newCandlesBeforeStart > 0) {
                    console.log(`[useCandleSubscription] Found ${newCandlesBeforeStart} candles before our current buffer`);
                }
            }

            setHistoricalBuffer(prevBuffer => {
                // Create a copy of the buffer to modify
                const updatedBuffer = [...prevBuffer];

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

            // If we added historical data, adjust the viewStartIndex to maintain position
            if (newCandlesBeforeStart > 0) {
                console.log(`[useCandleSubscription] Adjusting view index by ${newCandlesBeforeStart} to maintain current view`);
                setViewStartIndex(prev => prev + newCandlesBeforeStart);
            }

            // Data loading is complete
            setIsLoadingMoreData(false);
        }
        // Handle initial data load or additional data load
        else if (data.candles) {
            console.log("[useCandleSubscription] Received candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                setIsLoadingMoreData(false);
                return;
            }

            // Transform the candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol))
                .sort((a, b) => a.timestamp - b.timestamp);

            setHistoricalBuffer(prevBuffer => {
                // If we're loading additional data (not initial load)
                if (prevBuffer.length > 0 && !data.resetData) {
                    console.log("[useCandleSubscription] Merging new candles with existing buffer");

                    // Track how many new candles come before the current first candle
                    const firstBufferTimestamp = prevBuffer[0]?.timestamp;
                    const newCandlesBeforeStart = firstBufferTimestamp ?
                        newCandles.filter(c => c.timestamp < firstBufferTimestamp).length : 0;

                    if (newCandlesBeforeStart > 0) {
                        console.log(`[useCandleSubscription] Found ${newCandlesBeforeStart} new candles before current buffer start`);

                        // Schedule view adjustment after the buffer update completes
                        setTimeout(() => {
                            setViewStartIndex(prev => prev + newCandlesBeforeStart);
                            console.log(`[useCandleSubscription] Adjusted view index by ${newCandlesBeforeStart} to maintain position`);
                        }, 0);
                    }

                    // Create a merged array with candles from both sources
                    const mergedCandles = [...prevBuffer];

                    // Add new candles, avoiding duplicates
                    newCandles.forEach(newCandle => {
                        const existingIndex = mergedCandles.findIndex(
                            c => c.timestamp === newCandle.timestamp
                        );

                        if (existingIndex >= 0) {
                            // Replace existing candle
                            mergedCandles[existingIndex] = newCandle;
                        } else {
                            // Add new candle
                            mergedCandles.push(newCandle);
                        }
                    });

                    // Sort by timestamp
                    const sortedCandles = mergedCandles.sort((a, b) => a.timestamp - b.timestamp);

                    console.log("[useCandleSubscription] Merged buffer contains", sortedCandles.length, "candles");
                    if (sortedCandles.length > 0) {
                        console.log("[useCandleSubscription] Buffer date range:",
                            new Date(sortedCandles[0].timestamp).toISOString(), "to",
                            new Date(sortedCandles[sortedCandles.length - 1].timestamp).toISOString());
                    }

                    return sortedCandles;
                }

                // For initial load or reset, just use the new candles
                console.log("[useCandleSubscription] Setting initial buffer with", newCandles.length, "candles");
                return newCandles;
            });

            // For initial load, set view to the end of the data
            if (data.resetData || historicalBuffer.length === 0) {
                console.log("[useCandleSubscription] Initial load - setting view to end of data");
                setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            }

            // Clear errors and loading states
            setError(null);
            setIsWaitingForData(false);
            setIsLoadingMoreData(false);

            // Reset data loading flags
            setNeedsMoreHistoricalData(false);
            setNeedsMoreFutureData(false);
        }
    }, [setHistoricalBuffer, setViewStartIndex, displayedCandles, setIsWaitingForData,
        toast, historicalBuffer, setIsLoadingMoreData, setNeedsMoreHistoricalData, setNeedsMoreFutureData]);

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

            // Get data range needed based on historical buffer and indicators
            const range = calculateRequiredDataRange();
            const now = new Date();

            // If we have existing data, use the calculated range
            // Otherwise, request exactly displayedCandles + lookback worth of data + 1 extra on each end
            const endDate = range.end ? new Date(range.end) : now;
            const startDate = range.start ?
                new Date(range.start) :
                calculateStartDate(endDate, timeframe, displayedCandles + requiredLookbackCandles + 2); // +2 for 1 extra on each end

            console.log("[useCandleSubscription] Requesting candles from", startDate.toISOString(), "to", endDate.toISOString());
            console.log("[useCandleSubscription] Including lookback of", requiredLookbackCandles, "candles for indicators");

            const subscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            };

            console.log("[useCandleSubscription] Subscribing to candles:", subscriptionRequest);

            await webSocketService.send('/app/candles/subscribe', subscriptionRequest);
            console.log("[useCandleSubscription] Subscription request sent, waiting for response...");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [calculateRequiredDataRange, setIsWaitingForData, displayedCandles, calculateStartDate, requiredLookbackCandles]);

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

    // Monitor for data loading needs
    useEffect(() => {
        if (!isConnected || !SubscriptionManager.activeSubscriptionId || isWaitingForData) {
            return;
        }

        const handleDataNeeds = async () => {
            // Handle need for more historical data
            if (needsMoreHistoricalData && !isLoadingMoreData) {
                console.log("[useCandleSubscription] Detected need for more historical data");
                await fetchMoreHistoricalData();
            }

            // Handle need for more future data
            if (needsMoreFutureData && !isLoadingMoreData && !needsMoreHistoricalData) {
                console.log("[useCandleSubscription] Detected need for more future data");
                await fetchMoreFutureData();
            }
        };

        handleDataNeeds();
    }, [needsMoreHistoricalData, needsMoreFutureData, isConnected, isWaitingForData,
        isLoadingMoreData, fetchMoreHistoricalData, fetchMoreFutureData]);

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
        isLoadingMoreData
    };
}
