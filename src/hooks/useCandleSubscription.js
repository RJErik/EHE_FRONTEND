// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '@/feature/stockMarket/ChartContext';
import { useWebSocket } from '../context/CandleWebSocketContext.jsx';
import { useToast } from './use-toast';

const BUFFER_REQUEST_TIMEOUT = 10000; // 10 seconds
const INDICATOR_REQUEST_TIMEOUT = 10000; // 10 seconds

export function useCandleSubscription() {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    const [currentDetails, setCurrentDetails] = useState({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    const {
        isConnected,
        registerHandler,
        unregisterHandler,
        requestSubscription,
        updateSubscription,
        unsubscribe,
        unsubscribeAll,
        subscriptionIds,
        currentSubscription
    } = useWebSocket();

    const chartContext = useContext(ChartContext);
    const {
        initializeOnSelection,
        mergeBaseCandles,
        computeRequiredIndicatorRange,
        updateSubscriptionDateRange,
        setIsWaitingForData,
        displayedCandles,
        indicators,
        BUFFER_SIZE_MULTIPLIER
    } = chartContext;

    const pendingRequestsRef = useRef({
        buffer: {
            isRequesting: false,
            direction: null,
            requestId: null,
            timeoutId: null
        },
        indicator: {
            isRequesting: false,
            requestId: null,
            timeoutId: null
        }
    });

// Track previous subscription for timeframe change detection
    const previousSubscriptionRef = useRef({
        platformName: null,
        stockSymbol: null,
        timeframe: null,
        wasHistorical: false
    });

// Store anchor info for when data arrives
    const pendingAnchorRef = useRef(null);

// Latest trimmed range to apply to the subscription
    const pendingTrimRef = useRef(null);

// Local ref to the latest chart subscription ID we saw from the server
    const chartSubscriptionIdRef = useRef(null);

// ==================== HELPERS ====================

    const calculateStartDate = useCallback((endDate, timeframe, candleCount) => {
        let timeframeMinutes = 1;

        const tf = timeframe.toLowerCase();
        if (tf.endsWith('m')) {
            timeframeMinutes = parseInt(timeframe);
        } else if (tf.endsWith('h')) {
            timeframeMinutes = parseInt(timeframe) * 60;
        } else if (tf.endsWith('d')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24;
        } else if (tf.endsWith('w')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24 * 7;
        }

        const minutesBack = timeframeMinutes * candleCount;
        return new Date(endDate.getTime() - (minutesBack * 60 * 1000));
    }, []);

    const transformCandle = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp: new Date(backendCandle.timestamp + 'Z').getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || currentDetails.stockSymbol,
            indicatorValues: {}
        };
    }, [currentDetails.stockSymbol]);

    const parseTimeframeToMs = useCallback((timeframe) => {
        const tf = timeframe.toLowerCase();

        if (tf.endsWith('m')) {
            return parseInt(timeframe) * 60 * 1000;
        } else if (tf.endsWith('h')) {
            return parseInt(timeframe) * 60 * 60 * 1000;
        } else if (tf.endsWith('d')) {
            return parseInt(timeframe) * 24 * 60 * 60 * 1000;
        } else if (tf.endsWith('w')) {
            return parseInt(timeframe) * 7 * 24 * 60 * 60 * 1000;
        }

        return 60 * 1000;
    }, []);

    const calculateMaxLookback = useCallback((currentIndicators = []) => {
        let maxLookback = 0;

        const toPeriod = (v, fallback) => {
            const n = Number(v);
            const val = Number.isFinite(n) ? Math.floor(n) : fallback;
            return Math.max(1, val);
        };

        for (const indicator of currentIndicators) {
            const type = indicator?.type;
            const s = indicator?.settings ?? {};
            let lookback = 0;

            switch (type) {
                case "sma":
                case "ema":
                    lookback = toPeriod(s.period ?? 14, 14) - 1;
                    break;
                case "rsi":
                    lookback = toPeriod(s.period ?? 14, 14);
                    break;
                case "macd": {
                    const fast = toPeriod(s.fastPeriod ?? 12, 12);
                    const slow = toPeriod(s.slowPeriod ?? 26, 26);
                    const signal = toPeriod(s.signalPeriod ?? 9, 9);
                    lookback = (Math.max(fast, slow) - 1) + (signal - 1);
                    break;
                }
                case "bb":
                    lookback = toPeriod(s.period ?? 20, 20) - 1;
                    break;
                case "atr":
                    lookback = toPeriod(s.period ?? 14, 14) - 1;
                    break;
                default:
                    lookback = 50;
            }

            if (lookback > maxLookback) maxLookback = lookback;
        }

        return maxLookback;
    }, []);

