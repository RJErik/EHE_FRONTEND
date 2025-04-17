import { useEffect, useRef } from "react";
import { Card, CardContent } from "../../ui/card.jsx";
import CandleInfoPanel from "./CandleInfoPanel.jsx";
import { useCandleChart } from "./useCandleChart.js";
import { renderCandleChart } from "./renderCandleChart.js";

const CandleChart = () => {
    const chartRef = useRef(null);
    const dragStartXRef = useRef(null);
    const {
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
        setActiveTimestamp
    } = useCandleChart(chartRef);

    // D3 chart rendering
    useEffect(() => {
        const chartInfo = renderCandleChart({
            chartRef,
            data,
            isLogarithmic,
            isDragging,
            setHoveredCandle,
            setCurrentMouseY,
            setActiveTimestamp,
            activeTimestamp,
            currentMouseY
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
                currentMouseY
            });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [data, isLogarithmic, currentMouseY, activeTimestamp, isDragging]);

    // Setup dragging events
    useEffect(() => {
        const getCandleWidth = () => {
            const candleBodies = chartRef.current?.querySelectorAll('.candle-body');
            if (candleBodies?.length > 0) {
                return parseFloat(candleBodies[0].getAttribute('width')) || 10;
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
            if (chartRef.current) {
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
                            Math.min(newIndex, historicalBuffer.length - data.length)
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
                if (chartRef.current) {
                    const chartRect = chartRef.current.getBoundingClientRect();
                    const yRelative = e.clientY - chartRect.top - 20; // Adjust for top margin
                    if (yRelative >= 0 && yRelative <= chartRect.height - 60) {
                        setCurrentMouseY(yRelative);
                    }
                }
            }
        };

        const handleMouseLeave = () => {
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                if (chartRef.current) {
                    chartRef.current.style.cursor = 'crosshair';
                }
            }
        };

        // Attach event listeners
        if (chartRef.current) {
            chartRef.current.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            chartRef.current.addEventListener('mouseleave', handleMouseLeave);
        }

        // Cleanup
        return () => {
            if (chartRef.current) {
                chartRef.current.removeEventListener('mousedown', handleMouseDown);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (chartRef.current) {
                chartRef.current.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [data, isDragging, setIsDragging, setViewStartIndex, historicalBuffer, setCurrentMouseY]);

    return (
        <Card className="w-full h-80">
            <CardContent className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-2">
                    <CandleInfoPanel candle={hoveredCandle} />
                    <button
                        onClick={() => setIsLogarithmic(!isLogarithmic)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                    >
                        {isLogarithmic ? "Linear" : "Log"} Scale
                    </button>
                </div>
                <div
                    ref={chartRef}
                    className="flex-1 w-full overflow-hidden"
                    style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
                ></div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
