// src/components/stockMarket/indicators/IndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

const IndicatorInfoPanel = ({ indicator }) => {
    const { hoveredIndex, viewStartIndex } = useContext(ChartContext) || {
        hoveredIndex: null,
        viewStartIndex: 0
    };

    if (!indicator?.values || hoveredIndex === null) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                Hover for values
            </div>
        );
    }

    // Get value at ABSOLUTE hovered position
    const absoluteIndex = viewStartIndex + hoveredIndex;
    let value = absoluteIndex < indicator.values.length
        ? indicator.values[absoluteIndex]
        : null;

    // Rest of your component remains the same...
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
