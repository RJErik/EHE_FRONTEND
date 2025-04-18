import { useEffect, useState } from 'react';
import { generateMockCandleData, generateNewCandle } from '../../../utils/mockDataGenerator.js';

export function useCandleChart(chartRef) {
    // Store a larger history buffer to enable dragging to past data
    const [historicalBuffer, setHistoricalBuffer] = useState([]);
    const [data, setData] = useState([]);
    const [viewStartIndex, setViewStartIndex] = useState(0);
    const [isLogarithmic, setIsLogarithmic] = useState(false);
    const [hoveredCandle, setHoveredCandle] = useState(null);
    const [currentMouseY, setCurrentMouseY] = useState(null);
    const [activeTimestamp, setActiveTimestamp] = useState(null);

    // Dragging state
    const [isDragging, setIsDragging] = useState(false);

    // Configuration constants
    const MIN_DISPLAY_CANDLES = 20;     // Minimum candles when fully zoomed in
    const MAX_DISPLAY_CANDLES = 200;    // Maximum candles when fully zoomed out
    const MAX_HISTORY_CANDLES = 500;
    const DEFAULT_DISPLAY_CANDLES = 100;        // Default zoom level

    // Add zoom level state
    const [displayedCandles, setDisplayedCandles] = useState(100); // Default zoom level

    // Reset crosshair when mouse moves quickly out of the chart
    useEffect(() => {
        const handleGlobalMouseMove = (event) => {
            if (chartRef.current && (hoveredCandle || currentMouseY !== null)) {
                // Check if mouse is still over the chart
                const chartRect = chartRef.current.getBoundingClientRect();
                const isMouseOverChart =
                    event.clientX >= chartRect.left &&
                    event.clientX <= chartRect.right &&
                    event.clientY >= chartRect.top &&
                    event.clientY <= chartRect.bottom;

                // If mouse is not over chart but we still have an active crosshair, clear it
                // Don't clear if we're dragging (user might drag outside the chart)
                if (!isMouseOverChart && !isDragging) {
                    setHoveredCandle(null);
                    setCurrentMouseY(null);
                    setActiveTimestamp(null);
                }
            }
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [hoveredCandle, currentMouseY, chartRef, isDragging]);

    // Update visible data when viewStartIndex changes or historical buffer changes
    useEffect(() => {
        if (historicalBuffer.length > 0) {
            // Ensure we don't go out of bounds
            const safeStartIndex = Math.max(
                0,
                Math.min(viewStartIndex, historicalBuffer.length - displayedCandles)
            );

            // Create a window of data to display
            const visibleData = historicalBuffer.slice(
                safeStartIndex,
                safeStartIndex + displayedCandles
            );

            setData(visibleData);
        }
    }, [historicalBuffer, viewStartIndex, displayedCandles]);

    // Update data with new candles periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (historicalBuffer.length > 0) {
                const newCandle = generateNewCandle(historicalBuffer[historicalBuffer.length - 1]);

                setHistoricalBuffer(prevBuffer => {
                    // Add new candle and maintain max history size
                    const newBuffer = [...prevBuffer, newCandle].slice(-MAX_HISTORY_CANDLES);
                    return newBuffer;
                });

                // Auto-advance view only if we're already at the most recent data
                // and not actively dragging
                if (!isDragging) {
                    setViewStartIndex(prevIndex => {
                        const isAtEnd = prevIndex + displayedCandles >= historicalBuffer.length;
                        if (isAtEnd) {
                            // Move forward to keep showing most recent data
                            return Math.max(0, (historicalBuffer.length + 1) - displayedCandles);
                        }
                        return prevIndex;
                    });
                }
            }
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, [historicalBuffer, isDragging, displayedCandles]);

    // Initialize with mock data
    useEffect(() => {
        const initialData = generateMockCandleData(MAX_DISPLAY_CANDLES);
        setHistoricalBuffer(initialData);
        setViewStartIndex(0);
    }, []);

    return {
        data,
        historicalBuffer,
        viewStartIndex,
        setViewStartIndex,
        isDragging,
        setIsDragging,
        isLogarithmic,
        setIsLogarithmic,
        hoveredCandle,
        setHoveredCandle,
        currentMouseY,
        setCurrentMouseY,
        activeTimestamp,
        setActiveTimestamp,
        displayedCandles,
        setDisplayedCandles,
        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES,
        DEFAULT_DISPLAY_CANDLES
    };
}
