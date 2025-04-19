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
    const [isFollowingLatest, setIsFollowingLatest] = useState(true);

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
        if (historicalBuffer.length > 0) {
            const safeStartIndex = Math.max(
                0,
                Math.min(viewStartIndex, historicalBuffer.length - displayedCandles)
            );

            const visibleData = historicalBuffer.slice(
                safeStartIndex,
                safeStartIndex + displayedCandles
            );

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

    // Simulation of real-time updates
    useEffect(() => {
        // Skip setting up the interval if data generation is disabled
        if (!isDataGenerationEnabled) return;

        const interval = setInterval(() => {
            if (historicalBuffer.length > 0) {
                const newCandle = generateNewCandle(historicalBuffer[historicalBuffer.length - 1]);

                setHistoricalBuffer(prevBuffer => {
                    const newBuffer = [...prevBuffer, newCandle].slice(-MAX_HISTORY_CANDLES);
                    return newBuffer;
                });

                // Only auto-scroll if we're following the latest data
                if (isFollowingLatest && !isDragging) {
                    setViewStartIndex(prevIndex => {
                        return Math.max(0, (historicalBuffer.length + 1) - displayedCandles);
                    });
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [historicalBuffer, isDragging, displayedCandles, isDataGenerationEnabled, isFollowingLatest]);

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
    }, [historicalBuffer, indicators.length]); // Remove indicators from dependency array

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
            isFollowingLatest,
            setIsFollowingLatest,

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
