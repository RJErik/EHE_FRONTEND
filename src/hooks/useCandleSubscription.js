// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from './use-toast';

export function useCandleSubscription() {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const previousPage = useRef(null);

    // Add state to track last valid subscription for fallback
    const [lastValidSubscription, setLastValidSubscription] = useState({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

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
        currentSubscription,
        currentPage
    } = useWebSocket();

    // Add refs for managing indicator update sequences
    const isUpdatingIndicatorSubscription = useRef(false);
    const pendingUpdateRef = useRef(false);
    const isProcessingScrollRequest = useRef(false);

    // Create a ref to hold latest subscription details
    const latestSubscriptionDetailsRef = useRef({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    // Get chart context for data management
    const {
        setDisplayCandles,
        setIndicatorCandles,
        calculateRequiredDataRange,
        setViewStartIndex,
        viewStartIndex,
        displayedCandles,
        setIsWaitingForData,
        applyIndicatorsToCandleDisplay,
        indicators,
        displayCandles,
        checkNeedMoreData,
        isLoadingPastData,
        setIsLoadingPastData,
        isLoadingFutureData,
        setIsLoadingFutureData,
        scrollDirectionRef,
        lastDataRequestRef,
        timeframeInMs
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
            ticker: stockSymbol || currentSubscription.stockSymbol || latestSubscriptionDetailsRef.current.stockSymbol,
            indicatorValues: {}
        };
    }, [currentSubscription.stockSymbol]);

    // Handle incoming chart candle message
    const handleChartCandleMessage = useCallback((data) => {
        // Skip heartbeats - already handled in WebSocketContext
        if (data.updateType === "HEARTBEAT") return;

        // HANDLE INITIAL LOAD OR RESET DATA
        if (data.candles && (data.resetData === true || data.resetData === undefined)) {
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

                // Update latest subscription details when we receive valid data
                if (data.platformName && data.stockSymbol && data.timeframe) {
                    const newDetails = {
                        platformName: data.platformName,
                        stockSymbol: data.stockSymbol,
                        timeframe: data.timeframe
                    };

                    latestSubscriptionDetailsRef.current = newDetails;
                    setLastValidSubscription(newDetails);

                    // Ensure WebSocketContext is also updated
                    updateCurrentSubscriptionInfo(newDetails);
                }
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, data.stockSymbol || currentSubscription.stockSymbol));

            // Update display candles with new data
            updateDisplayCandles(newCandles, true);

            setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            setError(null);
            setIsWaitingForData(false);

            // Reset any ongoing scroll loading states
            setIsLoadingPastData(false);
            setIsLoadingFutureData(false);

            // Also handle subscription ID if present in the same message
            if (data.subscriptionId) {
                setActiveSubscription('chart', data.subscriptionId);
                console.log(`[useCandleSubscription] Successfully subscribed to chart data with ID: ${data.subscriptionId}`);
            }
        }
        // HANDLE SCROLL DATA - detect this by checking if resetData is explicitly false
        else if (data.candles && data.resetData === false) {
            console.log(`[Scroll] Received scroll data, direction: ${data.scrollDirection || "unknown"}, count: ${data.candles.length}`);

            if (data.success === false) {
                console.error("[Scroll] Data fetch error:", data.message);
                // Reset loading states
                setIsLoadingPastData(false);
                setIsLoadingFutureData(false);
                return;
            }

            // No data received, nothing to do
            if (!data.candles.length) {
                console.log("[Scroll] No candles received for this range");
                // Reset loading states
                setIsLoadingPastData(false);
                setIsLoadingFutureData(false);
                return;
            }

            // Log data range received
            const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
            console.log(`[Scroll] Received data range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform the candles
            const newCandles = data.candles.map(c => transformCandleData(c, data.stockSymbol));

            // Get reference to visible area before merge
            const viewStartTimestamp = displayCandles[viewStartIndex]?.timestamp;
            const viewEndIndex = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
            const viewEndTimestamp = displayCandles[viewEndIndex]?.timestamp;

            // Note current display boundaries
            console.log(`[Scroll] Current view: ${viewStartIndex} to ${viewEndIndex}`);
            console.log(`[Scroll] Current view timestamps: ${new Date(viewStartTimestamp).toISOString()} to ${new Date(viewEndTimestamp).toISOString()}`);

            // Merge with existing candles
            setDisplayCandles(prevCandles => {
                // Create a map of existing candles for quick lookup
                const existingMap = new Map();
                prevCandles.forEach(candle => {
                    existingMap.set(candle.timestamp, candle);
                });

                // Merge new candles
                const mergedArray = [...prevCandles];
                let addedCount = 0;

                newCandles.forEach(newCandle => {
                    if (!existingMap.has(newCandle.timestamp)) {
                        mergedArray.push(newCandle);
                        addedCount++;
                    } else {
                        // Replace with newer data if timestamp matches
                        const index = mergedArray.findIndex(c => c.timestamp === newCandle.timestamp);
                        if (index >= 0) {
                            mergedArray[index] = newCandle;
                        }
                    }
                });

                console.log(`[Scroll] Added ${addedCount} new candles to display buffer`);

                // Sort the merged array
                const sortedArray = mergedArray.sort((a, b) => a.timestamp - b.timestamp);

                // If we were loading past data, update the view index to maintain position
                if (data.scrollDirection === 'past' || scrollDirectionRef.current === 'past') {
                    // Find the index of the previous view start candle in the updated array
                    const oldStartIndex = sortedArray.findIndex(c => c.timestamp === viewStartTimestamp);

                    if (oldStartIndex >= 0 && oldStartIndex !== viewStartIndex) {
                        console.log(`[Scroll] Need to adjust view index from ${viewStartIndex} to ${oldStartIndex} due to past data load`);
                        // We'll update the view index after the state update
                        setTimeout(() => {
                            setViewStartIndex(oldStartIndex);
                        }, 0);
                    }
                }

                return sortedArray;
            });

            // Ensure we update indicators too if needed
            if (indicators.length > 0) {
                // Also merge with indicator candles if we have indicators
                setIndicatorCandles(prevCandles => {
                    // Create a map of existing candles for quick lookup
                    const existingMap = new Map();
                    prevCandles.forEach(candle => {
                        existingMap.set(candle.timestamp, candle);
                    });

                    // Merge new candles
                    const mergedArray = [...prevCandles];

                    newCandles.forEach(newCandle => {
                        if (!existingMap.has(newCandle.timestamp)) {
                            mergedArray.push(newCandle);
                        } else {
                            // Replace with newer data if timestamp matches
                            const index = mergedArray.findIndex(c => c.timestamp === newCandle.timestamp);
                            if (index >= 0) {
                                mergedArray[index] = newCandle;
                            }
                        }
                    });

                    // Sort the merged array
                    return mergedArray.sort((a, b) => a.timestamp - b.timestamp);
                });

                // Schedule indicator recalculation
                setTimeout(() => {
                    applyIndicatorsToCandleDisplay();
                }, 50);
            }

            // Reset loading state for this direction
            if (data.scrollDirection === 'past' || scrollDirectionRef.current === 'past') {
                setIsLoadingPastData(false);
            } else {
                setIsLoadingFutureData(false);
            }

            // Reset the scroll direction
            scrollDirectionRef.current = null;
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
                transformCandleData(candle, data.stockSymbol || currentSubscription.stockSymbol));

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

            // If this contains subscription details, update our reference
            if (data.platformName && data.stockSymbol && data.timeframe) {
                const newDetails = {
                    platformName: data.platformName,
                    stockSymbol: data.stockSymbol,
                    timeframe: data.timeframe
                };

                latestSubscriptionDetailsRef.current = newDetails;
                setLastValidSubscription(newDetails);

                // Ensure WebSocketContext is also updated
                updateCurrentSubscriptionInfo(newDetails);
            }
        } else {
            console.log("[useCandleSubscription] Message did not match any handler conditions:", data);
        }
    }, [setDisplayCandles, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, transformCandleData,
        setActiveSubscription, currentSubscription.stockSymbol, updateCurrentSubscriptionInfo, viewStartIndex,
        displayCandles, indicators, setIndicatorCandles, applyIndicatorsToCandleDisplay,
        setIsLoadingPastData, setIsLoadingFutureData]);

    // Handle incoming indicator candle data
    const handleIndicatorCandleMessage = useCallback((data) => {
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

                // Update latest subscription details if not already set
                if (data.platformName && data.stockSymbol && data.timeframe &&
                    (!latestSubscriptionDetailsRef.current.platformName ||
                        !latestSubscriptionDetailsRef.current.stockSymbol ||
                        !latestSubscriptionDetailsRef.current.timeframe)) {

                    const newDetails = {
                        platformName: data.platformName,
                        stockSymbol: data.stockSymbol,
                        timeframe: data.timeframe
                    };

                    latestSubscriptionDetailsRef.current = newDetails;
                    setLastValidSubscription(newDetails);

                    // Ensure WebSocketContext is also updated
                    updateCurrentSubscriptionInfo(newDetails);
                }
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, data.stockSymbol || currentSubscription.stockSymbol));

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
                transformCandleData(candle, data.stockSymbol || currentSubscription.stockSymbol));

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
    }, [setIndicatorCandles, applyIndicatorsToCandleDisplay, toast, transformCandleData, setActiveSubscription, currentSubscription.stockSymbol, updateCurrentSubscriptionInfo]);

    // New function to request data for a specific range when scrolling
    const requestDataRange = useCallback(async (direction) => {
        // Prevent duplicate requests
        if (isProcessingScrollRequest.current) {
            console.log("[Scroll] Skipping request - already processing another request");
            return;
        }

        // Get parameters with fallbacks
        let platformName = currentSubscription.platformName;
        let stockSymbol = currentSubscription.stockSymbol;
        let timeframe = currentSubscription.timeframe;

        // Try using fallbacks if any value is missing
        if (!platformName || !stockSymbol || !timeframe) {
            // Try using the latestSubscriptionDetailsRef as fallback
            if (latestSubscriptionDetailsRef.current.platformName &&
                latestSubscriptionDetailsRef.current.stockSymbol &&
                latestSubscriptionDetailsRef.current.timeframe) {

                console.log("[Scroll] Using latest subscription details as fallback");
                platformName = latestSubscriptionDetailsRef.current.platformName;
                stockSymbol = latestSubscriptionDetailsRef.current.stockSymbol;
                timeframe = latestSubscriptionDetailsRef.current.timeframe;
            }
            // Then try lastValidSubscription as second fallback
            else if (lastValidSubscription.platformName &&
                lastValidSubscription.stockSymbol &&
                lastValidSubscription.timeframe) {

                console.log("[Scroll] Using last valid subscription details as fallback");
                platformName = lastValidSubscription.platformName;
                stockSymbol = lastValidSubscription.stockSymbol;
                timeframe = lastValidSubscription.timeframe;
            }
            else {
                console.error("[Scroll] No subscription details available");
                return;
            }
        }

        if (!platformName || !stockSymbol || !timeframe) {
            console.error("[Scroll] Missing subscription parameters even after fallbacks");
            return;
        }

        // Get current boundaries
        const firstCandle = displayCandles[0];
        const lastCandle = displayCandles[displayCandles.length - 1];

        if (!firstCandle || !lastCandle) {
            console.log("[Scroll] No candles available to determine request range");
            return;
        }

        let startDate, endDate;
        // Calculate the timeframe in milliseconds
        let timeframeDuration = timeframeInMs || 60000; // Default to 1 minute

        // Set loading flag for relevant direction
        if (direction === 'past') {
            setIsLoadingPastData(true);
        } else {
            setIsLoadingFutureData(true);
        }

        // Mark that we're processing a request
        isProcessingScrollRequest.current = true;

        // Set appropriate request parameters based on direction
        if (direction === 'past') {
            // Request older data
            endDate = new Date(firstCandle.timestamp - 1); // Just before first candle
            startDate = new Date(endDate.getTime() - (timeframeDuration * 100)); // Get 100 candles

            // Don't request if we just requested this range
            if (lastDataRequestRef.current.past &&
                Math.abs(lastDataRequestRef.current.past - startDate.getTime()) < timeframeDuration * 10) {
                console.log("[Scroll] Skipping duplicate past data request");
                setIsLoadingPastData(false);
                isProcessingScrollRequest.current = false;
                return;
            }

            // Store this request time
            lastDataRequestRef.current.past = startDate.getTime();
        } else {
            // Request newer data
            startDate = new Date(lastCandle.timestamp + 1); // Just after last candle
            endDate = new Date(startDate.getTime() + (timeframeDuration * 100)); // Get 100 candles

            // Cap at current time
            const now = new Date();
            if (endDate > now) endDate = now;

            // Don't request if we just requested this range
            if (lastDataRequestRef.current.future &&
                Math.abs(lastDataRequestRef.current.future - endDate.getTime()) < timeframeDuration * 10) {
                console.log("[Scroll] Skipping duplicate future data request");
                setIsLoadingFutureData(false);
                isProcessingScrollRequest.current = false;
                return;
            }

            // Store this request time
            lastDataRequestRef.current.future = endDate.getTime();
        }

        console.log(`[Scroll] Requesting ${direction} data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Track this scroll direction for later reference
        scrollDirectionRef.current = direction;

        try {
            await requestSubscription('chart', {
                platformName,  // Use the local variables, not destructured from currentSubscription
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                resetData: false, // IMPORTANT: Don't reset existing data
                scrollDirection: direction // Add this so we can track on response
            });

            console.log(`[Scroll] ${direction} data request successfully sent`);
        } catch (err) {
            console.error(`[Scroll] Error requesting ${direction} data:`, err);
            // Reset loading state on error
            if (direction === 'past') {
                setIsLoadingPastData(false);
            } else {
                setIsLoadingFutureData(false);
            }
        } finally {
            // Reset processing flag after a delay
            setTimeout(() => {
                isProcessingScrollRequest.current = false;
            }, 500);
        }
    }, [
        displayCandles,
        currentSubscription,
        timeframeInMs,
        requestSubscription,
        setIsLoadingPastData,
        setIsLoadingFutureData,
        lastValidSubscription
    ]);


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

            // Update our local reference before making the request
            const subscriptionDetails = {
                platformName,
                stockSymbol,
                timeframe
            };

            latestSubscriptionDetailsRef.current = subscriptionDetails;
            setLastValidSubscription(subscriptionDetails);

            // Update subscription details - store centrally for both subscriptions
            updateCurrentSubscriptionInfo(subscriptionDetails);

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
                subscriptionType: 'CHART',  // Add type marker for backend differentiation
                resetData: true // Ensure we clear existing data for a new subscription
            };

            console.log("[useCandleSubscription] Subscribing to chart candles:", chartSubscriptionRequest);

            // Reset loading states for a new subscription
            setIsLoadingPastData(false);
            setIsLoadingFutureData(false);

            // Reset data request tracking
            lastDataRequestRef.current = { past: null, future: null };

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
        subscriptionIds.chart, unsubscribe, updateCurrentSubscriptionInfo, requestSubscription,
        setIsLoadingPastData, setIsLoadingFutureData]);

    // Subscribe to candles for indicator calculations
    const subscribeToIndicatorCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        // Only subscribe if we have indicators
        if (indicators.length === 0) {
            console.log("[useCandleSubscription] No indicators active, skipping indicator subscription");
            return Promise.resolve(null);
        }

        // Added fallback to local reference or currentSubscription if parameters not provided
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for indicator subscription");

            // Try to use the latestSubscriptionDetailsRef as fallback
            if (latestSubscriptionDetailsRef.current.platformName &&
                latestSubscriptionDetailsRef.current.stockSymbol &&
                latestSubscriptionDetailsRef.current.timeframe) {

                console.log("[useCandleSubscription] Using latest subscription details as fallback");
                platformName = latestSubscriptionDetailsRef.current.platformName;
                stockSymbol = latestSubscriptionDetailsRef.current.stockSymbol;
                timeframe = latestSubscriptionDetailsRef.current.timeframe;
            }
            // Then try currentSubscription as second fallback
            else if (currentSubscription.platformName &&
                currentSubscription.stockSymbol &&
                currentSubscription.timeframe) {

                console.log("[useCandleSubscription] Using current subscription details as fallback");
                platformName = currentSubscription.platformName;
                stockSymbol = currentSubscription.stockSymbol;
                timeframe = currentSubscription.timeframe;
            }
            // Lastly try lastValidSubscription state
            else if (lastValidSubscription.platformName &&
                lastValidSubscription.stockSymbol &&
                lastValidSubscription.timeframe) {

                console.log("[useCandleSubscription] Using last valid subscription details as fallback");
                platformName = lastValidSubscription.platformName;
                stockSymbol = lastValidSubscription.stockSymbol;
                timeframe = lastValidSubscription.timeframe;
            }
            else {
                return Promise.reject(new Error("Missing required parameters and no fallback available"));
            }
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
        subscriptionIds.indicator, unsubscribe, requestSubscription, lastValidSubscription, currentSubscription]);

    // Update indicator subscription when indicator requirements change - debounced version
    const updateIndicatorSubscription = useCallback(async () => {
        // Only proceed if we have an active chart subscription and indicators
        if (!subscriptionIds.chart || indicators.length === 0) {
            console.log("[useCandleSubscription] Skipping indicator update - no chart subscription or no indicators");
            return;
        }

        // Get subscription details with fallbacks
        let platformName = currentSubscription.platformName;
        let stockSymbol = currentSubscription.stockSymbol;
        let timeframe = currentSubscription.timeframe;

        // If current subscription is missing details, try using our local reference
        if (!platformName || !stockSymbol || !timeframe) {
            if (latestSubscriptionDetailsRef.current.platformName &&
                latestSubscriptionDetailsRef.current.stockSymbol &&
                latestSubscriptionDetailsRef.current.timeframe) {

                console.log("[useCandleSubscription] Using latest subscription details from ref for indicator update");
                platformName = latestSubscriptionDetailsRef.current.platformName;
                stockSymbol = latestSubscriptionDetailsRef.current.stockSymbol;
                timeframe = latestSubscriptionDetailsRef.current.timeframe;
            }
            // Then try lastValidSubscription state as fallback
            else if (lastValidSubscription.platformName &&
                lastValidSubscription.stockSymbol &&
                lastValidSubscription.timeframe) {

                console.log("[useCandleSubscription] Using last valid subscription for indicator update");
                platformName = lastValidSubscription.platformName;
                stockSymbol = lastValidSubscription.stockSymbol;
                timeframe = lastValidSubscription.timeframe;
            }
        }

        if (!platformName || !stockSymbol || !timeframe) {
            console.log("[useCandleSubscription] Cannot update indicator subscription - missing details");
            console.log(`!!!platformName ${platformName}`);
            console.log(`!!!stockSymbol ${stockSymbol}`);
            console.log(`!!!timeframe ${timeframe}`);
            return;
        }

        console.log("[useCandleSubscription] Updating indicator subscription due to indicator changes");
        console.log(`Using details: ${platformName}, ${stockSymbol}, ${timeframe}`);

        try {
            await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
        } catch (err) {
            console.error("[useCandleSubscription] Failed to update indicator subscription:", err);
        }
    }, [indicators, subscribeToIndicatorCandles, subscriptionIds.chart, currentSubscription, lastValidSubscription]);

    // Main subscription function exposed to components
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        try {
            // Update our local reference with these parameters
            const subscriptionDetails = {
                platformName,
                stockSymbol,
                timeframe
            };

            latestSubscriptionDetailsRef.current = subscriptionDetails;
            setLastValidSubscription(subscriptionDetails);

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
        const handleIndicatorRequirementsChanged = async () => {
            // Add debounce handling to prevent multiple rapid updates
            if (isUpdatingIndicatorSubscription.current) {
                console.log("[Indicator Monitor] Update already in progress, queueing request");
                pendingUpdateRef.current = true;
                return;
            }

            isUpdatingIndicatorSubscription.current = true;
            console.log(`[Indicator Monitor] Detected indicator requirements change event`);

            // Log if subscription details are available
            const details = {
                fromCurrent: Boolean(currentSubscription.platformName && currentSubscription.stockSymbol && currentSubscription.timeframe),
                fromLatestRef: Boolean(latestSubscriptionDetailsRef.current.platformName &&
                    latestSubscriptionDetailsRef.current.stockSymbol &&
                    latestSubscriptionDetailsRef.current.timeframe),
                fromLastValid: Boolean(lastValidSubscription.platformName &&
                    lastValidSubscription.stockSymbol &&
                    lastValidSubscription.timeframe),
            };

            console.log("[Indicator Monitor] Subscription details availability:", details);

            try {
                await updateIndicatorSubscription();
            } finally {
                // Add small delay before allowing next update
                setTimeout(() => {
                    isUpdatingIndicatorSubscription.current = false;
                    if (pendingUpdateRef.current) {
                        pendingUpdateRef.current = false;
                        console.log("[Indicator Monitor] Processing queued update request");
                        handleIndicatorRequirementsChanged();
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
    }, [updateIndicatorSubscription, currentSubscription, lastValidSubscription]);

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

    // Add effect to handle page navigation and cleanup subscriptions when leaving StockMarket
    useEffect(() => {
        // Set up subscriptions and handlers...

        // This cleanup function will run when the component unmounts
        return () => {
            console.log("[useCandleSubscription] Component unmounting - cleaning up subscriptions");

            // Clean up any active subscriptions
            if (subscriptionIds.chart) {
                console.log("[useCandleSubscription] Unsubscribing from chart data");
                unsubscribe('chart').catch(err => {
                    console.error("[useCandleSubscription] Error unsubscribing from chart data:", err);
                });
            }

            if (subscriptionIds.indicator) {
                console.log("[useCandleSubscription] Unsubscribing from indicator data");
                unsubscribe('indicator').catch(err => {
                    console.error("[useCandleSubscription] Error unsubscribing from indicator data:", err);
                });
            }
        };
    }, []); // Empty dependency array means this runs on mount and cleanup runs on unmount

    // Watch for indicator changes to manage indicator subscription lifecycle
    useEffect(() => {
        // If indicators are added and we have an active chart subscription but no indicator subscription
        if (indicators.length > 0 &&
            subscriptionIds.chart &&
            !subscriptionIds.indicator) {

            // Try getting subscription details with fallbacks
            let platformName = currentSubscription.platformName;
            let stockSymbol = currentSubscription.stockSymbol;
            let timeframe = currentSubscription.timeframe;

            if (!platformName || !stockSymbol || !timeframe) {
                // Try ref first
                if (latestSubscriptionDetailsRef.current.platformName &&
                    latestSubscriptionDetailsRef.current.stockSymbol &&
                    latestSubscriptionDetailsRef.current.timeframe) {

                    console.log("[Indicator Lifecycle] Using latest subscription details from ref");
                    platformName = latestSubscriptionDetailsRef.current.platformName;
                    stockSymbol = latestSubscriptionDetailsRef.current.stockSymbol;
                    timeframe = latestSubscriptionDetailsRef.current.timeframe;
                }
                // Then try lastValidSubscription state
                else if (lastValidSubscription.platformName &&
                    lastValidSubscription.stockSymbol &&
                    lastValidSubscription.timeframe) {

                    console.log("[Indicator Lifecycle] Using last valid subscription");
                    platformName = lastValidSubscription.platformName;
                    stockSymbol = lastValidSubscription.stockSymbol;
                    timeframe = lastValidSubscription.timeframe;
                }
            }

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
            } else {
                console.log("[useCandleSubscription] Cannot create indicator subscription - missing details");
            }
        }
        // If indicators are removed and we have an active indicator subscription
        else if (indicators.length === 0 && subscriptionIds.indicator) {
            console.log("[useCandleSubscription] No indicators active - removing indicator subscription");
            unsubscribe('indicator').catch(err => {
                console.error("[useCandleSubscription] Failed to remove indicator subscription:", err);
            });
        }
    }, [indicators, subscribeToIndicatorCandles, currentSubscription, lastValidSubscription, subscriptionIds, unsubscribe]);

    // Add a new effect for monitoring scrolling position
    useEffect(() => {
        const checkAndLoadMoreData = () => {
            const direction = checkNeedMoreData();
            if (!direction) return;

            console.log(`[Scroll] Need to load more ${direction} data`);
            requestDataRange(direction).catch(err => {
                console.error(`[Scroll] Error requesting ${direction} data:`, err);
            });
        };

        // Check when view index changes
        checkAndLoadMoreData();

    }, [viewStartIndex, checkNeedMoreData, requestDataRange]);

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
        updateIndicatorSubscription,
        // Expose the current subscription details
        currentSubscriptionDetails: {
            ...lastValidSubscription
        },
        // Expose scroll-related functions for direct component use if needed
        requestDataRange
    };
}