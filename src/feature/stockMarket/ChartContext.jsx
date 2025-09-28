// src/components/stockMarket/ChartContext.jsx
import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { calculateIndicator } from "./indicators/indicatorCalculations.js";

export const ChartContext = createContext(null);

export function ChartProvider({ children }) {
    // Dual candle storage - one for display, one for indicator calculations
    const [displayCandles, setDisplayCandles] = useState([]); // For rendering charts
    const [indicatorCandles, setIndicatorCandles] = useState([]); // For calculating indicators
    const [candleData, setCandleData] = useState([]); // Currently visible candles

    // Add isDataGenerationEnabled state for CandleChart component
    const [isDataGenerationEnabled, setIsDataGenerationEnabled] = useState(false);

    // View state
    const [viewStartIndex, setViewStartIndex] = useState(0);
    const [displayedCandles, setDisplayedCandles] = useState(100);
    const [isDragging, setIsDragging] = useState(false);

    // Cursor/hover state
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hoveredCandle, setHoveredCandle] = useState(null);
    const [currentMouseY, setCurrentMouseY] = useState(null);
    const [activeTimestamp, setActiveTimestamp] = useState(null);

    // Configuration
    const [isLogarithmic, setIsLogarithmic] = useState(false);
    // Default timeframe set to 1 day to avoid UI remounts forcing 1D later
    const [timeframeInMs, setTimeframeInMs] = useState(24 * 60 * 60 * 1000);
    const [isFollowingLatest, setIsFollowingLatest] = useState(false);

    // WebSocket state
    const [isWaitingForData, setIsWaitingForData] = useState(true);

    // Indicator state - now centralized here
    const [indicators, setIndicators] = useState([]);

    // New state for controlling subscription updates
    const [shouldUpdateSubscription, setShouldUpdateSubscription] = useState(false);
    const lastRequestedRangeRef = useRef(null);
    const isProcessingIndicatorUpdateRef = useRef(false);

    // Constants
    const MIN_DISPLAY_CANDLES = 20;
    const MAX_DISPLAY_CANDLES = 200;
    const MAX_HISTORY_CANDLES = 500;
    // Retention margins (in candles) for trimming buffers around the current view
    const PAST_MARGIN = 80;
    const FUTURE_MARGIN = 80;

    // Constants for buffer management
    const BUFFER_SIZE_MULTIPLIER = 20; // How many timeframes to buffer on each side
    const BUFFER_THRESHOLD_MULTIPLIER = 10; // When to request more data (timeframes left)

    // Refs to track first and last candle timestamps
    const firstCandleTimestampRef = useRef(null);
    const lastCandleTimestampRef = useRef(null);
    const lastUpdateReasonRef = useRef("initial");

    // Refs for buffer management
    const subscriptionStartDateRef = useRef(null);
    const subscriptionEndDateRef = useRef(null);
    // Track if we've reached the earliest available candle – avoid endless past requests
    const isStartReachedRef = useRef(false);
    const isRequestingPastDataRef = useRef(false);
    const isRequestingFutureDataRef = useRef(false);

    // Enhanced setter function with reason tracking
    const updateDisplayCandles = useCallback((newCandles, reason = "unknown") => {
        lastUpdateReasonRef.current = reason;
        setDisplayCandles(newCandles);
    }, []);

    // ---------- Core utilities and helpers (dedupe/sort, anchor) ----------
    const dedupeAndSort = useCallback((candles) => {
        const byTs = new Map();
        for (const c of candles || []) {
            if (!c || typeof c.timestamp !== 'number') continue;
            byTs.set(c.timestamp, c);
        }
        return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, []);

    const getVisibleWindow = useCallback(() => {
        const start = viewStartIndex;
        const end = Math.min(viewStartIndex + displayedCandles, displayCandles.length);
        return { start, end };
    }, [viewStartIndex, displayedCandles, displayCandles.length]);

    const getAnchor = useCallback(() => {
        const { start } = getVisibleWindow();
        const ts = displayCandles[start]?.timestamp;
        return ts ? { timestamp: ts, offset: 0 } : null;
    }, [displayCandles, getVisibleWindow]);

    const reanchorTo = useCallback((anchor) => {
        if (!anchor || typeof anchor.timestamp !== 'number') return false;
        const idx = displayCandles.findIndex(c => c.timestamp === anchor.timestamp);
        if (idx < 0) return false;
        const desiredStart = Math.max(0, idx - (anchor.offset || 0));
        const maxStart = Math.max(0, displayCandles.length - displayedCandles);
        setViewStartIndex(Math.max(0, Math.min(desiredStart, maxStart)));
        return true;
    }, [displayCandles, displayedCandles]);

    // Keep the visible slice in sync with buffer + view indices
    useEffect(() => {
        const { start, end } = getVisibleWindow();
        setCandleData(displayCandles.slice(start, end));
    }, [displayCandles, getVisibleWindow]);

    // ---------- Public operations expected by the subscription layer ----------
    // Initialize on selection/timeframe change with an initial batch (expects ~100)
    const initializeOnSelection = useCallback((initialCandles = []) => {
        const cleaned = dedupeAndSort(initialCandles);
        console.log('[Chart Merge] Initialize selection:', {
            incomingCount: initialCandles?.length || 0,
            cleanedCount: cleaned.length,
            firstIncoming: initialCandles?.length ? new Date(Math.min(...initialCandles.map(c=>c.timestamp))).toISOString() : 'none',
            lastIncoming: initialCandles?.length ? new Date(Math.max(...initialCandles.map(c=>c.timestamp))).toISOString() : 'none',
            cleanedFirst: cleaned.length ? new Date(cleaned[0].timestamp).toISOString() : 'none',
            cleanedLast: cleaned.length ? new Date(cleaned[cleaned.length-1].timestamp).toISOString() : 'none'
        });
        updateDisplayCandles(cleaned, 'initialize_selection');

        // Reset known subscription date range to the initialized buffer
        try {
            const firstTs = cleaned[0]?.timestamp;
            const lastTs = cleaned[cleaned.length - 1]?.timestamp;
            if (Number.isFinite(firstTs) && Number.isFinite(lastTs)) {
                subscriptionStartDateRef.current = firstTs;
                subscriptionEndDateRef.current = lastTs;
                console.log('[Buffer Management] Reset subscription date range on initialize:', {
                    start: new Date(firstTs).toISOString(),
                    end: new Date(lastTs).toISOString()
                });
            }
        } catch (_) {}

        const initialDisplayed = 100;
        setDisplayedCandles(initialDisplayed);
        // Show the latest candles on initial load: right-align the window
        const startIndex = Math.max(0, cleaned.length - initialDisplayed);
        setViewStartIndex(startIndex);
        console.log('[Chart Merge] Initialize window:', {
            startIndex,
            displayed: initialDisplayed,
            bufferLength: cleaned.length
        });
    }, [dedupeAndSort, updateDisplayCandles]);

    // Calculate max lookback needed for all indicators
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
                case "sma": {
                    const p = toPeriod(s.period ?? 14, 14);
                    lookback = p - 1;
                    break;
                }
                case "ema": {
                    const p = toPeriod(s.period ?? 14, 14);
                    lookback = p - 1;
                    break;
                }
                case "rsi": {
                    const p = toPeriod(s.period ?? 14, 14);
                    lookback = p; // first RSI at index p
                    break;
                }
                case "macd": {
                    const fast = toPeriod(s.fastPeriod ?? 12, 12);
                    const slow = toPeriod(s.slowPeriod ?? 26, 26);
                    const signal = toPeriod(s.signalPeriod ?? 9, 9);
                    // Full MACD (signal + histogram) ready:
                    lookback = (Math.max(fast, slow) - 1) + (signal - 1);
                    // If you only need the MACD line, use:
                    // lookback = Math.max(fast, slow) - 1;
                    break;
                }
                case "bb": {
                    const p = toPeriod(s.period ?? 20, 20);
                    lookback = p - 1;
                    break;
                }
                case "atr": {
                    const p = toPeriod(s.period ?? 14, 14);
                    // With current TR implementation, first ATR is at index p - 1
                    lookback = p - 1;
                    break;
                }
                default:
                    lookback = 50; // Safe fallback
            }

            if (lookback > maxLookback) maxLookback = lookback;
        }

        return maxLookback;
    }, []);

    // Merge base candles (handles past/future/overlap, dedupe, re-anchoring, and trim)
    const mergeBaseCandles = useCallback((newCandles = [], opts = {}) => {
        const { source = 'unknown' } = opts;
        const prev = displayCandles;
        const prevFirst = prev[0]?.timestamp;
        const prevLast = prev[prev.length - 1]?.timestamp;
        const prevLen = prev.length;

        const merged = dedupeAndSort([...(prev || []), ...(newCandles || [])]);
        const duplicates = Math.max(0, (prevLen + (newCandles?.length || 0)) - merged.length);

        // Determine direction by comparing new range to previous
        let direction = 'overlap';
        if (newCandles.length) {
            const nFirst = Math.min(...newCandles.map(c => c.timestamp));
            const nLast = Math.max(...newCandles.map(c => c.timestamp));
            const eps = Math.floor((timeframeInMs || 60000) / 2);
            if (prevLen === 0) direction = 'initial';
            else if (Number.isFinite(prevFirst) && nLast <= (prevFirst + eps)) direction = 'past';
            else if (Number.isFinite(prevLast) && nFirst >= (prevLast - eps)) direction = 'future';
            else direction = 'overlap';
        }

        // How many were prepended/appended relative to previous buffer
        let prepended = 0;
        let appended = 0;
        if (Number.isFinite(prevFirst)) {
            const threshold = prevFirst - Math.floor((timeframeInMs || 60000) / 2);
            for (let i = 0; i < merged.length; i++) {
                if (merged[i].timestamp < threshold) prepended++; else break;
            }
        }
        if (Number.isFinite(prevLast)) {
            const threshold = prevLast + Math.floor((timeframeInMs || 60000) / 2);
            for (let i = merged.length - 1; i >= 0; i--) {
                if (merged[i].timestamp > threshold) appended++; else break;
            }
        }

        const prevView = viewStartIndex;
        console.log('[Chart Merge] Before merge:', {
            source,
            direction,
            prevLen,
            incoming: newCandles?.length || 0,
            mergedLen: merged.length,
            duplicates,
            prepended,
            appended,
            prevFirst: prevLen ? new Date(prevFirst).toISOString() : 'none',
            prevLast: prevLen ? new Date(prevLast).toISOString() : 'none',
            mergedFirst: merged.length ? new Date(merged[0].timestamp).toISOString() : 'none',
            mergedLast: merged.length ? new Date(merged[merged.length-1].timestamp).toISOString() : 'none',
            viewStartIndex: prevView,
            displayedCandles
        });

        // Predict viewStartIndex that will be applied by the anchor logic above
        let predictedViewStart = viewStartIndex;
        if (prevLen === 0 || direction === 'initial') {
            predictedViewStart = 0;
        } else if (direction === 'past' && prepended > 0) {
            predictedViewStart = Math.min(viewStartIndex + prepended, Math.max(0, merged.length - displayedCandles));
        } else if (direction === 'future') {
            if (isFollowingLatest) {
                predictedViewStart = Math.max(0, merged.length - displayedCandles);
            } else {
                predictedViewStart = Math.min(viewStartIndex, Math.max(0, merged.length - displayedCandles));
            }
        } else {
            // Overlap: reanchor by previous left-edge candle using the merged buffer
            const anchorTs = prev[viewStartIndex]?.timestamp;
            if (anchorTs) {
                const idx = merged.findIndex(c => c.timestamp === anchorTs);
                if (idx >= 0) {
                    const maxStart = Math.max(0, merged.length - displayedCandles);
                    predictedViewStart = Math.max(0, Math.min(idx, maxStart));
                }
            }
        }

        // Local helper to trim immediately after merge, around predicted view
        const trimAfterMerge = (buffer, baseViewStart, fetchedDir) => {
            if (!Array.isArray(buffer) || buffer.length === 0) {
                updateDisplayCandles(buffer, `merge_base_${source}_${direction}`);
                setViewStartIndex(baseViewStart);
                return { finalBuffer: buffer, finalViewStart: baseViewStart };
            }

            const total = buffer.length;
            const MIN_TOTAL = 400; // guard to avoid aggressive trimming on small windows
            const FACTOR = 3; // keep ~3x the visible window in memory
            const targetTotal = Math.max(displayedCandles * FACTOR, MIN_TOTAL);
            const extra = Math.max(0, targetTotal - displayedCandles);

            // Base symmetric margins
            let leftMargin = Math.max(PAST_MARGIN, Math.floor(extra / 2));
            let rightMargin = Math.max(FUTURE_MARGIN, extra - Math.floor(extra / 2));

            // Bias margins away from the fetched side
            if (fetchedDir === 'past') {
                leftMargin = Math.floor(leftMargin * 1.25);
                rightMargin = Math.max(FUTURE_MARGIN, Math.floor(rightMargin * 0.75));
            } else if (fetchedDir === 'future') {
                leftMargin = Math.max(PAST_MARGIN, Math.floor(leftMargin * 0.75));
                rightMargin = Math.floor(rightMargin * 1.25);
            }

            if (total <= displayedCandles + leftMargin + rightMargin) {
                updateDisplayCandles(buffer, `merge_base_${source}_${direction}`);
                setViewStartIndex(baseViewStart);
                return { finalBuffer: buffer, finalViewStart: baseViewStart };
            }

            const boundedBase = Math.max(0, Math.min(baseViewStart, Math.max(0, total - displayedCandles)));
            const startIdx = Math.max(0, boundedBase - leftMargin);
            const endIdx = Math.min(total, boundedBase + displayedCandles + rightMargin);

            if (startIdx <= 0 && endIdx >= total) {
                updateDisplayCandles(buffer, `merge_base_${source}_${direction}`);
                setViewStartIndex(boundedBase);
                return { finalBuffer: buffer, finalViewStart: boundedBase };
            }

            const trimmed = buffer.slice(startIdx, endIdx);
            const newView = Math.max(0, boundedBase - startIdx);

            console.log('[Chart Trim] Trimming buffers after merge:', {
                bufferBefore: total,
                startIdx,
                endIdx,
                removedLeft: startIdx,
                removedRight: total - endIdx,
                newLength: trimmed.length,
                oldViewStart: boundedBase,
                newViewStart: newView
            });

            updateDisplayCandles(trimmed, `trim_after_merge_${source}_${direction}`);
            setViewStartIndex(newView);

            // Update subscription known date range to match trimmed buffer
            const newStartTs = trimmed[0]?.timestamp;
            const newEndTs = trimmed[trimmed.length - 1]?.timestamp;
            if (newStartTs && newEndTs) {
                subscriptionStartDateRef.current = newStartTs;
                subscriptionEndDateRef.current = newEndTs;
            }

            // Indicators: ensure sufficient lookback retained using timestamps
            if (indicatorCandles.length) {
                const maxLookback = calculateMaxLookback(indicators);
                const requiredStartTs = Math.max(0, (trimmed[0]?.timestamp || newStartTs || 0) - (maxLookback * timeframeInMs));
                const requiredEndTs = trimmed[trimmed.length - 1]?.timestamp || newEndTs;
                const trimmedIndicators = indicatorCandles.filter(c =>
                    c && typeof c.timestamp === 'number' && c.timestamp >= requiredStartTs && c.timestamp <= requiredEndTs
                );
                setIndicatorCandles(trimmedIndicators);
            }

            return { finalBuffer: trimmed, finalViewStart: newView };
        };

        const { finalBuffer, finalViewStart } = trimAfterMerge(merged, predictedViewStart, direction);

        setTimeout(() => {
            console.log('[Chart Merge] After merge:', {
                direction,
                newViewStartIndex: finalViewStart,
                mergedLen: finalBuffer.length
            });
        }, 0);

        // Defer trimming in the effect remains as a secondary safety net
    }, [displayCandles, displayedCandles, timeframeInMs, updateDisplayCandles, viewStartIndex, reanchorTo, indicatorCandles, indicators, calculateMaxLookback]);

    // Merge indicator calculation candles with optional reset
    const mergeIndicatorCandles = useCallback((newCandles = [], opts = {}) => {
        const { reset = false } = opts;
        if (reset) {
            setIndicatorCandles(dedupeAndSort(newCandles));
            return;
        }
        setIndicatorCandles(prev => dedupeAndSort([...(prev || []), ...(newCandles || [])]));
    }, [dedupeAndSort]);

    

    // Helper function to calculate indicators for a buffer
    const calculateIndicatorsForBuffer = useCallback((buffer, currentIndicators) => {
        if (!buffer.length || !currentIndicators.length) return buffer;

        console.log("[ChartContext] Calculating indicators for buffer with length:", buffer.length);

        return buffer.map((candle, candleIndex) => {
            const updatedCandle = {
                ...candle,
                indicatorValues: candle.indicatorValues || {}
            };

            currentIndicators.forEach(indicator => {
                try {
                    const fullValues = calculateIndicator(indicator, buffer);
                    if (fullValues && candleIndex < fullValues.length) {
                        updatedCandle.indicatorValues[indicator.id] = fullValues[candleIndex];
                    }
                } catch (err) {
                    console.error(`Error calculating ${indicator.name} for candle at index ${candleIndex}:`, err);
                }
            });

            return updatedCandle;
        });
    }, []);

    // Compute the indicator data range required to cover the current visible base window
    const computeRequiredIndicatorRange = useCallback(() => {
        if (!displayCandles.length) return { start: null, end: null, lookback: 0 };

        const maxLookback = calculateMaxLookback(indicators);

        // Use the ENTIRE buffer range instead of just viewed portion
        const firstBufferCandle = displayCandles[0];  // First in entire buffer
        const lastBufferCandle = displayCandles[displayCandles.length - 1];  // Last in entire buffer

        if (!firstBufferCandle?.timestamp || !lastBufferCandle?.timestamp) {
            return { start: null, end: null, lookback: maxLookback };
        }

        // Start: First buffer candle timestamp - lookback period
        const start = firstBufferCandle.timestamp - (maxLookback * timeframeInMs);

        // End: Last buffer candle timestamp (NOT last visible)
        const end = lastBufferCandle.timestamp;

        console.log('[ChartContext] Full buffer indicator range:', {
            bufferStart: new Date(firstBufferCandle.timestamp).toISOString(),
            bufferEnd: new Date(lastBufferCandle.timestamp).toISOString(),
            requiredStart: new Date(start).toISOString(),
            requiredEnd: new Date(end).toISOString(),
            candleCount: displayCandles.length,
            maxLookback
        });

        return { start, end, lookback: maxLookback };
    }, [displayCandles, indicators, calculateMaxLookback, timeframeInMs]);


    // Indicator range based on full base buffer, not just the visible window
    const computeIndicatorRangeForBaseBuffer = useCallback(() => {
        if (!displayCandles.length) return { start: null, end: null, lookback: 0 };
        const maxLookback = calculateMaxLookback(indicators);
        const startBuffer = displayCandles[0]?.timestamp;
        const endBuffer = displayCandles[displayCandles.length - 1]?.timestamp;
        if (!startBuffer || !endBuffer) return { start: null, end: null, lookback: maxLookback };
        const start = startBuffer - (maxLookback * timeframeInMs);
        const end = endBuffer;
        return { start, end, lookback: maxLookback };
    }, [displayCandles, indicators, calculateMaxLookback, timeframeInMs]);

    // Function to apply calculated indicator values to display candles
    const applyIndicatorsToCandleDisplay = useCallback(() => {
        if (!displayCandles.length || !indicatorCandles.length || !indicators.length) {
            console.log("[ChartContext] Cannot apply indicators - missing data or no indicators", {
                displayCandlesLength: displayCandles.length,
                indicatorCandlesLength: indicatorCandles.length,
                indicatorsCount: indicators.length
            });
            return;
        }

        // Verify indicator candles have the needed history
        if (indicatorCandles.length > 0 && displayCandles.length > 0) {
            const firstDisplayTimestamp = displayCandles[0].timestamp;
            const firstIndicatorTimestamp = indicatorCandles[0].timestamp;

            // Check if we have sufficient lookback for calculation
            const maxLookback = calculateMaxLookback(indicators);
            const firstRequiredTimestamp = firstDisplayTimestamp - (maxLookback * timeframeInMs);

            if (firstIndicatorTimestamp > firstRequiredTimestamp) {
                console.warn(`[ChartContext] Insufficient indicator history! Need data from ${new Date(firstRequiredTimestamp).toISOString()} but have from ${new Date(firstIndicatorTimestamp).toISOString()}`);
                // Consider requesting more data or showing a warning
            }
        }

        // Log information about the current candle data (BEFORE processing)
        console.log("===== BEFORE INDICATOR PROCESSING =====");

        // Display candles timestamp info
        const firstDisplayCandle = displayCandles[0];
        const lastDisplayCandle = displayCandles[displayCandles.length - 1];

        console.log("[ChartContext] Display candles range (BEFORE):", {
            count: displayCandles.length,
            firstTimestamp: firstDisplayCandle ? new Date(firstDisplayCandle.timestamp).toISOString() : 'none',
            lastTimestamp: lastDisplayCandle ? new Date(lastDisplayCandle.timestamp).toISOString() : 'none'
        });

        // Indicator candles timestamp info
        const firstIndicatorCandle = indicatorCandles[0];
        const lastIndicatorCandle = indicatorCandles[indicatorCandles.length - 1];

        console.log("[ChartContext] Indicator candles range:", {
            count: indicatorCandles.length,
            firstTimestamp: firstIndicatorCandle ? new Date(firstIndicatorCandle.timestamp).toISOString() : 'none',
            lastTimestamp: lastIndicatorCandle ? new Date(lastIndicatorCandle.timestamp).toISOString() : 'none'
        });

        // Active indicators summary
        console.log("[ChartContext] Active indicators:", indicators.map(ind => ({
            id: ind.id.substring(0, 8) + '...',  // Truncate ID for readability
            name: ind.name,
            type: ind.type
        })));

        // First calculate indicators on the indicator candle buffer
        console.log("[ChartContext] Calculating indicators for candle buffer...");
        const processedIndicatorCandles = calculateIndicatorsForBuffer(indicatorCandles, indicators);

        // Create a map of timestamp to calculated indicator values
        console.log("[ChartContext] Creating timestamp mapping...");
        const indicatorValuesByTimestamp = {};
        let mappedTimestamps = 0;

        processedIndicatorCandles.forEach(candle => {
            if (candle.timestamp && candle.indicatorValues) {
                indicatorValuesByTimestamp[candle.timestamp] = candle.indicatorValues;
                mappedTimestamps++;
            }
        });

        console.log(`[ChartContext] Created timestamp map with ${mappedTimestamps} entries`);

        // Apply indicator values to display candles
        console.log("[ChartContext] Applying indicator values to display candles...");

        let matchedCandles = 0;
        const updatedDisplayCandles = displayCandles.map(candle => {
            const calculatedValues = indicatorValuesByTimestamp[candle.timestamp];
            if (calculatedValues) {
                matchedCandles++;
                return {
                    ...candle,
                    indicatorValues: calculatedValues
                };
            }
            return candle;
        });

        console.log(`[ChartContext] Matched ${matchedCandles} out of ${displayCandles.length} display candles with indicator values`);

        // Check for any display candles that didn't get indicator values
        if (matchedCandles < displayCandles.length) {
            console.warn(`[ChartContext] Warning: ${displayCandles.length - matchedCandles} display candles did not receive indicator values`);

            // Log a few sample missing timestamps
            const missingSampleSize = Math.min(5, displayCandles.length - matchedCandles);
            const missingSamples = displayCandles
                .filter(candle => !indicatorValuesByTimestamp[candle.timestamp])
                .slice(0, missingSampleSize)
                .map(candle => new Date(candle.timestamp).toISOString());

            console.warn(`[ChartContext] Sample missing timestamps: ${JSON.stringify(missingSamples)}`);
        }

        // Update the display candles with calculated indicators
        updateDisplayCandles(updatedDisplayCandles, "apply_indicators");

        // Log information AFTER processing
        console.log("===== AFTER INDICATOR PROCESSING =====");

        // Display candles timestamp info AFTER processing
        const firstUpdatedDisplayCandle = updatedDisplayCandles[0];
        const lastUpdatedDisplayCandle = updatedDisplayCandles[updatedDisplayCandles.length - 1];

        console.log("[ChartContext] Display candles range (AFTER):", {
            count: updatedDisplayCandles.length,
            firstTimestamp: firstUpdatedDisplayCandle ? new Date(firstUpdatedDisplayCandle.timestamp).toISOString() : 'none',
            lastTimestamp: lastUpdatedDisplayCandle ? new Date(lastUpdatedDisplayCandle.timestamp).toISOString() : 'none'
        });

        // Get the first and last candles with indicator values
        const firstCandleWithIndicator = updatedDisplayCandles.find(c =>
            c.indicatorValues && Object.keys(c.indicatorValues).length > 0);
        const lastCandleWithIndicator = [...updatedDisplayCandles].reverse().find(c =>
            c.indicatorValues && Object.keys(c.indicatorValues).length > 0);

        console.log("[ChartContext] Final display candles with indicators:", {
            total: updatedDisplayCandles.length,
            withIndicators: matchedCandles,
            firstIndicatorTimestamp: firstCandleWithIndicator
                ? new Date(firstCandleWithIndicator.timestamp).toISOString()
                : 'none',
            lastIndicatorTimestamp: lastCandleWithIndicator
                ? new Date(lastCandleWithIndicator.timestamp).toISOString()
                : 'none'
        });

        // Sample of indicator values for the first candle with indicators
        if (firstCandleWithIndicator) {
            const sampleIndicatorValues = {};
            Object.entries(firstCandleWithIndicator.indicatorValues).forEach(([id, value]) => {
                const indicator = indicators.find(ind => ind.id === id);
                sampleIndicatorValues[indicator ? indicator.name : id] =
                    typeof value === 'object' ? JSON.stringify(value) : value;
            });

            console.log("[ChartContext] Sample indicator values for first candle:", sampleIndicatorValues);
        }

        console.log("======================================");
    }, [indicatorCandles, indicators, calculateIndicatorsForBuffer, updateDisplayCandles, calculateMaxLookback, timeframeInMs]);

    // Modified effect to track timestamp changes and their causes
    useEffect(() => {
        const firstDisplayCandle = displayCandles[0];
        const lastDisplayCandle = displayCandles[displayCandles.length - 1];

        const firstTimestamp = firstDisplayCandle?.timestamp;
        const lastTimestamp = lastDisplayCandle?.timestamp;

        // Only run the effect if either timestamp has changed
        if (firstTimestamp !== firstCandleTimestampRef.current ||
            lastTimestamp !== lastCandleTimestampRef.current) {

            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log(`Timestamp change detected with reason: ${lastUpdateReasonRef.current}`);
            console.log(`First candle timestamp: ${firstTimestamp ? new Date(firstTimestamp).toISOString() : 'none'} (previous: ${firstCandleTimestampRef.current ? new Date(firstCandleTimestampRef.current).toISOString() : 'none'})`);
            console.log(`Last candle timestamp: ${lastTimestamp ? new Date(lastTimestamp).toISOString() : 'none'} (previous: ${lastCandleTimestampRef.current ? new Date(lastCandleTimestampRef.current).toISOString() : 'none'})`);
            console.log(`Total candles: ${displayCandles.length}`);

            // Update refs with current values
            firstCandleTimestampRef.current = firstTimestamp;
            lastCandleTimestampRef.current = lastTimestamp;
        }
    }, [displayCandles]);

    // Track subscription date range when new data is received
    const updateSubscriptionDateRange = useCallback((startDate, endDate) => {
        const prevStart = subscriptionStartDateRef.current;
        const prevEnd = subscriptionEndDateRef.current;

        if (prevStart != null && prevEnd != null) {
            // If the new window does not overlap the existing known window,
            // treat it as a reset (e.g., new symbol/timeframe), otherwise extend.
            const disjoint = endDate < prevStart || startDate > prevEnd;
            if (disjoint) {
                subscriptionStartDateRef.current = startDate;
                subscriptionEndDateRef.current = endDate;
            } else {
                subscriptionStartDateRef.current = Math.min(prevStart, startDate);
                subscriptionEndDateRef.current = Math.max(prevEnd, endDate);
            }
        } else {
            subscriptionStartDateRef.current = startDate;
            subscriptionEndDateRef.current = endDate;
        }
        console.log("[Buffer Management] Updated subscription date range:", {
            prevStart: prevStart ? new Date(prevStart).toISOString() : "none",
            prevEnd: prevEnd ? new Date(prevEnd).toISOString() : "none",
            start: new Date(subscriptionStartDateRef.current).toISOString(),
            end: new Date(subscriptionEndDateRef.current).toISOString()
        });
    }, []);

    // Function to check if we need to load more data due to scrolling
    const checkBufferThresholds = useCallback(() => {
        if (!displayCandles.length || !subscriptionStartDateRef.current || !subscriptionEndDateRef.current) {
            return { needsPastData: false, needsFutureData: false };
        }

        // Get the first and last displayed candles
        const visibleStartIndex = viewStartIndex;
        const visibleEndIndex = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
        
        if (visibleStartIndex < 0 || visibleEndIndex < 0 || visibleStartIndex >= displayCandles.length) {
            return { needsPastData: false, needsFutureData: false };
        }

        const firstVisibleCandle = displayCandles[visibleStartIndex];
        const lastVisibleCandle = displayCandles[visibleEndIndex];
        
        if (!firstVisibleCandle || !lastVisibleCandle) {
            return { needsPastData: false, needsFutureData: false };
        }

        // Calculate thresholds
        const thresholdTimeInMs = BUFFER_THRESHOLD_MULTIPLIER * timeframeInMs;
        
        // Check if we're close to the beginning of our data
        const timeFromStart = firstVisibleCandle.timestamp - subscriptionStartDateRef.current;
        const needsPastData = timeFromStart < thresholdTimeInMs;
        
        // Check if we're close to the end of our data
        const timeToEnd = subscriptionEndDateRef.current - lastVisibleCandle.timestamp;
        const needsFutureData = timeToEnd < thresholdTimeInMs;
        
        console.log("[Buffer Management] Buffer threshold check:", {
            visibleStartIndex,
            visibleEndIndex,
            firstVisibleCandleTime: new Date(firstVisibleCandle.timestamp).toISOString(),
            lastVisibleCandleTime: new Date(lastVisibleCandle.timestamp).toISOString(),
            timeFromStart: `${(timeFromStart / 1000 / 60).toFixed(2)} minutes`,
            timeToEnd: `${(timeToEnd / 1000 / 60).toFixed(2)} minutes`,
            thresholdTime: `${(thresholdTimeInMs / 1000 / 60).toFixed(2)} minutes`,
            subscriptionEndDateRef: subscriptionEndDateRef.current,
            subscriptionStartDateRef: subscriptionStartDateRef.current,
            subscriptionEndDateRefDate: new Date(subscriptionEndDateRef.current).toISOString(),
            subscriptionStartDateRefDate: new Date(subscriptionStartDateRef.current).toISOString(),
            needsPastData,
            needsFutureData
        });
        if (visibleStartIndex === 0 && displayCandles.length > displayedCandles) {
            console.warn("[Snap Debug] View is at earliest candle (left edge) while buffer has extra history");
        }
        
        return { needsPastData, needsFutureData };
    }, [displayCandles, viewStartIndex, displayedCandles, timeframeInMs]);

    useEffect(() => {
        console.log("timeframeInMs changed to:", timeframeInMs);
    }, [timeframeInMs]);

    // Function to calculate new date range when we need more data
    const calculateNewDateRangeForBuffer = useCallback((direction) => {
        if (!displayCandles.length || !subscriptionStartDateRef.current || !subscriptionEndDateRef.current) {
            return null;
        }

        // Get the first and last displayed candles
        const visibleStartIndex = viewStartIndex;
        const visibleEndIndex = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
        
        if (visibleStartIndex < 0 || visibleEndIndex < 0 || visibleStartIndex >= displayCandles.length) {
            return null;
        }

        const firstVisibleCandle = displayCandles[visibleStartIndex];
        const lastVisibleCandle = displayCandles[visibleEndIndex];
        
        if (!firstVisibleCandle || !lastVisibleCandle) {
            return null;
        }

        // Buffer size in milliseconds
        const bufferSizeInMs = BUFFER_SIZE_MULTIPLIER * timeframeInMs;
        
        let newStartDate, newEndDate;
        
        if (direction === 'past') {
            // We need more past data
            // End date is the timestamp of first visible candle plus buffer
            newEndDate = firstVisibleCandle.timestamp + bufferSizeInMs;
            // Start date is the threshold for requesting more data
            newStartDate = subscriptionStartDateRef.current - bufferSizeInMs;
        } else {
            // We need more future data
            // Start date is the timestamp of last visible candle minus buffer
            newStartDate = lastVisibleCandle.timestamp - bufferSizeInMs;
            // End date is the threshold for requesting more data
            newEndDate = subscriptionEndDateRef.current + bufferSizeInMs;
        }

        // Guard against invalid ranges caused by stale subscription refs
        if (newStartDate >= newEndDate) {
            console.warn(`[Buffer Management] Adjusting invalid ${direction} buffer range (start >= end)`, {
                start: new Date(newStartDate).toISOString(),
                end: new Date(newEndDate).toISOString(),
                firstVisible: new Date(firstVisibleCandle.timestamp).toISOString(),
                lastVisible: new Date(lastVisibleCandle.timestamp).toISOString()
            });
            if (direction === 'past') {
                newStartDate = firstVisibleCandle.timestamp - bufferSizeInMs;
                newEndDate = firstVisibleCandle.timestamp + bufferSizeInMs;
            } else {
                newStartDate = lastVisibleCandle.timestamp - bufferSizeInMs;
                newEndDate = lastVisibleCandle.timestamp + bufferSizeInMs;
            }
        }
        
        // Ensure past requests always step strictly earlier than the currently known earliest
        if (direction === 'past') {
            const earliestKnown = subscriptionStartDateRef.current;
            if (earliestKnown != null && newStartDate >= earliestKnown) {
                const forcedStart = earliestKnown - ((BUFFER_SIZE_MULTIPLIER + 1) * timeframeInMs);
                // Also ensure at least one candle earlier than the first visible to avoid overlap
                newStartDate = Math.min(forcedStart, firstVisibleCandle.timestamp - timeframeInMs);
            }
        }

        console.log(`[Buffer Management] Calculated new ${direction} date range:`, {
            start: new Date(newStartDate).toISOString(),
            end: new Date(newEndDate).toISOString(),
            earliestKnown: subscriptionStartDateRef.current ? new Date(subscriptionStartDateRef.current).toISOString() : 'none'
        });
        console.log("[Buffer Management] Visible window before request:", {
            visibleStartIndex,
            visibleEndIndex,
            firstVisible: new Date(firstVisibleCandle.timestamp).toISOString(),
            lastVisible: new Date(lastVisibleCandle.timestamp).toISOString(),
            bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
            bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none'
        });
        
        return {
            startDate: newStartDate,
            endDate: newEndDate,
            resetData: true
        };
    }, [displayCandles, viewStartIndex, displayedCandles, timeframeInMs]);

    // Function to find candle index by timestamp
    const findCandleIndexByTimestamp = useCallback((timestamp) => {
        // 1) Try exact match first
        const exactIdx = displayCandles.findIndex(candle => candle.timestamp === timestamp);
        if (exactIdx !== -1) {
            console.log("[Anchor] Exact match for reference timestamp:", {
                reference: new Date(timestamp).toISOString(),
                index: exactIdx
            });
            console.log("[Anchor] Returning exact index for reference timestamp", { index: exactIdx });
            return exactIdx;
        }

        // 2) No exact match — compute nearest candle in the merged buffer
        let nearest = { index: -1, diff: Number.POSITIVE_INFINITY, ts: null };
        for (let i = 0; i < displayCandles.length; i++) {
            const d = Math.abs(displayCandles[i].timestamp - timestamp);
            if (d < nearest.diff) nearest = { index: i, diff: d, ts: displayCandles[i].timestamp };
        }

        // 3) If nearest is within half a timeframe, use it to preserve view position
        const halfTf = (typeof timeframeInMs === 'number' && timeframeInMs > 0) ? timeframeInMs / 2 : null;
        const withinHalfTf = Number.isFinite(nearest.diff) && halfTf != null ? nearest.diff <= halfTf : false;

        if (withinHalfTf && nearest.index !== -1) {
            console.log("[Anchor] Using nearest match within half timeframe to preserve position:", {
                reference: new Date(timestamp).toISOString(),
                chosenIndex: nearest.index,
                chosenIso: nearest.ts ? new Date(nearest.ts).toISOString() : 'none',
                diffMs: nearest.diff,
                timeframeInMs
            });
            return nearest.index;
        }

        // 4) Diagnostics + fallback to -1 when outside tolerance
        try {
            const diffs = displayCandles.slice(0, 10).map((c, i) => ({ i, ts: c.timestamp, iso: new Date(c.timestamp).toISOString(), dt: Math.abs(c.timestamp - timestamp) }));
            const last10 = displayCandles.slice(-10).map((c, i) => ({ i: displayCandles.length - 10 + i, ts: c.timestamp, iso: new Date(c.timestamp).toISOString(), dt: Math.abs(c.timestamp - timestamp) }));
            console.warn("[Anchor] Reference not found by exact match and nearest outside tolerance. Diagnostics:", {
                reference: new Date(timestamp).toISOString(),
                bufferLength: displayCandles.length,
                first: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
                last: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
                nearestIndex: nearest.index,
                nearestIso: nearest.ts ? new Date(nearest.ts).toISOString() : 'none',
                nearestDiffMs: nearest.diff,
                timeframeInMs
            });
            console.log("[Anchor] First 10 diffs:", diffs);
            console.log("[Anchor] Last 10 diffs:", last10);
        } catch (e) {
            console.warn("[Anchor] Diagnostics failed:", e);
        }

        console.warn("[Anchor] Returning -1 (reference timestamp not found within tolerance)");
        return -1;
    }, [displayCandles, timeframeInMs]);

    // Function to recalculate view index after receiving new data
    const recalculateViewIndex = useCallback((referenceInput) => {
        // Normalize reference input
        const { timestamp: referenceTimestamp, offset: referenceOffset } =
            (referenceInput && typeof referenceInput === 'object')
                ? { timestamp: referenceInput.timestamp, offset: referenceInput.offset }
                : { timestamp: referenceInput, offset: undefined };

        // Buffer snapshot BEFORE search
        const beforeSnapshot = {
            bufferLength: displayCandles.length,
            bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
            bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
            currentViewStart: viewStartIndex,
            displayedCandles
        };
        try {
            const vStart = viewStartIndex;
            const vEnd = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
            beforeSnapshot.visibleStartIndex = vStart;
            beforeSnapshot.visibleEndIndex = vEnd;
            beforeSnapshot.firstVisible = (displayCandles[vStart] ? new Date(displayCandles[vStart].timestamp).toISOString() : 'none');
            beforeSnapshot.lastVisible = (displayCandles[vEnd] ? new Date(displayCandles[vEnd].timestamp).toISOString() : 'none');
        } catch (_) {}

        console.log('[Anchor] recalculateViewIndex invoked:', {
            reference: new Date(referenceTimestamp).toISOString(),
            referenceOffset,
            ...beforeSnapshot
        });

        // Find the index of the candle with (or nearest to) the reference timestamp
        const newIndex = findCandleIndexByTimestamp(referenceTimestamp);
        console.log('[Anchor] Search outcome:', {
            reference: new Date(referenceTimestamp).toISOString(),
            foundIndex: newIndex,
            usedNearest: newIndex !== -1 && displayCandles[newIndex] && displayCandles[newIndex].timestamp !== referenceTimestamp,
            foundIso: (newIndex !== -1 && displayCandles[newIndex]) ? new Date(displayCandles[newIndex].timestamp).toISOString() : 'none'
        });

        if (newIndex !== -1) {
            // Keep the reference candle at the same relative position if offset is provided
            const desiredStart = (typeof referenceOffset === 'number') ? (newIndex - referenceOffset) : newIndex;
            const targetIndex = Math.max(0, Math.min(desiredStart, displayCandles.length - displayedCandles));

            // Predict visible window AFTER restoration (state update is async)
            const predictedStart = targetIndex;
            const predictedEnd = Math.min(targetIndex + displayedCandles - 1, displayCandles.length - 1);
            const predictedFirst = displayCandles[predictedStart] ? new Date(displayCandles[predictedStart].timestamp).toISOString() : 'none';
            const predictedLast = displayCandles[predictedEnd] ? new Date(displayCandles[predictedEnd].timestamp).toISOString() : 'none';

            console.log('[Anchor] Restoration details:', {
                referenceTimestamp: new Date(referenceTimestamp).toISOString(),
                newIndex,
                desiredStart,
                targetIndex,
                predictedVisibleStartIndex: predictedStart,
                predictedVisibleEndIndex: predictedEnd,
                predictedFirstVisible: predictedFirst,
                predictedLastVisible: predictedLast,
                bufferLength: displayCandles.length
            });
            console.log('[Anchor] Setting viewStartIndex to targetIndex to preserve reference position');

            // Update view index to maintain view position
            setViewStartIndex(targetIndex);
            return true;
        }

        console.warn('[Buffer Management] Failed to find reference candle after data update');
        console.warn('[Anchor] Restoration failed; not changing viewStartIndex', {
            currentViewStart: viewStartIndex,
            displayedCandles,
            bufferLength: displayCandles.length
        });
        return false;
    }, [displayCandles, displayedCandles, findCandleIndexByTimestamp, viewStartIndex]);

    // Trim display and indicator buffers to keep memory bounded while retaining enough context
    const trimBuffersIfNeeded = useCallback(() => {
        if (!displayCandles.length) return;

        // Avoid trimming while a buffer request is in-flight
        if (isRequestingPastDataRef.current || isRequestingFutureDataRef.current) return;

        const total = displayCandles.length;

        // Dynamic target total around current view with guard
        const MIN_TOTAL = 400; // guard to avoid aggressive trimming on small windows
        const FACTOR = 3; // keep ~3x the visible window in memory
        const targetTotal = Math.max(displayedCandles * FACTOR, MIN_TOTAL);
        const extra = Math.max(0, targetTotal - displayedCandles);
        const leftMargin = Math.max(PAST_MARGIN, Math.floor(extra / 2));
        const rightMargin = Math.max(FUTURE_MARGIN, extra - Math.floor(extra / 2));

        // If already within target bounds, skip
        if (total <= displayedCandles + leftMargin + rightMargin) return;

        const startIdx = Math.max(0, viewStartIndex - leftMargin);
        const endIdx = Math.min(total, viewStartIndex + displayedCandles + rightMargin);

        if (startIdx <= 0 && endIdx >= total) return; // Nothing to trim

        const trimmed = displayCandles.slice(startIdx, endIdx);
        const removedLeft = startIdx;
        const removedRight = displayCandles.length - endIdx;

        // Adjust viewStartIndex relative to trimmed buffer
        const newViewStart = Math.max(0, viewStartIndex - startIdx);

        // Update subscription known date range to match trimmed buffer
        const newStartTs = trimmed[0]?.timestamp;
        const newEndTs = trimmed[trimmed.length - 1]?.timestamp;

        // Apply updates
        console.log('[Chart Trim] Trimming buffers:', {
            bufferBefore: displayCandles.length,
            startIdx,
            endIdx,
            removedLeft,
            removedRight,
            newLength: trimmed.length,
            oldViewStart: viewStartIndex,
            newViewStart
        });
        updateDisplayCandles(trimmed, 'trim_buffers');
        setViewStartIndex(newViewStart);
        if (newStartTs && newEndTs) {
            subscriptionStartDateRef.current = newStartTs;
            subscriptionEndDateRef.current = newEndTs;
        }

        // Indicators: ensure sufficient lookback retained using timestamps
        if (indicatorCandles.length) {
            const maxLookback = calculateMaxLookback(indicators);
            const requiredStartTs = Math.max(0, (trimmed[0]?.timestamp || newStartTs || 0) - (maxLookback * timeframeInMs));
            const requiredEndTs = trimmed[trimmed.length - 1]?.timestamp || newEndTs;

            const trimmedIndicators = indicatorCandles.filter(c =>
                c && typeof c.timestamp === 'number' && c.timestamp >= requiredStartTs && c.timestamp <= requiredEndTs
            );
            setIndicatorCandles(trimmedIndicators);
        }
    }, [displayCandles, indicatorCandles, viewStartIndex, displayedCandles, indicators, calculateMaxLookback, updateDisplayCandles, timeframeInMs]);

    // Calculate the required data range for websocket requests
    const calculateRequiredDataRange = useCallback(() => {
        if (!displayCandles.length) {
            console.log("[WebSocket Prep] No data available to calculate ranges");
            return { start: null, end: null, lookbackNeeded: 0 };
        }

        // Get current view range
        const currentViewStart = viewStartIndex;
        const currentViewEnd = Math.min(viewStartIndex + displayedCandles, displayCandles.length);

        // Calculate maximum lookback period needed for indicators
        const maxLookback = calculateMaxLookback(indicators);

        // Calculate the actual data range needed
        // This should be currentViewStart - maxLookback, but limited to a minimum of 0
        const dataStartIndex = Math.max(0, currentViewStart - maxLookback);

        console.log("[Range Debug] CurrentViewStart:", currentViewStart);
        console.log("[Range Debug] MaxLookback:", maxLookback);
        console.log("[Range Debug] DataStartIndex:", dataStartIndex);

        // Check if we're viewing the latest data and need to fetch future candles
        const isViewingLatest = currentViewEnd >= displayCandles.length;
        // For now, we'll just request 1 candle ahead if we're at the edge
        const extraFutureCandles = isViewingLatest ? 1 : 0;

        // Check buffer thresholds
        const { needsPastData, needsFutureData } = checkBufferThresholds();
        
        // Past data request – stop if we already hit the earliest known candle
        if (needsPastData && !isRequestingPastDataRef.current /*&& !isStartReachedRef.current*/ ) {
            const pastRange = calculateNewDateRangeForBuffer('past');
            if (pastRange) {
                try {
                    const vStart = viewStartIndex;
                    const vEnd = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
                    console.log('[Anchor] Selected reference for buffer update:', {
                        direction: 'past',
                        referenceTimestamp: displayCandles[vStart]?.timestamp ? new Date(displayCandles[vStart].timestamp).toISOString() : 'none',
                        referenceOffset: 0,
                        visibleStartIndex: vStart,
                        visibleEndIndex: vEnd,
                        firstVisible: displayCandles[vStart] ? new Date(displayCandles[vStart].timestamp).toISOString() : 'none',
                        lastVisible: displayCandles[vEnd] ? new Date(displayCandles[vEnd].timestamp).toISOString() : 'none',
                        bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
                        bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
                        bufferLength: displayCandles.length
                    });
                } catch (_) {}

                return {
                    start: pastRange.startDate,
                    end: pastRange.endDate,
                    resetData: pastRange.resetData,
                    isBufferUpdate: true,
                    bufferDirection: 'past',
                    referenceTimestamp: displayCandles[viewStartIndex]?.timestamp || displayCandles[0]?.timestamp || null,
                    // Preserve the same candle at the same relative position (left edge for past)
                    referenceOffset: 0
                };
            }
        }

        console.log("inbetween calculations")

        if (needsFutureData && !isRequestingFutureDataRef.current) {
            console.log("future data in calculations")
            const futureRange = calculateNewDateRangeForBuffer('future');
            if (futureRange) {
                const refIndex = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
                const refTs = displayCandles[refIndex]?.timestamp;
                const refOffset = Math.max(0, Math.min(displayedCandles - 1, refIndex - viewStartIndex));
                try {
                    const vStart = viewStartIndex;
                    const vEnd = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
                    console.log('[Anchor] Selected reference for buffer update:', {
                        direction: 'future',
                        referenceTimestamp: refTs ? new Date(refTs).toISOString() : 'none',
                        referenceOffset: refOffset,
                        visibleStartIndex: vStart,
                        visibleEndIndex: vEnd,
                        firstVisible: displayCandles[vStart] ? new Date(displayCandles[vStart].timestamp).toISOString() : 'none',
                        lastVisible: displayCandles[vEnd] ? new Date(displayCandles[vEnd].timestamp).toISOString() : 'none',
                        bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
                        bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
                        bufferLength: displayCandles.length
                    });
                } catch (_) {}

                return {
                    start: futureRange.startDate,
                    end: futureRange.endDate,
                    resetData: futureRange.resetData,
                    isBufferUpdate: true,
                    bufferDirection: 'future',
                    referenceTimestamp: typeof refTs === 'number' ? refTs : (displayCandles[0]?.timestamp || null),
                    // Preserve the same candle at the same relative position within the window
                    referenceOffset: refOffset
                };
            }
        }

        // Calculate start date based on lookback
        let startDate;
        if (maxLookback > 0 && dataStartIndex > 0 && displayCandles[dataStartIndex]) {
            // If we have a lookback and data at the start index, use that date
            startDate = displayCandles[dataStartIndex].timestamp - (maxLookback * timeframeInMs);
        } else if (displayCandles[viewStartIndex]) {
            // Otherwise use the view start date
            startDate = displayCandles[viewStartIndex].timestamp;
            if (maxLookback > 0) {
                startDate -= (maxLookback * timeframeInMs);
            }
        } else if (displayCandles.length > 0) {
            // Fallback to first available candle
            startDate = displayCandles[0].timestamp;
            if (maxLookback > 0) {
                startDate -= (maxLookback * timeframeInMs);
            }
        } else {
            // No data available
            startDate = null;
        }

        // Calculate end date
        const endDate = isViewingLatest && displayCandles.length > 0
            ? (new Date(displayCandles[displayCandles.length - 1]?.timestamp + timeframeInMs)).getTime()
            : (currentViewEnd < displayCandles.length)
                ? displayCandles[currentViewEnd - 1]?.timestamp
                : (displayCandles.length > 0 ? displayCandles[displayCandles.length - 1].timestamp : null);

        // New detailed logging for indicator calculations
        console.log("--------- INDICATOR CALCULATION REQUIREMENTS ---------");
        console.log(`[Indicator Requirements] Active Indicators: ${indicators.length}`);

        if (indicators.length > 0) {
            console.log("[Indicator Requirements] Indicator Details:");
            indicators.forEach(ind => {
                let periodText = "";
                switch (ind.type) {
                    case "sma":
                    case "ema":
                    case "rsi":
                    case "bb":
                    case "atr":
                        periodText = `Period: ${ind.settings?.period || "default"}`;
                        break;
                    case "macd":
                        periodText = `Fast: ${ind.settings?.fastPeriod || 12}, Slow: ${ind.settings?.slowPeriod || 26}, Signal: ${ind.settings?.signalPeriod || 9}`;
                        break;
                }
                console.log(`  - ${ind.name} (${ind.type}): ${periodText}`);
            });
        }

        console.log(`[Indicator Requirements] Maximum lookback needed: ${maxLookback} candles`);
        console.log(`[Indicator Requirements] Candles before current view needed: ${currentViewStart - dataStartIndex}`);
        console.log(`currentViewStart: ${currentViewStart}`);
        console.log(`dataStartIndex: ${dataStartIndex}`);

        // Date formatting helper
        const formatDate = (timestamp) => {
            if (!timestamp) return "undefined";
            try { return new Date(timestamp).toISOString(); } catch { return String(timestamp); }
        };

        console.log(`[Indicator Requirements] Oldest candle needed time: ${formatDate(startDate)}`);
        console.log(`[Indicator Requirements] Oldest displayed candle time: ${formatDate(displayCandles[currentViewStart]?.timestamp)}`);
        console.log(`[Indicator Requirements] Newest displayed candle time: ${formatDate(displayCandles[currentViewEnd - 1]?.timestamp)}`);
        console.log(`[Indicator Requirements] Number of displayed candles: ${currentViewEnd - currentViewStart}`);
        console.log(`currentViewEnd ${currentViewEnd}`);
        console.log(`datastartIndex: ${dataStartIndex}`);
        console.log(`extraFutureCandles: ${extraFutureCandles}`);
        console.log(`[Indicator Requirements] Total candles needed (including lookback): ${(currentViewEnd - dataStartIndex) + extraFutureCandles}`);
        console.log(`[Indicator Requirements] Data request range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
        console.log("-----------------------------------------------------");

        return {
            start: startDate,
            end: endDate,
            lookbackNeeded: maxLookback,
            isViewingLatest,
            extraFutureCandles,
            totalCandlesNeeded: (currentViewEnd - dataStartIndex) + extraFutureCandles
        };
    }, [
        displayCandles, 
        viewStartIndex, 
        displayedCandles, 
        indicators, 
        timeframeInMs, 
        calculateMaxLookback, 
        checkBufferThresholds, 
        calculateNewDateRangeForBuffer
    ]);

    // Create a ref to safely access the latest version of the function
    const calculateRangeRef = useRef(calculateRequiredDataRange);

    // Keep the ref updated with the latest function
    useEffect(() => {
        calculateRangeRef.current = calculateRequiredDataRange;
    }, [calculateRequiredDataRange]);

    // When viewStartIndex changes, check if we need to load more chart data
    useEffect(() => {
        // Don't check while dragging to avoid multiple requests
        if (isDragging) return;

        // Don't check if no data is loaded yet
        if (!displayCandles.length) return;

        const { needsPastData, needsFutureData } = checkBufferThresholds();

        console.log("needs past data in useeffect: " + needsPastData)
        console.log("is requesting past data ref in useefect: " + isRequestingPastDataRef.current)
        console.log("needs future data in useeffect: " + needsFutureData)
        console.log("is requesting future data ref in useeffect: " + isRequestingFutureDataRef.current)

        if ((needsPastData && !isRequestingPastDataRef.current) ||
            (needsFutureData && !isRequestingFutureDataRef.current)) {

            // Compute the precise range to fetch for the chart buffer
            const range = calculateRequiredDataRange();
            if (range && range.isBufferUpdate && Number.isFinite(range.start) && Number.isFinite(range.end)) {
                console.log('[Buffer Management] Requesting chart buffer update due to scrolling', {
                    direction: range.bufferDirection,
                    start: new Date(range.start).toISOString(),
                    end: new Date(range.end).toISOString()
                });

                // Mark in-flight flag based on direction to avoid duplicate requests
                if (range.bufferDirection === 'past') isRequestingPastDataRef.current = true;
                if (range.bufferDirection === 'future') isRequestingFutureDataRef.current = true;


                console.log("useeffect time range calculation")
                console.log("Reasons past:" + isRequestingFutureDataRef.current + "reasons future:" + isRequestingFutureDataRef.current)


                // Emit an event that useCandleSubscription listens to for making the websocket request
                try {
                    const evt = new CustomEvent('chartBufferUpdateRequested', {
                        detail: {
                            start: range.start,
                            end: range.end,
                            bufferDirection: range.bufferDirection,
                            referenceTimestamp: range.referenceTimestamp,
                            referenceOffset: range.referenceOffset
                        }
                    });
                    window.dispatchEvent(evt);
                    console.log(range.bufferDirection)
                } catch (_) {}
            }
        }
    }, [viewStartIndex, displayCandles, checkBufferThresholds, isDragging, calculateRequiredDataRange]);

    // Recalculate indicators when indicators list changes or indicator candles change
    useEffect(() => {
        if (!indicators.length) return;

        console.log("[ChartContext] Indicators or indicator data changed - applying to display candles");
        applyIndicatorsToCandleDisplay();

    }, [indicators, indicatorCandles.length, applyIndicatorsToCandleDisplay]);

    // Update visible data when viewStartIndex changes or display candles change
    useEffect(() => {
        console.log("[Window Update] Starting - Buffer Length:", displayCandles.length,
            "ViewIndex:", viewStartIndex,
            "DisplayedCandles:", displayedCandles);

        if (displayCandles.length > 0) {
            const safeStartIndex = Math.max(
                0,
                Math.min(viewStartIndex, displayCandles.length - displayedCandles)
            );

            console.log("[Window Update] Calculated SafeStartIndex:", safeStartIndex,
                "EndIndex:", safeStartIndex + displayedCandles,
                "Will Show:", safeStartIndex, "to", safeStartIndex + displayedCandles - 1);

            const visibleData = displayCandles.slice(
                safeStartIndex,
                safeStartIndex + displayedCandles
            );

            console.log("[Window Update] Final Visible Data - Length:", visibleData.length,
                "First Candle Time:", visibleData[0]?.timestamp ? new Date(visibleData[0].timestamp).toISOString() : "None",
                "Last Candle Time:", visibleData.length > 0 ?
                    new Date(visibleData[visibleData.length-1]?.timestamp).toISOString() :
                    "None");
            if (safeStartIndex === 0 && displayCandles.length > displayedCandles) {
                console.warn("[Snap Debug] Window positioned at leftmost index after update", {
                    safeStartIndex,
                    displayedCandles,
                    bufferLength: displayCandles.length
                });
            }

            setCandleData(visibleData);

            // After window update, trim if needed to keep memory bounded
            trimBuffersIfNeeded();

            // If we just got data and were waiting, set waiting to false
            if (isWaitingForData && visibleData.length > 0) {
                setIsWaitingForData(false);
            }
        }
    }, [displayCandles, viewStartIndex, displayedCandles, isWaitingForData, trimBuffersIfNeeded]);

    // Monitor indicator changes to update indicator subscription requirements (do not alter chart buffer)
    useEffect(() => {
        if (displayCandles.length === 0) return;

        // Only fire when indicators change or an explicit update was requested (e.g., base buffer actually changed)
        if ((indicators.length > 0 || shouldUpdateSubscription) && !isProcessingIndicatorUpdateRef.current) {
            isProcessingIndicatorUpdateRef.current = true;
            console.log("[WebSocket Prep] Recalculating indicator range due to indicator/base buffer changes");

            // Compute indicator range based on the entire base buffer + lookback
            const indRange = computeIndicatorRangeForBaseBuffer();

            const lastRange = lastRequestedRangeRef.current;
            const isRangeDifferent = !lastRange || lastRange.start !== indRange.start || lastRange.end !== indRange.end;

            if (isRangeDifferent) {
                lastRequestedRangeRef.current = { ...indRange };

                setTimeout(() => {
                    const indicatorChangeEvent = new CustomEvent('indicatorRequirementsChanged', {
                        detail: {
                            range: indRange,
                            indicatorCount: indicators.length,
                            subscriptionDetails: true,
                            isBufferUpdate: false
                        }
                    });
                    window.dispatchEvent(indicatorChangeEvent);
                    console.log("[WebSocket Prep] Dispatched indicatorRequirementsChanged event - Indicator range changed");

                    setTimeout(() => {
                        isProcessingIndicatorUpdateRef.current = false;
                    }, 300);
                }, 100);
            } else {
                console.log("[WebSocket Prep] Skipping indicator event - Range unchanged");
                isProcessingIndicatorUpdateRef.current = false;
            }

            setShouldUpdateSubscription(false);
        }

        // Trim if too large after any indicator handling
        trimBuffersIfNeeded();
    }, [indicators, shouldUpdateSubscription, displayCandles.length, computeIndicatorRangeForBaseBuffer, trimBuffersIfNeeded]);

    // Update hovered candle when index changes
    useEffect(() => {
        if (hoveredIndex !== null && candleData[hoveredIndex]) {
            setHoveredCandle(candleData[hoveredIndex]);
        } else {
            setHoveredCandle(null);
        }
    }, [hoveredIndex, candleData]);

    // Set waiting for data state when buffer is emptied (e.g., when changing subscriptions)
    useEffect(() => {
        if (displayCandles.length === 0) {
            setIsWaitingForData(true);
        }
    }, [displayCandles]);

    // Indicator management functions
    const addIndicator = (indicator) => {
        console.log("[Indicator Manager] Adding indicator to context:", indicator);
        const newIndicator = {
            ...indicator,
            id: crypto.randomUUID?.() || `id-${Date.now()}`
        };
        setIndicators(prev => {
            const newState = [...prev, newIndicator];
            console.log("[Indicator Manager] New indicators state in context:", newState);
            return newState;
        });

        // Request a subscription update when adding an indicator
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
            setShouldUpdateSubscription(true);
        }, 50);
    };

    const removeIndicator = (id) => {
        // Get indicator name before removing for logging
        const indicator = indicators.find(ind => ind.id === id);
        const indicatorName = indicator ? indicator.name : "Unknown";

        console.log(`[Indicator Manager] Removing indicator "${indicatorName}" (${id})`);
        setIndicators(prev => prev.filter(ind => ind.id !== id));

        // Request a subscription update when removing an indicator
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
            setShouldUpdateSubscription(true);
        }, 50);
    };

    const updateIndicator = (id, updates) => {
        // Get indicator name before updating for logging
        const indicator = indicators.find(ind => ind.id === id);
        const indicatorName = indicator ? indicator.name : "Unknown";

        console.log(`[Indicator Manager] Updating indicator "${indicatorName}" (${id}) with:`, updates);
        setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind));

        // Request a subscription update when updating an indicator
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
            setShouldUpdateSubscription(true);
        }, 50);
    };

    // Method to explicitly request a subscription update
    const requestSubscriptionUpdate = () => {
        setShouldUpdateSubscription(true);
    };

    // Method to handle buffer update completion
    const handleBufferUpdateComplete = useCallback((direction, referenceInput) => {
        console.log("Is handleBufferUpdateComplete future: " + isRequestingFutureDataRef.current )
        // Detailed log: when buffer update completes and what reference we will use
        try {
            const refInfo = (referenceInput && typeof referenceInput === 'object')
                ? { timestamp: referenceInput.timestamp, offset: referenceInput.offset }
                : { timestamp: referenceInput }
            console.log('[Anchor] handleBufferUpdateComplete invoked:', {
                direction,
                referenceTimestamp: refInfo.timestamp ? new Date(refInfo.timestamp).toISOString() : 'none',
                referenceOffset: refInfo.offset !== undefined ? refInfo.offset : 'none',
            });
        } catch (_) {}

        // Only clear request flags when we actually extended buffer in that direction
        try {
            const prevFirst = firstCandleTimestampRef.current;
            const prevLast = lastCandleTimestampRef.current;
            const currentStart = subscriptionStartDateRef.current;
            const currentEnd = subscriptionEndDateRef.current;

            const madePastProgress = Boolean(prevFirst && currentStart && currentStart < prevFirst);
            const madeFutureProgress = Boolean(prevLast && currentEnd && currentEnd > prevLast);

            if (direction === 'past') {
                // Clear in-flight and ensure we allow further past requests if we extended
                isRequestingPastDataRef.current = false;
                if (madePastProgress) {
                    isStartReachedRef.current = false;
                }
            } else if (direction === 'future') {
                console.log("is requesting future data ref in handleBufferUpdateComplete: " + isRequestingFutureDataRef.current )
                isRequestingFutureDataRef.current = false;
            } else  {
                // Safety net: avoid deadlock if backend responded without clear direction (e.g., stale id)
                console.warn('[Buffer Management] Unknown direction on buffer completion; clearing in-flight flags to avoid deadlock');
                isRequestingPastDataRef.current = false;
                isRequestingFutureDataRef.current = false;
            }
        } catch (_) {
            if (direction === 'past') isRequestingPastDataRef.current = false;
            if (direction === 'future') isRequestingFutureDataRef.current = false;
            if (direction === 'unknown') {
                isRequestingPastDataRef.current = false;
                isRequestingFutureDataRef.current = false;
            }
        }

        // Recalculate view index if provided a reference (timestamp or {timestamp, offset})
        if (referenceInput) {
            // Snapshot BEFORE recalc
            try {
                const vStart = viewStartIndex;
                const vEnd = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
                console.log('[Anchor] Pre-restore snapshot:', {
                    bufferLength: displayCandles.length,
                    bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
                    bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
                    visibleStartIndex: vStart,
                    visibleEndIndex: vEnd,
                    firstVisible: displayCandles[vStart] ? new Date(displayCandles[vStart].timestamp).toISOString() : 'none',
                    lastVisible: displayCandles[vEnd] ? new Date(displayCandles[vEnd].timestamp).toISOString() : 'none',
                });
            } catch (_) {}

            const anchored = recalculateViewIndex(referenceInput);
            console.log(`[Anchor] recalculateViewIndex result`, {
                direction,
                referenceTimestamp: new Date((typeof referenceInput === 'object' ? referenceInput.timestamp : referenceInput)).toISOString(),
                anchored
            });

            // Schedule AFTER snapshot to capture final state once state updates settle
            setTimeout(() => {
                try {
                    const vStart2 = viewStartIndex;
                    const vEnd2 = Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1);
                    console.log('[Window Update] Final Visible Data:', {
                        visibleStartIndex: vStart2,
                        visibleEndIndex: vEnd2,
                        firstVisible: displayCandles[vStart2] ? new Date(displayCandles[vStart2].timestamp).toISOString() : 'none',
                        lastVisible: displayCandles[vEnd2] ? new Date(displayCandles[vEnd2].timestamp).toISOString() : 'none',
                        bufferLength: displayCandles.length,
                        bufferFirst: displayCandles[0] ? new Date(displayCandles[0].timestamp).toISOString() : 'none',
                        bufferLast: displayCandles[displayCandles.length - 1] ? new Date(displayCandles[displayCandles.length - 1].timestamp).toISOString() : 'none',
                    });
                } catch (_) {}
            }, 50);
        } else {
            console.log(`[Anchor] No referenceTimestamp provided to handleBufferUpdateComplete; skipping re-anchor`, { direction });
        }

        // After merge completion and any re-anchoring, trim buffers to keep memory bounded.
        // Use a short delay to allow state updates (e.g., viewStartIndex) to settle.
        try {
            setTimeout(() => {
                try {
                    trimBuffersIfNeeded();
                } catch (_) {}
            }, 60);
        } catch (_) {}

        console.log(`[Buffer Management] Completed ${direction} buffer update`);
    }, [recalculateViewIndex, trimBuffersIfNeeded]);

    // Create an object with all the context values
    const contextValue = {
        // Data
        displayCandles,
        setDisplayCandles: updateDisplayCandles, // Use enhanced setter
        indicatorCandles,
        setIndicatorCandles: (newCandles) => {
            lastUpdateReasonRef.current = "update_indicator_candles";
            setIndicatorCandles(newCandles);
        },
        candleData,

        // View state
        viewStartIndex,
        setViewStartIndex: (index) => {
            lastUpdateReasonRef.current = "view_index_change";
            setViewStartIndex(index);
        },
        displayedCandles,
        setDisplayedCandles: (count) => {
            lastUpdateReasonRef.current = "display_count_change";
            setDisplayedCandles(count);
        },
        isDragging,
        setIsDragging,

        // Hover state
        hoveredIndex,
        setHoveredIndex,
        hoveredCandle,
        setHoveredCandle,
        currentMouseY,
        setCurrentMouseY,
        activeTimestamp,
        setActiveTimestamp,

        // Configuration
        isLogarithmic,
        setIsLogarithmic,
        isWaitingForData,
        setIsWaitingForData,
        timeframeInMs,
        setTimeframeInMs: (ms) => {
            lastUpdateReasonRef.current = "timeframe_change";
            setTimeframeInMs(ms);
        },
        isFollowingLatest,
        setIsFollowingLatest,
        isDataGenerationEnabled,
        setIsDataGenerationEnabled,

        // Indicators
        indicators,
        addIndicator,
        removeIndicator,
        updateIndicator,
        applyIndicatorsToCandleDisplay,

        // Constants
        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES,
        BUFFER_SIZE_MULTIPLIER,
        BUFFER_THRESHOLD_MULTIPLIER,

        // WebSocket preparation
        calculateRequiredDataRange,
        requestSubscriptionUpdate,
        
        // Buffer management
        updateSubscriptionDateRange,
        checkBufferThresholds,
        handleBufferUpdateComplete,
        findCandleIndexByTimestamp,

        // New cleaner API used by subscription layer
        initializeOnSelection,
        mergeBaseCandles,
        mergeIndicatorCandles,
        computeRequiredIndicatorRange,
        getAnchor,
        reanchorTo,
        trimBuffersIfNeeded
    };
    
    // Expose context externally through a global variable
    if (typeof window !== 'undefined') {
        window.__chartContextValue = contextValue;
    }
    
    return (
        <ChartContext.Provider value={contextValue} data-chart-context>
            {children}
        </ChartContext.Provider>
    );
}
