// src/components/stockMarket/CandleChart.jsx
import { useEffect, useRef, useContext, useState } from "react";
import { Card, CardContent } from "../../ui/card.jsx";
import CandleInfoPanel from "./CandleInfoPanel.jsx";
import MainIndicatorInfoPanel from "../indicators/MainIndicatorInfoPanel.jsx";
import { renderCandleChart } from "./renderCandleChart.js";
import { ChartContext } from "../ChartContext.jsx";
import { useIndicators } from "../indicators/useIndicators.js";

const CandleChart = () => {
    const chartRef = useRef(null);
    const dragStartXRef = useRef(null);
    const dragStartViewIndexRef = useRef(null); // Store viewStartIndex at drag start
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);

    // Add mouseX state to track horizontal position for hover recalculation
    const [mouseX, setMouseX] = useState(null);

    // Use the shared chart context instead of local state
    const {
        candleData: data,
        displayCandles, // Fix: Changed from historicalBuffer to displayCandles
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
        hoveredIndex,
        setHoveredIndex,
        isDataGenerationEnabled = false, // Provide default
        setIsDataGenerationEnabled = () => {} // Provide default no-op function
    } = useContext(ChartContext) || {}; // Add fallback empty object

    useEffect(() => {
        if (!data) return; // Guard against undefined data
        
        console.log("[CandleChart] Received updated data - Length:", data.length,
            "ViewIndex:", viewStartIndex,
            "DisplayedCandles:", displayedCandles,
            "Buffer Length:", displayCandles?.length || 0,
            "First Candle:", data[0]?.timestamp,
            "Last Candle:", data[data.length-1]?.timestamp);
    }, [data, viewStartIndex, displayedCandles, displayCandles?.length]);

    const DEFAULT_DISPLAY_CANDLES = 100; // Define constant here for reset function

    // Get main indicators that should be displayed on the candle chart
    const { indicators } = useIndicators();
    const mainIndicators = indicators?.filter(ind => ind.category === "main") || [];

    // D3 chart rendering
    useEffect(() => {
        if (!data || !Array.isArray(data) || data.length === 0 || !chartRef.current) return;

        // Before rendering - LOG 10
        //console.log("[Chart Render] Starting render with - Candles:", data.length,
            //"First Candle:", data[0]?.timestamp,
            //"Last Candle:", data[data.length-1]?.timestamp);

        renderCandleChart({
            chartRef,
            data,
            isLogarithmic,
            isDragging,
            setHoveredCandle,
            setCurrentMouseY,
            setActiveTimestamp,
            activeTimestamp,
            currentMouseY,
            displayedCandles,
            mainIndicators: mainIndicators || [], // Ensure array even if undefined
            hoveredIndex,
            setHoveredIndex,
            viewStartIndex, // Pass the current viewStartIndex
            isMouseOverChart // Added this parameter
        });

        // Add window resize handler
        const handleResize = () => {
            if (!data || !Array.isArray(data) || data.length === 0) return;
            
            // Re-render on resize
            renderCandleChart({
                chartRef,
                data,
                isLogarithmic,
                isDragging,
                setHoveredCandle,
                setCurrentMouseY,
                setActiveTimestamp,
                activeTimestamp,
                currentMouseY,
                displayedCandles,
                mainIndicators: mainIndicators || [],
                hoveredIndex,
                setHoveredIndex,
                viewStartIndex, // Pass the current viewStartIndex
                isMouseOverChart // Also pass mouse over state
            });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            // Optional: Clear SVG on unmount or when dependencies change significantly
            if (chartRef.current) {
                const svg = chartRef.current.querySelector('svg');
                if (svg) {
                    svg.remove();
                }
            }
        };
        // Ensure all dependencies that affect rendering are included
    }, [
        data, isLogarithmic, currentMouseY, activeTimestamp, isDragging,
        displayedCandles, mainIndicators, hoveredIndex, viewStartIndex,
        setHoveredCandle, setCurrentMouseY, setActiveTimestamp, setHoveredIndex
    ]);

    // NEW: Effect to recalculate hover index when displayed candles change (zoom)
    useEffect(() => {
        // Skip if dragging, no data, not hovering or no valid mouse position
        if (isDragging || !data.length || !isMouseOverChart || mouseX === null || !chartRef.current) {
            return;
        }

        // Calculate which candle is under the mouse after zoom
        const chartRect = chartRef.current.getBoundingClientRect();
        const marginLeft = 60;
        const marginRight = 60;
        const chartWidth = chartRect.width - marginLeft - marginRight;

        // Calculate what percentage across the chart the mouse is
        const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth));

        // Convert to an index based on current number of displayed candles
        const newHoveredIndex = Math.floor(mouseXRatio * displayedCandles);

        // Ensure index is within valid bounds
        if (newHoveredIndex >= 0 && newHoveredIndex < data.length) {
            // Update hover state
            setHoveredIndex(newHoveredIndex);
            setHoveredCandle(data[newHoveredIndex]);
            setActiveTimestamp(data[newHoveredIndex].timestamp);

            // No need to update currentMouseY as that's handled by mouse move
        }
    }, [displayedCandles, data, isDragging, isMouseOverChart, mouseX, setHoveredIndex, setHoveredCandle, setActiveTimestamp]);

    // Zoom control handlers (No changes needed here)
    const handleZoomIn = () => {
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP);

        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, displayCandles.length - newDisplayedCandles)
        ));
    };

    const handleZoomOut = () => {
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);

        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, displayCandles.length - newDisplayedCandles)
        ));
    };

    const handleResetZoom = () => {
        const newDisplayedCandles = DEFAULT_DISPLAY_CANDLES;
        // Recenter based on the *current* middle, then apply default zoom
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            // Ensure the reset index is valid with the new candle count
            Math.min(newViewStartIndex, displayCandles.length - newDisplayedCandles)
        ));
    };

    // Handle zoom functionality (No changes needed here)
    const handleWheel = (e) => {
        e.preventDefault(); // Prevent page scrolling

        const isZoomIn = e.deltaY < 0;
        const chartRect = chartRef.current.getBoundingClientRect();
        const marginLeft = 60;
        const marginRight = 60;
        const chartWidth = chartRect.width - marginLeft - marginRight;

        const mouseX = e.clientX - chartRect.left - marginLeft;
        const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth)); // Clamp ratio [0, 1]

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
            Math.min(newViewStartIndex, displayCandles.length - newDisplayedCandles)
        );

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(newViewStartIndex);
    };

    // Setup dragging events
    useEffect(() => {
        const getCandleWidth = () => {
            if (chartRef.current && displayedCandles > 0) {
                const chartWidth = chartRef.current.clientWidth;
                // Use the actual chart drawing area width
                const drawingWidth = chartWidth - 120; // Adjust for margins (60 left + 60 right)
                return drawingWidth / displayedCandles;
            }
            return 10; // Fallback width
        };

        const handleMouseDown = (e) => {
            if (e.button === 0) { // Only left mouse button
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;

                const isInChartArea =
                    e.clientX >= chartRect.left + marginLeft &&
                    e.clientX <= chartRect.right - marginRight &&
                    e.clientY >= chartRect.top + marginTop &&
                    e.clientY <= chartRect.bottom - marginBottom;

                if (isInChartArea) {
                    setIsDragging(true);
                    dragStartXRef.current = e.clientX;
                    dragStartViewIndexRef.current = viewStartIndex; // *** Store the starting index ***
                    if (chartRef.current) {
                        chartRef.current.style.cursor = 'grabbing';
                    }
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = (e) => {
            // Update X & Y positions for crosshair if mouse is over the chart AND not dragging
            if (chartRef.current && isMouseOverChart && !isDragging) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;
                const relativeX = e.clientX - chartRect.left;
                const relativeY = e.clientY - chartRect.top;

                const isInChartArea =
                    relativeX >= marginLeft &&
                    relativeX <= (chartRect.width - marginRight) &&
                    relativeY >= marginTop &&
                    relativeY <= (chartRect.height - marginBottom);

                if (isInChartArea) {
                    // Store both X and Y positions now
                    const xRelative = relativeX - marginLeft;
                    const yRelative = relativeY - marginTop;
                    setMouseX(xRelative); // Update X for hover recalculation
                    setCurrentMouseY(yRelative); // Update Y for crosshair
                }
            }

            // Handle dragging logic
            if (isDragging && dragStartXRef.current !== null && dragStartViewIndexRef.current !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartXRef.current; // Total pixel distance dragged
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
                        Math.min(newIndex, displayCandles.length - displayedCandles)
                    );

                    // Update state only if the index actually changes to avoid unnecessary re-renders
                    if (boundedIndex !== viewStartIndex) {
                        setViewStartIndex(boundedIndex);
                    }
                }
                // *** DO NOT reset dragStartXRef.current here ***
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                dragStartViewIndexRef.current = null; // *** Clear the starting index ***

                // Update cursor based on whether the mouse is still over the chart
                if (chartRef.current) {
                    const chartRect = chartRef.current.getBoundingClientRect();
                    const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;
                    const relativeX = e.clientX - chartRect.left;
                    const relativeY = e.clientY - chartRect.top;
                    const isInChartArea =
                        relativeX >= marginLeft &&
                        relativeX <= (chartRect.width - marginRight) &&
                        relativeY >= marginTop &&
                        relativeY <= (chartRect.height - marginBottom);

                    setIsMouseOverChart(isInChartArea); // Update mouse over state on mouse up

                    if (!isInChartArea) {
                        // If mouse released outside, clear hover state
                        setHoveredCandle(null);
                        setCurrentMouseY(null);
                        setActiveTimestamp(null);
                        setHoveredIndex(null);
                        setMouseX(null); // Also clear mouseX
                    } else {
                        // Ensure X & Y positions are updated on release if still inside
                        const xRelative = relativeX - marginLeft;
                        const yRelative = relativeY - marginTop;
                        setMouseX(xRelative);
                        setCurrentMouseY(yRelative);
                    }
                }
            }
        };

        // --- Mouse Enter/Leave/Wheel Logic --- (Mostly unchanged, added bounds checks)
        const handleMouseEnter = (e) => {
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;
            const relativeX = e.clientX - chartRect.left;
            const relativeY = e.clientY - chartRect.top;
            const isInChartArea =
                relativeX >= marginLeft &&
                relativeX <= (chartRect.width - marginRight) &&
                relativeY >= marginTop &&
                relativeY <= (chartRect.height - marginBottom);

            if (isInChartArea) {
                setIsMouseOverChart(true);

                // When entering chart, set initial mouse X position
                const xRelative = relativeX - marginLeft;
                setMouseX(xRelative);
            }
        };

        const handleMouseLeave = (e) => {
            // Check if the mouse is truly leaving the chart element boundary
            if (chartRef.current && !chartRef.current.contains(e.relatedTarget)) {
                setIsMouseOverChart(false);
                if (isDragging) {
                    // If dragging stops because mouse left, treat it like mouse up
                    setIsDragging(false);
                    dragStartXRef.current = null;
                    dragStartViewIndexRef.current = null; // Clear start index
                }
                // Clear crosshair state
                setHoveredCandle(null);
                setCurrentMouseY(null);
                setActiveTimestamp(null);
                setHoveredIndex(null);
                setMouseX(null); // Also clear mouseX
            }
        };

        const handleWheelEvent = (e) => {
            if (!chartRef.current) return;
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;
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

                // Call the zoom handler
                handleWheel(e);
            }
        };

        // Global mouse move listener to catch mouse leaving the chart area *while not dragging*
        // This helps clear the crosshair if the mouse moves out quickly.
        const handleGlobalMouseMoveForLeave = (e) => {
            if (chartRef.current && !isDragging && isMouseOverChart) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 60, marginRight = 60, marginTop = 20, marginBottom = 40;
                const isStillOverChartArea =
                    e.clientX >= chartRect.left + marginLeft &&
                    e.clientX <= chartRect.right - marginRight &&
                    e.clientY >= chartRect.top + marginTop &&
                    e.clientY <= chartRect.bottom - marginBottom;

                if (!isStillOverChartArea) {
                    setIsMouseOverChart(false);
                    setHoveredCandle(null);
                    setCurrentMouseY(null);
                    setActiveTimestamp(null);
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
        // Include all state and props used within the effect and its handlers
        isDragging, setIsDragging, viewStartIndex, setViewStartIndex, displayCandles.length,
        displayedCandles, setDisplayedCandles, // Added setDisplayedCandles for zoom/reset
        setCurrentMouseY, isMouseOverChart, setMouseX, // Added setMouseX for tracking X position
        setHoveredCandle, setActiveTimestamp, setHoveredIndex, // Other state setters
        MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES // Constants used in handlers
    ]);

    // Calculate zoom percentage for display
    const zoomPercentage = Math.round(
        ((MAX_DISPLAY_CANDLES - displayedCandles) /
            (MAX_DISPLAY_CANDLES - MIN_DISPLAY_CANDLES)) * 100
    );

    return (
        <Card className="w-full h-80">
            <CardContent className="flex flex-col h-full p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col space-y-1">
                        {/* Pass hoveredCandle and mainIndicators/hoveredIndex */}
                        <CandleInfoPanel candle={hoveredCandle} />
                        <MainIndicatorInfoPanel indicators={mainIndicators} hoveredIndex={hoveredIndex} />
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        <div className="text-xs text-gray-500 mr-2 whitespace-nowrap">
                            Zoom: {zoomPercentage}%
                        </div>
                        <div className="flex space-x-1 mr-2">
                            <button
                                onClick={handleZoomIn}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                title="Zoom In"
                            >
                                +
                            </button>
                            <button
                                onClick={handleResetZoom}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                title="Reset Zoom"
                            >
                                ↺
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                title="Zoom Out"
                            >
                                -
                            </button>
                        </div>
                        <button
                            onClick={() => setIsLogarithmic(!isLogarithmic)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded mr-2 whitespace-nowrap hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            {isLogarithmic ? "Linear" : "Log"} Scale
                        </button>
                    </div>
                </div>
                <div
                    ref={chartRef}
                    className="flex-1 w-full overflow-hidden relative"
                    style={{
                        cursor: isDragging
                            ? 'grabbing'
                            : isMouseOverChart
                                ? 'crosshair'
                                : 'default'
                    }}
                >
                    {/* SVG will be appended here by D3 */}
                </div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
