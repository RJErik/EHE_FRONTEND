// src/components/stockMarket/ChartContext.jsx
import { createContext, useState, useEffect, useCallback } from "react";
import { generateMockCandleData, generateNewCandle } from "../../utils/mockDataGenerator.js";
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
    const [isDataGenerationEnabled, setIsDataGenerationEnabled] = useState(true);

    // Indicator state - now centralized here
    const [indicators, setIndicators] = useState([]);

    // Constants
    const MIN_DISPLAY_CANDLES = 20;
    const MAX_DISPLAY_CANDLES = 200;
    const MAX_HISTORY_CANDLES = 500;

    // Helper function to calculate indicators for a buffer
    // We make this a useCallback so it's stable and can be used in effects
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

    // Initialize with mock data
    useEffect(() => {
        const initialData = generateMockCandleData(MAX_HISTORY_CANDLES);
        setHistoricalBuffer(initialData);
        // Start viewing from the most recent candles instead of the oldest ones
        setViewStartIndex(Math.max(0, initialData.length - displayedCandles));
    }, []);

    // Recalculate indicators when indicators list changes
    useEffect(() => {
        if (!historicalBuffer.length || !indicators.length) return;

        console.log("[ChartContext] Indicators changed - recalculating for all candles");

        const processedBuffer = calculateIndicatorsForBuffer(historicalBuffer, indicators);
        setHistoricalBuffer(processedBuffer);
    }, [indicators, calculateIndicatorsForBuffer]); // No historicalBuffer dependency to avoid loops

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
                "First Candle Time:", visibleData[0]?.timestamp,
                "Last Candle Time:", visibleData[visibleData.length-1]?.timestamp);

            setCandleData(visibleData);
        }
    }, [historicalBuffer, viewStartIndex, displayedCandles]);

    // Update hovered candle when index changes
    useEffect(() => {
        if (hoveredIndex !== null && candleData[hoveredIndex]) {
            setHoveredCandle(candleData[hoveredIndex]);
        } else {
            setHoveredCandle(null);
        }
    }, [hoveredIndex, candleData]);

    // Real-time data generation
    useEffect(() => {
        console.log("[ChartContext] Real-time update effect setup. isDataGenerationEnabled:", isDataGenerationEnabled);

        if (!isDataGenerationEnabled) {
            console.log("[ChartContext] Data generation is disabled, interval not started.");
            return; // Exit if data generation is off
        }

        console.log("[ChartContext] Starting data generation interval (5 seconds).");
        const interval = setInterval(() => {
            console.log("=== CYCLE START ===");
            console.log("[Buffer State] Length:", historicalBuffer.length,
                "ViewIndex:", viewStartIndex,
                "DisplayedCandles:", displayedCandles,
                "ViewEnd:", viewStartIndex + displayedCandles,
                "ViewingLatest:", (viewStartIndex + displayedCandles >= historicalBuffer.length));

            console.log("--------------------");
            console.log("[ChartContext] Interval Tick - Attempting to generate new candle.");

            if (historicalBuffer.length === 0) {
                console.log("[ChartContext] Interval Tick - Historical buffer is empty, skipping generation.");
                return; // Don't generate if buffer is empty
            }

            const currentBufferLength = historicalBuffer.length;
            const isBufferFull = currentBufferLength >= MAX_HISTORY_CANDLES;
            const lastCandle = historicalBuffer[historicalBuffer.length - 1];
            const newCandle = generateNewCandle(lastCandle);

            // Initialize indicator values object for the new candle
            newCandle.indicatorValues = {};

            console.log("[New Candle]", newCandle);

            console.log(`[ChartContext] Interval Tick - Before Update: Buffer Length=${currentBufferLength}, Is Full=${isBufferFull}, Last Candle Timestamp=${lastCandle?.timestamp}`);
            console.log("[ChartContext] Interval Tick - Generated New Candle:", newCandle);

            // Update historical buffer AND calculate indicators for the new buffer in one step
            setHistoricalBuffer(prevBuffer => {
                // First add the new candle to the buffer
                const updatedBuffer = [...prevBuffer, newCandle].slice(-MAX_HISTORY_CANDLES);

                console.log("[Buffer Updated] New Length:", updatedBuffer.length,
                    "First Candle Time:", updatedBuffer[0]?.timestamp,
                    "Last Candle Time:", updatedBuffer[updatedBuffer.length-1]?.timestamp);

                // Then immediately calculate indicators for the updated buffer
                if (indicators.length > 0) {
                    console.log("[ChartContext] Calculating indicators for updated buffer with new candle");
                    return calculateIndicatorsForBuffer(updatedBuffer, indicators);
                }

                return updatedBuffer;
            });

            // Update viewStartIndex (Auto-scroll logic)
            if (!isDragging) {
                console.log("[ChartContext] Interval Tick - Not dragging, proceeding with auto-scroll check.");

                setViewStartIndex(prevIndex => {
                    console.log("[View Calc] Current Index:", prevIndex,
                        "DisplayCandles:", displayedCandles,
                        "BufferLength:", currentBufferLength,
                        "IsViewingEnd:", prevIndex + displayedCandles >= currentBufferLength);

                    console.log(`[ChartContext] AutoScroll Check - Prev Index: ${prevIndex}, Displayed: ${displayedCandles}, Buffer Length (Before Add): ${currentBufferLength}`);

                    // Check if we're currently viewing the end of the chart
                    const isViewingEnd = prevIndex + displayedCandles >= currentBufferLength;
                    console.log(`[ChartContext] AutoScroll Check - Is Viewing End? ${isViewingEnd}`);

                    let newIndex;

                    if (isViewingEnd) {
                        // If viewing the end, keep showing the newest data
                        newIndex = Math.max(0, (currentBufferLength + 1) - displayedCandles);
                        console.log(`[ChartContext] AutoScroll Action - Viewing End: Scrolling to include new candle. New Index: ${newIndex}`);
                    }
                    else if (isBufferFull) {
                        // If buffer is full but NOT viewing the end, shift by 1
                        newIndex = prevIndex - 1;
                        console.log(`[ChartContext] AutoScroll Action - Not Viewing End + Buffer Full: Shifting +1 to maintain position. New Index: ${newIndex}`);
                    }
                    else {
                        // Not viewing end and buffer isn't full
                        newIndex = prevIndex;
                        console.log(`[ChartContext] AutoScroll Action - Not Viewing End + Buffer Not Full: Keeping same position. New Index: ${prevIndex}`);
                    }

                    // Ensure index is within valid bounds
                    const finalBoundedIndex = Math.max(0, Math.min(newIndex, (currentBufferLength + 1) - displayedCandles));
                    if (finalBoundedIndex !== newIndex) {
                        console.warn(`[ChartContext] AutoScroll Warning - Calculated index ${newIndex} was out of bounds, corrected to ${finalBoundedIndex}`);
                    }

                    console.log("[View Calc] Result: New Index:", finalBoundedIndex,
                        "Will show candles", finalBoundedIndex, "to",
                        finalBoundedIndex + displayedCandles - 1);

                    console.log(`[ChartContext] AutoScroll Final - Setting viewStartIndex to: ${finalBoundedIndex}`);
                    return finalBoundedIndex;
                });
            } else {
                console.log("[ChartContext] Interval Tick - Currently dragging, skipping auto-scroll.");
            }
            console.log("--------------------");

        }, 5000); // Generate every 5 seconds

        // Cleanup function
        return () => {
            console.log("[ChartContext] Cleaning up data generation interval.");
            clearInterval(interval);
        };
    }, [
        historicalBuffer,
        isDragging,
        displayedCandles,
        isDataGenerationEnabled,
        viewStartIndex,
        indicators, // Added to access current indicators
        calculateIndicatorsForBuffer // Added to use our calculation function
    ]);

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
            isDataGenerationEnabled,
            setIsDataGenerationEnabled,

            // Indicators
            indicators,
            addIndicator,
            removeIndicator,
            updateIndicator,

            // Constants
            MIN_DISPLAY_CANDLES,
            MAX_DISPLAY_CANDLES
        }}>
            {children}
        </ChartContext.Provider>
    );
}
