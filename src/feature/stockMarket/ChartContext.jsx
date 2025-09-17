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
    const [timeframeInMs, setTimeframeInMs] = useState(60000); // Default to 1 minute

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

    // Calculate max lookback needed for all indicators
    const calculateMaxLookback = useCallback((currentIndicators) => {
        let maxLookback = 0;

        currentIndicators.forEach(indicator => {
            let indicatorLookback = 0;

            switch (indicator.type) {
                case "sma":
                    indicatorLookback = indicator.settings?.period - 1 || 14;
                    break;
                case "ema":
                    indicatorLookback = indicator.settings?.period - 1 || 14;
                    break;
                case "rsi":
                    indicatorLookback = indicator.settings?.period || 14;
                    // RSI needs one extra candle to calculate first change
                    indicatorLookback += 1;
                    break;
                case "macd":
                    // MACD needs the slowest period plus signal period
                    indicatorLookback = Math.max(
                        indicator.settings?.slowPeriod || 26,
                        indicator.settings?.fastPeriod || 12
                    ) + (indicator.settings?.signalPeriod || 9);
                    break;
                case "bb":
                    indicatorLookback = indicator.settings?.period || 20;
                    break;
                case "atr":
                    indicatorLookback = indicator.settings?.period || 14;
                    // ATR needs one extra candle for previous close
                    indicatorLookback += 1;
                    break;
                default:
                    indicatorLookback = 50; // Safe default
            }

            maxLookback = Math.max(maxLookback, indicatorLookback);
        });

        return maxLookback;
    }, []);

    // Helper function to calculate indicators for a buffer
    const calculateIndicatorsForBuffer = useCallback((buffer, currentIndicators) => {
        if (!buffer.length || !currentIndicators.length) return buffer;

        console.log("[ChartContext] Calculating indicators for buffer with length:", buffer.length);

        return buffer.map((candle, candleIndex) => {
            // Create a new candle object with existing properties
            const updatedCandle = {
                ...candle,
                // Initialize indicatorValues if it doesn't exist
                indicatorValues: candle.indicatorValues || {}
            };

            // Calculate each indicator's value for this candle
            currentIndicators.forEach(indicator => {
                try {
                    // Calculate the full array of values for this indicator
                    const fullValues = calculateIndicator(indicator, buffer);

                    // Store just this candle's value
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
            needsPastData,
            needsFutureData
        });
        
        return { needsPastData, needsFutureData };
    }, [displayCandles, viewStartIndex, displayedCandles, timeframeInMs]);

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
        
        console.log(`[Buffer Management] Calculated new ${direction} date range:`, {
            start: new Date(newStartDate).toISOString(),
            end: new Date(newEndDate).toISOString()
        });
        
        return {
            startDate: newStartDate,
            endDate: newEndDate,
            resetData: true
        };
    }, [displayCandles, viewStartIndex, displayedCandles, timeframeInMs]);

    // Function to find candle index by timestamp
    const findCandleIndexByTimestamp = useCallback((timestamp) => {
        return displayCandles.findIndex(candle => candle.timestamp === timestamp);
    }, [displayCandles]);

    // Function to recalculate view index after receiving new data
    const recalculateViewIndex = useCallback((referenceTimestamp) => {
        // Find the index of the candle with the reference timestamp
        const newIndex = findCandleIndexByTimestamp(referenceTimestamp);
        
        if (newIndex !== -1) {
            console.log("[Buffer Management] Recalculated view index:", {
                referenceTimestamp: new Date(referenceTimestamp).toISOString(),
                newIndex
            });
            
            // Update view index to maintain view position
            setViewStartIndex(Math.max(0, Math.min(newIndex, displayCandles.length - displayedCandles)));
            return true;
        }
        
        console.warn("[Buffer Management] Failed to find reference candle after data update");
        return false;
    }, [displayCandles, displayedCandles, findCandleIndexByTimestamp]);

    // Trim display and indicator buffers to keep memory bounded while retaining enough context
    const trimBuffersIfNeeded = useCallback(() => {
        if (!displayCandles.length) return;

        // Avoid trimming while a buffer request is in-flight
        if (isRequestingPastDataRef.current || isRequestingFutureDataRef.current) return;

        const total = displayCandles.length;
        if (total <= displayedCandles + PAST_MARGIN + FUTURE_MARGIN) return;

        const startIdx = Math.max(0, viewStartIndex - PAST_MARGIN);
        const endIdx = Math.min(total, viewStartIndex + displayedCandles + FUTURE_MARGIN);

        if (startIdx <= 0 && endIdx >= total) return; // Nothing to trim

        const trimmed = displayCandles.slice(startIdx, endIdx);

        // Adjust viewStartIndex relative to trimmed buffer
        const newViewStart = Math.max(0, viewStartIndex - startIdx);

        // Update subscription known date range to match trimmed buffer
        const newStartTs = trimmed[0]?.timestamp;
        const newEndTs = trimmed[trimmed.length - 1]?.timestamp;

        // Apply updates
        updateDisplayCandles(trimmed, "trim_buffers");
        setViewStartIndex(newViewStart);
        if (newStartTs && newEndTs) {
            subscriptionStartDateRef.current = newStartTs;
            subscriptionEndDateRef.current = newEndTs;
        }

        // Indicators: ensure sufficient lookback retained
        if (indicatorCandles.length) {
            const maxLookback = calculateMaxLookback(indicators);
            const indicatorStartIdx = Math.max(0, startIdx - maxLookback);
            const indicatorEndIdx = Math.min(indicatorCandles.length, endIdx + 0);
            const trimmedIndicators = indicatorCandles.slice(indicatorStartIdx, indicatorEndIdx);
            setIndicatorCandles(trimmedIndicators);
        }
    }, [displayCandles, indicatorCandles, viewStartIndex, displayedCandles, indicators, calculateMaxLookback, updateDisplayCandles]);

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
        if (needsPastData && !isRequestingPastDataRef.current && !isStartReachedRef.current) {
            const pastRange = calculateNewDateRangeForBuffer('past');
            if (pastRange) {
                return {
                    start: pastRange.startDate,
                    end: pastRange.endDate,
                    resetData: pastRange.resetData,
                    isBufferUpdate: true,
                    bufferDirection: 'past',
                    referenceTimestamp: displayCandles[viewStartIndex]?.timestamp
                };
            }
        }

        if (needsFutureData && !isRequestingFutureDataRef.current) {
            const futureRange = calculateNewDateRangeForBuffer('future');
            if (futureRange) {
                return {
                    start: futureRange.startDate,
                    end: futureRange.endDate,
                    resetData: futureRange.resetData,
                    isBufferUpdate: true,
                    bufferDirection: 'future',
                    referenceTimestamp: displayCandles[Math.min(viewStartIndex + displayedCandles - 1, displayCandles.length - 1)]?.timestamp
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
            return new Date(timestamp).toISOString();
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

    // When viewStartIndex changes, check if we need to load more data
    useEffect(() => {
        // Don't check while dragging to avoid multiple requests
        if (isDragging) return;
        
        // Don't check if no data is loaded yet
        if (!displayCandles.length) return;
        
        const { needsPastData, needsFutureData } = checkBufferThresholds();
        
        if ((needsPastData && !isRequestingPastDataRef.current) || 
            (needsFutureData && !isRequestingFutureDataRef.current)) {
            
            // Request data update through existing subscription mechanism
            console.log("[Buffer Management] Requesting data update due to scrolling");
            setShouldUpdateSubscription(true);
        }
    }, [viewStartIndex, displayCandles, checkBufferThresholds, isDragging]);

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

            setCandleData(visibleData);

            // Calculate the required data range using the ref version
            setTimeout(() => {
                if (displayCandles.length > 0) {
                    calculateRangeRef.current();
                }
            }, 0);

            // If we just got data and were waiting, set waiting to false
            if (isWaitingForData && visibleData.length > 0) {
                setIsWaitingForData(false);
            }
        }
    }, [displayCandles, viewStartIndex, displayedCandles, isWaitingForData]);

    // Monitor indicator changes to update subscription requirements
    useEffect(() => {
        if (displayCandles.length > 0) {
            // Only recalculate range when indicators change or when explicitly requested
            if ((indicators.length > 0 || shouldUpdateSubscription) && !isProcessingIndicatorUpdateRef.current) {
                isProcessingIndicatorUpdateRef.current = true;
                console.log("[WebSocket Prep] Recalculating required data range due to indicator changes");
                const range = calculateRequiredDataRange();

                // Check if range is different from last request or if it's a buffer update
                const lastRange = lastRequestedRangeRef.current;
                const isRangeDifferent = !lastRange ||
                    lastRange.start !== range.start ||
                    lastRange.end !== range.end;

                if (isRangeDifferent || range.isBufferUpdate) {
                    lastRequestedRangeRef.current = { ...range };
                    
                    // Update request flags for buffer management
                    if (range.isBufferUpdate) {
                        if (range.bufferDirection === 'past') {
                            isRequestingPastDataRef.current = true;
                        } else if (range.bufferDirection === 'future') {
                            isRequestingFutureDataRef.current = true;
                        }
                    }

                    // Use setTimeout to prevent immediate consecutive emissions
                    setTimeout(() => {
                        const indicatorChangeEvent = new CustomEvent('indicatorRequirementsChanged', {
                            detail: {
                                range,
                                indicatorCount: indicators.length,
                                // Include current subscription details if needed
                                subscriptionDetails: true, // this forces the handler to look up current details
                                isBufferUpdate: range.isBufferUpdate,
                                bufferDirection: range.bufferDirection,
                                referenceTimestamp: range.referenceTimestamp
                            }
                        });
                        window.dispatchEvent(indicatorChangeEvent);

                        console.log("[WebSocket Prep] Dispatched indicatorRequirementsChanged event - Range changed");

                        // Reset the processing flag after a delay to allow processing
                        setTimeout(() => {
                            isProcessingIndicatorUpdateRef.current = false;
                        }, 300);
                    }, 100);
                } else {
                    console.log("[WebSocket Prep] Skipping event dispatch - Range unchanged");
                    isProcessingIndicatorUpdateRef.current = false;
                }

                // Reset the flag
                setShouldUpdateSubscription(false);
            }
            // After handling indicator updates and potential merges, trim buffers if too large
            trimBuffersIfNeeded();
        }
    }, [indicators, shouldUpdateSubscription, displayCandles.length, calculateRequiredDataRange, trimBuffersIfNeeded]);

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
    const handleBufferUpdateComplete = useCallback((direction, referenceTimestamp) => {
        // Reset request flags
        if (direction === 'past') {
            isRequestingPastDataRef.current = false;
        } else if (direction === 'future') {
            isRequestingFutureDataRef.current = false;
        }
        
        // Recalculate view index if provided a reference timestamp
        if (referenceTimestamp) {
            recalculateViewIndex(referenceTimestamp);
        }
        
        console.log(`[Buffer Management] Completed ${direction} buffer update`);
    }, [recalculateViewIndex]);

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
        findCandleIndexByTimestamp
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
