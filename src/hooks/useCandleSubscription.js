// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import webSocketService from '../services/websocketService';
import { useToast } from './use-toast';

// Utility function to convert timeframe to milliseconds
const timeframeToMilliseconds = (timeframe) => {
    if (!timeframe) return 60000; // Default to 1 minute

    const normalizedTimeframe = timeframe.toLowerCase();
    let minutes = 1;

    if (normalizedTimeframe.endsWith('m')) {
        minutes = parseInt(normalizedTimeframe);
    } else if (normalizedTimeframe.endsWith('h')) {
        minutes = parseInt(normalizedTimeframe) * 60;
    } else if (normalizedTimeframe.endsWith('d')) {
        minutes = parseInt(normalizedTimeframe) * 60 * 24;
    } else if (normalizedTimeframe.endsWith('w')) {
        minutes = parseInt(normalizedTimeframe) * 60 * 24 * 7;
    }

    return minutes * 60 * 1000; // Convert minutes to milliseconds
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
        historicalBuffer,
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

    // Function to request more historical data for scrolling
    const requestMoreHistoricalData = useCallback(async () => {
        if (!SubscriptionManager.activeSubscriptionId || !SubscriptionManager.currentSubscription.timeframe) {
            console.log("[useCandleSubscription] No active subscription, can't request more data");
            return;
        }

        try {
            // If already waiting for data, don't make another request
            if (setIsWaitingForData) return;

            // Find the earliest candle we have
            const earliestCandle = historicalBuffer[0];
            if (!earliestCandle) {
                console.log("[useCandleSubscription] No candles in buffer, can't request more data");
                return;
            }

            // Calculate a new start date that goes back further (request 50 more candles)
            const currentStartDate = new Date(earliestCandle.timestamp);
            const additionalCandlesNeeded = 50; // Number of additional candles to request
            const newStartDate = new Date(
                currentStartDate.getTime() - (
                    timeframeToMilliseconds(SubscriptionManager.currentSubscription.timeframe) * additionalCandlesNeeded
                )
            );

            console.log(`[useCandleSubscription] Requesting more historical data from ${newStartDate.toISOString()} to ${currentStartDate.toISOString()}`);

            // Set loading state but don't block the UI
            setIsWaitingForData(true);

            // Request more data via subscription update
            await webSocketService.send('/app/candles/update-subscription', {
                subscriptionId: SubscriptionManager.activeSubscriptionId,
                newStartDate: newStartDate.toISOString(),
                newEndDate: currentStartDate.toISOString(), // Make sure we get data up to our earliest candle
                resetData: false // Don't reset existing data
            });

            console.log("[useCandleSubscription] Request for more historical data sent");
        } catch (err) {
            console.error("[useCandleSubscription] Error requesting more historical data:", err);
            setError("Failed to load more historical data: " + err.message);
            setIsWaitingForData(false);

            toast({
                title: "Data Loading Error",
                description: "Failed to load more historical data.",
                variant: "destructive",
                duration: 3000
            });
        }
    }, [historicalBuffer, setIsWaitingForData, setError, toast]);

    // Function to request data specifically for indicator calculations
    const requestDataForIndicator = useCallback(async (event) => {
        const { indicator } = event.detail;

        if (!SubscriptionManager.activeSubscriptionId) {
            console.log("[useCandleSubscription] No active subscription, can't request indicator data");
            return;
        }

        try {
            // First, calculate the range required for this indicator
            const range = calculateRequiredDataRange();
            console.log(`[useCandleSubscription] Calculated data range for ${indicator.type} indicator:`, range);

            // If we don't have enough historical data, request more
            if (historicalBuffer.length > 0 && range.lookbackNeeded > 0) {
                // If already waiting for data, don't make another request
                if (setIsWaitingForData) return;

                const earliestCandle = historicalBuffer[0];
                if (!earliestCandle) return;

                // Calculate how far back we need to go beyond our current earliest candle
                const currentStartDate = new Date(earliestCandle.timestamp);

                // Add a safety margin to the lookback period (20% more)
                const lookbackWithMargin = Math.ceil(range.lookbackNeeded * 1.2);

                const newStartDate = new Date(
                    currentStartDate.getTime() - (
                        timeframeToMilliseconds(SubscriptionManager.currentSubscription.timeframe) * lookbackWithMargin
                    )
                );

                console.log(`[useCandleSubscription] Requesting additional data for ${indicator.type} indicator from ${newStartDate.toISOString()}`);

                setIsWaitingForData(true);

                // Request more data via subscription update
                await webSocketService.send('/app/candles/update-subscription', {
                    subscriptionId: SubscriptionManager.activeSubscriptionId,
                    newStartDate: newStartDate.toISOString(),
                    newEndDate: currentStartDate.toISOString(), // Get data up to our earliest candle
                    resetData: false // Don't reset existing data
                });

                console.log(`[useCandleSubscription] Request for indicator data sent, lookback: ${lookbackWithMargin} candles`);
            } else {
                console.log("[useCandleSubscription] No additional data needed for indicator");
            }
        } catch (err) {
            console.error(`[useCandleSubscription] Error requesting data for ${indicator.type} indicator:`, err);
            setError(`Failed to load data for ${indicator.type} indicator: ${err.message}`);
            setIsWaitingForData(false);

            toast({
                title: "Indicator Data Error",
                description: `Failed to load data needed for ${indicator.type} calculations.`,
                variant: "destructive",
                duration: 3000
            });
        }
    }, [historicalBuffer, calculateRequiredDataRange, setIsWaitingForData, setError, toast]);

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

            // If we were waiting for data, we're not anymore
            setIsWaitingForData(false);
        }
        // Handle initial data load or additional historical data
        else if (data.candles) {
            console.log("[useCandleSubscription] Received candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                return;
            }

            // Transform and store the candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol))
                .sort((a, b) => a.timestamp - b.timestamp);

            setHistoricalBuffer(prevBuffer => {
                // If this is an initial load (empty buffer), just return the new candles
                if (prevBuffer.length === 0) {
                    console.log("[useCandleSubscription] Initial load, setting buffer with", newCandles.length, "candles");
                    return newCandles;
                }

                // This is additional historical data (from scrolling or indicator request)
                console.log("[useCandleSubscription] Adding", newCandles.length, "candles to existing buffer of", prevBuffer.length);

                // Filter out any duplicates (candles that exist in both arrays)
                const uniqueNewCandles = newCandles.filter(newCandle =>
                    !prevBuffer.some(existing => existing.timestamp === newCandle.timestamp)
                );

                console.log("[useCandleSubscription] After filtering duplicates, adding", uniqueNewCandles.length, "unique candles");

                // Combine and sort
                const combined = [...prevBuffer, ...uniqueNewCandles].sort((a, b) => a.timestamp - b.timestamp);

                console.log("[useCandleSubscription] Final combined buffer has", combined.length, "candles");
                console.log("[useCandleSubscription] Earliest candle:", new Date(combined[0]?.timestamp).toISOString());
                console.log("[useCandleSubscription] Latest candle:", new Date(combined[combined.length - 1]?.timestamp).toISOString());

                return combined;
            });

            // Only adjust view position on initial load
            if (historicalBuffer.length === 0) {
                setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            }

            // We're done waiting for data
            setError(null);
            setIsWaitingForData(false);
        }
    }, [setHistoricalBuffer, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, historicalBuffer.length]);

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

        // Set up event listeners for scrolling and indicator data requests
        const handleScrollRequest = () => {
            console.log("[useCandleSubscription] Received request for more historical data");
            requestMoreHistoricalData();
        };

        const handleIndicatorRequest = (event) => {
            console.log("[useCandleSubscription] Received request for indicator data", event.detail);
            requestDataForIndicator(event);
        };

        window.addEventListener('requestMoreHistoricalData', handleScrollRequest);
        window.addEventListener('requestDataForIndicator', handleIndicatorRequest);

        // Cleanup function
        return () => {
            console.log("[useCandleSubscription] Component unmounting - keeping WebSocket alive");
            unregister();
            window.removeEventListener('requestMoreHistoricalData', handleScrollRequest);
            window.removeEventListener('requestDataForIndicator', handleIndicatorRequest);
        };
    }, [handleCandleMessage, toast, requestMoreHistoricalData, requestDataForIndicator]);

    // Monitor view position to detect when we're close to the edge of available data
    useEffect(() => {
        // If we're close to the beginning of our buffer and not already loading data
        if (viewStartIndex < 20 && historicalBuffer.length > 0 && !isSubscribing && !setIsWaitingForData) {
            console.log("[useCandleSubscription] Close to start of available data, requesting more history");

            // Create a custom event to request more historical data
            const event = new CustomEvent('requestMoreHistoricalData');
            window.dispatchEvent(event);
        }
    }, [viewStartIndex, historicalBuffer.length, isSubscribing]);

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
        unsubscribeFromCandles
    };
}
