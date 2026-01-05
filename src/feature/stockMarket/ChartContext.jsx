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
        sequenceBounds: {
            minLoadedSequence: null,    // Lowest sequence in buffer
            maxLoadedSequence: null,    // Highest sequence in buffer
            latestKnownSequence: null,  // Latest from WebSocket
            oldestAvailableSequence: 1  // Server's oldest
        },
        metadata: {
            timeframe: null,
            timeframeMs: 24 * 60 * 60 * 1000,
            symbol: null,
            platform: null
        }
    });

    const [indicators, setIndicators] = useState([]);

    const [asyncState, setAsyncState] = useState({
        loadingPast: false,
        loadingFuture: false,
        isInitializing: true,
        isWaitingForData: true
    });

    const [uiState, setUiState] = useState({
        isDragging: false,
        hoveredIndex: null,
        currentMouseY: null,
        activeTimestamp: null,
        isLogarithmic: false,
        isFollowingLatest: true,
        isDataGenerationEnabled: false
    });

    // ==================== CONSTANTS ====================

    const MIN_DISPLAY_CANDLES = 20;
    const MAX_DISPLAY_CANDLES = 200;
    const BUFFER_SIZE = 100;        // Candles to keep on each side of view
    const FETCH_THRESHOLD = 50;     // Fetch when buffer drops below this
    const FETCH_BATCH_SIZE = 100;   // How many candles to fetch at once

    // ==================== REFS ====================

    const prevIndicatorIdsRef = useRef(new Set());
    const debounceTimerRef = useRef(null);

    // ==================== HELPER FUNCTIONS ====================

    const dedupeAndSortBySequence = useCallback((candles) => {
        const bySeq = new Map();
        for (const c of candles || []) {
            if (!c || typeof c.sequence !== 'number') continue;
            bySeq.set(c.sequence, c);
        }
        return Array.from(bySeq.values()).sort((a, b) => a.sequence - b.sequence);
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

    const initializeChart = useCallback((newCandles = [], metadata = {}, options = {}) => {
        const {
            latestKnownSequence = null,
            anchorToSequence = null
        } = options;

        console.log('[ChartContext] initializeChart', {
            candleCount: newCandles?.length || 0,
            metadata,
            latestKnownSequence,
            anchorToSequence
        });

        const cleaned = dedupeAndSortBySequence(newCandles);
        const withIndicators = applyIndicatorsToCandles(cleaned, indicators);

        // Calculate sequence bounds
        let minSeq = null, maxSeq = null;
        if (withIndicators.length > 0) {
            minSeq = withIndicators[0].sequence;
            maxSeq = withIndicators[withIndicators.length - 1].sequence;
        }

        // Determine view start index
        let startIndex;
        const displayCount = 100;

        if (anchorToSequence !== null && withIndicators.length > 0) {
            const anchorIdx = withIndicators.findIndex(c => c.sequence >= anchorToSequence);
            if (anchorIdx >= 0) {
                startIndex = anchorIdx;
            } else {
                startIndex = Math.max(0, withIndicators.length - displayCount);
            }
        } else {
            startIndex = Math.max(0, withIndicators.length - displayCount);
        }

        setChartData(prev => ({
            candles: withIndicators,
            viewWindow: {
                startIndex,
                displayCount
            },
            sequenceBounds: {
                minLoadedSequence: minSeq,
                maxLoadedSequence: maxSeq,
                latestKnownSequence: latestKnownSequence ?? maxSeq,
                oldestAvailableSequence: 1
            },
            metadata: {
                timeframe: metadata.timeframe || prev.metadata.timeframe,
                timeframeMs: metadata.timeframeMs || prev.metadata.timeframeMs,
                symbol: metadata.symbol || prev.metadata.symbol,
                platform: metadata.platform || prev.metadata.platform
            }
        }));

        setAsyncState(prev => ({
            ...prev,
            isInitializing: false,
            isWaitingForData: false
        }));
    }, [dedupeAndSortBySequence, applyIndicatorsToCandles, indicators]);

    /**
     * Merge incoming candles into the buffer
     */
    const mergeCandles = useCallback((newCandles = [], options = {}) => {
        const {
            direction = 'unknown', // 'past', 'future', 'update'
            updateLatestSequence = null
        } = options;

        console.log('[ChartContext] mergeCandles', {
            count: newCandles?.length || 0,
            direction,
            updateLatestSequence
        });

        if (!newCandles || newCandles.length === 0) {
            setAsyncState(prev => ({
                ...prev,
                loadingPast: direction === 'past' ? false : prev.loadingPast,
                loadingFuture: direction === 'future' ? false : prev.loadingFuture
            }));
            return;
        }

        setChartData(prev => {
            const prevCandles = prev.candles;

            const bySequence = new Map();

            for (const c of prevCandles) {
                if (c && typeof c.sequence === 'number') {
                    bySequence.set(c.sequence, c);
                }
            }

            // Merge new candles
            for (const n of newCandles) {
                if (!n || typeof n.sequence !== 'number') continue;

                const existing = bySequence.get(n.sequence);
                if (!existing) {
                    bySequence.set(n.sequence, { ...n, indicatorValues: {} });
                } else {
                    bySequence.set(n.sequence, {
                        ...existing,
                        ...n,
                        indicatorValues: existing.indicatorValues || {}
                    });
                }
            }

            let merged = Array.from(bySequence.values()).sort((a, b) => a.sequence - b.sequence);

            // Apply indicators
            merged = applyIndicatorsToCandles(merged, indicators);

            // Calculate how many candles were prepended, for view adjustment
            const prevMinSeq = prev.sequenceBounds.minLoadedSequence;
            const newMinSeq = merged.length > 0 ? merged[0].sequence : prevMinSeq;
            const prependedCount = prevMinSeq !== null && newMinSeq !== null
                ? Math.max(0, prevMinSeq - newMinSeq)
                : 0;

            // Adjust view start index
            let newViewStart = prev.viewWindow.startIndex;

            if (direction === 'past' && prependedCount > 0) {
                newViewStart = prev.viewWindow.startIndex + prependedCount;
            } else if (direction === 'future' || direction === 'update') {
                if (uiState.isFollowingLatest) {
                    newViewStart = Math.max(0, merged.length - prev.viewWindow.displayCount);
                }
            }

            newViewStart = Math.max(0, Math.min(newViewStart, merged.length - prev.viewWindow.displayCount));

            // Calculate new sequence bounds
            const newBounds = {
                minLoadedSequence: merged.length > 0 ? merged[0].sequence : null,
                maxLoadedSequence: merged.length > 0 ? merged[merged.length - 1].sequence : null,
                latestKnownSequence: updateLatestSequence ?? prev.sequenceBounds.latestKnownSequence,
                oldestAvailableSequence: prev.sequenceBounds.oldestAvailableSequence
            };

            // ==================== BUFFER TRIMMING ====================

            const targetBufferSize = prev.viewWindow.displayCount + (BUFFER_SIZE * 2);

            if (merged.length > targetBufferSize * 1.5) {
                const maxLookback = calculateMaxLookback(indicators);
                const viewStart = newViewStart;
                const viewEnd = viewStart + prev.viewWindow.displayCount;

                // Calculate trim boundaries, with indicators
                const leftKeep = Math.max(0, viewStart - BUFFER_SIZE - maxLookback);
                const rightKeep = Math.min(merged.length, viewEnd + BUFFER_SIZE);

                if (rightKeep - leftKeep < merged.length) {
                    console.log('[ChartContext] Trimming buffer:', {
                        before: merged.length,
                        after: rightKeep - leftKeep,
                        trimLeft: leftKeep,
                        trimRight: merged.length - rightKeep,
                        maxLookback,
                        targetBufferSize
                    });

                    merged = merged.slice(leftKeep, rightKeep);
                    newViewStart = viewStart - leftKeep;

                    // Update bounds after trimming
                    newBounds.minLoadedSequence = merged[0]?.sequence ?? null;
                    newBounds.maxLoadedSequence = merged[merged.length - 1]?.sequence ?? null;
                }
            }

            return {
                ...prev,
                candles: merged,
                viewWindow: {
                    ...prev.viewWindow,
                    startIndex: newViewStart
                },
                sequenceBounds: newBounds
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
     * Update latest known sequence from WebSocket
     */
    const updateLatestKnownSequence = useCallback((sequence) => {
        setChartData(prev => ({
            ...prev,
            sequenceBounds: {
                ...prev.sequenceBounds,
                latestKnownSequence: sequence
            }
        }));
    }, []);

    /**
     * Handle live candle update from WebSocket
     */
    const handleLiveCandleUpdate = useCallback((candles, latestSequence) => {
        console.log('[ChartContext] handleLiveCandleUpdate:', {
            candleCount: candles?.length,
            latestSequence
        });

        if (!candles || candles.length === 0) return;

        mergeCandles(candles, {
            direction: 'update',
            updateLatestSequence: latestSequence
        });
    }, [mergeCandles]);

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
                    Math.max(0, prev.candles.length - prev.viewWindow.displayCount)
                ))
            }
        }));
    }, []);

    /**
     * Set loading state for buffer requests
     */
    const setBufferLoading = useCallback((direction, isLoading) => {
        setAsyncState(prev => ({
            ...prev,
            [direction === 'past' ? 'loadingPast' : 'loadingFuture']: isLoading
        }));
    }, []);

    // ==================== BUFFER CHECK ====================

    /**
     * Check if we need more data based on view position
     */
    const checkBufferNeeds = useCallback(() => {
        const { candles, viewWindow, sequenceBounds } = chartData;

        if (candles.length === 0) {
            return { needsPast: false, needsFuture: false };
        }

        const viewStart = viewWindow.startIndex;
        const viewEnd = Math.min(viewStart + viewWindow.displayCount - 1, candles.length - 1);

        // Calculate indicator lookback requirement
        const maxLookback = calculateMaxLookback(indicators);

        // Check past buffer
        const leftBuffer = viewStart;
        const minRequiredLeftBuffer = FETCH_THRESHOLD + maxLookback;

        const needsPast = leftBuffer < minRequiredLeftBuffer &&
            sequenceBounds.minLoadedSequence > sequenceBounds.oldestAvailableSequence &&
            !asyncState.loadingPast;

        // Check future buffer
        const rightBuffer = candles.length - 1 - viewEnd;
        const isAtEdge = sequenceBounds.maxLoadedSequence >= sequenceBounds.latestKnownSequence;
        const needsFuture = rightBuffer < FETCH_THRESHOLD &&
            !isAtEdge &&
            !asyncState.loadingFuture;

        return {
            needsPast,
            needsFuture,
            requestInfo: {
                minLoadedSequence: sequenceBounds.minLoadedSequence,
                maxLoadedSequence: sequenceBounds.maxLoadedSequence,
                latestKnownSequence: sequenceBounds.latestKnownSequence,
                leftBuffer,
                rightBuffer,
                maxLookback,
                minRequiredLeftBuffer
            }
        };
    }, [chartData, asyncState.loadingPast, asyncState.loadingFuture, indicators, calculateMaxLookback]);

    // ==================== EFFECTS ====================

    /**
     * Check buffer needs when view changes
     */
    useEffect(() => {
        if (uiState.isDragging) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            return;
        }

        if (chartData.candles.length === 0) return;
        if (asyncState.isInitializing) return;

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            const { needsPast, needsFuture, requestInfo } = checkBufferNeeds();

            if (needsPast || needsFuture) {
                console.log('[ChartContext] Buffer needs detected:', {
                    needsPast,
                    needsFuture,
                    ...requestInfo
                });

                // Emit event for useCandleSubscription
                const evt = new CustomEvent('chartBufferNeeded', {
                    detail: {
                        direction: needsPast ? 'past' : 'future',
                        ...requestInfo
                    }
                });
                window.dispatchEvent(evt);
            }
        }, 150);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [
        chartData.viewWindow.startIndex,
        chartData.candles.length,
        uiState.isDragging,
        asyncState.isInitializing,
        checkBufferNeeds
    ]);

    /**
     * Handle indicator changes - recalculate on current data
     */
    useEffect(() => {
        if (indicators.length === 0) {
            prevIndicatorIdsRef.current = new Set();
            return;
        }

        const currentIds = new Set(indicators.map(ind => ind.id));
        const prevIds = prevIndicatorIdsRef.current;

        const idsChanged =
            currentIds.size !== prevIds.size ||
            [...currentIds].some(id => !prevIds.has(id));

        if (!idsChanged) return;

        prevIndicatorIdsRef.current = currentIds;

        // Recalculate indicators
        setChartData(prev => {
            const withIndicators = applyIndicatorsToCandles(prev.candles, indicators);
            return { ...prev, candles: withIndicators };
        });

        // Check if we need more data for indicator lookback
        const maxLookback = calculateMaxLookback(indicators);
        const { candles, viewWindow, sequenceBounds } = chartData;

        if (candles.length > 0 && maxLookback > 0) {
            const candlesBefore = viewWindow.startIndex;

            if (candlesBefore < maxLookback) {
                console.log('[ChartContext] Need more data for indicator lookback:', {
                    need: maxLookback,
                    have: candlesBefore
                });

                const evt = new CustomEvent('indicatorDataNeeded', {
                    detail: {
                        minLoadedSequence: sequenceBounds.minLoadedSequence,
                        lookbackNeeded: maxLookback - candlesBefore
                    }
                });
                window.dispatchEvent(evt);
            }
        }
    }, [indicators, applyIndicatorsToCandles, calculateMaxLookback, chartData]);

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

    const isAtLatestEdge = useMemo(() => {
        const { sequenceBounds, candles, viewWindow } = chartData;
        if (!sequenceBounds.latestKnownSequence || candles.length === 0) return true;

        const viewEndIndex = Math.min(viewWindow.startIndex + viewWindow.displayCount - 1, candles.length - 1);
        const viewEndCandle = candles[viewEndIndex];

        return viewEndCandle && viewEndCandle.sequence >= sequenceBounds.latestKnownSequence;
    }, [chartData]);

    // ======================= API =======================

    const addIndicator = useCallback((indicator) => {
        const newIndicator = {
            ...indicator,
            id: crypto.randomUUID?.() || `id-${Date.now()}`
        };
        setIndicators(prev => [...prev, newIndicator]);
    }, []);

    const removeIndicator = useCallback((id) => {
        setIndicators(prev => prev.filter(ind => ind.id !== id));
    }, []);

    const updateIndicator = useCallback((id, updates) => {
        setIndicators(prev =>
            prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind)
        );
    }, []);

    const contextValue = {
        displayCandles: chartData.candles,
        candleData: visibleCandles,

        sequenceBounds: chartData.sequenceBounds,

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
        isInitializing: asyncState.isInitializing,
        loadingPast: asyncState.loadingPast,
        loadingFuture: asyncState.loadingFuture,

        timeframeInMs: chartData.metadata.timeframeMs,
        setTimeframeInMs: useCallback((value) => {
            setChartData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, timeframeMs: value }
            }));
        }, []),

        indicators,
        addIndicator,
        removeIndicator,
        updateIndicator,

        initializeChart,
        mergeCandles,
        handleLiveCandleUpdate,
        updateLatestKnownSequence,
        setBufferLoading,
        checkBufferNeeds,

        isAtLatestEdge,

        calculateMaxLookback,

        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES,
        BUFFER_SIZE,
        FETCH_THRESHOLD,
        FETCH_BATCH_SIZE
    };

    if (typeof window !== 'undefined') {
        window.__chartContextValue = contextValue;
    }

    return (
        <ChartContext.Provider value={contextValue}>
            {children}
        </ChartContext.Provider>
    );
}