// Round timestamp down to timeframe boundary
    const roundTimestampToTimeframeBoundary = useCallback((timestamp, timeframe) => {
        const tfMs = parseTimeframeToMs(timeframe);
        return Math.floor(timestamp / tfMs) * tfMs;
    }, [parseTimeframeToMs]);

// Check if user is viewing "current" data (at the latest edge)
    const isViewingLatestData = useCallback(() => {
        const candles = chartContext.displayCandles || [];
        const startIdx = chartContext.viewStartIndex || 0;
        const displayCount = chartContext.displayedCandles || 100;

        if (candles.length === 0) return true;

        // Calculate the index of the newest visible candle
        const endIndex = Math.min(
            startIdx + displayCount - 1,
            candles.length - 1
        );

        // We're viewing latest if we can see the last candle in the dataset
        return endIndex === candles.length - 1;
    }, [chartContext]);

// Get oldest visible candle timestamp
    const getOldestVisibleTimestamp = useCallback(() => {
        const candles = chartContext.displayCandles || [];
        const startIdx = chartContext.viewStartIndex || 0;

        if (candles.length === 0) return null;

        const oldestVisibleCandle = candles[startIdx];
        return oldestVisibleCandle?.timestamp || null;
    }, [chartContext]);

// Check if anchoring to timestamp would exceed current time
    const wouldExceedCurrentTime = useCallback(
        (anchorTimestamp, newTimeframe, candleCount) => {
            const tfMs = parseTimeframeToMs(newTimeframe);
            const projectedEnd = anchorTimestamp + (tfMs * candleCount);
            const now = Date.now();

            // Allow small buffer (1 timeframe) for current candle forming
            return projectedEnd > (now + tfMs);
        },
        [parseTimeframeToMs]
    );

    const clearBufferRequestState = useCallback((requestId = null) => {
        if (requestId && pendingRequestsRef.current.buffer.requestId !== requestId) {
            return; // Not the current request
        }

        console.log('[useCandleSubscription] Clearing buffer request state');

        if (pendingRequestsRef.current.buffer.timeoutId) {
            clearTimeout(pendingRequestsRef.current.buffer.timeoutId);
        }

        pendingRequestsRef.current.buffer = {
            isRequesting: false,
            direction: null,
            requestId: null,
            timeoutId: null
        };
    }, []);

    const clearIndicatorRequestState = useCallback((requestId = null) => {
        if (requestId && pendingRequestsRef.current.indicator.requestId !== requestId) {
            return; // Not the current request
        }

        console.log('[useCandleSubscription] Clearing indicator request state');

        if (pendingRequestsRef.current.indicator.timeoutId) {
            clearTimeout(pendingRequestsRef.current.indicator.timeoutId);
        }

        pendingRequestsRef.current.indicator = {
            isRequesting: false,
            requestId: null,
            timeoutId: null
        };
    }, []);

