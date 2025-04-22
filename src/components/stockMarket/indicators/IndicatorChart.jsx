// src/components/stockMarket/indicators/IndicatorChart.jsx
import { useEffect, useRef, useContext, useState } from "react";
import { renderIndicatorChart } from "./renderIndicatorChart.js";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorChart = ({ indicator }) => {
    const chartRef = useRef(null);
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);

    const {
        candleData, // Added this to extract values
        viewStartIndex,
        displayedCandles,
        setActiveTimestamp,
        isDragging,
        currentMouseY,
        setCurrentMouseY,
        hoveredIndex,
        setHoveredIndex
    } = useContext(ChartContext) || {};

    useEffect(() => {
        if (!chartRef.current || !candleData || candleData.length === 0) return;

        console.log(`[IndicatorChart] Rendering chart for indicator: ${indicator.name} (${indicator.id})`);

        // Extract indicator values from candleData
        const indicatorValues = extractIndicatorValues(candleData, indicator.id, indicator.type);

        console.log(`[IndicatorChart] Extracted values for ${indicator.name}:`, indicatorValues);

        // Only render if we have valid data
        if (!indicatorValues ||
            (Array.isArray(indicatorValues) && indicatorValues.every(v => v === null)) ||
            (typeof indicatorValues === 'object' && Object.keys(indicatorValues).length === 0)) {
            console.warn(`[IndicatorChart] No valid data for indicator: ${indicator.name}`);
            return;
        }

        // Render chart using D3
        const cleanup = renderIndicatorChart({
            chartRef,
            data: indicatorValues,
            indicator,
            isDragging,
            setActiveTimestamp,
            setCurrentMouseY,
            setHoveredIndex,
            hoveredIndex,
            currentMouseY,
            isMouseOverChart
        });

        return cleanup;
    }, [
        indicator,
        candleData,
        viewStartIndex,
        displayedCandles,
        isDragging,
        hoveredIndex,
        currentMouseY,
        isMouseOverChart
    ]);

    // Setup mouse tracking to handle the case where the mouse moves out of the chart quickly
    useEffect(() => {
        const handleMouseEnter = (e) => {
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 40;
            const marginRight = 40;
            const marginTop = 5;
            const marginBottom = 5;

            const isInChartArea =
                e.clientX >= chartRect.left + marginLeft &&
                e.clientX <= chartRect.right - marginRight &&
                e.clientY >= chartRect.top + marginTop &&
                e.clientY <= chartRect.bottom - marginBottom;

            if (isInChartArea) {
                setIsMouseOverChart(true);
            }
        };

        const handleMouseLeave = (e) => {
            // Check if mouse is truly leaving the chart element
            if (chartRef.current && !chartRef.current.contains(e.relatedTarget)) {
                setIsMouseOverChart(false);
            }
        };

        // Global mouse move to catch quick mouse movements
        const handleGlobalMouseMove = (e) => {
            if (chartRef.current && isMouseOverChart && !isDragging) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 40;
                const marginRight = 40;
                const marginTop = 5;
                const marginBottom = 5;

                const isStillInChartArea =
                    e.clientX >= chartRect.left + marginLeft &&
                    e.clientX <= chartRect.right - marginRight &&
                    e.clientY >= chartRect.top + marginTop &&
                    e.clientY <= chartRect.bottom - marginBottom;

                if (!isStillInChartArea) {
                    setIsMouseOverChart(false);
                }
            }
        };

        // Attach event listeners
        const chartElement = chartRef.current;
        if (chartElement) {
            chartElement.addEventListener('mouseenter', handleMouseEnter);
            chartElement.addEventListener('mouseleave', handleMouseLeave);
        }

        // Global listener for quick mouse movements
        document.addEventListener('mousemove', handleGlobalMouseMove);

        // Cleanup
        return () => {
            if (chartElement) {
                chartElement.removeEventListener('mouseenter', handleMouseEnter);
                chartElement.removeEventListener('mouseleave', handleMouseLeave);
            }
            document.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [isMouseOverChart, isDragging]);

    // Helper function to extract indicator values from candle data
    const extractIndicatorValues = (candles, indicatorId, indicatorType) => {
        // For simple indicators like SMA, EMA, RSI, ATR
        if (['sma', 'ema', 'rsi', 'atr'].includes(indicatorType)) {
            return candles.map(candle =>
                candle.indicatorValues && candle.indicatorValues[indicatorId]
            );
        }

        // For composite indicators like MACD, Bollinger Bands
        if (['macd', 'bb'].includes(indicatorType)) {
            // Initialize an empty result object
            const result = {};

            // Iterate through candles to extract all properties
            candles.forEach((candle, index) => {
                if (candle.indicatorValues && candle.indicatorValues[indicatorId]) {
                    const indicatorValue = candle.indicatorValues[indicatorId];

                    // For each property in the indicator value
                    Object.entries(indicatorValue).forEach(([key, value]) => {
                        // Initialize array if it doesn't exist
                        if (!result[key]) {
                            result[key] = new Array(candles.length).fill(null);
                        }
                        // Set the value for this candle
                        result[key][index] = value;
                    });
                }
            });

            return result;
        }

        // Default fallback
        return [];
    };

    return (
        <div ref={chartRef} className="w-full h-full" style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}></div>
    );
};

export default IndicatorChart;
