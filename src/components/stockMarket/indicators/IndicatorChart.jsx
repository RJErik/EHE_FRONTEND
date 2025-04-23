// src/components/stockMarket/indicators/IndicatorChart.jsx
import { useEffect, useRef, useContext, useState } from "react";
import { renderIndicatorChart } from "./renderIndicatorChart.js";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorChart = ({ indicator }) => {
    const chartRef = useRef(null);
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);
    // Add mouseX state to track horizontal position for hover recalculation
    const [mouseX, setMouseX] = useState(null);
    // Add refs for tracking drag state
    const dragStartXRef = useRef(null);
    const dragStartViewIndexRef = useRef(null);

    const {
        candleData,
        viewStartIndex,
        setViewStartIndex,
        displayedCandles,
        setDisplayedCandles,
        isDragging,
        setIsDragging,
        setActiveTimestamp,
        currentMouseY,
        setCurrentMouseY,
        hoveredIndex,
        setHoveredIndex,
        historicalBuffer,
        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES
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

    // NEW: Effect to recalculate hover index when displayed candles change (zoom)
    useEffect(() => {
        // Skip if dragging, no data, not hovering or no valid mouse position
        if (isDragging || !candleData || !candleData.length || !isMouseOverChart || mouseX === null || !chartRef.current) {
            return;
        }

        // Calculate which candle is under the mouse after zoom
        const chartRect = chartRef.current.getBoundingClientRect();
        const marginLeft = 40;
        const marginRight = 40;
        const chartWidth = chartRect.width - marginLeft - marginRight;

        // Calculate what percentage across the chart the mouse is
        const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth));

        // Convert to an index based on current number of displayed candles
        const newHoveredIndex = Math.floor(mouseXRatio * displayedCandles);

        // Ensure index is within valid bounds
        if (newHoveredIndex >= 0 && newHoveredIndex < candleData.length) {
            // Update hover state
            setHoveredIndex(newHoveredIndex);

            // Set active timestamp from the corresponding candle
            if (candleData[newHoveredIndex]) {
                setActiveTimestamp(candleData[newHoveredIndex].timestamp);
            }
        }
    }, [displayedCandles, candleData, isDragging, isMouseOverChart, mouseX, setHoveredIndex, setActiveTimestamp]);

    // Setup dragging events for the indicator chart
    useEffect(() => {
        const getCandleWidth = () => {
            if (chartRef.current && displayedCandles > 0) {
                const chartWidth = chartRef.current.clientWidth;
                // Use the actual chart drawing area width
                const drawingWidth = chartWidth - 80; // Adjust for margins (40 left + 40 right)
                return drawingWidth / displayedCandles;
            }
            return 10; // Fallback width
        };

        const handleMouseDown = (e) => {
            if (e.button === 0) { // Only left mouse button
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 40, marginRight = 40, marginTop = 5, marginBottom = 5;

                const isInChartArea =
                    e.clientX >= chartRect.left + marginLeft &&
                    e.clientX <= chartRect.right - marginRight &&
                    e.clientY >= chartRect.top + marginTop &&
                    e.clientY <= chartRect.bottom - marginBottom;

                if (isInChartArea) {
                    setIsDragging(true);
                    dragStartXRef.current = e.clientX;
                    dragStartViewIndexRef.current = viewStartIndex;
                    if (chartRef.current) {
                        chartRef.current.style.cursor = 'grabbing';
                    }
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = (e) => {
            // Handle dragging logic
            if (isDragging && dragStartXRef.current !== null && dragStartViewIndexRef.current !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartXRef.current;
                const candleWidth = getCandleWidth();

                if (candleWidth > 0) {
                    // Calculate the total number of candles to shift based on total drag distance
                    const totalCandlesToShift = deltaX / candleWidth;

                    // Calculate the target new index based on the index when drag started
                    const targetViewStartIndex = dragStartViewIndexRef.current - totalCandlesToShift;

                    // Apply bounds and rounding
                    const newIndex = Math.round(targetViewStartIndex);
                    const boundedIndex = Math.max(
                        0,
                        Math.min(newIndex, historicalBuffer.length - displayedCandles)
                    );

                    // Update state only if the index actually changes to avoid unnecessary re-renders
                    if (boundedIndex !== viewStartIndex) {
                        setViewStartIndex(boundedIndex);
                    }
                }
            }

            // Update hover state if not dragging
            if (chartRef.current && isMouseOverChart && !isDragging) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 40;
                const marginTop = 5;
                const relativeX = e.clientX - chartRect.left - marginLeft;
                const relativeY = e.clientY - chartRect.top - marginTop;

                // Store both X and Y positions
                setMouseX(relativeX); // Update X for hover recalculation
                setCurrentMouseY(relativeY); // Update Y for crosshair
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                dragStartViewIndexRef.current = null;

                // Update cursor based on whether the mouse is still over the chart
                if (chartRef.current) {
                    chartRef.current.style.cursor = isMouseOverChart ? 'crosshair' : 'default';
                }
            }
        };

        const handleWheel = (e) => {
            e.preventDefault(); // Prevent page scrolling

            const isZoomIn = e.deltaY < 0;
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 40;
            const marginRight = 40;
            const chartWidth = chartRect.width - marginLeft - marginRight;

            const mouseX = e.clientX - chartRect.left - marginLeft;
            const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth)); // Clamp ratio [0, 1]

            // Store mouse X position before zoom
            setMouseX(mouseX);

            const candleIndexUnderMouse = Math.floor(mouseXRatio * displayedCandles);
            const absoluteIndexUnderMouse = viewStartIndex + candleIndexUnderMouse;

            const ZOOM_STEP = 5;
            const newDisplayedCandles = isZoomIn
                ? Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP)
                : Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);

            // If the number of candles didn't change, do nothing
            if (newDisplayedCandles === displayedCandles) return;

            // Calculate the new index ratio under the mouse for the new zoom level
            const newCandleIndexUnderMouse = Math.floor(mouseXRatio * newDisplayedCandles);
            let newViewStartIndex = absoluteIndexUnderMouse - newCandleIndexUnderMouse;

            // Adjust start index to stay within bounds
            newViewStartIndex = Math.max(
                0,
                Math.min(newViewStartIndex, historicalBuffer.length - newDisplayedCandles)
            );

            setDisplayedCandles(newDisplayedCandles);
            setViewStartIndex(newViewStartIndex);
        };

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

                // When entering chart, set initial mouse positions
                const relativeX = e.clientX - chartRect.left - marginLeft;
                setMouseX(relativeX);

                if (chartRef.current) {
                    chartRef.current.style.cursor = isDragging ? 'grabbing' : 'crosshair';
                }
            }
        };

        const handleMouseLeave = (e) => {
            if (chartRef.current && !chartRef.current.contains(e.relatedTarget)) {
                setIsMouseOverChart(false);
                if (isDragging) {
                    // If dragging stops because mouse left, treat it like mouse up
                    setIsDragging(false);
                    dragStartXRef.current = null;
                    dragStartViewIndexRef.current = null;
                }
                // Clear crosshair state
                setCurrentMouseY(null);
                setHoveredIndex(null);
                setMouseX(null); // Also clear mouseX
            }
        };

        const handleWheelEvent = (e) => {
            if (!chartRef.current) return;
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 40, marginRight = 40, marginTop = 5, marginBottom = 5;
            const relativeX = e.clientX - chartRect.left;
            const relativeY = e.clientY - chartRect.top;
            const isInChartArea =
                relativeX >= marginLeft &&
                relativeX <= (chartRect.width - marginRight) &&
                relativeY >= marginTop &&
                relativeY <= (chartRect.height - marginBottom);

            if (isInChartArea) {
                // Store the mouse X position before zoom
                const xRelative = relativeX - marginLeft;
                setMouseX(xRelative);

                handleWheel(e); // Call the zoom handler
            }
        };

        // Global mouse move listener to catch mouse leaving the chart area *while not dragging*
        const handleGlobalMouseMoveForLeave = (e) => {
            if (chartRef.current && !isDragging && isMouseOverChart) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 40, marginRight = 40, marginTop = 5, marginBottom = 5;
                const isStillOverChartArea =
                    e.clientX >= chartRect.left + marginLeft &&
                    e.clientX <= chartRect.right - marginRight &&
                    e.clientY >= chartRect.top + marginTop &&
                    e.clientY <= chartRect.bottom - marginBottom;

                if (!isStillOverChartArea) {
                    setIsMouseOverChart(false);
                    setCurrentMouseY(null);
                    setHoveredIndex(null);
                    setMouseX(null); // Also clear mouseX
                }
            }
        };

        // Attach event listeners
        const chartElement = chartRef.current;
        if (chartElement) {
            chartElement.addEventListener('mousedown', handleMouseDown);
            chartElement.addEventListener('wheel', handleWheelEvent, { passive: false });
            chartElement.addEventListener('mouseenter', handleMouseEnter);
            chartElement.addEventListener('mouseleave', handleMouseLeave);
        }
        // Use document listeners for move/up to capture events outside the chart element during drag
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleGlobalMouseMoveForLeave); // Separate listener for leave detection

        // Cleanup
        return () => {
            if (chartElement) {
                chartElement.removeEventListener('mousedown', handleMouseDown);
                chartElement.removeEventListener('wheel', handleWheelEvent);
                chartElement.removeEventListener('mouseenter', handleMouseEnter);
                chartElement.removeEventListener('mouseleave', handleMouseLeave);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleGlobalMouseMoveForLeave);
        };
    }, [
        isDragging, setIsDragging, viewStartIndex, setViewStartIndex, historicalBuffer?.length,
        displayedCandles, setDisplayedCandles,
        setCurrentMouseY, isMouseOverChart, setMouseX, // Added setMouseX
        setHoveredIndex, setActiveTimestamp, // Added setActiveTimestamp
        MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES
    ]);

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
        <div
            ref={chartRef}
            className="w-full h-full"
            style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
        ></div>
    );
};

export default IndicatorChart;
