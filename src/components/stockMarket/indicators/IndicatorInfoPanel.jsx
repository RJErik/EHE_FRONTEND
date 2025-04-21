// src/components/stockMarket/indicators/IndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorInfoPanel = ({ indicator }) => {
    const { hoveredIndex, candleData } = useContext(ChartContext) || {
        hoveredIndex: null,
        candleData: []
    };

    if (!indicator?.id || hoveredIndex === null || !candleData[hoveredIndex]) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                Hover for values
            </div>
        );
    }

    // Get indicator value from the hovered candle
    const value = candleData[hoveredIndex].indicatorValues?.[indicator.id];

    if (!value) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                No data available
            </div>
        );
    }

    if (typeof value === 'object') {
        return (
            <div className="h-5 flex items-center text-xs overflow-x-auto whitespace-nowrap">
                <span className="font-medium mr-1">{indicator.name}:</span>
                {Object.entries(value).map(([key, val]) => (
                    <span
                        key={key}
                        className="mr-2"
                        style={{ color: indicator.settings.color }}
                    >
                        {key}: {val?.toFixed(2) || 'N/A'}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="h-5 flex items-center text-xs">
            <span className="font-medium mr-1">{indicator.name}:</span>
            <span style={{ color: indicator.settings.color }}>
                {typeof value === 'number' ? value.toFixed(2) : (value || 'N/A')}
            </span>
        </div>
    );
};

export default IndicatorInfoPanel;
