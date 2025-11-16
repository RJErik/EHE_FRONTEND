// src/components/stockMarket/ChartContext.jsx
import { createContext, useState, useCallback, useRef, useMemo, useEffect } from "react";
import { calculateIndicator } from "./indicators/indicatorCalculations.js";

export const ChartContext = createContext(null);

export function ChartProvider({ children }) {
    // ==================== CORE STATE ====================

    const [chartData, setChartData] = useState({
        candles: [],
        viewWindow: {
            startIndex: 0,
            displayCount: 100
        },
        subscriptionRange: {
            actual: {
                start: null,
                end: null
            },
            requested: {
                start: null,
                end: null
            }
        },
        metadata: {
            timeframe: 24 * 60 * 60 * 1000, // Default 1 day in ms
            symbol: null,
            platform: null
        }
    });

    const [indicators, setIndicators] = useState([]);

    const [asyncState, setAsyncState] = useState({
        loadingPast: false,
        loadingFuture: false,
        isWaitingForData: true
    });

    const [uiState, setUiState] = useState({
        isDragging: false,
        hoveredIndex: null,
        currentMouseY: null,
        activeTimestamp: null,
        isLogarithmic: false,
        isFollowingLatest: false,
        isDataGenerationEnabled: false
    });

    // ==================== CONSTANTS ====================

    const MIN_DISPLAY_CANDLES = 20;
    const MAX_DISPLAY_CANDLES = 200;
    const BUFFER_SIZE_MULTIPLIER = 20;
    const BUFFER_THRESHOLD_MULTIPLIER = 10;
    const PAST_MARGIN = 80;
    const FUTURE_MARGIN = 80;

    // ==================== REFS ====================

    const prevIndicatorIdsRef = useRef(new Set());
    const debounceTimerRef = useRef(null);
    const lastRequestRef = useRef({ direction: null, timestamp: 0 });

    // ==================== HELPER FUNCTIONS ====================

    const dedupeAndSort = useCallback((candles) => {
        const byTs = new Map();
        for (const c of candles || []) {
            if (!c || typeof c.timestamp !== 'number') continue;
            byTs.set(c.timestamp, c);
        }
        return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
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

    const applyIndicatorsToCandles = useCallback((candles, currentIndicators) => {
        if (!candles.length || !currentIndicators.length) return candles;

        return candles.map((candle, candleIndex) => {
            const updated = { ...candle, indicatorValues: candle.indicatorValues || {} };

            currentIndicators.forEach(ind => {
                try {
                    const values = calculateIndicator(ind, candles);
                    if (values && candleIndex < values.length) {
                        updated.indicatorValues[ind.id] = values[candleIndex];
                    }
                } catch (err) {
                    console.error(`[ChartContext] Error calculating ${ind.name}:`, err);
                }
            });

            return updated;
        });
    }, []);

    // ==================== CORE ACTIONS ====================

    /**
     * Initialize chart with new data (stock/timeframe change)
     */
    const initializeChart = useCallback((newCandles = [], metadata = {}) => {
        console.log('[ChartContext] initializeChart', {
            candleCount: newCandles?.length || 0,
            metadata
        });

        const cleaned = dedupeAndSort(newCandles);
        const withIndicators = applyIndicatorsToCandles(cleaned, indicators);

        const initialDisplayCount = 100;
        const startIndex = Math.max(0, withIndicators.length - initialDisplayCount);

        setChartData(prev => ({
            candles: withIndicators,
            viewWindow: {
                startIndex,
                displayCount: initialDisplayCount
            },
            subscriptionRange: prev.subscriptionRange, // Keep existing subscription ranges
            metadata: {
                timeframe: metadata.timeframe || prev.metadata.timeframe,
                symbol: metadata.symbol || prev.metadata.symbol,
                platform: metadata.platform || prev.metadata.platform
            }
        }));

        setAsyncState(prev => ({
            ...prev,
            isWaitingForData: false
        }));
    }, [dedupeAndSort, applyIndicatorsToCandles, indicators]);

    /**
     * Merge incoming candles into the buffer
     */
    const handleIncomingCandles = useCallback((newCandles = [], options = {}) => {
        const {
            direction = 'unknown',
            referenceTimestamp = null,
            referenceOffset = 0,
            isUpdate = false
        } = options;

        console.log('[ChartContext] handleIncomingCandles', {
            count: newCandles?.length || 0,
            direction,
            isUpdate
        });

        setChartData(prev => {
            const prevCandles = prev.candles;

            // Merge logic
            const byTimestamp = new Map();

            // Seed with existing candles
            for (const c of prevCandles) {
                if (!c || typeof c.timestamp !== 'number') continue;
                byTimestamp.set(c.timestamp, c);
            }

            const EPS = 1e-8;
            const nearlyEqual = (a, b) => {
                const an = Number(a), bn = Number(b);
                if (!Number.isFinite(an) || !Number.isFinite(bn)) return a === b;
                return Math.abs(an - bn) <= EPS;
            };

            const isOHLCVSame = (a, b) => (
                nearlyEqual(a?.open, b?.open) &&
                nearlyEqual(a?.high, b?.high) &&
                nearlyEqual(a?.low, b?.low) &&
                nearlyEqual(a?.close, b?.close) &&
                nearlyEqual(a?.volume, b?.volume)
            );

            // Merge new candles
            for (const n of newCandles) {
                if (!n || typeof n.timestamp !== 'number') continue;
                const existing = byTimestamp.get(n.timestamp);

                if (!existing) {
                    byTimestamp.set(n.timestamp, { ...n });
                    continue;
                }

                // If OHLCV identical, keep existing (preserves indicators)
                if (isOHLCVSame(existing, n)) {
                    continue;
                }

                // Update OHLCV but preserve indicators if they exist
                const preservedIndicators = (existing.indicatorValues && Object.keys(existing.indicatorValues).length > 0)
                    ? existing.indicatorValues
                    : n.indicatorValues;

                byTimestamp.set(n.timestamp, {
                    ...existing,
                    ...n,
                    indicatorValues: preservedIndicators || existing.indicatorValues || {}
                });
            }

            let merged = Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);

            // Apply indicators
            merged = applyIndicatorsToCandles(merged, indicators);

            // Calculate prepended count for view adjustment
            const prevFirst = prevCandles[0]?.timestamp;
            let prepended = 0;
            if (Number.isFinite(prevFirst)) {
                const threshold = prevFirst - Math.floor(prev.metadata.timeframe / 2);
                for (let i = 0; i < merged.length; i++) {
                    if (merged[i].timestamp < threshold) prepended++;
                    else break;
                }
            }

            // Reanchor view
            let newViewStart = prev.viewWindow.startIndex;

            if (prepended > 0) {
                // Shift right to maintain visual position
                newViewStart = Math.min(
                    prev.viewWindow.startIndex + prepended,
                    Math.max(0, merged.length - prev.viewWindow.displayCount)
                );
            } else if (referenceTimestamp) {
                // Use explicit reference
                const refIdx = merged.findIndex(c => c.timestamp === referenceTimestamp);
                if (refIdx >= 0) {
                    const desiredStart = refIdx - referenceOffset;
                    newViewStart = Math.max(
                        0,
                        Math.min(desiredStart, merged.length - prev.viewWindow.displayCount)
                    );
                }
            } else if (isUpdate && uiState.isFollowingLatest) {
                // Snap to latest for real-time updates
                newViewStart = Math.max(0, merged.length - prev.viewWindow.displayCount);
            }

            // Trim if buffer too large
            const displayCount = prev.viewWindow.displayCount;
            const targetTotal = Math.max(
                displayCount * 3,
                400,
            );

            let didTrim = false;
            if (merged.length > targetTotal) {
                const maxLookback = calculateMaxLookback(indicators);
                const leftMargin = Math.max(PAST_MARGIN + maxLookback, Math.floor((targetTotal - displayCount) / 2));
                const rightMargin = Math.max(FUTURE_MARGIN, targetTotal - displayCount - leftMargin);

                const startIdx = Math.max(0, newViewStart - leftMargin);
                const endIdx = Math.min(merged.length, newViewStart + displayCount + rightMargin);

                merged = merged.slice(startIdx, endIdx);
                newViewStart = Math.max(0, newViewStart - startIdx);
                didTrim = true;

                // Notify subscription layer about trimmed boundaries
                if (merged.length > 0) {
                    console.log('[ChartContext] Buffer trimmed, notifying subscription layer', {
                        newStart: new Date(merged[0].timestamp).toISOString(),
                        newEnd: new Date(merged[merged.length - 1].timestamp).toISOString(),
                        candleCount: merged.length
                    });

                    setTimeout(() => {
                        const evt = new CustomEvent('chartBufferTrimmed', {
                            detail: {
                                start: merged[0].timestamp,
                                end: merged[merged.length - 1].timestamp,
                                candleCount: merged.length
                            }
                        });
                        window.dispatchEvent(evt);
                    }, 0);
                }
            }

            return {
                candles: merged,
                viewWindow: {
                    ...prev.viewWindow,
                    startIndex: newViewStart
                },
                subscriptionRange: {
                    actual: prev.subscriptionRange.actual,
                    requested: prev.subscriptionRange.requested
                },
                metadata: prev.metadata
            };
        });

        // Clear loading flags
        setAsyncState(prev => ({
            ...prev,
            loadingPast: direction === 'past' ? false : prev.loadingPast,
            loadingFuture: direction === 'future' ? false : prev.loadingFuture
        }));

    }, [applyIndicatorsToCandles, indicators, uiState.isFollowingLatest, calculateMaxLookback]);

    /**
     * Handle view scroll
     */
    const handleViewScroll = useCallback((newStartIndex) => {
        setChartData(prev => ({
            ...prev,
            viewWindow: {
                ...prev.viewWindow,
                startIndex: Math.max(0, Math.min(
                    newStartIndex,
                    prev.candles.length - prev.viewWindow.displayCount
                ))
            }
        }));
    }, []);

    /**
     * Handle indicator changes
     */
    const handleIndicatorChange = useCallback((newIndicators) => {
        setIndicators(newIndicators);

        // Recalculate indicators on current data
        setChartData(prev => {
            const withIndicators = applyIndicatorsToCandles(prev.candles, newIndicators);
            return {
                ...prev,
                candles: withIndicators
            };
        });
    }, [applyIndicatorsToCandles]);

    /**
     * Request buffer extension
     */
    const requestBufferExtension = useCallback((direction, referenceInfo = null) => {
        const { candles, viewWindow, metadata, subscriptionRange } = chartData;

        if (!candles.length || !subscriptionRange.actual.start || !subscriptionRange.actual.end) {
            console.warn('[ChartContext] Cannot request buffer - no data');
            return;
        }

        // Check if we're making the same request too quickly
        const now = Date.now();
        if (lastRequestRef.current.direction === direction &&
            now - lastRequestRef.current.timestamp < 1000) {
            console.log('[ChartContext] Skipping duplicate request (too soon)');
            return;
        }

        const bufferSizeInMs = BUFFER_SIZE_MULTIPLIER * metadata.timeframe;
        const visibleStartIndex = viewWindow.startIndex;
        const visibleEndIndex = Math.min(
            viewWindow.startIndex + viewWindow.displayCount - 1,
            candles.length - 1
        );

        const firstVisibleCandle = candles[visibleStartIndex];
        const lastVisibleCandle = candles[visibleEndIndex];

        let newStartDate, newEndDate;

        if (direction === 'past') {
            newEndDate = firstVisibleCandle.timestamp + bufferSizeInMs;
            newStartDate = subscriptionRange.requested.start
                ? subscriptionRange.requested.start - bufferSizeInMs
                : subscriptionRange.actual.start - bufferSizeInMs;

            // Check if already requested this range
            if (subscriptionRange.requested.start &&
                newStartDate >= subscriptionRange.requested.start - (metadata.timeframe * 2)) {
                console.log('[ChartContext] Skipping redundant past request');
                return;
            }
        } else {
            newStartDate = lastVisibleCandle.timestamp - bufferSizeInMs;
            newEndDate = subscriptionRange.requested.end
                ? subscriptionRange.requested.end + bufferSizeInMs
                : subscriptionRange.actual.end + bufferSizeInMs;

            // Check if already requested this range
            if (subscriptionRange.requested.end &&
                newEndDate <= subscriptionRange.requested.end + (metadata.timeframe * 2)) {
                console.log('[ChartContext] Skipping redundant future request');
                return;
            }
        }

        // Guard against invalid range
        if (newStartDate >= newEndDate) {
            if (direction === 'past') {
                newStartDate = firstVisibleCandle.timestamp - bufferSizeInMs;
                newEndDate = firstVisibleCandle.timestamp + bufferSizeInMs;
            } else {
                newStartDate = lastVisibleCandle.timestamp - bufferSizeInMs;
                newEndDate = lastVisibleCandle.timestamp + bufferSizeInMs;
            }
        }

        console.log('[ChartContext] Requesting buffer extension:', {
            direction,
            start: new Date(newStartDate).toISOString(),
            end: new Date(newEndDate).toISOString()
        });

        // Update last request tracking
        lastRequestRef.current = {
            direction,
            timestamp: now
        };

        setAsyncState(prev => ({
            ...prev,
            [direction === 'past' ? 'loadingPast' : 'loadingFuture']: true
        }));

        // Emit event
        const evt = new CustomEvent('chartBufferUpdateRequested', {
            detail: {
                start: newStartDate,
                end: newEndDate,
                bufferDirection: direction,
                referenceTimestamp: referenceInfo?.timestamp || firstVisibleCandle?.timestamp,
                referenceOffset: referenceInfo?.offset || 0
            }
        });
        window.dispatchEvent(evt);

    }, [chartData]);

    /**
     * Request indicator data extension
     */
    const requestIndicatorData = useCallback(() => {
        const { candles, metadata } = chartData;

        if (!candles.length || indicators.length === 0) return;

        const maxLookback = calculateMaxLookback(indicators);
        const firstCandle = candles[0];
        const lastCandle = candles[candles.length - 1];

        const start = firstCandle.timestamp - (maxLookback * metadata.timeframe);
        const end = lastCandle.timestamp;

        console.log('[ChartContext] Requesting indicator data:', {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            lookback: maxLookback
        });

        // Emit event
        const evt = new CustomEvent('indicatorRequirementsChanged', {
            detail: {
                range: { start, end, lookback: maxLookback },
                indicatorCount: indicators.length
            }
        });
        window.dispatchEvent(evt);

    }, [chartData, indicators, calculateMaxLookback]);

    // ==================== COMPUTED VALUES ====================

    const visibleCandles = useMemo(() => {
        const { candles, viewWindow } = chartData;
        const start = viewWindow.startIndex;
        const end = Math.min(start + viewWindow.displayCount, candles.length);
        return candles.slice(start, end);
    }, [chartData]);

    const hoveredCandle = useMemo(() => {
        if (uiState.hoveredIndex === null) return null;
        return visibleCandles[uiState.hoveredIndex] || null;
    }, [visibleCandles, uiState.hoveredIndex]);

    // ==================== EFFECTS ====================

    /**
     * Check if we need more data when view changes (with debouncing)
     */
    useEffect(() => {
        if (uiState.isDragging) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            return;
        }

        if (!chartData.candles.length) return;
        if (asyncState.loadingPast || asyncState.loadingFuture) {
            console.log('[ChartContext] Skipping edge check - request in flight:', {
                loadingPast: asyncState.loadingPast,
                loadingFuture: asyncState.loadingFuture
            });
            return;
        }

        const { candles, viewWindow, subscriptionRange, metadata } = chartData;

        if (!subscriptionRange.actual.start || !subscriptionRange.actual.end) return;

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the check
        debounceTimerRef.current = setTimeout(() => {
            const visibleStartIndex = viewWindow.startIndex;
            const visibleEndIndex = Math.min(
                viewWindow.startIndex + viewWindow.displayCount - 1,
                candles.length - 1
            );

            const firstVisibleCandle = candles[visibleStartIndex];
            const lastVisibleCandle = candles[visibleEndIndex];

            if (!firstVisibleCandle || !lastVisibleCandle) return;

            const thresholdTimeInMs = BUFFER_THRESHOLD_MULTIPLIER * metadata.timeframe;

            const timeFromStart = firstVisibleCandle.timestamp - subscriptionRange.actual.start;
            const timeToEnd = subscriptionRange.actual.end - lastVisibleCandle.timestamp;

            console.log('[ChartContext] Edge check:', {
                timeFromStart: `${Math.floor(timeFromStart / (24 * 60 * 60 * 1000))} days`,
                timeToEnd: `${Math.floor(timeToEnd / (24 * 60 * 60 * 1000))} days`,
                threshold: `${Math.floor(thresholdTimeInMs / (24 * 60 * 60 * 1000))} days`,
                needsPast: timeFromStart < thresholdTimeInMs,
                needsFuture: timeToEnd < thresholdTimeInMs
            });

            const needsPastData = timeFromStart < thresholdTimeInMs;
            const needsFutureData = timeToEnd < thresholdTimeInMs;

            if (needsPastData) {
                requestBufferExtension('past', {
                    timestamp: firstVisibleCandle.timestamp,
                    offset: 0
                });
            } else if (needsFutureData) {
                const refOffset = Math.max(0, Math.min(
                    viewWindow.displayCount - 1,
                    visibleEndIndex - visibleStartIndex
                ));
                requestBufferExtension('future', {
                    timestamp: lastVisibleCandle.timestamp,
                    offset: refOffset
                });
            }
        }, 200); // 200ms debounce

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };

    }, [
        chartData.viewWindow.startIndex,
        chartData.candles.length,
        uiState.isDragging,
        asyncState.loadingPast,
        asyncState.loadingFuture,
        requestBufferExtension,
        chartData
    ]);

    /**
     * Request indicator data when indicators change
     */
    useEffect(() => {
        if (indicators.length === 0) {
            prevIndicatorIdsRef.current = new Set();
            return;
        }

        if (!chartData.candles.length) return;

        const currentIds = new Set(indicators.map(ind => ind.id));
        const prevIds = prevIndicatorIdsRef.current;

        const idsChanged =
            currentIds.size !== prevIds.size ||
            [...currentIds].some(id => !prevIds.has(id));

        if (!idsChanged) return;

        prevIndicatorIdsRef.current = currentIds;

        const timer = setTimeout(() => {
            requestIndicatorData();
        }, 100);

        return () => clearTimeout(timer);
    }, [indicators, chartData.candles.length, requestIndicatorData]);

    /**
     * Set default active timestamp
     */
    useEffect(() => {
        if (uiState.activeTimestamp == null && visibleCandles.length > 0) {
            setUiState(prev => ({
                ...prev,
                activeTimestamp: visibleCandles[0].timestamp
            }));
        }
    }, [visibleCandles, uiState.activeTimestamp]);

    // ==================== PUBLIC API ====================

    const addIndicator = useCallback((indicator) => {
        const newIndicator = {
            ...indicator,
            id: crypto.randomUUID?.() || `id-${Date.now()}`
        };
        handleIndicatorChange([...indicators, newIndicator]);
    }, [indicators, handleIndicatorChange]);

    const removeIndicator = useCallback((id) => {
        handleIndicatorChange(indicators.filter(ind => ind.id !== id));
    }, [indicators, handleIndicatorChange]);

    const updateIndicator = useCallback((id, updates) => {
        handleIndicatorChange(
            indicators.map(ind => ind.id === id ? { ...ind, ...updates } : ind)
        );
    }, [indicators, handleIndicatorChange]);

    const computeRequiredIndicatorRange = useCallback(() => {
        const { candles, metadata } = chartData;

        if (!candles.length) {
            return { start: null, end: null, lookback: 0 };
        }

        const maxLookback = calculateMaxLookback(indicators);
        const firstCandle = candles[0];
        const lastCandle = candles[candles.length - 1];

        const start = firstCandle.timestamp - (maxLookback * metadata.timeframe);
        const end = lastCandle.timestamp;

        return { start, end, lookback: maxLookback };
    }, [chartData, indicators, calculateMaxLookback]);

    const updateSubscriptionDateRange = useCallback((type, startDate, endDate) => {
        console.log('[ChartContext] Updating subscription range:', {
            type,
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString()
        });

        setChartData(prev => ({
            ...prev,
            subscriptionRange: {
                ...prev.subscriptionRange,
                [type]: {
                    start: startDate,
                    end: endDate
                }
            }
        }));
    }, []);

    const contextValue = {
        // Core data
        displayCandles: chartData.candles,
        candleData: visibleCandles,

        // View state
        viewStartIndex: chartData.viewWindow.startIndex,
        setViewStartIndex: handleViewScroll,
        displayedCandles: chartData.viewWindow.displayCount,
        setDisplayedCandles: useCallback((count) => {
            setChartData(prev => ({
                ...prev,
                viewWindow: {
                    ...prev.viewWindow,
                    displayCount: Math.max(MIN_DISPLAY_CANDLES, Math.min(MAX_DISPLAY_CANDLES, count))
                }
            }));
        }, []),

        // UI state
        isDragging: uiState.isDragging,
        setIsDragging: useCallback((value) => {
            setUiState(prev => ({ ...prev, isDragging: value }));
        }, []),
        hoveredIndex: uiState.hoveredIndex,
        setHoveredIndex: useCallback((value) => {
            setUiState(prev => ({ ...prev, hoveredIndex: value }));
        }, []),
        hoveredCandle,
        currentMouseY: uiState.currentMouseY,
        setCurrentMouseY: useCallback((value) => {
            setUiState(prev => ({ ...prev, currentMouseY: value }));
        }, []),
        activeTimestamp: uiState.activeTimestamp,
        setActiveTimestamp: useCallback((value) => {
            setUiState(prev => ({ ...prev, activeTimestamp: value }));
        }, []),
        isLogarithmic: uiState.isLogarithmic,
        setIsLogarithmic: useCallback((value) => {
            setUiState(prev => ({ ...prev, isLogarithmic: value }));
        }, []),
        isFollowingLatest: uiState.isFollowingLatest,
        setIsFollowingLatest: useCallback((value) => {
            setUiState(prev => ({ ...prev, isFollowingLatest: value }));
        }, []),
        isDataGenerationEnabled: uiState.isDataGenerationEnabled,
        setIsDataGenerationEnabled: useCallback((value) => {
            setUiState(prev => ({ ...prev, isDataGenerationEnabled: value }));
        }, []),
        isWaitingForData: asyncState.isWaitingForData,
        setIsWaitingForData: useCallback((value) => {
            setAsyncState(prev => ({ ...prev, isWaitingForData: value }));
        }, []),

        // Metadata
        timeframeInMs: chartData.metadata.timeframe,
        setTimeframeInMs: useCallback((value) => {
            setChartData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, timeframe: value }
            }));
        }, []),

        // Indicators
        indicators,
        addIndicator,
        removeIndicator,
        updateIndicator,

        // Core actions
        initializeOnSelection: initializeChart,
        mergeBaseCandles: handleIncomingCandles,

        // Helper functions
        computeRequiredIndicatorRange,
        updateSubscriptionDateRange,

        // Status checks
        isBaseBufferReadyForTimeframe: useCallback(() => chartData.candles.length > 0, [chartData.candles]),
        isFutureRequestInFlight: useCallback(() => asyncState.loadingFuture, [asyncState.loadingFuture]),
        isPastRequestInFlight: useCallback(() => asyncState.loadingPast, [asyncState.loadingPast]),

        // Constants
        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES,
        BUFFER_SIZE_MULTIPLIER,
        BUFFER_THRESHOLD_MULTIPLIER
    };

    // Expose globally for debugging
    if (typeof window !== 'undefined') {
        window.__chartContextValue = contextValue;
    }

    return (
        <ChartContext.Provider value={contextValue}>
            {children}
        </ChartContext.Provider>
    );
}