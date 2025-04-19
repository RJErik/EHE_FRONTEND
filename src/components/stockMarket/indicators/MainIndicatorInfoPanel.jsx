// src/components/stockMarket/indicators/MainIndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";
import { ScrollArea } from "../../ui/scroll-area.jsx";

const MainIndicatorInfoPanel = ({ indicators }) => {
    const { hoveredIndex, viewStartIndex } = useContext(ChartContext) || {
        hoveredIndex: null,
        viewStartIndex: 0
    };

    if (!indicators || indicators.length === 0) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                No indicators on main chart
            </div>
        );
    }

    if (hoveredIndex === null) {
        return (
            <div className="h-5 text-xs text-muted-foreground">
                Hover over chart to view indicator values
            </div>
        );
    }

    return (
        <ScrollArea className="h-5 overflow-y-auto">
            <div className="flex flex-wrap items-center text-xs gap-x-3">
                {indicators.map(indicator => {
                    if (!indicator.values) return null;

                    // Calculate absolute index with viewStartIndex
                    const absoluteIndex = viewStartIndex + hoveredIndex;

                    // Check if the value exists at this absolute index
                    if (absoluteIndex >= indicator.values.length) return null;

                    const value = indicator.values[absoluteIndex];
                    if (value === null || value === undefined) return null;

                    if (typeof value === 'object') {
                        return (
                            <div key={indicator.id} className="flex items-center">
                                <span className="font-medium mr-1">{indicator.name}:</span>
                                {Object.entries(value).map(([key, val]) => (
                                    <span
                                        key={key}
                                        className="mr-2"
                                        style={{ color: indicator.settings.color }}
                                    >
                                        {key}: {val !== null && val !== undefined ? val.toFixed(2) : 'N/A'}
                                    </span>
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div key={indicator.id} className="flex items-center">
                            <span className="font-medium text-foreground mr-1">{indicator.name}:</span>
                            <span style={{ color: indicator.settings.color }}>
                                {typeof value === 'number' ? value.toFixed(2) : (value || 'N/A')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};

export default MainIndicatorInfoPanel;
