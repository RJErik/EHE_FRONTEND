// src/components/stockMarket/ChartContext.jsx
import { createContext, useState, useEffect } from "react";
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

    // Initialize with mock data
    useEffect(() => {
        const initialData = generateMockCandleData(MAX_HISTORY_CANDLES);
        setHistoricalBuffer(initialData);
        // Start viewing from the most recent candles instead of the oldest ones
        setViewStartIndex(Math.max(0, initialData.length - displayedCandles));
    }, []);

    // Update visible data when viewStartIndex changes or historical buffer changes
    useEffect(() => {
        // At the beginning of effect - LOG 6
        console.log("[Window Update] Starting - Buffer Length:", historicalBuffer.length,
            "ViewIndex:", viewStartIndex,
            "DisplayedCandles:", displayedCandles);

        if (historicalBuffer.length > 0) {
            const safeStartIndex = Math.max(
                0,
                Math.min(viewStartIndex, historicalBuffer.length - displayedCandles)
            );

            // After calculating safe index - LOG 7
            console.log("[Window Update] Calculated SafeStartIndex:", safeStartIndex,
                "EndIndex:", safeStartIndex + displayedCandles,
                "Will Show:", safeStartIndex, "to", safeStartIndex + displayedCandles - 1);

            const visibleData = historicalBuffer.slice(
                safeStartIndex,
                safeStartIndex + displayedCandles
            );

            // Before setting candle data - LOG 8
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

    useEffect(() => {
        console.log("[ChartContext] Real-time update effect setup. isDataGenerationEnabled:", isDataGenerationEnabled);

        if (!isDataGenerationEnabled) {
            console.log("[ChartContext] Data generation is disabled, interval not started.");
            return; // Exit if data generation is off
        }

        console.log("[ChartContext] Starting data generation interval (5 seconds).");
        const interval = setInterval(() => {
            // Just before generating new candle - LOG 1
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

            // After generating new candle - LOG 2
            console.log("[New Candle]", newCandle);

            console.log(`[ChartContext] Interval Tick - Before Update: Buffer Length=${currentBufferLength}, Is Full=${isBufferFull}, Last Candle Timestamp=${lastCandle?.timestamp}`);
            console.log("[ChartContext] Interval Tick - Generated New Candle:", newCandle);

            // Update historical buffer
            setHistoricalBuffer(prevBuffer => {
                const updatedBuffer = [...prevBuffer, newCandle].slice(-MAX_HISTORY_CANDLES);

                // Inside the setHistoricalBuffer callback - LOG 3
                console.log("[Buffer Updated] New Length:", updatedBuffer.length,
                    "First Candle Time:", updatedBuffer[0]?.timestamp,
                    "Last Candle Time:", updatedBuffer[updatedBuffer.length-1]?.timestamp);

                console.log(`[ChartContext] Interval Tick - Updated Buffer: New Length=${updatedBuffer.length}`);
                return updatedBuffer;
            });

            // Update viewStartIndex (Fixed Auto-scroll logic)
            if (!isDragging) {
                console.log("[ChartContext] Interval Tick - Not dragging, proceeding with auto-scroll check.");

                setViewStartIndex(prevIndex => {
                    // Inside the setViewStartIndex callback before any calculations - LOG 4
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
                        // Advance the view to include the new candle
                        newIndex = Math.max(0, (currentBufferLength + 1) - displayedCandles);
                        console.log(`[ChartContext] AutoScroll Action - Viewing End: Scrolling to include new candle. New Index: ${newIndex}`);
                    }
                    else if (isBufferFull) {
                        // If buffer is full but NOT viewing the end,
                        // Shift by exactly 1 to maintain the same relative position
                        // This compensates for the oldest candle being removed
                        newIndex = prevIndex - 1;
                        console.log(`[ChartContext] AutoScroll Action - Not Viewing End + Buffer Full: Shifting +1 to maintain position. New Index: ${newIndex}`);
                    }
                    else {
                        // Not viewing end and buffer isn't full
                        // Keep the view position exactly the same
                        newIndex = prevIndex;
                        console.log(`[ChartContext] AutoScroll Action - Not Viewing End + Buffer Not Full: Keeping same position. New Index: ${prevIndex}`);
                    }

                    // Ensure index is within valid bounds just in case
                    const finalBoundedIndex = Math.max(0, Math.min(newIndex, (currentBufferLength + 1) - displayedCandles));
                    if (finalBoundedIndex !== newIndex) {
                        console.warn(`[ChartContext] AutoScroll Warning - Calculated index ${newIndex} was out of bounds, corrected to ${finalBoundedIndex}`);
                    }

                    // After calculating new index - LOG 5
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
        viewStartIndex, // Added for logging purposes
    ]);

    // Calculate indicator values when candle data changes
    useEffect(() => {
        if (!historicalBuffer || historicalBuffer.length === 0 || indicators.length === 0) return;

        console.log("Calculating indicators with historical buffer length:", historicalBuffer.length);

        // Clone the buffer to ensure we're working with the latest data
        const currentBuffer = [...historicalBuffer];

        setIndicators(prevIndicators =>
            prevIndicators.map(indicator => {
                try {
                    const values = calculateIndicator(indicator, currentBuffer);
                    console.log(`Calculated values for ${indicator.name}:`, values.length);
                    return { ...indicator, values };
                } catch (err) {
                    console.error("Error calculating indicator:", err);
                    return indicator;
                }
            })
        );
    }, [historicalBuffer, indicators.length]);

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
