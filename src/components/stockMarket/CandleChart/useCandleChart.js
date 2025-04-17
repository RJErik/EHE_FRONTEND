import { useEffect, useState } from 'react';
import { generateMockCandleData, generateNewCandle } from '../../../utils/mockDataGenerator.js';

export function useCandleChart(chartRef) {
    const [data, setData] = useState([]);
    const [isLogarithmic, setIsLogarithmic] = useState(false);
    const [hoveredCandle, setHoveredCandle] = useState(null);
    const [currentMouseY, setCurrentMouseY] = useState(null);
    const [activeTimestamp, setActiveTimestamp] = useState(null);

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
                if (!isMouseOverChart) {
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
    }, [hoveredCandle, currentMouseY, chartRef]);

    // Update data with new candles periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (data.length > 0) {
                const newCandle = generateNewCandle(data[data.length - 1]);
                setData(prevData => [...prevData.slice(-99), newCandle]);
            }
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, [data]);

    // Initialize with mock data
    useEffect(() => {
        setData(generateMockCandleData(100));
    }, []);

    return {
        data,
        isLogarithmic,
        setIsLogarithmic,
        hoveredCandle,
        setHoveredCandle,
        currentMouseY,
        setCurrentMouseY,
        activeTimestamp,
        setActiveTimestamp
    };
}
