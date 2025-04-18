// src/components/stockMarket/ChartContext.js
import { createContext, useState, useEffect } from "react";
import { generateMockCandleData, generateNewCandle } from "../../utils/mockDataGenerator.js";

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
    }, [displayedCandles]);

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
        const interval = setInterval(() => {
            if (historicalBuffer.length > 0) {
                const newCandle = generateNewCandle(historicalBuffer[historicalBuffer.length - 1]);

                setHistoricalBuffer(prevBuffer => {
                    const newBuffer = [...prevBuffer, newCandle].slice(-MAX_HISTORY_CANDLES);
                    return newBuffer;
                });

                if (!isDragging) {
                    setViewStartIndex(prevIndex => {
                        const isAtEnd = prevIndex + displayedCandles >= historicalBuffer.length;
                        if (isAtEnd) {
                            return Math.max(0, (historicalBuffer.length + 1) - displayedCandles);
                        }
                        return prevIndex;
                    });
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [historicalBuffer, isDragging, displayedCandles]);

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

            // Constants
            MIN_DISPLAY_CANDLES,
            MAX_DISPLAY_CANDLES
        }}>
            {children}
        </ChartContext.Provider>
    );
}
