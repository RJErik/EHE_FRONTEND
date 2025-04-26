// src/components/stockMarket/ChartContext.jsx
import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { calculateIndicator } from "./indicators/indicatorCalculations.js";

export const ChartContext = createContext(null);

export function ChartProvider({ children }) {
    // Candle data state
    const [historicalBuffer, setHistoricalBuffer] = useState([]);
    const [candleData, setCandleData] = useState([]);

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

    // Calculate the required data range for websocket requests
    const calculateRequiredDataRange = useCallback(() => {
        if (!historicalBuffer.length) {
            console.log("[WebSocket Prep] No data available to calculate ranges");
            return { start: null, end: null, lookbackNeeded: 0 };
        }

        // Get current view range
        const currentViewStart = viewStartIndex;
        const currentViewEnd = Math.min(viewStartIndex + displayedCandles, historicalBuffer.length);

        // Calculate maximum lookback period needed for indicators
        let maxLookback = 0;

        indicators.forEach(indicator => {
            let indicatorLookback = 0;

            switch (indicator.type) {
                case "sma":
                    indicatorLookback = indicator.settings?.period || 14;
                    break;
                case "ema":
                    indicatorLookback = indicator.settings?.period || 14;
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
        const dataStartIndex = Math.min(0, currentViewStart - maxLookback);

        console.log(currentViewStart);
        console.log(maxLookback);
        console.log(dataStartIndex);


        // Check if we're viewing the latest data and need to fetch future candles
        const isViewingLatest = currentViewEnd >= historicalBuffer.length;
        // For now, we'll just request 1 candle ahead if we're at the edge
        const extraFutureCandles = isViewingLatest ? 1 : 0;

        const startDate = historicalBuffer[viewStartIndex].timestamp - (maxLookback * timeframeInMs); // Using timeframeInMs here
        const endDate = isViewingLatest
            ? (new Date(historicalBuffer[historicalBuffer.length - 1]?.timestamp + 60000)).getTime()
            : historicalBuffer[currentViewEnd - 1]?.timestamp;

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

        // Date formatting helper
        const formatDate = (timestamp) => {
            if (!timestamp) return "undefined";
            return new Date(timestamp).toISOString();
        };

        console.log(`[Indicator Requirements] Oldest candle needed time: ${formatDate(startDate)}`);
        console.log(`[Indicator Requirements] Oldest displayed candle time: ${formatDate(historicalBuffer[currentViewStart]?.timestamp)}`);
        console.log(`[Indicator Requirements] Newest displayed candle time: ${formatDate(historicalBuffer[currentViewEnd - 1]?.timestamp)}`);
        console.log(`[Indicator Requirements] Number of displayed candles: ${currentViewEnd - currentViewStart}`);
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
    }, [historicalBuffer, viewStartIndex, displayedCandles, indicators, timeframeInMs]);

    // Create a ref to safely access the latest version of the function
    const calculateRangeRef = useRef(calculateRequiredDataRange);

    // Keep the ref updated with the latest function
    useEffect(() => {
        calculateRangeRef.current = calculateRequiredDataRange;
    }, [calculateRequiredDataRange]);

    // Recalculate indicators when indicators list changes
    useEffect(() => {
        if (!historicalBuffer.length || !indicators.length) return;

        console.log("[ChartContext] Indicators changed - recalculating for all candles");

        const processedBuffer = calculateIndicatorsForBuffer(historicalBuffer, indicators);
        setHistoricalBuffer(processedBuffer);
    }, [indicators, calculateIndicatorsForBuffer]);

    // Update visible data when viewStartIndex changes or historical buffer changes
    useEffect(() => {
        console.log("[Window Update] Starting - Buffer Length:", historicalBuffer.length,
            "ViewIndex:", viewStartIndex,
            "DisplayedCandles:", displayedCandles);

        if (historicalBuffer.length > 0) {
            const safeStartIndex = Math.max(
                0,
                Math.min(viewStartIndex, historicalBuffer.length - displayedCandles)
            );

            console.log("[Window Update] Calculated SafeStartIndex:", safeStartIndex,
                "EndIndex:", safeStartIndex + displayedCandles,
                "Will Show:", safeStartIndex, "to", safeStartIndex + displayedCandles - 1);

            const visibleData = historicalBuffer.slice(
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
                if (historicalBuffer.length > 0) {
                    calculateRangeRef.current();
                }
            }, 0);

            // If we just got data and were waiting, set waiting to false
            if (isWaitingForData && visibleData.length > 0) {
                setIsWaitingForData(false);
            }
        }
    }, [historicalBuffer, viewStartIndex, displayedCandles, isWaitingForData]);

    // Run the calculation whenever indicators change too
    useEffect(() => {
        if (historicalBuffer.length > 0) {
            console.log("[WebSocket Prep] Recalculating required data range due to indicator changes");
            calculateRangeRef.current();
        }
    }, [indicators, historicalBuffer.length]);

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
        if (historicalBuffer.length === 0) {
            setIsWaitingForData(true);
        }
    }, [historicalBuffer]);

    // Indicator management functions
    const addIndicator = (indicator) => {
        console.log("Adding indicator to context:", indicator);
        const newIndicator = {
            ...indicator,
            id: crypto.randomUUID?.() || `id-${Date.now()}`
        };
        setIndicators(prev => {
            const newState = [...prev, newIndicator];
            console.log("New indicators state in context:", newState);
            return newState;
        });
    };

    const removeIndicator = (id) => {
        setIndicators(prev => prev.filter(ind => ind.id !== id));
    };

    const updateIndicator = (id, updates) => {
        setIndicators(prev =>
            prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind)
        );
    };

    return (
        <ChartContext.Provider value={{
            // Data
            historicalBuffer,
            setHistoricalBuffer,
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

            // Indicators
            indicators,
            addIndicator,
            removeIndicator,
            updateIndicator,

            // Constants
            MIN_DISPLAY_CANDLES,
            MAX_DISPLAY_CANDLES,

            // WebSocket preparation
            calculateRequiredDataRange
        }}>
            {children}
        </ChartContext.Provider>
    );
}