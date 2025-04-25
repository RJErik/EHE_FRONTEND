// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import webSocketService from '../services/websocketService';
import { useToast } from './use-toast';

export function useCandleSubscription() {
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Track ALL subscription IDs we've ever created to help with cleanup
    const allSubscriptionIds = useRef(new Set());

    // Track current subscription details
    const currentSubscription = useRef({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    // Get the chart context for accessing and updating candle data
    const {
        setHistoricalBuffer,
        calculateRequiredDataRange,
        setViewStartIndex,
        displayedCandles,
        setIsWaitingForData
    } = useContext(ChartContext);

    // Define unsubscribeFromCandles BEFORE we use it in subscribeToCandles
    const unsubscribeFromCandles = useCallback(async (idToUnsubscribe = null) => {
        const id = idToUnsubscribe || subscriptionId;
        if (!id) {
            return Promise.resolve();
        }

        console.log("[useCandleSubscription] Unsubscribing from candles:", id);

        try {
            await webSocketService.send('/app/candles/unsubscribe', { subscriptionId: id });
            console.log("[useCandleSubscription] Unsubscribe request sent successfully");

            // Only clear current subscription ID if it matches what we're unsubscribing
            if (!idToUnsubscribe || id === subscriptionId) {
                setSubscriptionId(null);
                setHistoricalBuffer([]);
            }

            return true;
        } catch (err) {
            console.error("[useCandleSubscription] Error unsubscribing from candles:", err);
            setError("Failed to unsubscribe: " + err.message);
            throw err;
        }
    }, [subscriptionId, setHistoricalBuffer]);

    // Handler for incoming candle messages
    const handleCandleMessage = useCallback((message) => {
        // Parse the message if it's a string
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // For heartbeats, just log with minimal details
        if (data.updateType === "HEARTBEAT") {
            console.log(`[useCandleSubscription] Heartbeat for subscription: ${data.subscriptionId}`);

            // If this is a heartbeat for an old subscription we know about but isn't current,
            // try to unsubscribe from it to clean up
            if (
                data.subscriptionId &&
                data.subscriptionId !== subscriptionId &&
                allSubscriptionIds.current.has(data.subscriptionId)
            ) {
                console.log(`[useCandleSubscription] Cleaning up old subscription: ${data.subscriptionId}`);
                unsubscribeFromCandles(data.subscriptionId).catch(err => {
                    console.error(`[useCandleSubscription] Failed to clean up old subscription: ${data.subscriptionId}`, err);
                });
            }
            return;
        }

        // For debugging other messages
        console.log("[useCandleSubscription] Received message:", data);

        // Ignore messages from old subscriptions
        if (data.subscriptionId && data.subscriptionId !== subscriptionId && subscriptionId !== null) {
            console.log(`[useCandleSubscription] Ignoring message for old subscription: ${data.subscriptionId}`);
            return;
        }

        // Check if this is a subscription response
        if (data.subscriptionId && data.updateType === undefined) {
            // This is a subscription response
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

            // Store the subscription ID
            setSubscriptionId(data.subscriptionId);

            // Add to our set of known subscriptions for cleanup
            allSubscriptionIds.current.add(data.subscriptionId);

            console.log(`[useCandleSubscription] Successfully subscribed with ID: ${data.subscriptionId}`);
        }
        else if (data.updateType) {
            // This is an update message
            if (data.updateType === "UPDATE" && data.updatedCandles && data.updatedCandles.length > 0) {
                console.log("[useCandleSubscription] Received candle updates:", data.updatedCandles.length);

                // Add the updated candles to the buffer
                setHistoricalBuffer(prevBuffer => {
                    // Transform backend candles to frontend format
                    const newCandles = data.updatedCandles.map(candle =>
                        transformCandleData(candle, currentSubscription.current.stockSymbol));

                    // Create a copy of the buffer to modify
                    const updatedBuffer = [...prevBuffer];

                    // Find where to add the new candles
                    newCandles.forEach(newCandle => {
                        const existingIndex = updatedBuffer.findIndex(
                            c => c.timestamp === newCandle.timestamp
                        );

                        if (existingIndex >= 0) {
                            // Replace existing candle
                            updatedBuffer[existingIndex] = newCandle;
                        } else {
                            // Add new candle
                            updatedBuffer.push(newCandle);
                        }
                    });

                    // Sort by timestamp
                    return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
                });
            }
        }
        else if (data.candles) {
            // This is an initial data load
            console.log("[useCandleSubscription] Received initial candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                return;
            }

            // Transform and store the candles
            const candles = data.candles
                .map(c => transformCandleData(c, currentSubscription.current.stockSymbol))
                .sort((a, b) => a.timestamp - b.timestamp); // Ensure proper sorting

            setHistoricalBuffer(candles);

            // Start viewing from the most recent candles
            setViewStartIndex(Math.max(0, candles.length - displayedCandles));

            // Clear any errors since we got data successfully
            setError(null);
            setIsWaitingForData(false);
        }
    }, [subscriptionId, setHistoricalBuffer, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, unsubscribeFromCandles]);

    // Transform candle data from backend format to frontend format
    const transformCandleData = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp: new Date(backendCandle.timestamp).getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || currentSubscription.current.stockSymbol,
            // Initialize indicator values as empty object
            indicatorValues: {}
        };
    }, []);

    // Subscribe to candles
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        // If we're already subscribed to this exact combination, no need to resubscribe
        if (
            currentSubscription.current.platformName === platformName &&
            currentSubscription.current.stockSymbol === stockSymbol &&
            currentSubscription.current.timeframe === timeframe &&
            subscriptionId
        ) {
            console.log("[useCandleSubscription] Already subscribed to this data");
            return Promise.resolve(subscriptionId);
        }

        setIsSubscribing(true);
        setIsWaitingForData(true);

        try {
            // First, unsubscribe from any existing subscription
            if (subscriptionId) {
                console.log(`[useCandleSubscription] Unsubscribing from previous subscription: ${subscriptionId}`);
                await unsubscribeFromCandles();
                // Small delay to ensure backend has processed the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Update current subscription reference
            currentSubscription.current = {
                platformName,
                stockSymbol,
                timeframe
            };

            // Get data range needed
            const range = calculateRequiredDataRange();
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

            const subscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: range.start ? new Date(range.start).toISOString() : oneWeekAgo.toISOString(),
                endDate: range.end ? new Date(range.end).toISOString() : now.toISOString()
            };

            console.log("[useCandleSubscription] Subscribing to candles:", subscriptionRequest);

            await webSocketService.send('/app/candles/subscribe', subscriptionRequest);
            console.log("[useCandleSubscription] Subscription request sent");

            // Note: We don't return subscriptionId here because it will be set
            // asynchronously when we receive the subscription response
            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [subscriptionId, calculateRequiredDataRange, setIsWaitingForData, unsubscribeFromCandles]);

    // Cleanup all known subscriptions
    const cleanupAllSubscriptions = useCallback(async () => {
        const ids = Array.from(allSubscriptionIds.current);
        console.log(`[useCandleSubscription] Cleaning up all ${ids.length} known subscriptions`);

        for (const id of ids) {
            try {
                await unsubscribeFromCandles(id);
                console.log(`[useCandleSubscription] Successfully unsubscribed from: ${id}`);
            } catch (err) {
                console.error(`[useCandleSubscription] Failed to unsubscribe from: ${id}`, err);
            }
        }

        // Clear our subscription tracking
        allSubscriptionIds.current.clear();
    }, [unsubscribeFromCandles]);

    // Connect to WebSocket when component mounts
    useEffect(() => {
        console.log("[useCandleSubscription] Connecting to WebSocket...");
        let userQueueSubscription = null;

        const connectWebSocket = async () => {
            try {
                await webSocketService.connect();
                console.log("[useCandleSubscription] WebSocket connected!");
                setIsConnected(true);
                setError(null);

                // Subscribe to personal queue
                userQueueSubscription = await webSocketService.subscribe('/user/queue/candles', handleCandleMessage);
            } catch (err) {
                console.error("[useCandleSubscription] WebSocket connection error:", err);
                setIsConnected(false);
                setError("Failed to connect to WebSocket: " + err.message);

                toast({
                    title: "Connection Error",
                    description: "Failed to connect to server for live data.",
                    variant: "destructive",
                    duration: 5000
                });
            }
        };

        connectWebSocket();

        // Cleanup on unmount
        return () => {
            console.log("[useCandleSubscription] Cleaning up WebSocket connections");
            const cleanup = async () => {
                try {
                    // Clean up all known subscriptions
                    await cleanupAllSubscriptions();

                    // Then unsubscribe from the user queue
                    if (userQueueSubscription) {
                        await webSocketService.unsubscribe(userQueueSubscription);
                    }

                    // Finally disconnect the websocket
                    await webSocketService.disconnect();
                } catch (err) {
                    console.error("[useCandleSubscription] Error during cleanup:", err);
                }
            };

            cleanup();
        };
    }, [handleCandleMessage, toast, cleanupAllSubscriptions]);

    return {
        isConnected,
        isSubscribing,
        subscriptionId,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        cleanupAllSubscriptions
    };
}
