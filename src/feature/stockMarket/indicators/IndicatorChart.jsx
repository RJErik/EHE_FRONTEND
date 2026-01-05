import {useContext, useEffect, useRef, useState} from "react";
import {renderIndicatorChart} from "./renderIndicatorChart.js";
import {ChartContext} from "../ChartContext.jsx";

const IndicatorChart = ({ indicator }) => {
    const chartRef = useRef(null);
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);
    const [mouseX, setMouseX] = useState(null);
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
        displayCandles,
        MIN_DISPLAY_CANDLES,
        MAX_DISPLAY_CANDLES
    } = useContext(ChartContext) || {};

    useEffect(() => {
        if (!chartRef.current || !candleData || candleData.length === 0) return;

        console.log(`[IndicatorChart] Rendering chart for indicator: ${indicator.name} (${indicator.id})`);

        const indicatorValues = extractIndicatorValues(candleData, indicator.id, indicator.type);

        console.log(`[IndicatorChart] Extracted values for ${indicator.name}:`, indicatorValues);

        if (!indicatorValues ||
            (Array.isArray(indicatorValues) && indicatorValues.every(v => v === null)) ||
            (typeof indicatorValues === 'object' && Object.keys(indicatorValues).length === 0)) {
            console.warn(`[IndicatorChart] No valid data for indicator: ${indicator.name}`);
            return;
        }

        return renderIndicatorChart({
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
    }, [indicator, candleData, viewStartIndex, displayedCandles, isDragging, hoveredIndex, currentMouseY, isMouseOverChart, setActiveTimestamp, setCurrentMouseY, setHoveredIndex]);

    useEffect(() => {
        if (isDragging || !candleData || !candleData.length || !isMouseOverChart || mouseX === null || !chartRef.current) {
            return;
        }

        const chartRect = chartRef.current.getBoundingClientRect();
        const marginLeft = 40;
        const marginRight = 40;
        const chartWidth = chartRect.width - marginLeft - marginRight;

        const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth));
        const newHoveredIndex = Math.floor(mouseXRatio * displayedCandles);

        if (newHoveredIndex >= 0 && newHoveredIndex < candleData.length) {
            setHoveredIndex(newHoveredIndex);

            if (candleData[newHoveredIndex]) {
                setActiveTimestamp(candleData[newHoveredIndex].timestamp);
            }
        }
    }, [displayedCandles, candleData, isDragging, isMouseOverChart, mouseX, setHoveredIndex, setActiveTimestamp]);

    useEffect(() => {
        const getCandleWidth = () => {
            if (chartRef.current && displayedCandles > 0) {
                const chartWidth = chartRef.current.clientWidth;
                const drawingWidth = chartWidth - 80;
                return drawingWidth / displayedCandles;
            }
            return 10;
        };

        const CHART_MARGINS = { left: 40, right: 40, top: 5, bottom: 5 };
        const getChartRect = () => chartRef.current?.getBoundingClientRect();
        const isEventInChartArea = (e) => {
            const rect = getChartRect();
            if (!rect) return false;
            const { left, right, top, bottom } = rect;
            const { left: ml, right: mr, top: mt, bottom: mb } = CHART_MARGINS;
            return (
                e.clientX >= left + ml &&
                e.clientX <= right - mr &&
                e.clientY >= top + mt &&
                e.clientY <= bottom - mb
            );
        };
        const getRelativeMouse = (e) => {
            const rect = getChartRect();
            return {
                rect,
                x: rect ? e.clientX - rect.left - CHART_MARGINS.left : 0,
                y: rect ? e.clientY - rect.top - CHART_MARGINS.top : 0,
            };
        };

        const handleMouseDown = (e) => {
            if (e.button === 0 && isEventInChartArea(e)) {
                setIsDragging(true);
                dragStartXRef.current = e.clientX;
                dragStartViewIndexRef.current = viewStartIndex;
                if (chartRef.current) {
                    chartRef.current.style.cursor = 'grabbing';
                }
                e.preventDefault();
            }
        };

        const handleMouseMove = (e) => {
            if (isDragging && dragStartXRef.current !== null && dragStartViewIndexRef.current !== null) {
                const currentX = e.clientX;
                const deltaX = currentX - dragStartXRef.current;
                const candleWidth = getCandleWidth();

                if (candleWidth > 0) {
                    const totalCandlesToShift = deltaX / candleWidth;
                    const targetViewStartIndex = dragStartViewIndexRef.current - totalCandlesToShift;

                    const newIndex = Math.round(targetViewStartIndex);
                    const boundedIndex = Math.max(
                        0,
                        Math.min(newIndex, (displayCandles?.length || 0) - displayedCandles)
                    );

                    if (boundedIndex !== viewStartIndex) {
                        setViewStartIndex(boundedIndex);
                    }
                }
            }

            if (chartRef.current && isMouseOverChart && !isDragging) {
                const chartRect = chartRef.current.getBoundingClientRect();
                const marginLeft = 40;
                const marginTop = 5;
                const relativeX = e.clientX - chartRect.left - marginLeft;
                const relativeY = e.clientY - chartRect.top - marginTop;

                setMouseX(relativeX);
                setCurrentMouseY(relativeY);
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                dragStartXRef.current = null;
                dragStartViewIndexRef.current = null;

                if (chartRef.current) {
                    chartRef.current.style.cursor = isMouseOverChart ? 'crosshair' : 'default';
                }
            }
        };

        const handleWheel = (e) => {
            e.preventDefault();

            const isZoomIn = e.deltaY < 0;
            const chartRect = chartRef.current.getBoundingClientRect();
            const marginLeft = 40;
            const marginRight = 40;
            const chartWidth = chartRect.width - marginLeft - marginRight;

            const mouseX = e.clientX - chartRect.left - marginLeft;
            const mouseXRatio = Math.max(0, Math.min(1, mouseX / chartWidth));

            setMouseX(mouseX);

            const candleIndexUnderMouse = Math.floor(mouseXRatio * displayedCandles);
            const absoluteIndexUnderMouse = viewStartIndex + candleIndexUnderMouse;

            const ZOOM_STEP = 5;
            const newDisplayedCandles = isZoomIn
                ? Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP)
                : Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);

            if (newDisplayedCandles === displayedCandles) return;

            const newCandleIndexUnderMouse = Math.floor(mouseXRatio * newDisplayedCandles);
            let newViewStartIndex = absoluteIndexUnderMouse - newCandleIndexUnderMouse;

            newViewStartIndex = Math.max(
                0,
                Math.min(newViewStartIndex, (displayCandles?.length || 0) - newDisplayedCandles)
            );

            setDisplayedCandles(newDisplayedCandles);
            setViewStartIndex(newViewStartIndex);
        };

        const handleMouseEnter = (e) => {
            if (isEventInChartArea(e)) {
                setIsMouseOverChart(true);
                const { x } = getRelativeMouse(e);
                setMouseX(x);
                if (chartRef.current) {
                    chartRef.current.style.cursor = isDragging ? 'grabbing' : 'crosshair';
                }
            }
        };

        const handleMouseLeave = (e) => {
            if (chartRef.current && !chartRef.current.contains(e.relatedTarget)) {
                setIsMouseOverChart(false);
                if (isDragging) {
                    setIsDragging(false);
                    dragStartXRef.current = null;
                    dragStartViewIndexRef.current = null;
                }
                setCurrentMouseY(null);
                setHoveredIndex(null);
                setMouseX(null);
            }
        };

        const handleWheelEvent = (e) => {
            if (!chartRef.current) return;
            if (isEventInChartArea(e)) {
                const { x } = getRelativeMouse(e);
                setMouseX(x);
                handleWheel(e);
            }
        };

        const handleGlobalMouseMoveForLeave = (e) => {
            if (chartRef.current && !isDragging && isMouseOverChart) {
                if (!isEventInChartArea(e)) {
                    setIsMouseOverChart(false);
                    setCurrentMouseY(null);
                    setHoveredIndex(null);
                    setMouseX(null);
                }
            }
        };

        const chartElement = chartRef.current;
        if (chartElement) {
            chartElement.addEventListener('mousedown', handleMouseDown);
            chartElement.addEventListener('wheel', handleWheelEvent, { passive: false });
            chartElement.addEventListener('mouseenter', handleMouseEnter);
            chartElement.addEventListener('mouseleave', handleMouseLeave);
        }
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleGlobalMouseMoveForLeave);

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
    }, [isDragging, setIsDragging, viewStartIndex, setViewStartIndex, displayCandles.length, displayedCandles, setDisplayedCandles, setCurrentMouseY, isMouseOverChart, setMouseX, setHoveredIndex, setActiveTimestamp, MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES]);

    const extractIndicatorValues = (candles, indicatorId, indicatorType) => {
        if (['sma', 'ema', 'rsi', 'atr'].includes(indicatorType)) {
            return candles.map(candle =>
                candle.indicatorValues && candle.indicatorValues[indicatorId]
            );
        }

        if (['macd', 'bb'].includes(indicatorType)) {
            const result = {};

            candles.forEach((candle, index) => {
                if (candle.indicatorValues && candle.indicatorValues[indicatorId]) {
                    const indicatorValue = candle.indicatorValues[indicatorId];

                    Object.entries(indicatorValue).forEach(([key, value]) => {
                        if (!result[key]) {
                            result[key] = new Array(candles.length).fill(null);
                        }
                        result[key][index] = value;
                    });
                }
            });

            return result;
        }

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