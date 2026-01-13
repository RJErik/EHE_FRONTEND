import {useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {Card, CardContent} from "../../../components/ui/card.jsx";
import CandleInfoPanel from "./CandleInfoPanel.jsx";
import MainIndicatorInfoPanel from "../indicators/MainIndicatorInfoPanel.jsx";
import {renderCandleChart} from "./renderCandleChart.js";
import {ChartContext} from "../ChartContext.jsx";
import {useIndicators} from "../indicators/useIndicators.js";

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
    const dragStartViewIndexRef = useRef(null);
    const [isMouseOverChart, setIsMouseOverChart] = useState(false);
    const [, setMouseX] = useState(null);

    const {
        candleData: data,
        displayCandles,
        viewStartIndex,
        setViewStartIndex,
        isDragging,
        setIsDragging,
        isLogarithmic,
        setIsLogarithmic,
        hoveredCandle,
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
        isFollowingLatest,
        setIsFollowingLatest,
        setIsWaitingForData
    } = useContext(ChartContext) || {};

    useEffect(() => {
        if (!data) return;

        console.log("[CandleChart] Received updated data - Length:", data.length,
            "ViewIndex:", viewStartIndex,
            "DisplayedCandles:", displayedCandles,
            "Buffer Length:", displayCandles?.length || 0);
    }, [data, viewStartIndex, displayedCandles, displayCandles?.length]);

    const DEFAULT_DISPLAY_CANDLES = 100;

    const { indicators } = useIndicators();
    const mainIndicators = useMemo(() => (
        Array.isArray(indicators) ? indicators.filter(ind => ind.category === "main") : []
    ), [indicators]);

    const isViewingLatest = useCallback(() => {
        if (!displayCandles || displayCandles.length === 0) return true;

        const lastVisibleIndex = viewStartIndex + displayedCandles - 1;
        const lastDataIndex = displayCandles.length - 1;

        return lastVisibleIndex >= lastDataIndex;
    }, [displayCandles, viewStartIndex, displayedCandles]);

    const updateHoveredCandleByTimestamp = useCallback((timestamp) => {
        if (!data || !timestamp) return false;

        const newHoveredIndex = data.findIndex(candle => candle.timestamp === timestamp);
        if (newHoveredIndex >= 0) {
            setHoveredIndex(newHoveredIndex);
            return true;
        }
        return false;
    }, [data, setHoveredIndex]);

    useEffect(() => {
        const el = chartRef.current;
        if (!data || !Array.isArray(data) || data.length === 0 || !el) return;

        const possibleBufferUpdate = displayCandles.length > data.length + displayedCandles;

        renderCandleChart({
            chartRef,
            data,
            isLogarithmic,
            isDragging,
            setCurrentMouseY,
            setActiveTimestamp,
            activeTimestamp,
            currentMouseY,
            displayedCandles,
            mainIndicators: mainIndicators || [],
            hoveredIndex,
            setHoveredIndex,
            viewStartIndex,
            isMouseOverChart,
            isBufferUpdate: possibleBufferUpdate
        });

        const handleResize = () => {
            if (!data || !Array.isArray(data) || data.length === 0) return;

            renderCandleChart({
                chartRef,
                data,
                isLogarithmic,
                isDragging,
                setCurrentMouseY,
                setActiveTimestamp,
                activeTimestamp,
                currentMouseY,
                displayedCandles,
                mainIndicators: mainIndicators || [],
                hoveredIndex,
                setHoveredIndex,
                viewStartIndex,
                isMouseOverChart,
                isBufferUpdate: true
            });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (el) {
                const svg = el.querySelector('svg');
                if (svg) {
                    svg.remove();
                }
            }
        };
    }, [data, isLogarithmic, currentMouseY, activeTimestamp, isDragging, displayedCandles, mainIndicators, hoveredIndex, viewStartIndex, isMouseOverChart, displayCandles.length, setCurrentMouseY, setActiveTimestamp, setHoveredIndex]);

    useEffect(() => {
        if (isDragging || !data?.length || !isMouseOverChart || !activeTimestamp) {
            return;
        }

        updateHoveredCandleByTimestamp(activeTimestamp);
    }, [displayedCandles, viewStartIndex, data?.length, isDragging, isMouseOverChart, activeTimestamp, updateHoveredCandleByTimestamp]);

    useEffect(() => {
        if (isFollowingLatest && !isViewingLatest()) {
            console.log('[CandleChart] User scrolled away from latest - disabling follow mode');
            setIsFollowingLatest(false);
        }
    }, [viewStartIndex, isFollowingLatest, isViewingLatest, setIsFollowingLatest]);

    const applyCenteredZoom = useCallback((newDisplayed, timestampToTrack) => {
        const middleIndex = viewStartIndex + Math.floor(displayedCandles / 2);
        const newViewStartIndex = middleIndex - Math.floor(newDisplayed / 2);

        setDisplayedCandles(newDisplayed);
        setViewStartIndex(Math.max(0, Math.min(newViewStartIndex, Math.max(0, displayCandles.length - newDisplayed))));

        if (timestampToTrack) {
            updateHoveredCandleByTimestamp(timestampToTrack);
        }
    }, [viewStartIndex, displayedCandles, displayCandles.length, setDisplayedCandles, setViewStartIndex, updateHoveredCandleByTimestamp]);

    const handleZoomIn = () => {
        if (!data?.length) return;
        const timestampToTrack = activeTimestamp;
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.max(MIN_DISPLAY_CANDLES, displayedCandles - ZOOM_STEP);
        applyCenteredZoom(newDisplayedCandles, timestampToTrack);
    };

    const handleZoomOut = () => {
        if (!data?.length) return;
        const timestampToTrack = activeTimestamp;
        const ZOOM_STEP = 10;
        const newDisplayedCandles = Math.min(MAX_DISPLAY_CANDLES, displayedCandles + ZOOM_STEP);
        applyCenteredZoom(newDisplayedCandles, timestampToTrack);
    };

    const handleResetZoom = () => {
        if (!data?.length) return;
        applyCenteredZoom(DEFAULT_DISPLAY_CANDLES, activeTimestamp);
    };

    const handleGoToStart = useCallback(() => {
        console.log('[CandleChart] Requesting restart to fresh data');

        setHoveredIndex(null);
        setActiveTimestamp(null);
        setCurrentMouseY(null);
        setIsWaitingForData(true);

        window.dispatchEvent(new CustomEvent('restartChartRequested'));
    }, [setHoveredIndex, setActiveTimestamp, setCurrentMouseY, setIsWaitingForData, setIsFollowingLatest]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        if (!data?.length) return;

        const timestampToTrack = activeTimestamp;
        const isZoomIn = e.deltaY < 0;
        const el = chartRef.current;
        if (!el) return;
        const { rect, innerWidth } = getChartMetrics(el);
        const rel = getRelativePosition(e, rect);
        const mouseXInner = rel.x - CHART_MARGINS.left;
        const mouseXRatio = Math.max(0, Math.min(1, mouseXInner / innerWidth));

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
            Math.min(newViewStartIndex, displayCandles.length - newDisplayedCandles)
        );

        setDisplayedCandles(newDisplayedCandles);
        setViewStartIndex(newViewStartIndex);

        if (timestampToTrack) {
            updateHoveredCandleByTimestamp(timestampToTrack);
        }
    }, [data?.length, activeTimestamp, displayedCandles, viewStartIndex, MIN_DISPLAY_CANDLES, MAX_DISPLAY_CANDLES, displayCandles.length, setDisplayedCandles, setViewStartIndex, updateHoveredCandleByTimestamp]);

    useEffect(() => {
        const getCandleWidth = () => {
            if (chartRef.current && displayedCandles > 0) {
                const chartWidth = chartRef.current.clientWidth;
                const drawingWidth = chartWidth - 120;
                return drawingWidth / displayedCandles;
            }
            return 10;
        };

        const handleMouseDown = (e) => {
            if (e.button === 0) {
                const el = chartRef.current;
                if (!el) return;
                const { rect } = getChartMetrics(el);
                const rel = getRelativePosition(e, rect);
                const inside = isInChartArea(rel, rect);

                if (inside) {
                    setIsDragging(true);
                    dragStartXRef.current = e.clientX;
                    dragStartViewIndexRef.current = viewStartIndex;
                    if (chartRef.current) chartRef.current.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = (e) => {
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

            if (isDragging && dragStartXRef.current !== null && dragStartViewIndexRef.current !== null) {
                const timestampToTrack = activeTimestamp;
                const currentX = e.clientX;
                const deltaX = currentX - dragStartXRef.current;
                const candleWidth = getCandleWidth();

                if (candleWidth > 0) {
                    const totalCandlesToShift = deltaX / candleWidth;
                    const targetViewStartIndex = dragStartViewIndexRef.current - totalCandlesToShift;
                    const newIndex = Math.round(targetViewStartIndex);
                    const boundedIndex = Math.max(
                        0,
                        Math.min(newIndex, displayCandles.length - displayedCandles)
                    );

                    if (boundedIndex !== viewStartIndex) {
                        setViewStartIndex(boundedIndex);

                        if (timestampToTrack) {
                            updateHoveredCandleByTimestamp(timestampToTrack);
                        }
                    }
                }
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging) {
                const timestampToTrack = activeTimestamp;
                setIsDragging(false);
                dragStartXRef.current = null;
                dragStartViewIndexRef.current = null;

                if (chartRef.current) {
                    const el = chartRef.current;
                    const { rect } = getChartMetrics(el);
                    const rel = getRelativePosition(e, rect);
                    const inside = isInChartArea(rel, rect);

                    setIsMouseOverChart(inside);

                    if (!inside) {
                        setHoveredIndex(null);
                        setCurrentMouseY(null);
                        setActiveTimestamp(null);
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
            if (chartRef.current && !chartRef.current.contains(e.relatedTarget)) {
                setIsMouseOverChart(false);
                if (isDragging) {
                    setIsDragging(false);
                    dragStartXRef.current = null;
                    dragStartViewIndexRef.current = null;
                }
                setHoveredIndex(null);
                setCurrentMouseY(null);
                setActiveTimestamp(null);
                setMouseX(null);
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

        const handleGlobalMouseMoveForLeave = (e) => {
            if (chartRef.current && !isDragging && isMouseOverChart) {
                const el = chartRef.current;
                const { rect } = getChartMetrics(el);
                const rel = getRelativePosition(e, rect);
                const inside = isInChartArea(rel, rect);

                if (!inside) {
                    setIsMouseOverChart(false);
                    setHoveredIndex(null);
                    setCurrentMouseY(null);
                    setActiveTimestamp(null);
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
    }, [isDragging, viewStartIndex, displayCandles.length, displayedCandles, isMouseOverChart, activeTimestamp, handleWheel, updateHoveredCandleByTimestamp, setIsDragging, setCurrentMouseY, setViewStartIndex, setActiveTimestamp, setHoveredIndex]);

    const zoomPercentage = Math.round(
        ((MAX_DISPLAY_CANDLES - displayedCandles) /
            (MAX_DISPLAY_CANDLES - MIN_DISPLAY_CANDLES)) * 100
    );

    return (
        <Card className="w-full h-80">
            <CardContent className="flex flex-col h-full p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col space-y-1">
                        <CandleInfoPanel candle={hoveredCandle} />
                        <MainIndicatorInfoPanel indicators={mainIndicators} hoveredIndex={hoveredIndex} />
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        <button
                            onClick={handleGoToStart}
                            disabled={!data?.length || isViewingLatest()}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded mr-2 whitespace-nowrap hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Reset to fresh current data"
                        >
                            Go To Start
                        </button>
                        <button
                            onClick={() => setIsFollowingLatest?.(!isFollowingLatest)}
                            disabled={!isViewingLatest()}
                            className={`px-2 py-1 text-xs rounded mr-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                                isFollowingLatest
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                            title={isViewingLatest() ? "Toggle auto-follow new candles" : "Scroll to latest to enable"}
                        >
                            {isFollowingLatest ? '● Following' : 'Follow Latest'}
                        </button>
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
                </div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;