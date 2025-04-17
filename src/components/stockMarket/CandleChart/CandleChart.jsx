import { useEffect, useRef } from "react";
import { Card, CardContent } from "../../ui/card.jsx";
import CandleInfoPanel from "./CandleInfoPanel.jsx";
import { useCandleChart } from "./useCandleChart.js";
import { renderCandleChart } from "./renderCandleChart.js";

const CandleChart = () => {
    const chartRef = useRef(null);
    const {
        data,
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
        renderCandleChart({
            chartRef,
            data,
            isLogarithmic,
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
    }, [data, isLogarithmic, currentMouseY, activeTimestamp]);

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
                ></div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
