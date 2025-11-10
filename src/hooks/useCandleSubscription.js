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
        updateSubscription,
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

    // ✅ CHANGE 2: NEW: Add this line to prevent double-extending
    const indicatorExtensionPendingRef = useRef(false);

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
    // Track last chart subscription we requested for correct diffing on timeframe change
    const lastChartSubscriptionRef = useRef({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    // Track pre-init buffer length to detect reinitialization
    const prevLenBeforeInitRef = useRef(null);

    // Get chart context for data management
    const {
        // New ChartContext API for clean merge/anchor/trim
        initializeOnSelection,
        mergeBaseCandles,
        // Single buffer: no separate indicator merge needed
        computeRequiredIndicatorRange,
        calculateRequiredDataRange,
        trimBuffersIfNeeded,

        // Existing controls consumed elsewhere
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

    // Listen for chart buffer update requests from ChartContext
    useEffect(() => {
        const handleChartBufferUpdateRequested = async (event) => {
            try {
                const detail = event?.detail || {};
                const { start, end, bufferDirection, referenceTimestamp, referenceOffset } = detail;
                if (!start || !end || isNaN(start) || isNaN(end)) {
                    console.log('[Chart Buffer] Invalid range in request; ignoring');
                    return;
                }

                // Resolve subscription details
                let platformName = currentSubscription.platformName;
                let stockSymbol = currentSubscription.stockSymbol;
                let timeframe = currentSubscription.timeframe;

                if (!platformName || !stockSymbol || !timeframe) {
                    if (latestSubscriptionDetailsRef.current.platformName && latestSubscriptionDetailsRef.current.stockSymbol && latestSubscriptionDetailsRef.current.timeframe) {
                        ({ platformName, stockSymbol, timeframe } = latestSubscriptionDetailsRef.current);
                    } else if (lastValidSubscription.platformName && lastValidSubscription.stockSymbol && lastValidSubscription.timeframe) {
                        ({ platformName, stockSymbol, timeframe } = lastValidSubscription);
                    }
                }

                if (!platformName || !stockSymbol || !timeframe) {
                    console.warn('[Chart Buffer] Missing subscription details; cannot request buffer update');
                    return;
                }

                const startDateIso = new Date(start).toISOString();
                const endDateIso = new Date(end).toISOString();
                console.log('[Chart Buffer] Requesting chart buffer update:', { platformName, stockSymbol, timeframe, startDateIso, endDateIso, bufferDirection });

                // Mark in-flight so downstream processing treats the next payload as buffer update
                isRequestingBufferUpdate.current = true;

                // Update known subscription date range to the requested range (not what we may receive)
                try {
                    if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange) {
                        window.__chartContextValue.updateSubscriptionDateRange(start, end);
                    }
                } catch (_) {}

                // Capture anchor to restore after merge (prefer explicit ref; fallback to left-edge anchor)
                if (referenceTimestamp) {
                    referenceTimestampRef.current = typeof referenceTimestamp === 'object'
                        ? { timestamp: referenceTimestamp.timestamp, offset: referenceOffset }
                        : referenceTimestamp;
                } else {
                    // fallback: left-edge timestamp
                    try {
                        const anchor = window.__chartContextValue?.getAnchor?.();
                        if (anchor) referenceTimestampRef.current = anchor;
                    } catch (_) {}
                }

                // Update existing chart subscription, fallback to create if missing
                if (subscriptionIds.chart) {
                    await updateSubscription({
                        subscriptionId: subscriptionIds.chart,
                        newStartDate: start,
                        newEndDate: end,
                        resetData: true,
                        subscriptionType: 'CHART'
                    });
                    console.log('[Chart Buffer] Chart buffer update-subscription sent');
                } else {
                    await requestSubscription('chart', {
                        platformName,
                        stockSymbol,
                        timeframe,
                        startDate: startDateIso,
                        endDate: endDateIso,
                        resetData: true,
                        isBufferUpdate: true,
                        bufferDirection,
                        subscriptionType: 'CHART'
                    });
                    console.log('[Chart Buffer] Chart subscribe sent (no existing subscription)');
                }
            } catch (err) {
                console.error('[Chart Buffer] Failed to request chart buffer update:', err);
            }
        };

        window.addEventListener('chartBufferUpdateRequested', handleChartBufferUpdateRequested);
        return () => window.removeEventListener('chartBufferUpdateRequested', handleChartBufferUpdateRequested);
    }, [currentSubscription, lastValidSubscription, requestSubscription, subscriptionIds.chart, unsubscribe]);

    // Transform candle data from backend format to frontend format
    const transformCandleData = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp:new Date(backendCandle.timestamp + 'Z').getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || currentSubscription.stockSymbol || latestSubscriptionDetailsRef.current.stockSymbol,
            indicatorValues: {}
        };
    }, [currentSubscription.stockSymbol]);

    let backendTimeframe, expectedTf, timeframeChanged;
    let newInterval, prevInterval, intervalChanged;
    let prevTicker, newTicker, symbolChanged;
    let forceReset;


    // Handle incoming chart candle message
    const handleChartCandleMessage = useCallback(async (data) => {
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
                const lastCandleTime = new Date(data.candles[data.candles.length - 1].timestamp).toISOString();
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
                        // Convert to milliseconds if necessary; ensure UTC for string dates
                        const startDate = typeof data.startDate === 'string' ?
                            new Date((/Z$/i.test(data.startDate) ? data.startDate : data.startDate + 'Z')).getTime() : data.startDate;
                        const endDate = typeof data.endDate === 'string' ?
                            new Date((/Z$/i.test(data.endDate) ? data.endDate : data.endDate + 'Z')).getTime() : data.endDate;

                        if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange) {
                            window.__chartContextValue.updateSubscriptionDateRange(startDate, endDate);
                        }
                    } else if (data.candles.length > 0) {
                        // If not provided explicitly, estimate from the candles we received
                        const startDate = new Date(data.candles[0].timestamp + 'Z').getTime();
                        const endDate = new Date(data.candles[data.candles.length - 1].timestamp + 'Z').getTime();

                        if (window.__chartContextValue && window.__chartContextValue.updateSubscriptionDateRange) {
                            window.__chartContextValue.updateSubscriptionDateRange(startDate, endDate);
                        }
                    }
                }
            }

            // Transform the new candles
            const newCandles = data.candles.map(c => transformCandleData(c, data.stockSymbol || currentSubscription.stockSymbol));

            // Check if this is a buffer update
            const isBufferUpdate = (data.isBufferUpdate || data.resetData === true) || isRequestingBufferUpdate.current;
            if (isRequestingBufferUpdate.current) {
                isRequestingBufferUpdate.current = false; // Reset the flag immediately after use
            }

            if (isBufferUpdate) {
                console.log("[Buffer Manager] Processing buffer update response");

                // Infer buffer direction by comparing received range to current known buffer
                let bufferDirection = 'unknown';
                // Capture previous buffer snapshot for past-shift logic
                let prevCandlesSnapshotForShift = null;
                try {
                    const prevCandles = (window.__chartContextValue && window.__chartContextValue.displayCandles) || [];
                    prevCandlesSnapshotForShift = Array.isArray(prevCandles) ? [...prevCandles] : [];
                    const prevStart = prevCandles.length ? prevCandles[0].timestamp : null;
                    const prevEnd = prevCandles.length ? prevCandles[prevCandles.length - 1].timestamp : null;
                    const newStart = Math.min(...newCandles.map(c => c.timestamp));
                    const newEnd = Math.max(...newCandles.map(c => c.timestamp));
                    const epsilon = (window.__chartContextValue && window.__chartContextValue.timeframeInMs) || 60_000;

                    if (prevStart != null && prevEnd != null && Number.isFinite(newStart) && Number.isFinite(newEnd)) {
                        // Determine if the new slice extends the buffer to the past/future beyond a tolerance
                        const extendsPast = newStart < (prevStart - epsilon);
                        const extendsFuture = newEnd > (prevEnd + epsilon);

                        if (extendsPast && !extendsFuture) bufferDirection = 'past';
                        else if (!extendsPast && extendsFuture) bufferDirection = 'future';
                        else if (extendsPast && extendsFuture) bufferDirection = 'both';
                        else bufferDirection = 'overlap'; // stays within known bounds
                    }

                    // Do NOT shrink known range to received slice; keep requested range authoritative
                } catch (e) {
                    console.warn('[Buffer Manager] Failed to infer direction:', e);
                }

                const referenceObj = referenceTimestampRef.current; // Use the ref; may be timestamp or {timestamp, offset}
                try {
                    const refTs = (referenceObj && typeof referenceObj === 'object') ? referenceObj.timestamp : referenceObj;
                    const refOffset = (referenceObj && typeof referenceObj === 'object') ? referenceObj.offset : undefined;
                    const prevCandles = (window.__chartContextValue && window.__chartContextValue.displayCandles) || [];
                    const prevStartIso = prevCandles[0] ? new Date(prevCandles[0].timestamp).toISOString() : 'none';
                    const prevEndIso = prevCandles[prevCandles.length - 1] ? new Date(prevCandles[prevCandles.length - 1].timestamp).toISOString() : 'none';
                    console.log('[Merge] Buffer BEFORE merge:', {
                        length: prevCandles.length,
                        first: prevStartIso,
                        last: prevEndIso
                    });
                    console.log('[Anchor] Reference to restore BEFORE merge:', {
                        timestamp: refTs ? new Date(refTs).toISOString() : 'none',
                        offset: refOffset !== undefined ? refOffset : 'none'
                    });
                } catch (_) {
                }

                // Reset the ref after use
                if (referenceTimestampRef.current) {
                    referenceTimestampRef.current = null;
                }

                // Merge via ChartContext (handles dedupe and re-anchoring)
                console.log('[Chart Merge] Buffer update incoming slice:', {
                    count: newCandles.length,
                    first: newCandles.length ? new Date(Math.min(...newCandles.map(c => c.timestamp))).toISOString() : 'none',
                    last: newCandles.length ? new Date(Math.max(...newCandles.map(c => c.timestamp))).toISOString() : 'none',
                    direction: bufferDirection
                });
                mergeBaseCandles(newCandles, {source: bufferDirection || 'buffer'});
                try {
                    const afterCandles = (window.__chartContextValue && window.__chartContextValue.displayCandles) || [];
                    const afterStartIso = afterCandles[0] ? new Date(afterCandles[0].timestamp).toISOString() : 'none';
                    const afterEndIso = afterCandles[afterCandles.length - 1] ? new Date(afterCandles[afterCandles.length - 1].timestamp).toISOString() : 'none';
                    console.log('[Merge] Buffer AFTER merge:', {
                        length: afterCandles.length,
                        first: afterStartIso,
                        last: afterEndIso
                    });
                } catch (_) {
                }

                // Track observed end to help break future buffer request loops if backend doesn't extend
                try {
                    const observedEnd = Math.max(...newCandles.map(c => c.timestamp));
                    if (Number.isFinite(observedEnd)) {
                        lastChartObservedEndRef.current = observedEnd;
                    }
                } catch (_) {
                }

                // Minimal re-anchor notification; the context already anchored on merge.
                // Use stored reference if present (e.g., special timeframe anchoring)
                if (window.__chartContextValue && window.__chartContextValue.handleBufferUpdateComplete) {
                    const ref = referenceTimestampRef.current || null;
                    console.log("Handle chart candle message called hundle buffer update complete with direction:" + bufferDirection, ref ? 'with reference' : 'without reference');
                    window.__chartContextValue.handleBufferUpdateComplete(bufferDirection || 'unknown', ref);
                    // Clear after use to avoid unintended reuse
                    referenceTimestampRef.current = null;
                }

                // Re-assert the requested known range after processing the response
                try {
                    const lastReq = lastChartRequestedRangeRef.current;
                    if (lastReq && lastReq.start && lastReq.end) {
                        window.__chartContextValue?.updateSubscriptionDateRange?.(lastReq.start, lastReq.end);
                    }
                } catch (_) {
                }
            } else {
                // For non-buffer initial payloads, decide replace vs merge based on overlap with current buffer
                try {
                    const ctx = window.__chartContextValue || {};
                    const prevCandles = (ctx && ctx.displayCandles) || [];
                    prevLenBeforeInitRef.current = prevCandles.length;
                    const prevStart = prevCandles.length ? prevCandles[0].timestamp : null;
                    const prevEnd = prevCandles.length ? prevCandles[prevCandles.length - 1].timestamp : null;
                    const newStart = Math.min(...newCandles.map(c => c.timestamp));
                    const newEnd = Math.max(...newCandles.map(c => c.timestamp));
                    const epsilon = (ctx && ctx.timeframeInMs) || 60_000;

                    const hasPrev = prevStart != null && prevEnd != null;
                    const overlaps = hasPrev && (newStart <= (prevEnd + epsilon)) && (newEnd >= (prevStart - epsilon));

                    // Detect timeframe/symbol changes to force reset instead of merge
                    const computeInterval = (arr) => {
                        if (!Array.isArray(arr) || arr.length < 2) return null;
                        const start = Math.max(1, arr.length - 5);
                        const deltas = [];
                        for (let i = start; i < arr.length; i++) {
                            const dt = arr[i].timestamp - arr[i - 1].timestamp;
                            if (Number.isFinite(dt) && dt > 0) deltas.push(dt);
                        }
                        if (!deltas.length) return null;
                        deltas.sort((a, b) => a - b);
                        return deltas[Math.floor(deltas.length / 2)];
                    };

                    // ✅ ASSIGN to module-level variables (no const)
                    prevInterval = computeInterval(prevCandles);
                    newInterval = computeInterval(newCandles);
                    intervalChanged = Number.isFinite(prevInterval) && Number.isFinite(newInterval)
                        ? Math.abs(prevInterval - newInterval) > Math.min(prevInterval, newInterval) * 0.2
                        : false;

                    // Prefer explicit backend timeframe when available
                    backendTimeframe = data?.timeframe;
                    expectedTf = currentSubscription?.timeframe
                        || latestSubscriptionDetailsRef.current?.timeframe
                        || lastValidSubscription?.timeframe;
                    timeframeChanged = Boolean(backendTimeframe && expectedTf && backendTimeframe !== expectedTf);

                    prevTicker = prevCandles[0]?.ticker;
                    newTicker = newCandles[0]?.ticker;
                    symbolChanged = Boolean(prevTicker && newTicker && prevTicker !== newTicker);

                    // Determine an anchor timestamp to preserve visual position across merges
                    let anchorTimestamp = null;
                    try {
                        if (ctx && ctx.activeTimestamp) {
                            anchorTimestamp = ctx.activeTimestamp;
                        } else if (Array.isArray(ctx.candleData) && ctx.candleData.length) {
                            anchorTimestamp = ctx.candleData[Math.floor(ctx.candleData.length / 2)]?.timestamp || null;
                        }
                    } catch (_) {
                    }

                    forceReset = timeframeChanged || intervalChanged || symbolChanged;

                    if (!hasPrev || forceReset) {
                        // First load or timeframe/symbol changed: initialize buffer
                        console.log(forceReset
                            ? `[Init] Change detected — reinitializing (timeframeChanged=${timeframeChanged}, intervalChanged=${intervalChanged}, symbolChanged=${symbolChanged}, backendTimeframe=${backendTimeframe}, expectedTf=${expectedTf})`
                            : 'has prev initialize on selection');
                        initializeOnSelection(newCandles);
                    } else if (overlaps) {
                        // Overlapping refresh: merge only; preserve current viewStartIndex
                        mergeBaseCandles(newCandles, {source: 'overlap'});
                        // Restore view to the anchor timestamp to avoid perceived snapping
                        if (anchorTimestamp && window.__chartContextValue?.handleBufferUpdateComplete) {
                            console.log('Future handle buffer update complete called for unknown');
                            window.__chartContextValue.handleBufferUpdateComplete('future', anchorTimestamp);
                        }
                    } else {
                        // Disjoint window (likely timeframe/symbol change): replace and start at left edge
                        console.log('else prev initialize on selection');
                        initializeOnSelection(newCandles);
                    }

                    // Coalesce known range
                    if (window.__chartContextValue?.updateSubscriptionDateRange && Number.isFinite(newStart) && Number.isFinite(newEnd)) {
                        window.__chartContextValue.updateSubscriptionDateRange(newStart, newEnd);
                    }
                } catch (e) {
                    console.warn('[Chart] Fallback initial handling due to error, replacing buffer:', e);
                    initializeOnSelection(newCandles);
                }

                // For initial payloads, prefer the requested range when present in the request metadata
                try {
                    const req = lastChartRequestedRangeRef.current;
                    if (req && req.start && req.end) {
                        window.__chartContextValue?.updateSubscriptionDateRange?.(req.start, req.end);
                    }
                } catch (_) {
                }
            }


            setError(null);
            setIsWaitingForData(false);

            // Do not set active subscription from data payloads; handled by WebSocket context on confirmations

            // ✅ CHANGE 3: Prevent Duplicate Extension in handleChartCandleMessage
            // If reinitialized and indicators exist, ensure base buffer covers lookback via update-subscription
            setError(null);
            setIsWaitingForData(false);