// ==================== TRIM / SUBSCRIPTION UPDATE HELPER ====================

    const attemptTrimSubscriptionUpdate = useCallback(
        async (overrideSubscriptionId) => {
            const pendingTrim = pendingTrimRef.current;
            if (!pendingTrim) return;

            const subscriptionId =
                overrideSubscriptionId ||
                subscriptionIds.chart ||
                chartSubscriptionIdRef.current;

            if (!subscriptionId) {
                console.log('[useCandleSubscription] Post-trim subscription id not ready yet', {
                    overrideSubscriptionId,
                    chartSubscriptionIdFromContext: subscriptionIds.chart,
                    chartSubscriptionIdLocal: chartSubscriptionIdRef.current
                });
                return;
            }

            const { start, end, candleCount } = pendingTrim;

            console.log('[useCandleSubscription] Updating subscription after buffer trim:', {
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
                candleCount,
                subscriptionId
            });

            try {
                const startDate = new Date(start);
                const endDate = new Date(end);

                // Update both actual and requested ranges in chart context
                updateSubscriptionDateRange('actual', start, end);
                updateSubscriptionDateRange('requested', start, end);

                // Update server subscription
                await updateSubscription({
                    subscriptionId,
                    newStartDate: startDate,
                    newEndDate: endDate,
                    resetData: false,
                    subscriptionType: 'CHART'
                });

                console.log('[useCandleSubscription] Subscription updated after trim');
                // Clear pending trim since it has been applied
                pendingTrimRef.current = null;
            } catch (err) {
                console.error('[useCandleSubscription] Failed to update subscription after trim:', err);
            }
        },
        [subscriptionIds.chart, updateSubscription, updateSubscriptionDateRange]
    );

// ==================== MESSAGE HANDLERS ====================

    const handleCandleMessage = useCallback((data) => {
        console.log('[useCandleSubscription] Received message:', data.updateType);

        if (data.updateType === "HEARTBEAT") return;

        if (data.success === false) {
            console.error('[useCandleSubscription] Error:', data.message);
            setError(data.message);
            setIsWaitingForData(false);

            // Clear all pending requests
            clearBufferRequestState();
            clearIndicatorRequestState();

            toast({
                title: "Data Error",
                description: data.message,
                variant: "destructive",
                duration: 5000
            });
            return;
        }

        if (data.candles && Array.isArray(data.candles)) {
            console.log('[useCandleSubscription] Received candles:', data.candles.length);

            if (data.platformName && data.stockSymbol && data.timeframe) {
                setCurrentDetails({
                    platformName: data.platformName,
                    stockSymbol: data.stockSymbol,
                    timeframe: data.timeframe
                });
            }

            const transformedCandles = data.candles.map(c =>
                transformCandle(c, data.stockSymbol)
            );

            const isBufferUpdate = pendingRequestsRef.current.buffer.isRequesting;
            const isIndicatorUpdate = pendingRequestsRef.current.indicator.isRequesting;
            const bufferDirection = pendingRequestsRef.current.buffer.direction;

            if (isBufferUpdate || isIndicatorUpdate) {
                const direction = isIndicatorUpdate ? 'past' : bufferDirection || 'unknown';

                console.log('[useCandleSubscription] Processing update:', {
                    type: isIndicatorUpdate ? 'indicator' : 'buffer',
                    direction,
                    candleCount: transformedCandles.length
                });

                mergeBaseCandles(transformedCandles, {
                    direction,
                    referenceTimestamp: data.referenceTimestamp,
                    referenceOffset: data.referenceOffset
                });

                // Clear the appropriate request state
                if (isBufferUpdate) {
                    clearBufferRequestState(pendingRequestsRef.current.buffer.requestId);
                }
                if (isIndicatorUpdate) {
                    clearIndicatorRequestState(pendingRequestsRef.current.indicator.requestId);
                }
            } else {
                console.log('[useCandleSubscription] Initializing chart');

                const metadata = {
                    symbol: data.stockSymbol,
                    platform: data.platformName,
                    timeframe: data.timeframe ? parseTimeframeToMs(data.timeframe) : undefined
                };

                // Check if we have a pending anchor to apply
                const anchorInfo = pendingAnchorRef.current;

                initializeOnSelection(transformedCandles, metadata);

                // Apply historical anchor if present
                if (anchorInfo && anchorInfo.anchorTimestamp) {
                    console.log('[useCandleSubscription] Applying historical anchor:', {
                        anchor: new Date(anchorInfo.anchorTimestamp).toISOString()
                    });

                    // Find the index of the anchor candle (or nearest after it)
                    const anchorIndex = transformedCandles.findIndex(
                        c => c.timestamp >= anchorInfo.anchorTimestamp
                    );

                    if (anchorIndex >= 0) {
                        // Use setTimeout to ensure the initialization has completed
                        setTimeout(() => {
                            chartContext.setViewStartIndex(anchorIndex);
                            console.log('[useCandleSubscription] View anchored to index:', anchorIndex);
                        }, 0);
                    } else {
                        console.warn('[useCandleSubscription] Could not find anchor candle in data');
                    }

                    // Clear pending anchor
                    pendingAnchorRef.current = null;
                }

                // Update actual range after initialization
                if (transformedCandles.length > 0) {
                    const timestamps = transformedCandles.map(c => c.timestamp);
                    const start = Math.min(...timestamps);
                    const end = Math.max(...timestamps);
                    updateSubscriptionDateRange('actual', start, end);
                }
            }

            setIsWaitingForData(false);
            setError(null);
        }
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log('[useCandleSubscription] Received updates:', data.updatedCandles.length);

            const transformedCandles = data.updatedCandles.map(c =>
                transformCandle(c, data.stockSymbol)
            );

            mergeBaseCandles(transformedCandles, {
                direction: 'future',
                isUpdate: true
            });
        }
        else if (data.subscriptionId && data.updateType === undefined) {
            console.log('[useCandleSubscription] Subscription confirmed');

            // Track latest chart subscription id locally
            chartSubscriptionIdRef.current = data.subscriptionId;

            if (data.platformName && data.stockSymbol && data.timeframe) {
                setCurrentDetails({
                    platformName: data.platformName,
                    stockSymbol: data.stockSymbol,
                    timeframe: data.timeframe
                });
            }

            // If there is a pending trim, try to apply it now using this subscriptionId
            if (pendingTrimRef.current) {
                void attemptTrimSubscriptionUpdate(data.subscriptionId);
            }
        }

    }, [
        transformCandle,
        mergeBaseCandles,
        initializeOnSelection,
        setIsWaitingForData,
        toast,
        parseTimeframeToMs,
        updateSubscriptionDateRange,
        clearBufferRequestState,
        clearIndicatorRequestState,
        attemptTrimSubscriptionUpdate,
        chartContext
    ]);

