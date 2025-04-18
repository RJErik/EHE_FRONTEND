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
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);

    // Use the shared chart context instead of local state
    const {
        candleData: data,
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
        hoveredIndex,
        setHoveredIndex
    } = useContext(ChartContext);

    const DEFAULT_DISPLAY_CANDLES = 100; // Define constant here for reset function

    // Get main indicators that should be displayed on the candle chart
    const { indicators } = useIndicators();
    const mainIndicators = indicators?.filter(ind => ind.category === "main") || [];

    // D3 chart rendering
    useEffect(() => {
        if (!data || data.length === 0) return;

        const chartInfo = renderCandleChart({
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
            mainIndicators, // Pass main indicators for rendering
            hoveredIndex,
            setHoveredIndex
        });

        // Add window resize handler
        const handleResize = () => {
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
                mainIndicators,
                hoveredIndex,
                setHoveredIndex
            });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [data, isLogarithmic, currentMouseY, activeTimestamp, isDragging, displayedCandles, mainIndicators, hoveredIndex]);

    // Zoom control handlers
    const handleZoomIn = () => {
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP);

        // Center the zoom on the middle of the current view
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, historicalBuffer.length - newDisplayedCandles)
        ));
    };

    const handleZoomOut = () => {
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);

        // Center the zoom on the middle of the current view
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, historicalBuffer.length - newDisplayedCandles)
        ));
    };

    const handleResetZoom = () => {
        const newDisplayedCandles = DEFAULT_DISPLAY_CANDLES;

        // Center the zoom on the middle of the current view
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayedCandles / 2);

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, historicalBuffer.length - newDisplayedCandles)
        ));
    };

    // Handle zoom functionality
    const handleWheel = (e) => {
        e.preventDefault(); // Prevent page scrolling

        // Determine zoom direction
        const isZoomIn = e.deltaY < 0;

        // Calculate the candle index at mouse position
        const chartRect = chartRef.current.getBoundingClientRect();
        const mouseX = e.clientX - chartRect.left - 60; // Adjust for left margin
        const mouseXRatio = mouseX / (chartRect.width - 120); // Adjust for margins

        // Find which candle is under the cursor (clamping to valid range)
        const candleIndexAtMouse = Math.max(0, Math.min(
            Math.floor(mouseXRatio * data.length),
            data.length - 1
        ));

        const absoluteIndexAtMouse = viewStartIndex + candleIndexAtMouse;

        // Calculate new zoom level
        const ZOOM_STEP = 5; // How many candles to add/remove per zoom action
        const newDisplayedCandles = isZoomIn
            ? Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP)
            : Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);

        // Calculate new start index to keep the same candle under mouse cursor
        const newCandleIndexAtMouse = Math.floor(mouseXRatio * newDisplayedCandles);
        let newViewStartIndex = absoluteIndexAtMouse - newCandleIndexAtMouse;

        // Update state (bounded to valid ranges)
        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(Math.max(
            0,
            Math.min(newViewStartIndex, historicalBuffer.length - newDisplayedCandles)
        ));
    };

    // Setup dragging events
    useEffect(() => {
        const getCandleWidth = () => {
            // Calculate candle width based on current zoom level
            if (chartRef.current) {
                const chartWidth = chartRef.current.clientWidth - 120; // Adjust for margins
                return chartWidth / displayedCandles;
            }
            return 10;
        };

        const handleMouseDown = (e) => {
            // Only start drag with left mouse button
            if (e.button === 0) {
                setIsDragging(true);
                dragStartXRef.current = e.clientX;
                if (chartRef.current) {
                    chartRef.current.style.cursor = 'grabbing';
                }
                e.preventDefault(); // Prevent text selection
            }
        };

        const handleMouseMove = (e) => {
            // Always update Y position for crosshair, even during drag
            if (chartRef.current && isMouseOverChart) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const yRelative = e.clientY - chartRect.top - 20; // Adjust for top margin

                // Only update if mouse is within chart bounds
                if (yRelative >= 0 && yRelative <= chartRect.height - 60) { // Adjust for margins
                    setCurrentMouseY(yRelative);
                }
            }

            if (isDragging && dragStartXRef.current !== null) {
                const deltaX = e.clientX - dragStartXRef.current;
                const candleWidth = getCandleWidth();

                // Calculate candles to move (negative means show older data)
                const candlesToMove = Math.round(deltaX / candleWidth);

                if (candlesToMove !== 0) {
                    setViewStartIndex(prevIndex => {
                        // Calculate new index
                        const newIndex = prevIndex - candlesToMove;

                        // Bounds checking
                        return Math.max(
                            0,
                            Math.min(newIndex, historicalBuffer.length - displayedCandles)
                        );
                    });

                    // Reset drag start position for continuous dragging
                    dragStartXRef.current = e.clientX;
                }
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                if (chartRef.current) {
                    chartRef.current.style.cursor = 'crosshair';
                }

                // Ensure we have the current Y position at the exact spot we release
                if (chartRef.current && isMouseOverChart) {
                    const chartRect = chartRef.current.getBoundingClientRect();
                    const yRelative = e.clientY - chartRect.top - 20; // Adjust for top margin
                    if (yRelative >= 0 && yRelative <= chartRect.height - 60) {
                        setCurrentMouseY(yRelative);
                    }
                }
            }
        };

        const handleMouseEnter = () => {
            setIsMouseOverChart(true);
        };

        const handleMouseLeave = () => {
            setIsMouseOverChart(false);
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                if (chartRef.current) {
                    chartRef.current.style.cursor = 'crosshair';
                }
            }

            // Clear crosshair state when mouse leaves
            setHoveredCandle(null);
            setCurrentMouseY(null);
            setActiveTimestamp(null);
            setHoveredIndex(null);
        };

        const handleWheelEvent = (e) => handleWheel(e);

        // Global mouse move tracking for catching fast mouse movements
        const handleGlobalMouseMove = (e) => {
            if (chartRef.current && isMouseOverChart) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const isStillOverChart =
                    e.clientX >= chartRect.left &&
                    e.clientX <= chartRect.right &&
                    e.clientY >= chartRect.top &&
                    e.clientY <= chartRect.bottom;

                if (!isStillOverChart && !isDragging) {
                    setIsMouseOverChart(false);
                    setHoveredCandle(null);
                    setCurrentMouseY(null);
                    setActiveTimestamp(null);
                    setHoveredIndex(null);
                }
            }
        };

        // Attach event listeners
        if (chartRef.current) {
            chartRef.current.addEventListener('mousedown', handleMouseDown);
            chartRef.current.addEventListener('wheel', handleWheelEvent, { passive: false });
            chartRef.current.addEventListener('mouseenter', handleMouseEnter);
            chartRef.current.addEventListener('mouseleave', handleMouseLeave);
        }
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleGlobalMouseMove);

        // Cleanup
        return () => {
            if (chartRef.current) {
                chartRef.current.removeEventListener('mousedown', handleMouseDown);
                chartRef.current.removeEventListener('wheel', handleWheelEvent);
                chartRef.current.removeEventListener('mouseenter', handleMouseEnter);
                chartRef.current.removeEventListener('mouseleave', handleMouseLeave);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [
        data, isDragging, setIsDragging, setViewStartIndex, historicalBuffer,
        setCurrentMouseY, displayedCandles, MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES,
        setHoveredIndex, isMouseOverChart, setHoveredCandle, setActiveTimestamp, setHoveredIndex
    ]);

    // Calculate zoom percentage for display
    const zoomPercentage = Math.round(
        ((MAX_DISPLAY_CANDLES - displayedCandles) /
            (MAX_DISPLAY_CANDLES - MIN_DISPLAY_CANDLES)) * 100
    );

    return (
        <Card className="w-full h-80">
            <CardContent className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex flex-col space-y-1">
                        <CandleInfoPanel candle={hoveredCandle}/>
                        {/* Display main indicators info below candle info */}
                        <MainIndicatorInfoPanel indicators={mainIndicators} />
                    </div>
                    <div className="flex items-center">
                        <div className="text-xs text-gray-500 mr-2">
                            Zoom: {zoomPercentage}%
                        </div>
                        <div className="flex space-x-1 mr-2">
                            <button
                                onClick={handleZoomIn}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                                title="Zoom In"
                            >
                                +
                            </button>
                            <button
                                onClick={handleResetZoom}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                                title="Reset Zoom"
                            >
                                ↺
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                                title="Zoom Out"
                            >
                                -
                            </button>
                        </div>
                        <button
                            onClick={() => setIsLogarithmic(!isLogarithmic)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                        >
                            {isLogarithmic ? "Linear" : "Log"} Scale
                        </button>
                    </div>
                </div>
                <div
                    ref={chartRef}
                    className="flex-1 w-full overflow-hidden"
                    style={{cursor: isDragging ? 'grabbing' : 'crosshair'}}
                ></div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
