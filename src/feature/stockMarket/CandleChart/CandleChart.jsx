// src/components/stockMarket/CandleChart.jsx
import {useCallback, useContext, useEffect, useRef, useState} from "react";
import {Card, CardContent} from "../../../components/ui/card.jsx";
import CandleInfoPanel from "./CandleInfoPanel.jsx";
import MainIndicatorInfoPanel from "../indicators/MainIndicatorInfoPanel.jsx";
import {renderCandleChart} from "./renderCandleChart.js";
import {ChartContext} from "../ChartContext.jsx";
import {useIndicators} from "../indicators/useIndicators.js";

// Shared constants and helpers
const CHART_MARGINS = { left: 60, right: 60, top: 20, bottom: 40 };

const getChartMetrics = (el) => {
    const rect = el.getBoundingClientRect();
    const innerWidth = rect.width - CHART_MARGINS.left - CHART_MARGINS.right;
    const innerHeight = rect.height - CHART_MARGINS.top - CHART_MARGINS.bottom;
    return { rect, innerWidth, innerHeight };
};

const getRelativePosition = (e, rect) => ({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
});

const isInChartArea = ({ x, y }, rect) => (
    x >= CHART_MARGINS.left &&
    x <= (rect.width - CHART_MARGINS.right) &&
    y >= CHART_MARGINS.top &&
    y <= (rect.height - CHART_MARGINS.bottom)
);

