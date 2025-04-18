// src/components/stockMarket/indicators/MainIndicatorInfoPanel.jsx
import { useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";
import { ScrollArea } from "../../ui/scroll-area.jsx";

const MainIndicatorInfoPanel = ({ indicators }) => {
    const { hoveredIndex } = useContext(ChartContext) || { hoveredIndex: null };

    if (!indicators || indicators.length === 0 || hoveredIndex === null) {
        return null;
    }

    return (
        <ScrollArea className="h-8 overflow-y-auto">
            <div className="flex flex-wrap items-center text-xs gap-x-3 gap-y-1">
                {indicators.map(indicator => {
                    if (!indicator.values || !indicator.values[hoveredIndex]) return null;

                    const value = indicator.values[hoveredIndex];

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
                                        {key}: {val.toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div key={indicator.id} className="flex items-center">
                            <span className="font-medium mr-1">{indicator.name}:</span>
                            <span style={{ color: indicator.settings.color }}>
                                {typeof value === 'number' ? value.toFixed(2) : value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};

export default MainIndicatorInfoPanel;
