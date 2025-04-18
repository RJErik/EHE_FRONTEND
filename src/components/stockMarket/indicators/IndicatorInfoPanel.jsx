// src/components/stockMarket/indicators/IndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorInfoPanel = ({ indicator }) => {
    const { hoveredIndex } = useContext(ChartContext) || { hoveredIndex: null };

    if (!indicator?.values || hoveredIndex === null) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                Hover for values
            </div>
        );
    }

    // Get value at hovered position
    let value = indicator.values[hoveredIndex];

    // Handle complex indicator types with multiple values
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
                        {key}: {val.toFixed(2)}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="h-5 flex items-center text-xs">
            <span className="font-medium mr-1">{indicator.name}:</span>
            <span style={{ color: indicator.settings.color }}>
                {typeof value === 'number' ? value.toFixed(2) : value}
            </span>
        </div>
    );
};

export default IndicatorInfoPanel;
