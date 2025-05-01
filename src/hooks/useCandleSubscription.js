// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from './use-toast';

export function useCandleSubscription() {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Use the global WebSocket context
    const {
        isConnected,
        registerHandler,
        unregisterHandler,
        requestSubscription,
        unsubscribe,
        unsubscribeAll,
        setActiveSubscription,
        updateCurrentSubscriptionInfo,
        subscriptionIds,
        currentSubscription
    } = useWebSocket();

    // Add refs for managing indicator update sequences
    const isUpdatingIndicatorSubscription = useRef(false);
    const pendingUpdateRef = useRef(false);

    // Get chart context for data management
    const {
        setDisplayCandles,
        setIndicatorCandles,
        calculateRequiredDataRange,
        setViewStartIndex,
        displayedCandles,
        setIsWaitingForData,
        applyIndicatorsToCandleDisplay,
        indicators
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

    // Transform candle data from backend format to frontend format
    const transformCandleData = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp: new Date(backendCandle.timestamp).getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || currentSubscription.stockSymbol,
            indicatorValues: {}
        };
    }, [currentSubscription.stockSymbol]);

    // Handle incoming chart candle message
    const handleChartCandleMessage = useCallback((data) => {
        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        console.log(data);

        // Skip heartbeats - already handled in WebSocketContext
        if (data.updateType === "HEARTBEAT") return;

        // UPDATED APPROACH: Check for candles first, regardless of other properties
        if (data.candles) {
            console.log("[useCandleSubscription] Received initial chart candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Chart data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                return;
            }

            // Log the received data range
            if (data.candles.length > 0) {
                const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
                const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
                console.log(`[WebSocket Data] Received initial chart data range: ${firstCandleTime} to ${lastCandleTime}`);
                console.log(`[WebSocket Data] Platform: ${data.platformName}, Symbol: ${data.stockSymbol}, Timeframe: ${data.timeframe}`);
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, currentSubscription.stockSymbol));

            // Update display candles with new data
            updateDisplayCandles(newCandles, true);

            setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            setError(null);
            setIsWaitingForData(false);

            // Also handle subscription ID if present in the same message
            if (data.subscriptionId) {
                setActiveSubscription('chart', data.subscriptionId);
                console.log(`[useCandleSubscription] Successfully subscribed to chart data with ID: ${data.subscriptionId}`);
            }
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received chart candle updates:", data.updatedCandles.length);

            // Get timestamps from first and last candles to log data range received
            const firstCandleTime = new Date(data.updatedCandles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.updatedCandles[data.updatedCandles.length-1].timestamp).toISOString();
            console.log(`[WebSocket Data] Received chart candle update range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, currentSubscription.stockSymbol));

            // Update display candles only
            updateDisplayCandles(newCandles);
        }
        // Handle subscription response with no candles
        else if (data.subscriptionId && data.updateType === undefined) {
            if (data.success === false) {
                console.error("[useCandleSubscription] Chart subscription error:", data.message);
                setError(data.message);

                toast({
                    title: "Chart Subscription Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 5000
                });
                return;
            }

            // Store the new subscription ID
            setActiveSubscription('chart', data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed to chart data with ID: ${data.subscriptionId}`);
        } else {
            console.log("[useCandleSubscription] Message did not match any handler conditions:", data);
        }
    }, [setDisplayCandles, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, transformCandleData, setActiveSubscription, currentSubscription.stockSymbol]);


    // Handle incoming indicator candle data
    const handleIndicatorCandleMessage = useCallback((data) => {
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        console.log(data);

        // Skip heartbeats - already handled in WebSocketContext
        if (data.updateType === "HEARTBEAT") return;

        // UPDATED APPROACH: Check for candles first, regardless of other properties
        if (data.candles) {
            console.log("[useCandleSubscription] Received initial indicator candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Indicator data fetch error:", data.message);
                // Don't set global error for indicator data issues

                toast({
                    title: "Indicator Data Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 3000
                });
                return;
            }

            // Log the received data range
            if (data.candles.length > 0) {
                const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
                const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
                console.log(`[WebSocket Data] Received initial indicator data range: ${firstCandleTime} to ${lastCandleTime}`);
                console.log(`[WebSocket Data] Platform: ${data.platformName}, Symbol: ${data.stockSymbol}, Timeframe: ${data.timeframe}`);
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, currentSubscription.stockSymbol));

            // Update indicator candles with new data
            updateIndicatorCandles(newCandles, true);

            // Apply indicators after data is loaded
            setTimeout(() => {
                applyIndicatorsToCandleDisplay();
            }, 50);

            // Also handle subscription ID if present in the same message
            if (data.subscriptionId) {
                setActiveSubscription('indicator', data.subscriptionId);
                console.log(`[useCandleSubscription] Successfully subscribed to indicator data with ID: ${data.subscriptionId}`);
            }
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received indicator candle updates:", data.updatedCandles.length);

            // Get timestamps from first and last candles to log data range received
            const firstCandleTime = new Date(data.updatedCandles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.updatedCandles[data.updatedCandles.length-1].timestamp).toISOString();
            console.log(`[WebSocket Data] Received indicator candle update range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, currentSubscription.stockSymbol));

            // Update indicator candles only
            updateIndicatorCandles(newCandles);
        }
        // Handle subscription response with no candles
        else if (data.subscriptionId && data.updateType === undefined) {
            if (data.success === false) {
                console.error("[useCandleSubscription] Indicator subscription error:", data.message);

                toast({
                    title: "Indicator Data Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 3000
                });
                return;
            }

            // Store the new subscription ID
            setActiveSubscription('indicator', data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed to indicator data with ID: ${data.subscriptionId}`);
        } else {
            console.log("[useCandleSubscription] Message did not match any handler conditions:", data);
        }
    }, [setIndicatorCandles, applyIndicatorsToCandleDisplay, toast, transformCandleData, setActiveSubscription, currentSubscription.stockSymbol]);

    // Helper function to update only display candles
    const updateDisplayCandles = useCallback((newCandles, isInitialLoad = false) => {
        setDisplayCandles(prevCandles => {
            console.log('[Chart] Updating display candles - Initial load:', isInitialLoad);

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
    }, [setDisplayCandles]);

    // Helper function to update only indicator candles
    const updateIndicatorCandles = useCallback((newCandles, isInitialLoad = false) => {
        setIndicatorCandles(prevCandles => {
            console.log('[Indicator] Updating indicator candles - Initial load:', isInitialLoad);

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
    }, [setIndicatorCandles]);

    // Subscribe to candles for the chart display
    const subscribeToChartCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for chart subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        // If we're already subscribed to this exact combination for chart data, no need to resubscribe
        if (
            currentSubscription.platformName === platformName &&
            currentSubscription.stockSymbol === stockSymbol &&
            currentSubscription.timeframe === timeframe &&
            subscriptionIds.chart
        ) {
            console.log("[useCandleSubscription] Already subscribed to this chart data");
            return Promise.resolve(subscriptionIds.chart);
        }

        setIsSubscribing(true);
        setIsWaitingForData(true);

        try {
            // First, unsubscribe from any existing chart subscription
            if (subscriptionIds.chart) {
                console.log(`[useCandleSubscription] Unsubscribing from current chart subscription before creating new one`);
                await unsubscribe('chart');
                // Small delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Update subscription details - store centrally for both subscriptions
            updateCurrentSubscriptionInfo({
                platformName,
                stockSymbol,
                timeframe
            });

            // For chart data, request exactly displayedCandles worth of data
            const now = new Date();
            const endDate = now;
            const startDate = calculateStartDate(endDate, timeframe, displayedCandles);

            console.log("--------- CHART CANDLE DATA REQUEST ---------");
            console.log(`[Chart Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Chart Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Chart Request] End date: ${endDate.toISOString()}`);
            console.log(`[Chart Request] Candles needed: ${displayedCandles}`);
            console.log("---------------------------------------------");

            const chartSubscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                subscriptionType: 'CHART'  // Add type marker for backend differentiation
            };

            console.log("[useCandleSubscription] Subscribing to chart candles:", chartSubscriptionRequest);

            // Use the WebSocketContext's request method for subscriptions
            await requestSubscription('chart', chartSubscriptionRequest);
            console.log("[useCandleSubscription] Chart subscription request sent");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to chart candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [calculateStartDate, setIsWaitingForData, displayedCandles, currentSubscription, 
        subscriptionIds.chart, unsubscribe, updateCurrentSubscriptionInfo, requestSubscription]);

    // Subscribe to candles for indicator calculations
    const subscribeToIndicatorCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        // Only subscribe if we have indicators
        if (indicators.length === 0) {
            console.log("[useCandleSubscription] No indicators active, skipping indicator subscription");
            return Promise.resolve(null);
        }

        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for indicator subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        try {
            // First, unsubscribe from any existing indicator subscription
            if (subscriptionIds.indicator) {
                console.log(`[useCandleSubscription] Unsubscribing from current indicator subscription before creating new one`);
                await unsubscribe('indicator');
                // Longer delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Calculate the required data range for indicators
            const range = calculateRequiredDataRange();

            // For indicator data, use the calculated range or a sensible default
            const now = new Date();
            const endDate = range.end ? new Date(range.end) : now;

            // Start date should be further back based on indicator requirements
            const startDate = range.start ? new Date(range.start) :
                calculateStartDate(endDate, timeframe, displayedCandles * 3); // Use 3x display candles as safe default

            console.log("--------- INDICATOR CANDLE DATA REQUEST ---------");
            console.log(`[Indicator Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Indicator Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Indicator Request] End date: ${endDate.toISOString()}`);
            console.log(`[Indicator Request] Lookback needed: ${range.lookbackNeeded || 'default'} candles`);
            console.log(`[Indicator Request] Active indicators: ${indicators.length}`);
            console.log("--------------------------------------------------");

            const indicatorSubscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                resetData: true,  // Always true for indicator data
                subscriptionType: 'INDICATOR'  // Add type marker for backend differentiation
            };

            console.log("[useCandleSubscription] Subscribing to indicator candles:", indicatorSubscriptionRequest);

            // Use the WebSocketContext's request method for subscriptions
            await requestSubscription('indicator', indicatorSubscriptionRequest);
            console.log("[useCandleSubscription] Indicator subscription request sent");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to indicator candles:", err);

            toast({
                title: "Indicator Data Error",
                description: "Failed to subscribe to indicator data: " + err.message,
                variant: "destructive",
                duration: 3000
            });

            return null;
        }
    }, [calculateRequiredDataRange, calculateStartDate, displayedCandles, indicators, toast, 
        subscriptionIds.indicator, unsubscribe, requestSubscription]);

    // Update indicator subscription when indicator requirements change - debounced version
    const updateIndicatorSubscription = useCallback(async () => {
        // Only proceed if we have an active chart subscription and indicators
        if (!subscriptionIds.chart || indicators.length === 0) {
            console.log("[useCandleSubscription] Skipping indicator update - no chart subscription or no indicators");
            return;
        }

        const { platformName, stockSymbol, timeframe } = currentSubscription;
        if (!platformName || !stockSymbol || !timeframe) {
            console.log("[useCandleSubscription] Cannot update indicator subscription - missing details");
            return;
        }

        console.log("[useCandleSubscription] Updating indicator subscription due to indicator changes");
        try {
            await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
        } catch (err) {
            console.error("[useCandleSubscription] Failed to update indicator subscription:", err);
        }
    }, [indicators, subscribeToIndicatorCandles, subscriptionIds.chart, currentSubscription]);

    // Main subscription function exposed to components
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        try {
            // First subscribe to chart data
            await subscribeToChartCandles(platformName, stockSymbol, timeframe);

            // After subscribing to chart data, also subscribe to indicator data if needed
            if (indicators.length > 0) {
                // Small delay to ensure backend processes the first subscription
                await new Promise(resolve => setTimeout(resolve, 500));
                await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
            }

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error in main subscription function:", err);
            throw err;
        }
    }, [subscribeToChartCandles, subscribeToIndicatorCandles, indicators]);

    // Listen for indicator requirement changes with debouncing
    useEffect(() => {
        // Define event handler for indicator requirement changes
        const handleIndicatorRequirementsChanged = async (event) => {
            // Add debounce handling to prevent multiple rapid updates
            if (isUpdatingIndicatorSubscription.current) {
                console.log("[Indicator Monitor] Update already in progress, queueing request");
                pendingUpdateRef.current = true;
                return;
            }

            isUpdatingIndicatorSubscription.current = true;
            console.log(`[Indicator Monitor] Detected indicator requirements change event`);

            try {
                await updateIndicatorSubscription();
            } finally {
                // Add small delay before allowing next update
                setTimeout(() => {
                    isUpdatingIndicatorSubscription.current = false;
                    if (pendingUpdateRef.current) {
                        pendingUpdateRef.current = false;
                        console.log("[Indicator Monitor] Processing queued update request");
                        handleIndicatorRequirementsChanged({type: 'queued'});
                    }
                }, 500);
            }
        };

        // Register event listener for indicator changes
        window.addEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);

        // Clean up event listener
        return () => {
            window.removeEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);
        };
    }, [updateIndicatorSubscription]);

    // Register message handlers with WebSocketContext on mount
    useEffect(() => {
        console.log("[useCandleSubscription] Registering message handlers with WebSocketContext");
        
        // Register our handlers
        const unregChartHandler = registerHandler('chart', handleChartCandleMessage);
        const unregIndicatorHandler = registerHandler('indicator', handleIndicatorCandleMessage);

        // Cleanup function - unregister our handlers when unmounting
        return () => {
            console.log("[useCandleSubscription] Unregistering message handlers");
            unregChartHandler();
            unregIndicatorHandler();
        };
    }, [handleChartCandleMessage, handleIndicatorCandleMessage, registerHandler]);

    // Watch for indicator changes to manage indicator subscription lifecycle
    useEffect(() => {
        // If indicators are added and we have an active chart subscription but no indicator subscription
        if (indicators.length > 0 &&
            subscriptionIds.chart &&
            !subscriptionIds.indicator) {

            const { platformName, stockSymbol, timeframe } = currentSubscription;
            if (platformName && stockSymbol && timeframe) {
                console.log("[useCandleSubscription] Indicators added - creating indicator subscription");

                // Use setTimeout to ensure this doesn't conflict with other indicator updates
                setTimeout(() => {
                    if (!isUpdatingIndicatorSubscription.current) {
                        subscribeToIndicatorCandles(platformName, stockSymbol, timeframe).catch(err => {
                            console.error("[useCandleSubscription] Failed to create indicator subscription:", err);
                        });
                    } else {
                        console.log("[useCandleSubscription] Skipping immediate indicator subscription - update already in progress");
                    }
                }, 100);
            }
        }
        // If indicators are removed and we have an active indicator subscription
        else if (indicators.length === 0 && subscriptionIds.indicator) {
            console.log("[useCandleSubscription] No indicators active - removing indicator subscription");
            unsubscribe('indicator').catch(err => {
                console.error("[useCandleSubscription] Failed to remove indicator subscription:", err);
            });
        }
    }, [indicators, subscribeToIndicatorCandles, currentSubscription, subscriptionIds, unsubscribe]);

    // Expose the unsubscribe function for explicit use
    const unsubscribeFromCandles = useCallback(async () => {
        return unsubscribeAll();
    }, [unsubscribeAll]);

    return {
        isConnected,
        isSubscribing,
        // Return subscription IDs for debugging
        subscriptionIds,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        updateIndicatorSubscription
    };
}