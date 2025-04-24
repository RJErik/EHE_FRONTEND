// src/components/stockMarket/indicators/IndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";


const IndicatorInfoPanel = ({ indicator }) => {
    // Add at the beginning of IndicatorInfoPanel.jsx
    function lightenColor(hex, percent) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse the hex color
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        // Lighten each component
        r = Math.min(255, Math.floor(r * (100 + percent) / 100));
        g = Math.min(255, Math.floor(g * (100 + percent) / 100));
        b = Math.min(255, Math.floor(b * (100 + percent) / 100));

        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    function darkenColor(hex, percent) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse the hex color
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        // Darken each component
        r = Math.max(0, Math.floor(r * (100 - percent) / 100));
        g = Math.max(0, Math.floor(g * (100 - percent) / 100));
        b = Math.max(0, Math.floor(b * (100 - percent) / 100));

        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

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

    // Special handling for MACD
    if (indicator.type === 'macd' && typeof value === 'object') {
        const { macd, signal, histogram } = value;
        return (
            <div className="h-5 flex items-center text-xs overflow-x-auto whitespace-nowrap">
                <span className="font-medium mr-1">MACD:</span>
                <span className="mr-2" style={{ color: indicator.settings.color }}>
                    MACD: {macd?.toFixed(2) || 'N/A'}
                </span>
                <span className="mr-2" style={{ color: lightenColor(indicator.settings.color, 40) }}>
                    Signal: {signal?.toFixed(2) || 'N/A'}
                </span>
                <span className="mr-2" style={{ color: histogram > 0 ?
                        lightenColor(indicator.settings.color, 20) :
                        darkenColor(indicator.settings.color, 20) }}>
                    Histogram: {histogram?.toFixed(2) || 'N/A'}
                </span>
            </div>
        );
    }

    // For other object-type indicators
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
