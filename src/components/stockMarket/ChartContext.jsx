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

    // Constants
    const MIN_DISPLAY_CANDLES = 20;
    const MAX_DISPLAY_CANDLES = 200;
    const MAX_HISTORY_CANDLES = 500;

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
        if (!displayCandles.length || !indicatorCandles.length || !indicators.length) return;

        console.log("[ChartContext] Applying calculated indicators to display candles");

        // First calculate indicators on the indicator candle buffer
        const processedIndicatorCandles = calculateIndicatorsForBuffer(indicatorCandles, indicators);

        // Create a map of timestamp to calculated indicator values
        const indicatorValuesByTimestamp = {};
        processedIndicatorCandles.forEach(candle => {
            if (candle.timestamp && candle.indicatorValues) {
                indicatorValuesByTimestamp[candle.timestamp] = candle.indicatorValues;
            }
        });

        // Apply indicator values to display candles
        const updatedDisplayCandles = displayCandles.map(candle => {
            const calculatedValues = indicatorValuesByTimestamp[candle.timestamp];
            if (calculatedValues) {
                return {
                    ...candle,
                    indicatorValues: calculatedValues
                };
            }
            return candle;
        });

        // Update the display candles with calculated indicators
        setDisplayCandles(updatedDisplayCandles);
    }, [displayCandles, indicatorCandles, indicators, calculateIndicatorsForBuffer]);

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
        let maxLookback = 0;

        indicators.forEach(indicator => {
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

        // Calculate start date based on lookback
        let startDate;
        if (maxLookback > 0 && displayCandles[dataStartIndex]) {
            // If we have a lookback and data at the start index, use that date
            startDate = displayCandles[dataStartIndex].timestamp - (maxLookback * timeframeInMs);
        } else if (displayCandles[viewStartIndex]) {
            // Otherwise use the view start date
            startDate = displayCandles[viewStartIndex].timestamp;
        } else if (displayCandles.length > 0) {
            // Fallback to first available candle
            startDate = displayCandles[0].timestamp;
        } else {
            // No data available
            startDate = null;
        }

        // Calculate end date
        const endDate = isViewingLatest && displayCandles.length > 0
            ? (new Date(displayCandles[displayCandles.length - 1]?.timestamp + 60000)).getTime()
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
    }, [displayCandles, viewStartIndex, displayedCandles, indicators, timeframeInMs]);

    // Create a ref to safely access the latest version of the function
    const calculateRangeRef = useRef(calculateRequiredDataRange);

    // Keep the ref updated with the latest function
    useEffect(() => {
        calculateRangeRef.current = calculateRequiredDataRange;
    }, [calculateRequiredDataRange]);

    // Recalculate indicators when indicators list changes or indicator candles change
    useEffect(() => {
        if (!indicators.length) return;

        console.log("[ChartContext] Indicators or indicator data changed - applying to display candles");
        applyIndicatorsToCandleDisplay();
        
    }, [indicators, indicatorCandles, applyIndicatorsToCandleDisplay]);

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
                "First Candle Time:", new Date(visibleData[0]?.timestamp).toISOString(),
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

    // FIXED: Modified useEffect to prevent infinite loop
    useEffect(() => {
        if (displayCandles.length > 0) {
            // Only recalculate range when indicators change or when explicitly requested
            if (indicators.length > 0 || shouldUpdateSubscription) {
                console.log("[WebSocket Prep] Recalculating required data range due to indicator changes");
                const range = calculateRequiredDataRange();

                // Check if range is different from last request
                const lastRange = lastRequestedRangeRef.current;
                const isRangeDifferent = !lastRange ||
                    lastRange.start !== range.start ||
                    lastRange.end !== range.end;

                if (isRangeDifferent) {
                    lastRequestedRangeRef.current = { ...range };

                    const indicatorChangeEvent = new CustomEvent('indicatorRequirementsChanged', {
                        detail: {
                            range,
                            indicatorCount: indicators.length
                        }
                    });
                    window.dispatchEvent(indicatorChangeEvent);

                    console.log("[WebSocket Prep] Dispatched indicatorRequirementsChanged event - Range changed");
                } else {
                    console.log("[WebSocket Prep] Skipping event dispatch - Range unchanged");
                }

                // Reset the flag
                setShouldUpdateSubscription(false);
            }
        }
    }, [indicators, shouldUpdateSubscription, displayCandles.length, calculateRequiredDataRange]);

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

    // Helper function to format date for logs
    const formatDate = (timestamp) => {
        if (!timestamp) return "undefined";
        return new Date(timestamp).toISOString();
    };

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
        setShouldUpdateSubscription(true);
    };

    const removeIndicator = (id) => {
        // Get indicator name before removing for logging
        const indicator = indicators.find(ind => ind.id === id);
        const indicatorName = indicator ? indicator.name : "Unknown";

        console.log(`[Indicator Manager] Removing indicator "${indicatorName}" (${id})`);
        setIndicators(prev => prev.filter(ind => ind.id !== id));

        // Request a subscription update when removing an indicator
        setShouldUpdateSubscription(true);
    };

    const updateIndicator = (id, updates) => {
        // Get indicator name before updating for logging
        const indicator = indicators.find(ind => ind.id === id);
        const indicatorName = indicator ? indicator.name : "Unknown";

        console.log(`[Indicator Manager] Updating indicator "${indicatorName}" (${id}) with:`, updates);
        setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind));

        // Request a subscription update when updating an indicator
        setShouldUpdateSubscription(true);
    };

    // Method to explicitly request a subscription update
    const requestSubscriptionUpdate = () => {
        setShouldUpdateSubscription(true);
    };

    return (
        <ChartContext.Provider value={{
            // Data
            displayCandles,
            setDisplayCandles,
            indicatorCandles,
            setIndicatorCandles,
            candleData,

            // View state
            viewStartIndex,
            setViewStartIndex,
            displayedCandles,
            setDisplayedCandles,
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
            setTimeframeInMs,
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

            // WebSocket preparation
            calculateRequiredDataRange,
            requestSubscriptionUpdate
        }}>
            {children}
        </ChartContext.Provider>
    );
}
