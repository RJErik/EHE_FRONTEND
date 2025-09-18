// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '@/feature/stockMarket/ChartContext';
import { useWebSocket } from '../context/CandleWebSocketContext.jsx';
import { useToast } from './use-toast';

export function useCandleSubscription() {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const previousPage = useRef(null);

    // NEW: Add state to track last valid subscription for fallback
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
    const referenceTimestampRef = useRef(null);
    const isRequestingBufferUpdate = useRef(false);
    // Controls whether the next indicator candles message should replace buffer (true) or merge (false)
    const expectIndicatorResetRef = useRef(false);

    // Remember last indicator subscription request to avoid redundant resubscribes
    const lastIndicatorRequestRef = useRef(null);
    // Track last chart buffer request and observed end to avoid repeating non-extending future requests
    const lastChartRequestedRangeRef = useRef({ start: null, end: null, direction: null });
    const lastChartObservedEndRef = useRef(null);
    const chartRequestCooldownUntilRef = useRef(0);

    // NEW: Create a ref to hold latest subscription details
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
            ticker: stockSymbol || currentSubscription.stockSymbol || latestSubscriptionDetailsRef.current.stockSymbol,
            indicatorValues: {}
        };
    }, [currentSubscription.stockSymbol]);

    // Handle incoming chart candle message
    const handleChartCandleMessage = useCallback((data) => {
        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        console.log(data);

        // Skip heartbeats - already handled in CandleWebSocketContext
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

                // NEW: Update latest subscription details when we receive valid data
                if (data.platformName && data.stockSymbol && data.timeframe) {
                    const newDetails = {
                        platformName: data.platformName,
                        stockSymbol: data.stockSymbol,
                        timeframe: data.timeframe
                    };

                    latestSubscriptionDetailsRef.current = newDetails;
                    setLastValidSubscription(newDetails);

                    // Ensure CandleWebSocketContext is also updated
                    updateCurrentSubscriptionInfo(newDetails);
                    
                    // Update the buffer date range in ChartContext
                    if (data.startDate && data.endDate) {
                        // Convert to milliseconds if necessary
                        const startDate = typeof data.startDate === 'string' ? 
                            new Date(data.startDate).getTime() : data.startDate;
                        const endDate = typeof data.endDate === 'string' ? 
                            new Date(data.endDate).getTime() : data.endDate;
                            
                        if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange) {
                            window.__chartContextValue.updateSubscriptionDateRange(startDate, endDate);
                        }
                    } else if (data.candles.length > 0) {
                        // If not provided explicitly, estimate from the candles we received
                        const startDate = new Date(data.candles[0].timestamp).getTime();
                        const endDate = new Date(data.candles[data.candles.length-1].timestamp).getTime();
                        
                        if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange) {
                            window.__chartContextValue.updateSubscriptionDateRange(startDate, endDate);
                        }
                    }
                }
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, data.stockSymbol || currentSubscription.stockSymbol));

            // Check if this is a buffer update
            const isBufferUpdate = (data.isBufferUpdate || data.resetData === true) || isRequestingBufferUpdate.current;
            if (isRequestingBufferUpdate.current) {
                isRequestingBufferUpdate.current = false; // Reset the flag immediately after use
            }
            
            if (isBufferUpdate) {
                console.log("[Buffer Manager] Processing buffer update response");
                
                // Infer buffer direction by comparing received range to current known buffer
                let bufferDirection = 'unknown';
                try {
                    const prevCandles = (window.__chartContextValue && window.__chartContextValue.displayCandles) || [];
                    const prevStart = prevCandles.length ? prevCandles[0].timestamp : null;
                    const prevEnd = prevCandles.length ? prevCandles[prevCandles.length - 1].timestamp : null;
                    const newStart = Math.min(...newCandles.map(c => c.timestamp));
                    const newEnd = Math.max(...newCandles.map(c => c.timestamp));
                    const epsilon = (window.__chartContextValue && window.__chartContextValue.timeframeInMs) || 60_000;

                    if (prevStart != null && prevEnd != null && Number.isFinite(newStart) && Number.isFinite(newEnd)) {
                        const touchesPast = newEnd <= (prevStart + epsilon);
                        const touchesFuture = newStart >= (prevEnd - epsilon);
                        if (touchesPast && !touchesFuture) bufferDirection = 'past';
                        else if (touchesFuture && !touchesPast) bufferDirection = 'future';
                        else if (newStart < prevStart && newEnd > prevEnd) bufferDirection = 'both';
                        else if (newStart >= prevStart && newEnd <= prevEnd) bufferDirection = 'unknown'; // overlap/refresh
                    }

                    // After inferring, update the known subscription date range using the new slice
                    if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange && Number.isFinite(newStart) && Number.isFinite(newEnd)) {
                        window.__chartContextValue.updateSubscriptionDateRange(newStart, newEnd);
                    }
                } catch (e) {
                    console.warn('[Buffer Manager] Failed to infer direction:', e);
                }

                const referenceTimestamp = referenceTimestampRef.current; // Use the ref

                // Reset the ref after use
                if (referenceTimestampRef.current) {
                    referenceTimestampRef.current = null;
                }
                
                // Update display candles with new data. Do not set viewStartIndex here;
                // let ChartContext handle re-position based on merged buffer and referenceTimestamp.
                updateDisplayCandles(newCandles, false);

                // Track observed end to help break future buffer request loops if backend doesn't extend
                try {
                    const observedEnd = Math.max(...newCandles.map(c => c.timestamp));
                    if (Number.isFinite(observedEnd)) {
                        lastChartObservedEndRef.current = observedEnd;
                    }
                } catch (_) {}
                
                // Notify ChartContext that the buffer update is complete
                if (window.__chartContextValue && window.__chartContextValue.handleBufferUpdateComplete) {
                    if (bufferDirection === 'both') {
                        // Clear both directions to avoid any stuck flags
                        window.__chartContextValue.handleBufferUpdateComplete('past', referenceTimestamp);
                        window.__chartContextValue.handleBufferUpdateComplete('future', null);
                    } else if (bufferDirection === 'unknown') {
                        // Be defensive: clear both flags if direction ambiguous or overlapping
                        window.__chartContextValue.handleBufferUpdateComplete('past', referenceTimestamp);
                        window.__chartContextValue.handleBufferUpdateComplete('future', null);
                    } else if (bufferDirection === 'past' || bufferDirection === 'future') {
                        window.__chartContextValue.handleBufferUpdateComplete(bufferDirection, referenceTimestamp);
                    } else {
                        // Fallback safety: clear both if we failed to classify
                        window.__chartContextValue.handleBufferUpdateComplete('past', referenceTimestamp);
                        window.__chartContextValue.handleBufferUpdateComplete('future', null);
                    }
                }
            } else {
                // For non-buffer initial payloads, decide replace vs merge based on overlap with current buffer
                try {
                    const ctx = window.__chartContextValue || {};
                    const prevCandles = (ctx && ctx.displayCandles) || [];
                    const prevStart = prevCandles.length ? prevCandles[0].timestamp : null;
                    const prevEnd = prevCandles.length ? prevCandles[prevCandles.length - 1].timestamp : null;
                    const newStart = Math.min(...newCandles.map(c => c.timestamp));
                    const newEnd = Math.max(...newCandles.map(c => c.timestamp));
                    const epsilon = (ctx && ctx.timeframeInMs) || 60_000;

                    const hasPrev = prevStart != null && prevEnd != null;
                    const overlaps = hasPrev && (newStart <= (prevEnd + epsilon)) && (newEnd >= (prevStart - epsilon));

                    // Determine an anchor timestamp to preserve visual position across merges
                    let anchorTimestamp = null;
                    try {
                        if (ctx && ctx.activeTimestamp) {
                            anchorTimestamp = ctx.activeTimestamp;
                        } else if (Array.isArray(ctx.candleData) && ctx.candleData.length) {
                            anchorTimestamp = ctx.candleData[Math.floor(ctx.candleData.length / 2)]?.timestamp || null;
                        }
                    } catch (_) {}

                    if (!hasPrev) {
                        // First load: replace and position at the end of buffer
                        updateDisplayCandles(newCandles, true);
                        setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
                    } else if (overlaps) {
                        // Overlapping refresh: merge only; preserve current viewStartIndex
                        updateDisplayCandles(newCandles, false);
                        // Restore view to the anchor timestamp to avoid perceived snapping
                        if (anchorTimestamp && window.__chartContextValue?.handleBufferUpdateComplete) {
                            window.__chartContextValue.handleBufferUpdateComplete('future', anchorTimestamp);
                        }
                    } else {
                        // Disjoint window (likely timeframe/symbol change): replace
                        updateDisplayCandles(newCandles, true);
                        setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
                    }

                    // Coalesce known range
                    if (window.__chartContextValue?.updateSubscriptionDateRange && Number.isFinite(newStart) && Number.isFinite(newEnd)) {
                        window.__chartContextValue.updateSubscriptionDateRange(newStart, newEnd);
                    }
                } catch (e) {
                    console.warn('[Chart] Fallback initial handling due to error, replacing buffer:', e);
                    updateDisplayCandles(newCandles, true);
                    setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
                }
            }
            
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

            // NEW: If this contains subscription details, update our reference
            if (data.platformName && data.stockSymbol && data.timeframe) {
                const newDetails = {
                    platformName: data.platformName,
                    stockSymbol: data.stockSymbol,
                    timeframe: data.timeframe
                };

                latestSubscriptionDetailsRef.current = newDetails;
                setLastValidSubscription(newDetails);

                // Ensure CandleWebSocketContext is also updated
                updateCurrentSubscriptionInfo(newDetails);
            }
        } else {
            console.log("[useCandleSubscription] Message did not match any handler conditions:", data);
        }
    }, [setDisplayCandles, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, transformCandleData, setActiveSubscription, currentSubscription.stockSymbol, updateCurrentSubscriptionInfo]);


    // Handle incoming indicator candle data
    const handleIndicatorCandleMessage = useCallback((data) => {
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        console.log(data);

        // Skip heartbeats - already handled in CandleWebSocketContext
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

                // NEW: Update latest subscription details if not already set
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

                    // Ensure CandleWebSocketContext is also updated
                    updateCurrentSubscriptionInfo(newDetails);
                }
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, data.stockSymbol || currentSubscription.stockSymbol));

            // Replace buffer only if a reset was explicitly expected; otherwise merge
            const doReset = expectIndicatorResetRef.current === true;
            if (doReset) {
                expectIndicatorResetRef.current = false;
            }
            updateIndicatorCandles(newCandles, doReset);

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

            // Update indicator candles only (merge)
            updateIndicatorCandles(newCandles, false);
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

            // NEW: Update our local reference before making the request
            const subscriptionDetails = {
                platformName,
                stockSymbol,
                timeframe
            };

            latestSubscriptionDetailsRef.current = subscriptionDetails;
            setLastValidSubscription(subscriptionDetails);

            // Update subscription details - store centrally for both subscriptions
            updateCurrentSubscriptionInfo(subscriptionDetails);

            // Access ChartContext to get buffer settings
            let bufferSizeMultiplier = 20; // Default if not available from context
            
            try {
                if (window.__chartContextValue && window.__chartContextValue.BUFFER_SIZE_MULTIPLIER) {
                    bufferSizeMultiplier = window.__chartContextValue.BUFFER_SIZE_MULTIPLIER;
                }
            } catch (e) {
                console.warn("[Buffer Manager] Could not access chart context for buffer settings:", e);
            }
            
            // For chart data, request displayedCandles plus buffer worth of data
            const now = new Date();
            const endDate = now;
            
            // Include buffer on both sides (past and future)
            // For first load, request enough data to allow scrolling in both directions
            const totalCandlesToRequest = displayedCandles + (bufferSizeMultiplier * 2);
            const startDate = calculateStartDate(endDate, timeframe, totalCandlesToRequest);

            console.log("--------- CHART CANDLE DATA REQUEST ---------");
            console.log(`[Chart Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Chart Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Chart Request] End date: ${endDate.toISOString()}`);
            console.log(`[Chart Request] Display candles: ${displayedCandles}`);
            console.log(`[Chart Request] Buffer multiplier: ${bufferSizeMultiplier}`);
            console.log(`[Chart Request] Total candles needed: ${totalCandlesToRequest}`);
            console.log("---------------------------------------------");

            const chartSubscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                subscriptionType: 'CHART',  // Add type marker for backend differentiation
                // Store the actual date range for buffer management
                actualStartDate: startDate.toISOString(),
                actualEndDate: endDate.toISOString()
            };

            console.log("[useCandleSubscription] Subscribing to chart candles:", chartSubscriptionRequest);

            // Use the CandleWebSocketContext's request method for subscriptions
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

        // NEW: Added fallback to local reference or currentSubscription if parameters not provided
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
            // First, check if we really need a fresh indicator subscription
            // Build a key to compare against last request
            const tentativeKey = JSON.stringify({
                platformName,
                stockSymbol,
                timeframe,
                startDate: null, // filled later
                endDate: null
            });

            // Only unsubscribe if a new range will be requested later (below)
            if (subscriptionIds.indicator) {
                console.log(`[useCandleSubscription] Existing indicator subscription detected; will only recreate if range differs`);
            }

            // Prepare for a fresh indicator dataset on the next response
            try {
                expectIndicatorResetRef.current = true;
                // Clear current indicator buffer to avoid mixing symbols/timeframes
                setIndicatorCandles([]);
            } catch (_) {}

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

            // Skip identical request to avoid resubscribe storms (compare before sending)
            const nextKey = JSON.stringify(indicatorSubscriptionRequest);
            if (lastIndicatorRequestRef.current === nextKey) {
                console.log('[Indicator] Skipping identical indicator subscription request');
                return "pending";
            }

            console.log("[useCandleSubscription] Subscribing to indicator candles:", indicatorSubscriptionRequest);

            // If an indicator subscription exists, cleanly unsubscribe first
            if (subscriptionIds.indicator) {
                console.log(`[useCandleSubscription] Unsubscribing from current indicator subscription before creating new one`);
                await unsubscribe('indicator');
                await new Promise(resolve => setTimeout(resolve, 300));
                // Clear last request key so the next request can proceed
                lastIndicatorRequestRef.current = null;
            }

            // Use the CandleWebSocketContext's request method for subscriptions
            await requestSubscription('indicator', indicatorSubscriptionRequest);
            // Record the last request only after successfully sending
            lastIndicatorRequestRef.current = nextKey;
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

        // NEW: Get subscription details with fallbacks
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
        const handleIndicatorRequirementsChanged = async (event) => {
            // Add debounce handling to prevent multiple rapid updates
            if (isUpdatingIndicatorSubscription.current) {
                console.log("[Indicator Monitor] Update already in progress, queueing request");
                pendingUpdateRef.current = true;
                return;
            }

            isUpdatingIndicatorSubscription.current = true;
            console.log(`[Indicator Monitor] Detected indicator requirements change event`);

            // Get event details if available
            const eventDetail = event?.detail || {};
            const isBufferUpdate = eventDetail.isBufferUpdate;
            const bufferDirection = eventDetail.bufferDirection;
            const referenceTimestamp = eventDetail.referenceTimestamp;
            const range = eventDetail.range;

            // Log if this is a buffer update
            if (isBufferUpdate) {
                const refTimestampStr = referenceTimestamp && !isNaN(referenceTimestamp)
                    ? new Date(referenceTimestamp).toISOString()
                    : 'invalid';
                console.log(`[Indicator Monitor] Processing buffer update for ${bufferDirection} data with reference timestamp: ${refTimestampStr}`);
            }

            // NEW: Log if subscription details are available
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
                // For buffer updates with range details, use that directly
            if (isBufferUpdate && range) {
                console.log("[Buffer Manager] Processing buffer update request");

                    // Get subscription details
                    let platformName = currentSubscription.platformName;
                    let stockSymbol = currentSubscription.stockSymbol;
                    let timeframe = currentSubscription.timeframe;

                    // Use fallbacks if needed
                    if (!platformName || !stockSymbol || !timeframe) {
                        if (latestSubscriptionDetailsRef.current.platformName &&
                            latestSubscriptionDetailsRef.current.stockSymbol &&
                            latestSubscriptionDetailsRef.current.timeframe) {
                            console.log("[Buffer Manager] Using latest subscription details from ref");
                            platformName = latestSubscriptionDetailsRef.current.platformName;
                            stockSymbol = latestSubscriptionDetailsRef.current.stockSymbol;
                            timeframe = latestSubscriptionDetailsRef.current.timeframe;
                        } else if (lastValidSubscription.platformName &&
                            lastValidSubscription.stockSymbol &&
                            lastValidSubscription.timeframe) {
                            console.log("[Buffer Manager] Using last valid subscription");
                            platformName = lastValidSubscription.platformName;
                            stockSymbol = lastValidSubscription.stockSymbol;
                            timeframe = lastValidSubscription.timeframe;
                        }
                    }

                    if (!platformName || !stockSymbol || !timeframe) {
                        console.error("[Buffer Manager] Missing subscription details for buffer update");
                        return;
                    }

                    // Extract range data with validation
                    const { start, end } = range;

                    // Validate the timestamps before using them
                    if (!start || !end || isNaN(start) || isNaN(end)) {
                        console.error("[Buffer Manager] Invalid range timestamps:", { start, end });
                        console.error("[Buffer Manager] Range object:", range);
                        return;
                    }

                    // Additional validation to ensure the dates are reasonable
                    const startDate = new Date(start);
                    const endDate = new Date(end);

                    if (!startDate.getTime() || !endDate.getTime()) {
                        console.error("[Buffer Manager] Invalid Date objects created from:", { start, end });
                        return;
                    }

                    if (startDate >= endDate) {
                        console.error("[Buffer Manager] Start date is not before end date:", {
                            start: startDate.toISOString(),
                            end: endDate.toISOString()
                        });
                        return;
                    }

                    console.log(`[Buffer Manager] Requesting ${bufferDirection} buffer data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

                    // Prefer reusing the same subscription if backend supports range change without unsubscribing
                    // If your backend requires new subscription, uncomment the block below and keep delay small.
                    /*
                    if (subscriptionIds.chart) {
                        console.log(`[Buffer Manager] Unsubscribing from current chart subscription before buffer update`);
                        await unsubscribe('chart');
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                    */

                    // Create buffer update request
                    const bufferUpdateRequest = {
                        platformName,
                        stockSymbol,
                        timeframe,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        resetData: true,  // Always true for buffer updates
                        subscriptionType: 'CHART'
                    };

                    console.log("[Buffer Manager] Sending buffer update request:", bufferUpdateRequest);

                    // Before sending, avoid repeating identical future requests when backend hasn't extended
                    const now = Date.now();
                    if (bufferDirection === 'future') {
                        const lastReq = lastChartRequestedRangeRef.current;
                        const observedEnd = lastChartObservedEndRef.current;
                        if (lastReq && lastReq.direction === 'future' && lastReq.start === start && lastReq.end === end) {
                            if (observedEnd && observedEnd < end) {
                                if (now < chartRequestCooldownUntilRef.current) {
                                    console.log('[Buffer Manager] Skipping duplicate future buffer request during cooldown');
                                    return;
                                }
                                // set short cooldown
                                chartRequestCooldownUntilRef.current = now + 2000;
                            }
                        }
                        lastChartRequestedRangeRef.current = { start, end, direction: 'future' };
                    } else if (bufferDirection === 'past') {
                        lastChartRequestedRangeRef.current = { start, end, direction: 'past' };
                    }

                    // Set the flag before sending the request
                    isRequestingBufferUpdate.current = true;

                    // Send the request
                    await requestSubscription('chart', bufferUpdateRequest);

                    // Store the reference timestamp for position restoration
                    if (referenceTimestamp && !isNaN(referenceTimestamp)) {
                        console.log(`[Buffer Manager] Stored reference timestamp: ${new Date(referenceTimestamp).toISOString()}`);
                        referenceTimestampRef.current = referenceTimestamp;
                    }

                    console.log("[Buffer Manager] Buffer update request sent");

                    // Also ensure indicator subscription covers the same required range
                    try {
                        // Union buffer range with required indicator lookback
                        let indicatorRangeStartDate = startDate;
                        let indicatorRangeEndDate = endDate;

                        try {
                            // Ask ChartContext what lookback is required right now
                            const ctx = window.__chartContextValue || {};
                            const lookReq = ctx.calculateRequiredDataRange ? ctx.calculateRequiredDataRange() : null;
                            if (lookReq && lookReq.start && !isNaN(lookReq.start)) {
                                const requiredStart = new Date(lookReq.start);
                                if (requiredStart.getTime() && requiredStart < indicatorRangeStartDate) {
                                    indicatorRangeStartDate = requiredStart;
                                }
                            }
                        } catch (_) {}

                        const indicatorRangeStart = indicatorRangeStartDate.toISOString();
                        const indicatorRangeEnd = indicatorRangeEndDate.toISOString();

                        // Only if we have indicators
                        if (indicators.length > 0) {
                            // Unsubscribe old indicator sub to avoid overlap
                            if (subscriptionIds.indicator) {
                                console.log(`[Buffer Manager] Unsubscribing from current indicator subscription before indicator buffer sync`);
                                await unsubscribe('indicator');
                                await new Promise(resolve => setTimeout(resolve, 300));
                            }

                            const indicatorSubscriptionRequest = {
                                platformName,
                                stockSymbol,
                                timeframe,
                                startDate: indicatorRangeStart,
                                endDate: indicatorRangeEnd,
                                resetData: true,
                                subscriptionType: 'INDICATOR'
                            };

                            // Prepare to reset indicator buffer on response
                            expectIndicatorResetRef.current = true;
                            setIndicatorCandles([]);

                            console.log("[Buffer Manager] Sending indicator buffer sync request:", indicatorSubscriptionRequest);
                            await requestSubscription('indicator', indicatorSubscriptionRequest);
                        }
                    } catch (e) {
                        console.warn('[Buffer Manager] Failed to sync indicator subscription to buffer range:', e);
                    }
                } else {
                    // If not a buffer update, use the regular indicator subscription update
                    await updateIndicatorSubscription();
                }
            } catch (error) {
                console.error("[Buffer Manager] Error in handleIndicatorRequirementsChanged:", error);
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
    }, [updateIndicatorSubscription, currentSubscription, lastValidSubscription, unsubscribe, requestSubscription, subscriptionIds.chart]);

    // Register message handlers with CandleWebSocketContext on mount
    useEffect(() => {
        //console.log("[useCandleSubscription] Registering message handlers with CandleWebSocketContext");

        // Register our handlers
        const unregChartHandler = registerHandler('chart', handleChartCandleMessage);
        const unregIndicatorHandler = registerHandler('indicator', handleIndicatorCandleMessage);

        // Cleanup function - unregister our handlers when unmounting
        return () => {
            //console.log("[useCandleSubscription] Unregistering message handlers");
            unregChartHandler();
            unregIndicatorHandler();
        };
    }, [handleChartCandleMessage, handleIndicatorCandleMessage, registerHandler]);

    // NEW: Add effect to handle page navigation and cleanup subscriptions when leaving StockMarket
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

            // NEW: Try getting subscription details with fallbacks
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
            console.log("[useCandleSubscription] No indicators active - scheduling indicator unsubscribe");
            let timeoutId = setTimeout(() => {
                unsubscribe('indicator')
                    .then(() => { lastIndicatorRequestRef.current = null; })
                    .catch(err => {
                        console.error("[useCandleSubscription] Failed to remove indicator subscription:", err);
                    });
            }, 200);
            // Cleanup debounce if indicators change before timeout fires
            return () => clearTimeout(timeoutId);
        }
    }, [indicators, subscribeToIndicatorCandles, currentSubscription, lastValidSubscription, subscriptionIds, unsubscribe]);

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
        // NEW: Expose the current subscription details
        currentSubscriptionDetails: {
            ...lastValidSubscription
        }
    };
}
