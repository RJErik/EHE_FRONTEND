// src/components/stockMarket/indicators/IndicatorChart.jsx
import { useEffect, useRef, useContext } from "react";
import { renderIndicatorChart } from "./renderIndicatorChart.js";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorChart = ({ indicator }) => {
    const chartRef = useRef(null);
    const {
        viewStartIndex,
        displayedCandles,
        setActiveTimestamp,
        isDragging,
        setCurrentMouseY,
        setHoveredIndex
    } = useContext(ChartContext) || {};

    useEffect(() => {
        if (!chartRef.current || !indicator.values) return;

        // Get the portion of data currently in view
        const visibleValues = Array.isArray(indicator.values)
            ? indicator.values.slice(viewStartIndex, viewStartIndex + displayedCandles)
            : Object.entries(indicator.values).reduce((acc, [key, values]) => {
                acc[key] = values.slice(viewStartIndex, viewStartIndex + displayedCandles);
                return acc;
            }, {});

        // Render chart using D3
        const cleanup = renderIndicatorChart({
            chartRef,
            data: visibleValues,
            indicator,
            isDragging,
            setActiveTimestamp,
            setCurrentMouseY,
            setHoveredIndex
        });

        return cleanup;
    }, [indicator, viewStartIndex, displayedCandles, isDragging]);

    return (
        <div ref={chartRef} className="w-full h-full" style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}></div>
    );
};

export default IndicatorChart;