const CandleChart = () => {
    const chartRef = useRef(null);
    const dragStartXRef = useRef(null);
    const dragStartViewIndexRef = useRef(null); // Store viewStartIndex at drag start
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);

    // Add mouseX state to track horizontal position for hover recalculation
    const [, setMouseX] = useState(null);

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

    // Helper function to update hovered candle based on timestamp
    const updateHoveredCandleByTimestamp = useCallback((timestamp) => {
        if (!data || !timestamp) return false;

        const newHoveredIndex = data.findIndex(candle => candle.timestamp === timestamp);
        if (newHoveredIndex >= 0) {
            setHoveredIndex(newHoveredIndex);
            setHoveredCandle(data[newHoveredIndex]);
            return true;
        }
        return false;
    }, [data, setHoveredIndex, setHoveredCandle]);

    // D3 chart rendering
    useEffect(() => {
        const el = chartRef.current;
        if (!data || !Array.isArray(data) || data.length === 0 || !el) return;

        // Check if this is a buffer update - if buffer size changed but we still have data
        const possibleBufferUpdate = displayCandles.length > data.length + displayedCandles;
        
        if (possibleBufferUpdate) {
            console.log("[CandleChart] Detected possible buffer update - maintaining view position");
        }

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
            isMouseOverChart, // Added this parameter
            isBufferUpdate: possibleBufferUpdate // Indicate this may be a buffer update
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
                isMouseOverChart, // Also pass mouse over state
                isBufferUpdate: true // Always preserve position on resize
            });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            // Optional: Clear SVG on unmount or when dependencies change significantly
            if (el) {
                const svg = el.querySelector('svg');
                if (svg) {
                    svg.remove();
                }
            }
        };
    }, [data, isLogarithmic, currentMouseY, activeTimestamp, isDragging, displayedCandles, mainIndicators, hoveredIndex, viewStartIndex, isMouseOverChart, displayCandles.length]);

    // Backup mechanism: Effect to recalculate hover based on timestamp when displayed candles change
    useEffect(() => {
        // Skip if dragging, no data, not hovering or no active timestamp
        if (isDragging || !data?.length || !isMouseOverChart || !activeTimestamp) {
            return;
        }

        updateHoveredCandleByTimestamp(activeTimestamp);
    }, [displayedCandles, viewStartIndex, data?.length, isDragging, isMouseOverChart, activeTimestamp, updateHoveredCandleByTimestamp]);

    // Helper to apply centered zoom and preserve hover by timestamp
    const applyCenteredZoom = useCallback((newDisplayed, timestampToTrack) => {
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayed / 2);

        setDisplayedCandles(newDisplayed);
        setViewStartIndex(Math.max(0, Math.min(newViewStartIndex, Math.max(0, displayCandles.length - newDisplayed))));

        if (timestampToTrack) {
            updateHoveredCandleByTimestamp(timestampToTrack);
        }
    }, [viewStartIndex, displayedCandles, displayCandles.length, setDisplayedCandles, setViewStartIndex, updateHoveredCandleByTimestamp]);

    // Zoom control handlers with immediate timestamp tracking
    const handleZoomIn = () => {
        if (!data?.length) return;

        // Store the current timestamp to maintain after zoom
        const timestampToTrack = activeTimestamp;

        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP);
        applyCenteredZoom(newDisplayedCandles, timestampToTrack);
    };

    const handleZoomOut = () => {
        if (!data?.length) return;

        // Store the current timestamp to maintain after zoom
        const timestampToTrack = activeTimestamp;

        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);
        applyCenteredZoom(newDisplayedCandles, timestampToTrack);
    };

    const handleResetZoom = () => {
        if (!data?.length) return;

        // Store the current timestamp to maintain after zoom
        applyCenteredZoom(DEFAULT_DISPLAY_CANDLES, activeTimestamp);
    };

    // Handle zoom functionality with immediate timestamp tracking
    const handleWheel = useCallback((e) => {
        e.preventDefault(); // Prevent page scrolling
        if (!data?.length) return;

        // Store the current timestamp to maintain after zoom
        const timestampToTrack = activeTimestamp;

        const isZoomIn = e.deltaY < 0;
        const el = chartRef.current;
        if (!el) return;
        const { rect, innerWidth } = getChartMetrics(el);
        const rel = getRelativePosition(e, rect);
        const mouseXInner = rel.x - CHART_MARGINS.left;
        const mouseXRatio = Math.max(0, Math.min(1, mouseXInner / innerWidth)); // Clamp ratio [0, 1]

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

        // Update zoom state
        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(newViewStartIndex);

        // Immediately update hover position based on timestamp
        if (timestampToTrack) {
            updateHoveredCandleByTimestamp(timestampToTrack);
        }
    }, [data?.length, activeTimestamp, displayedCandles, viewStartIndex, MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES, displayCandles.length, updateHoveredCandleByTimestamp]);

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
                const el = chartRef.current;
                if (!el) return;
                const { rect } = getChartMetrics(el);
                const rel = getRelativePosition(e, rect);
                const inside = isInChartArea(rel, rect);

                if (inside) {
                    setIsDragging(true);
                    dragStartXRef.current = e.clientX;
                    dragStartViewIndexRef.current = viewStartIndex; // *** Store the starting index ***
                    if (chartRef.current) chartRef.current.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = (e) => {
            // Update X & Y positions for crosshair if mouse is over the chart AND not dragging
            if (chartRef.current && isMouseOverChart && !isDragging) {
                const el = chartRef.current;
                const { rect } = getChartMetrics(el);
                const rel = getRelativePosition(e, rect);
                const inside = isInChartArea(rel, rect);
                if (inside) {
                    const xRelative = rel.x - CHART_MARGINS.left;
                    const yRelative = rel.y - CHART_MARGINS.top;
                    setMouseX(xRelative);
                    setCurrentMouseY(yRelative);
                }
            }

            // Handle dragging logic
            if (isDragging && dragStartXRef.current !== null && dragStartViewIndexRef.current !== null) {
                // Store current timestamp before drag update
                const timestampToTrack = activeTimestamp;

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

                        // Immediately update hover position based on timestamp while dragging
                        if (timestampToTrack) {
                            updateHoveredCandleByTimestamp(timestampToTrack);
                        }
                    }
                }
                // *** DO NOT reset dragStartXRef.current here ***
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging) {
                // Store timestamp before ending drag
                const timestampToTrack = activeTimestamp;

                setIsDragging(false);
                dragStartXRef.current = null;
                dragStartViewIndexRef.current = null; // *** Clear the starting index ***

                if (chartRef.current) {
                    const el = chartRef.current;
                    const { rect } = getChartMetrics(el);
                    const rel = getRelativePosition(e, rect);
                    const inside = isInChartArea(rel, rect);

                    setIsMouseOverChart(inside);

                    if (!inside) {
                        setHoveredCandle(null);
                        setCurrentMouseY(null);
                        setActiveTimestamp(null);
                        setHoveredIndex(null);
                        setMouseX(null);
                    } else {
                        const xRelative = rel.x - CHART_MARGINS.left;
                        const yRelative = rel.y - CHART_MARGINS.top;
                        setMouseX(xRelative);
                        setCurrentMouseY(yRelative);

                        if (timestampToTrack) {
                            updateHoveredCandleByTimestamp(timestampToTrack);
                        }
                    }
                }
            }
        };

        // --- Mouse Enter/Leave/Wheel Logic --- (Mostly unchanged, added bounds checks)
        const handleMouseEnter = (e) => {
            const el = chartRef.current;
            if (!el) return;
            const { rect } = getChartMetrics(el);
            const rel = getRelativePosition(e, rect);
            const inside = isInChartArea(rel, rect);

            if (inside) {
                setIsMouseOverChart(true);
                const xRelative = rel.x - CHART_MARGINS.left;
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
            const el = chartRef.current;
            const { rect } = getChartMetrics(el);
            const rel = getRelativePosition(e, rect);
            const inside = isInChartArea(rel, rect);

            if (inside) {
                const xRelative = rel.x - CHART_MARGINS.left;
                setMouseX(xRelative);
                handleWheel(e);
            }
        };

        // Global mouse move listener to catch mouse leaving the chart area *while not dragging*
        // This helps clear the crosshair if the mouse moves out quickly.
        const handleGlobalMouseMoveForLeave = (e) => {
            if (chartRef.current && !isDragging && isMouseOverChart) {
                const el = chartRef.current;
                const { rect } = getChartMetrics(el);
                const rel = getRelativePosition(e, rect);
                const inside = isInChartArea(rel, rect);

                if (!inside) {
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
        // Include state used within the effect and its handlers
        isDragging, viewStartIndex, displayCandles.length,
        displayedCandles, // zoom/reset
        isMouseOverChart, // tracking X position and hover state
        MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES, // constants
        activeTimestamp, data?.length, handleWheel, updateHoveredCandleByTimestamp
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