// ==================== SUBSCRIPTION FUNCTIONS ====================

    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn('[useCandleSubscription] Missing parameters');
            return Promise.reject(new Error("Missing required parameters"));
        }

        if (
            currentDetails.platformName === platformName &&
            currentDetails.stockSymbol === stockSymbol &&
            currentDetails.timeframe === timeframe &&
            subscriptionIds.chart
        ) {
            console.log('[useCandleSubscription] Already subscribed');
            return Promise.resolve(subscriptionIds.chart);
        }

        // Detect change type
        const isPlatformOrStockChange =
            previousSubscriptionRef.current.platformName !== platformName ||
            previousSubscriptionRef.current.stockSymbol !== stockSymbol;

        const isTimeframeChangeOnly =
            previousSubscriptionRef.current.platformName === platformName &&
            previousSubscriptionRef.current.stockSymbol === stockSymbol &&
            previousSubscriptionRef.current.timeframe !== timeframe &&
            previousSubscriptionRef.current.timeframe !== null;

        console.log('[useCandleSubscription] Subscription change type:', {
            isPlatformOrStockChange,
            isTimeframeChangeOnly,
            previous: previousSubscriptionRef.current,
            new: { platformName, stockSymbol, timeframe }
        });

        // Reset historical tracking on platform/stock change
        if (isPlatformOrStockChange) {
            previousSubscriptionRef.current.wasHistorical = false;
        }

        setIsSubscribing(true);
        setIsWaitingForData(true);

        // Clear all pending requests
        clearBufferRequestState();
        clearIndicatorRequestState();

        try {
            if (subscriptionIds.chart) {
                console.log('[useCandleSubscription] Unsubscribing from existing subscription');
                await unsubscribe('chart');
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const maxLookback = calculateMaxLookback(indicators);
            const totalCandlesToRequest = displayedCandles + (BUFFER_SIZE_MULTIPLIER * 2) + maxLookback;

            let startDate, endDate, isHistoricalAnchor = false, anchorTimestamp = null;

            // Try to use historical anchor for timeframe-only changes
            if (isTimeframeChangeOnly && !isViewingLatestData()) {
                const oldestVisibleTs = getOldestVisibleTimestamp();

                if (oldestVisibleTs) {
                    anchorTimestamp = roundTimestampToTimeframeBoundary(
                        oldestVisibleTs,
                        timeframe
                    );

                    const tfMs = parseTimeframeToMs(timeframe);

                    // FIXED: Only check if the VISIBLE range would exceed current time
                    // not the entire buffer range
                    const visibleEndTimestamp = anchorTimestamp + (displayedCandles * tfMs);
                    const now = Date.now();
                    const wouldExceed = visibleEndTimestamp > (now + tfMs);

                    if (!wouldExceed) {
                        // Safe to use historical anchor
                        isHistoricalAnchor = true;

                        // Request data with buffer on both sides
                        startDate = new Date(anchorTimestamp - ((maxLookback + BUFFER_SIZE_MULTIPLIER) * tfMs));
                        endDate = new Date(Math.min(
                            anchorTimestamp + ((displayedCandles + BUFFER_SIZE_MULTIPLIER) * tfMs),
                            Date.now()
                        ));

                        console.log('[useCandleSubscription] Using historical anchor:', {
                            oldestVisible: new Date(oldestVisibleTs).toISOString(),
                            anchor: new Date(anchorTimestamp).toISOString(),
                            start: startDate.toISOString(),
                            end: endDate.toISOString(),
                            visibleEnd: new Date(visibleEndTimestamp).toISOString()
                        });
                    } else {
                        console.log('[useCandleSubscription] Historical anchor would exceed current time, using default');
                    }
                }
            }

            // Fall back to default "current time" behavior
            if (!isHistoricalAnchor) {
                const now = new Date();
                startDate = calculateStartDate(now, timeframe, totalCandlesToRequest);
                endDate = now;

                console.log('[useCandleSubscription] Using current time anchor:', {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                });
            }

            // Store anchor info for when data arrives
            if (isHistoricalAnchor && anchorTimestamp) {
                pendingAnchorRef.current = {
                    anchorTimestamp,
                    isHistoricalAnchor: true
                };
            } else {
                pendingAnchorRef.current = null;
            }

            // Update requested range
            updateSubscriptionDateRange('requested', startDate.getTime(), endDate.getTime());

            const subscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                subscriptionType: 'CHART'
            };

            await requestSubscription('chart', subscriptionRequest);

            setCurrentDetails({ platformName, stockSymbol, timeframe });

            // Update previous subscription tracking
            previousSubscriptionRef.current = {
                platformName,
                stockSymbol,
                timeframe,
                wasHistorical: isHistoricalAnchor
            };

            console.log('[useCandleSubscription] Subscription request sent');

            return "pending";
        } catch (err) {
            console.error('[useCandleSubscription] Subscription error:', err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            pendingAnchorRef.current = null;
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [
        currentDetails,
        subscriptionIds.chart,
        unsubscribe,
        displayedCandles,
        indicators,
        BUFFER_SIZE_MULTIPLIER,
        calculateStartDate,
        calculateMaxLookback,
        updateSubscriptionDateRange,
        requestSubscription,
        clearBufferRequestState,
        clearIndicatorRequestState,
        isViewingLatestData,
        getOldestVisibleTimestamp,
        roundTimestampToTimeframeBoundary,
        wouldExceedCurrentTime,
        parseTimeframeToMs
    ]);

    const unsubscribeFromCandles = useCallback(async () => {
        console.log('[useCandleSubscription] Unsubscribing from all');
        setCurrentDetails({
            platformName: null,
            stockSymbol: null,
            timeframe: null
        });

        // Reset previous subscription tracking
        previousSubscriptionRef.current = {
            platformName: null,
            stockSymbol: null,
            timeframe: null,
            wasHistorical: false
        };

        pendingAnchorRef.current = null;

        clearBufferRequestState();
        clearIndicatorRequestState();

        return unsubscribeAll();
    }, [unsubscribeAll, clearBufferRequestState, clearIndicatorRequestState]);

// ==================== EVENT LISTENERS ====================

    useEffect(() => {
        const handleBufferRequest = async (event) => {
            if (pendingRequestsRef.current.buffer.isRequesting) {
                console.log('[useCandleSubscription] Buffer request already in flight, ignoring');
                return;
            }

            const { bufferDirection, referenceTimestamp, referenceOffset } = event.detail || {};

            const { platformName, stockSymbol, timeframe } = currentDetails;

            if (!platformName || !stockSymbol || !timeframe) {
                console.warn('[useCandleSubscription] Missing subscription details for buffer request');
                return;
            }

            // Calculate buffer size using the ACTUAL subscription timeframe (not chartData.metadata)
            const tfMs = parseTimeframeToMs(timeframe);
            const bufferSizeInMs = BUFFER_SIZE_MULTIPLIER * tfMs;

            // Get current buffer boundaries from chart context
            const candles = chartContext.displayCandles || [];
            if (candles.length === 0) {
                console.warn('[useCandleSubscription] No candles available for buffer request');
                return;
            }

            const firstCandle = candles[0];
            const lastCandle = candles[candles.length - 1];

            let start, end;

            if (bufferDirection === 'past') {
                // Extend backwards from first candle (incremental, not cumulative)
                start = firstCandle.timestamp - bufferSizeInMs;
                end = firstCandle.timestamp + bufferSizeInMs; // Small overlap for safety
            } else {
                // Extend forwards from last candle (incremental, not cumulative)
                start = lastCandle.timestamp - bufferSizeInMs; // Small overlap for safety
                end = lastCandle.timestamp + bufferSizeInMs;
            }

            console.log('[useCandleSubscription] Handling buffer request:', {
                direction: bufferDirection,
                timeframe,
                tfMs: `${tfMs}ms`,
                bufferSize: `${BUFFER_SIZE_MULTIPLIER} candles = ${bufferSizeInMs}ms`,
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
                expectedCandles: Math.round((end - start) / tfMs)
            });

            const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

            // Set request state
            pendingRequestsRef.current.buffer = {
                isRequesting: true,
                direction: bufferDirection,
                requestId,
                timeoutId: null
            };

            // Setup timeout
            const timeoutId = setTimeout(() => {
                if (pendingRequestsRef.current.buffer.requestId === requestId) {
                    console.warn('[useCandleSubscription] Buffer request timeout - clearing flag');
                    clearBufferRequestState(requestId);

                    toast({
                        title: "Request Timeout",
                        description: "Buffer request took too long and was cancelled",
                        variant: "destructive",
                        duration: 3000
                    });
                }
            }, BUFFER_REQUEST_TIMEOUT);

            pendingRequestsRef.current.buffer.timeoutId = timeoutId;

            try {
                const startDate = new Date(start);
                const endDate = new Date(end);

                // Update requested range
                updateSubscriptionDateRange('requested', start, end);

                let success = false;

                if (subscriptionIds.chart) {
                    const result = await updateSubscription({
                        subscriptionId: subscriptionIds.chart,
                        newStartDate: startDate,
                        newEndDate: endDate,
                        resetData: true,
                        subscriptionType: 'CHART',
                        bufferDirection,
                        referenceTimestamp,
                        referenceOffset
                    });
                    success = result !== false;
                } else {
                    const result = await requestSubscription('chart', {
                        platformName,
                        stockSymbol,
                        timeframe,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        resetData: true,
                        subscriptionType: 'CHART',
                        isBufferUpdate: true,
                        bufferDirection
                    });
                    success = result !== false;
                }

                if (!success) {
                    console.warn('[useCandleSubscription] Buffer request was blocked');
                    clearTimeout(timeoutId);
                    clearBufferRequestState(requestId);
                    return;
                }

                console.log('[useCandleSubscription] Buffer request sent');
            } catch (err) {
                console.error('[useCandleSubscription] Buffer request failed:', err);
                clearTimeout(timeoutId);
                clearBufferRequestState(requestId);

                toast({
                    title: "Request Failed",
                    description: "Failed to request buffer data",
                    variant: "destructive",
                    duration: 3000
                });
            }
        };

        window.addEventListener('chartBufferUpdateRequested', handleBufferRequest);
        return () => window.removeEventListener('chartBufferUpdateRequested', handleBufferRequest);
    }, [
        currentDetails,
        subscriptionIds.chart,
        updateSubscription,
        requestSubscription,
        updateSubscriptionDateRange,
        clearBufferRequestState,
        toast,
        parseTimeframeToMs,
        BUFFER_SIZE_MULTIPLIER,
        chartContext
    ]);

    useEffect(() => {
        const handleIndicatorRequest = async (event) => {
            if (pendingRequestsRef.current.indicator.isRequesting) {
                console.log('[useCandleSubscription] Indicator request already in flight');
                return;
            }

            if (indicators.length === 0) {
                console.log('[useCandleSubscription] No indicators, skipping');
                return;
            }

            const { range } = event.detail || {};

            if (!range || !range.start || !range.end) {
                console.warn('[useCandleSubscription] Invalid indicator request range');
                return;
            }

            const { platformName, stockSymbol, timeframe } = currentDetails;

            if (!platformName || !stockSymbol || !timeframe) {
                console.warn('[useCandleSubscription] Missing subscription details for indicator request');
                return;
            }

            console.log('[useCandleSubscription] Handling indicator request:', {
                start: new Date(range.start).toISOString(),
                end: new Date(range.end).toISOString(),
                lookback: range.lookback
            });

            const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

            pendingRequestsRef.current.indicator = {
                isRequesting: true,
                requestId,
                timeoutId: null
            };

            const timeoutId = setTimeout(() => {
                if (pendingRequestsRef.current.indicator.requestId === requestId) {
                    console.warn('[useCandleSubscription] Indicator request timeout');
                    clearIndicatorRequestState(requestId);

                    toast({
                        title: "Request Timeout",
                        description: "Indicator data request took too long",
                        variant: "destructive",
                        duration: 3000
                    });
                }
            }, INDICATOR_REQUEST_TIMEOUT);

            pendingRequestsRef.current.indicator.timeoutId = timeoutId;

            try {
                const startDate = new Date(range.start);
                const endDate = new Date(range.end);

                // Update requested range
                updateSubscriptionDateRange('requested', range.start, range.end);

                if (subscriptionIds.chart) {
                    const result = await updateSubscription({
                        subscriptionId: subscriptionIds.chart,
                        newStartDate: startDate,
                        newEndDate: endDate,
                        resetData: true,
                        subscriptionType: 'CHART'
                    });

                    if (result === false) {
                        console.warn('[useCandleSubscription] Indicator request was blocked');
                        clearTimeout(timeoutId);
                        clearIndicatorRequestState(requestId);
                        return;
                    }
                }

                console.log('[useCandleSubscription] Indicator request sent');
            } catch (err) {
                console.error('[useCandleSubscription] Indicator request failed:', err);
                clearTimeout(timeoutId);
                clearIndicatorRequestState(requestId);

                toast({
                    title: "Request Failed",
                    description: "Failed to request indicator data",
                    variant: "destructive",
                    duration: 3000
                });
            }
        };

        window.addEventListener('indicatorRequirementsChanged', handleIndicatorRequest);
        return () => window.removeEventListener('indicatorRequirementsChanged', handleIndicatorRequest);
    }, [
        currentDetails,
        indicators,
        subscriptionIds.chart,
        updateSubscription,
        updateSubscriptionDateRange,
        clearIndicatorRequestState,
        toast
    ]);

// Handle buffer trimming: always store the trim and then attempt update
    useEffect(() => {
        const handleBufferTrimmed = (event) => {
            const { start, end, candleCount } = event.detail || {};

            if (!start || !end) {
                console.warn('[useCandleSubscription] Invalid trim event');
                return;
            }

            // Store the latest trim range
            pendingTrimRef.current = { start, end, candleCount };

            // Try to update subscription immediately (may defer if id not ready)
            void attemptTrimSubscriptionUpdate();
        };

        window.addEventListener('chartBufferTrimmed', handleBufferTrimmed);
        return () => window.removeEventListener('chartBufferTrimmed', handleBufferTrimmed);
    }, [attemptTrimSubscriptionUpdate]);

// Handle Go to Start reset of chart
    useEffect(() => {
        const handleRestartRequest = async () => {
            // Capture current subscription details BEFORE any state changes
            const { platformName, stockSymbol, timeframe } = currentDetails;

            if (!platformName || !stockSymbol || !timeframe) {
                console.warn('[useCandleSubscription] Cannot restart - no active subscription');
                toast({
                    title: "Cannot Reset",
                    description: "No active stock selected",
                    variant: "destructive",
                    duration: 3000
                });
                return;
            }

            console.log('[useCandleSubscription] Restarting subscription for current stock:', {
                platformName,
                stockSymbol,
                timeframe
            });

            try {
                // Step 1: Clear all state flags
                pendingAnchorRef.current = null;
                pendingTrimRef.current = null;
                clearBufferRequestState();
                clearIndicatorRequestState();

                // Step 2: Reset previous subscription tracking FIRST
                // This ensures the next subscription is treated as a new request
                previousSubscriptionRef.current = {
                    platformName: null,
                    stockSymbol: null,
                    timeframe: null,
                    wasHistorical: false
                };

                // Step 3: Unsubscribe
                if (subscriptionIds.chart) {
                    await unsubscribe('chart');
                    // Wait for unsubscribe to fully complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Step 4: Prepare fresh subscription request
                setIsSubscribing(true);
                setIsWaitingForData(true);

                const maxLookback = calculateMaxLookback(indicators);
                const totalCandlesToRequest = displayedCandles + (BUFFER_SIZE_MULTIPLIER * 2) + maxLookback;

                const now = new Date();
                const startDate = calculateStartDate(now, timeframe, totalCandlesToRequest);
                const endDate = now;

                console.log('[useCandleSubscription] Restart: requesting fresh data', {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    candles: totalCandlesToRequest
                });

                // Update requested range
                updateSubscriptionDateRange('requested', startDate.getTime(), endDate.getTime());

                // Step 5: Make fresh subscription request directly
                const subscriptionRequest = {
                    platformName,
                    stockSymbol,
                    timeframe,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    subscriptionType: 'CHART'
                };

                await requestSubscription('chart', subscriptionRequest);

                // Update current details
                setCurrentDetails({ platformName, stockSymbol, timeframe });

                console.log('[useCandleSubscription] Restart completed successfully');

            } catch (err) {
                console.error('[useCandleSubscription] Restart failed:', err);
                toast({
                    title: "Reset Failed",
                    description: "Failed to reload chart data",
                    variant: "destructive",
                    duration: 3000
                });
            } finally {
                setIsSubscribing(false);
            }
        };

        window.addEventListener('restartChartRequested', handleRestartRequest);
        return () => window.removeEventListener('restartChartRequested', handleRestartRequest);
    }, [
        currentDetails,
        subscriptionIds.chart,
        unsubscribe,
        calculateMaxLookback,
        calculateStartDate,
        displayedCandles,
        BUFFER_SIZE_MULTIPLIER,
        indicators,
        updateSubscriptionDateRange,
        requestSubscription,
        clearBufferRequestState,
        clearIndicatorRequestState,
        toast
    ]);

// Whenever subscriptionIds.chart changes, try to apply any pending trim
    useEffect(() => {
        if (!pendingTrimRef.current) return;
        if (!subscriptionIds.chart) return;

        void attemptTrimSubscriptionUpdate();
    }, [subscriptionIds.chart, attemptTrimSubscriptionUpdate]);

// ==================== REGISTER MESSAGE HANDLER ====================

    useEffect(() => {
        const unregister = registerHandler('chart', handleCandleMessage);
        return () => unregister();
    }, [handleCandleMessage, registerHandler]);

// ==================== CLEANUP ====================

    useEffect(() => {
        return () => {
            console.log('[useCandleSubscription] Cleaning up on unmount');

            clearBufferRequestState();
            clearIndicatorRequestState();

            if (subscriptionIds.chart) {
                unsubscribe('chart').catch(err => {
                    console.error('[useCandleSubscription] Cleanup error:', err);
                });
            }
        };
    }, [clearBufferRequestState, clearIndicatorRequestState]);

// ==================== RETURN ====================

    return {
        isConnected,
        isSubscribing,
        subscriptionIds,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        currentSubscriptionDetails: currentDetails
    };
}