// If reinitialized and indicators exist, ensure base buffer covers lookback via update-subscription
            try {
                const ctx = window.__chartContextValue || {};
                const hasIndicators = Array.isArray(indicators) && indicators.length > 0;
                const didInit = typeof initializeOnSelection === 'function' &&
                    (prevLenBeforeInitRef?.current === 0 ||
                        ctx.displayCandles?.length === (newCandles?.length || 0));

                // ✅ Variables now accessible here
                const computeInterval = (arr) => {
                    if (!Array.isArray(arr) || arr.length < 2) return null;
                    const start = Math.max(1, arr.length - 5);
                    const deltas = [];
                    for (let i = start; i < arr.length; i++) {
                        const dt = arr[i].timestamp - arr[i - 1].timestamp;
                        if (Number.isFinite(dt) && dt > 0) deltas.push(dt);
                    }
                    if (!deltas.length) return null;
                    deltas.sort((a, b) => a - b);
                    return deltas[Math.floor(deltas.length / 2)];
                };

                // Recalculate if we haven't computed interval yet
                if (!intervalChanged && newCandles.length) {
                    newInterval = computeInterval(newCandles);
                    prevInterval = computeInterval(prevCandles || []);
                    intervalChanged = Number.isFinite(prevInterval) && Number.isFinite(newInterval)
                        ? Math.abs(prevInterval - newInterval) > Math.min(prevInterval, newInterval) * 0.2
                        : false;
                }

                const theForceReset = timeframeChanged || intervalChanged || symbolChanged;

                if (hasIndicators && didInit && !theForceReset && !indicatorExtensionPendingRef.current) {
                    console.log('[useCandleSubscription] Stock/platform same, auto-extending base buffer for indicator lookback');
                    indicatorExtensionPendingRef.current = true;

                    const indRange = computeRequiredIndicatorRange();
                    if (subscriptionIds.chart && (indRange.start || indRange.end)) {
                        await updateSubscription({
                            subscriptionId: subscriptionIds.chart,
                            newStartDate: indRange.start || undefined,
                            newEndDate: indRange.end || undefined,
                            resetData: true,
                            subscriptionType: 'CHART'
                        });
                        console.log('[useCandleSubscription] Auto-extension request sent');
                    }

                    setTimeout(() => {
                        indicatorExtensionPendingRef.current = false;
                    }, 500);
                } else if (theForceReset) {
                    console.log('[useCandleSubscription] Stock/platform change detected; skipping auto-extend (will be handled by subscribeToIndicatorCandles)');
                }
            } catch (e) {
                console.warn('[useCandleSubscription] Failed to auto-extend indicator lookback after reinit:', e);
                indicatorExtensionPendingRef.current = false;
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

            // Update (merge) base candles for realtime updates
            mergeBaseCandles(newCandles, { source: 'update' });
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

            // Do not set active subscription from here; WebSocket context will handle confirmations

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
    }, [mergeBaseCandles, initializeOnSelection, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, transformCandleData, setActiveSubscription, currentSubscription.stockSymbol, updateCurrentSubscriptionInfo]);


    // Indicator path unified: no separate indicator message handler required.

    // Legacy local buffer managers removed; buffer operations are centralized in ChartContext

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
            // Capture previous selection to detect timeframe-only change
            // Prefer stable sources so we don't compare against already-updated refs
            const prevPlatform =
                (lastChartSubscriptionRef.current && lastChartSubscriptionRef.current.platformName) ||
                (lastValidSubscription && lastValidSubscription.platformName) ||
                currentSubscription.platformName;
            const prevSymbol =
                (lastChartSubscriptionRef.current && lastChartSubscriptionRef.current.stockSymbol) ||
                (lastValidSubscription && lastValidSubscription.stockSymbol) ||
                currentSubscription.stockSymbol;
            const prevTimeframe =
                (lastChartSubscriptionRef.current && lastChartSubscriptionRef.current.timeframe) ||
                (lastValidSubscription && lastValidSubscription.timeframe) ||
                currentSubscription.timeframe;

            // First, unsubscribe from any existing chart subscription
            if (subscriptionIds.chart) {
                console.log(`[useCandleSubscription] Unsubscribing from current chart subscription before creating new one`);
                await unsubscribe('chart');
                // Small delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // ✅ CHANGE 4: Detect if this is a stock/platform change (not just timeframe)
            const isStockChange = prevPlatform && prevSymbol &&
                (prevPlatform.toUpperCase() !== platformName.toUpperCase() ||
                    prevSymbol.toUpperCase() !== stockSymbol.toUpperCase());

            if (isStockChange) {
                console.log('[useCandleSubscription] Stock/platform change detected, setting indicator extension flag');
                indicatorExtensionPendingRef.current = true;
            }

            // Defer updating our local reference until after we send the request
            // to ensure previous values above truly reflect the last state.

            // Access ChartContext to get buffer settings
            let bufferSizeMultiplier = 20; // Default if not available from context

            try {
                if (window.__chartContextValue && window.__chartContextValue.BUFFER_SIZE_MULTIPLIER) {
                    bufferSizeMultiplier = window.__chartContextValue.BUFFER_SIZE_MULTIPLIER;
                }
            } catch (e) {
                console.warn("[Buffer Manager] Could not access chart context for buffer settings:", e);
            }

            // For chart data, compute request window
            const now = new Date();
            const nowMs = now.getTime();
            let endDate = now;

            // Default behavior: request displayed + buffer around now
            const totalCandlesToRequest = displayedCandles + (bufferSizeMultiplier * 2);
            let startDate = calculateStartDate(endDate, timeframe, totalCandlesToRequest);

            // Special case: timeframe-only change AND not at latest edge → center around current anchor
            const onlyTimeframeChanged = (
                prevPlatform?.toUpperCase() === platformName.toUpperCase() &&
                prevSymbol?.toUpperCase() === stockSymbol.toUpperCase() &&
                typeof prevTimeframe === 'string' && prevTimeframe.toUpperCase() !== timeframe.toUpperCase()
            );
            try {
                console.log("Checking whether only the timeframe has changed. " +
                    "onlyTimeframeChanged: " + onlyTimeframeChanged +
                    " prevPlatfrom: " + prevPlatform + " platform: " + platformName +
                    " prevSymbol: " + prevSymbol + " stockSymbol: " + stockSymbol + "" +
                    " prevTimeframe: " + prevTimeframe + " timeframe: " + timeframe)
                if (onlyTimeframeChanged && window.__chartContextValue) {
                    console.log("Only timeframe has changed.")
                    const ctx = window.__chartContextValue;
                    const atRightEdge = (ctx.viewStartIndex + ctx.displayedCandles) >= (ctx.displayCandles?.length || 0);
                    const futureInFlight = ctx.isFutureRequestInFlight ? ctx.isFutureRequestInFlight() : false;
                    if (!atRightEdge && !futureInFlight) {
                        let anchorTs = null;
                        let offsetInView = null;

                        // Prefer the context-provided left-edge anchor when available
                        const anc = ctx.getAnchor?.();
                        if (anc && anc.timestamp) {
                            console.log('[useCandleSubscription] Using getAnchor() for timeframe-only change');
                            anchorTs = anc.timestamp;
                            offsetInView = 0; // left edge anchor
                        } else if (ctx.activeTimestamp) {
                            console.log('[useCandleSubscription] Using activeTimestamp for timeframe-only change');
                            anchorTs = ctx.activeTimestamp;
                        } else if (Array.isArray(ctx.candleData) && ctx.candleData.length) {
                            console.log('[useCandleSubscription] Using mid of visible window as fallback anchor');
                            const mid = Math.floor(ctx.candleData.length / 2);
                            anchorTs = ctx.candleData[mid]?.timestamp || null;
                            offsetInView = mid;
                        }

                        const tf = timeframe.toUpperCase();
                        const tfMs = tf === '1H' ? 60 * 60 * 1000
                            : tf === '4H' ? 4 * 60 * 60 * 1000
                                : tf === '1D' ? 24 * 60 * 60 * 1000
                                    : tf.endsWith('W') ? parseInt(tf) * 7 * 24 * 60 * 60 * 1000
                                        : tf.endsWith('M') ? parseInt(tf) * 60 * 1000
                                            : 60 * 1000;

                        if (anchorTs && Number.isFinite(tfMs) && tfMs > 0) {
                            const anchorRounded = Math.floor(anchorTs / tfMs) * tfMs;
                            if (offsetInView == null && Array.isArray(ctx.candleData) && ctx.candleData.length) {
                                const idx = ctx.candleData.findIndex(c => c.timestamp === anchorTs);
                                if (idx >= 0) offsetInView = idx;
                            }
                            if (offsetInView == null) offsetInView = Math.floor(ctx.displayedCandles / 2);
                            const visible = ctx.displayedCandles;
                            const extraPast = 40;

                            const startMs = anchorRounded - (offsetInView + extraPast) * tfMs;
                            const endMs = anchorRounded + (visible - 1 - offsetInView) * tfMs;

                            // Guard: if end would exceed now, fall back to now-based
                            if (endMs <= nowMs) {
                                const s = new Date(Math.max(0, startMs));
                                const e = new Date(Math.max(s.getTime() + tfMs, endMs));

                                startDate = s;
                                endDate = e;

                                // Pre-set known range and store reference for re-anchoring after init
                                try { ctx.updateSubscriptionDateRange?.(s.getTime(), e.getTime()); } catch (_) {}
                                referenceTimestampRef.current = { timestamp: anchorRounded, offset: offsetInView };

                                console.log('[useCandleSubscription] Timeframe-only change: anchored window', {
                                    anchorRounded: new Date(anchorRounded).toISOString(),
                                    offsetInView,
                                    startIso: s.toISOString(),
                                    endIso: e.toISOString(),
                                    visible
                                });
                            } else {
                                console.log('[useCandleSubscription] Anchored window exceeds now; using now-based range');
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[useCandleSubscription] Failed special timeframe anchoring; falling back to now-based window', e);
            }

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
            // Update known range immediately to the requested range
            try {
                window.__chartContextValue?.updateSubscriptionDateRange?.(startDate.getTime(), endDate.getTime());
            } catch (_) {}

            await requestSubscription('chart', chartSubscriptionRequest);
            console.log("[useCandleSubscription] Chart subscription request sent");
            // Update last-chart-subscription record for future diffs
            lastChartSubscriptionRef.current = { platformName, stockSymbol, timeframe };

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to chart candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            indicatorExtensionPendingRef.current = false; // ✅ Clear on error
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

            // No separate indicator subscription maintained anymore

            // Ensure base subscription covers indicator lookback instead of maintaining a separate indicator subscription
            expectIndicatorResetRef.current = true;
            const indRange = computeRequiredIndicatorRange();
            const now = new Date();
            const endDate = indRange.end ? new Date(indRange.end) : now;
            const startDate = indRange.start ? new Date(indRange.start) : calculateStartDate(endDate, timeframe, displayedCandles * 3);

            if (subscriptionIds.chart) {
                await updateSubscription({
                    subscriptionId: subscriptionIds.chart,
                    newStartDate: startDate,
                    newEndDate: endDate,
                    resetData: true,
                    subscriptionType: 'CHART'
                });

                // ✅ CHANGE 5: Clear the pending flag after we've submitted
                console.log('[useCandleSubscription] Indicator subscription extension sent, clearing pending flag');
                setTimeout(() => {
                    indicatorExtensionPendingRef.current = false;
                }, 100);

                return 'pending';
            }
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to indicator candles:", err);

            // ✅ Clear on error to avoid deadlock
            indicatorExtensionPendingRef.current = false;

            toast({
                title: "Indicator Data Error",
                description: "Failed to subscribe to indicator data: " + err.message,
                variant: "destructive",
                duration: 3000
            });

            return null;
        }
    }, [computeRequiredIndicatorRange, calculateStartDate, displayedCandles, indicators, toast,
        subscriptionIds.chart, updateSubscription]);

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

        // Deduplicate using last requested range to avoid repeated identical updates
        console.log("[useCandleSubscription] Updating indicator subscription due to indicator changes");
        console.log(`Using details: ${platformName}, ${stockSymbol}, ${timeframe}`);

        try {
            const indRange = computeRequiredIndicatorRange();
            const key = indRange ? `${indRange.start}|${indRange.end}|${indicators.length}` : 'none';
            if (lastIndicatorRequestRef.current === key) {
                console.log('[useCandleSubscription] Skipping indicator update; range unchanged');
                return;
            }
            lastIndicatorRequestRef.current = key;
            await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
        } catch (err) {
            console.error("[useCandleSubscription] Failed to update indicator subscription:", err);
        }
    }, [indicators.length, subscribeToIndicatorCandles, subscriptionIds.chart, currentSubscription, lastValidSubscription, computeRequiredIndicatorRange]);

    // Main subscription function exposed to components
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        try {
            // First subscribe to chart data (it will update refs after sending the request)
            await subscribeToChartCandles(platformName, stockSymbol, timeframe);

            // After subscribing to chart data, ensure base buffer covers indicator range if needed
            if (indicators.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
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
                const refTimestampStr = (referenceTimestamp && typeof referenceTimestamp === 'object')
                    ? new Date(referenceTimestamp.timestamp).toISOString()
                    : (referenceTimestamp && !isNaN(referenceTimestamp))
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

                    console.log("[Buffer Manager] Sending buffer update via update-subscription:", { start: startDate.toISOString(), end: endDate.toISOString() });

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

                    // Send the update request (no new subscription)
                    if (subscriptionIds.chart) {
                        await updateSubscription({
                            subscriptionId: subscriptionIds.chart,
                            newStartDate: startDate,
                            newEndDate: endDate,
                            resetData: true,
                            subscriptionType: 'CHART'
                        });
                    } else {
                        // Fallback: create if missing
                        await requestSubscription('chart', {
                            platformName,
                            stockSymbol,
                            timeframe,
                            startDate: startDate.toISOString(),
                            endDate: endDate.toISOString(),
                            resetData: true,
                            subscriptionType: 'CHART'
                        });
                    }

                    // Store the reference timestamp for position restoration
                    if (typeof referenceTimestamp === 'number' && !isNaN(referenceTimestamp)) {
                        console.log(`[Buffer Manager] Stored reference timestamp: ${new Date(referenceTimestamp).toISOString()}`);
                        referenceTimestampRef.current = referenceTimestamp;
                    } else if (referenceTimestamp && typeof referenceTimestamp === 'object' && !isNaN(referenceTimestamp.timestamp)) {
                        console.log(`[Buffer Manager] Stored reference (with offset): ${new Date(referenceTimestamp.timestamp).toISOString()} offset=${referenceTimestamp.offset}`);
                        referenceTimestampRef.current = { timestamp: referenceTimestamp.timestamp, offset: referenceTimestamp.offset };
                    }

                    console.log("[Buffer Manager] Buffer update request sent");

                    // Also ensure indicator subscription covers the same required range
                    try {
                        // Use the context's indicator range directly
                        let indicatorRangeStartDate = startDate;
                        let indicatorRangeEndDate = endDate;
                        try {
                            const ctx = window.__chartContextValue || {};
                            const indReq = ctx.computeRequiredIndicatorRange ? ctx.computeRequiredIndicatorRange() : null;
                            if (indReq && indReq.start && !isNaN(indReq.start)) {
                                const reqStart = new Date(indReq.start);
                                if (reqStart.getTime()) indicatorRangeStartDate = reqStart;
                            }
                            if (indReq && indReq.end && !isNaN(indReq.end)) {
                                const reqEnd = new Date(indReq.end);
                                if (reqEnd.getTime()) indicatorRangeEndDate = reqEnd;
                            }
                        } catch (_) {}

                        const indicatorRangeStart = indicatorRangeStartDate.toISOString();
                        const indicatorRangeEnd = indicatorRangeEndDate.toISOString();

                        // Only if we have indicators
                        if (indicators.length > 0 && subscriptionIds.chart) {
                            // Single buffer: no separate indicator buffer to reset
                            expectIndicatorResetRef.current = true;
                            await updateSubscription({
                                subscriptionId: subscriptionIds.chart,
                                newStartDate: indicatorRangeStartDate,
                                newEndDate: indicatorRangeEndDate,
                                resetData: true,
                                subscriptionType: 'CHART'
                            });
                        }
                    } catch (e) {
                        console.warn('[Buffer Manager] Failed to sync indicator subscription to buffer range:', e);
                    }
                } else {
                    // If not a buffer update, ensure base buffer covers indicator needs
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

    // Handle explicit restart requests from UI (e.g., CandleChart)
    useEffect(() => {
        const onRestart = async () => {
            try {
                console.log('[useCandleSubscription] Restart requested event received');
                const platform = latestSubscriptionDetailsRef.current.platformName || currentSubscription.platformName;
                const symbol = latestSubscriptionDetailsRef.current.stockSymbol || currentSubscription.stockSymbol;
                const timeframe = latestSubscriptionDetailsRef.current.timeframe || currentSubscription.timeframe;
                if (!platform || !symbol || !timeframe) {
                    console.warn('[useCandleSubscription] Missing details for restart');
                    return;
                }
                // Re-run the same flow as user selection
                await subscribeToCandles(platform, symbol, timeframe);
            } catch (e) {
                console.error('[useCandleSubscription] Failed to restart subscription:', e);
            }
        };
        window.addEventListener('restartChartRequested', onRestart);
        return () => window.removeEventListener('restartChartRequested', onRestart);
    }, [subscribeToCandles, currentSubscription]);

    // Register message handlers with CandleWebSocketContext on mount
    useEffect(() => {
        //console.log("[useCandleSubscription] Registering message handlers with CandleWebSocketContext");

        // Register our handlers
        const unregChartHandler = registerHandler('chart', handleChartCandleMessage);

        // Cleanup function - unregister our handlers when unmounting
        return () => {
            unregChartHandler();
        };
    }, [handleChartCandleMessage, registerHandler]);

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

            // No separate indicator subscription anymore
        };
    }, []); // Empty dependency array means this runs on mount and cleanup runs on unmount


    // Watch for indicator changes to ensure base buffer covers indicator needs (single subscription)
    useEffect(() => {
        // If indicators are added and we have an active chart subscription but no indicator subscription
        if (indicators.length > 0 && subscriptionIds.chart) {

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
                        // Ensure base buffer covers indicator lookback instead of creating a separate indicator subscription
                        updateIndicatorSubscription();
                    } else {
                        console.log("[useCandleSubscription] Skipping immediate indicator subscription - update already in progress");
                    }
                }, 100);
            } else {
                console.log("[useCandleSubscription] Cannot create indicator subscription - missing details");
            }
        }
        // If indicators are removed
        else if (indicators.length === 0) {
            // No indicators: nothing to do; base subscription remains
        }
    }, [indicators.length, subscriptionIds.chart]);

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