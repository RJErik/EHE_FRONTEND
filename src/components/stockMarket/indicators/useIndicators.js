// src/components/stockMarket/indicators/useIndicators.js
import { useState, useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

export function useIndicators() {
    // Only local state is for configuration UI
    const [configuringIndicator, setConfiguringIndicator] = useState(null);

    // Get indicator state and functions from shared context
    const {
        indicators = [],
        addIndicator = () => console.error("ChartContext not available"),
        removeIndicator = () => console.error("ChartContext not available"),
        updateIndicator = () => console.error("ChartContext not available")
    } = useContext(ChartContext) || {};

    // Configure an indicator
    const configureIndicator = (id) => {
        console.log("Configuring indicator with ID:", id);
        const indicator = indicators.find(ind => ind.id === id);
        if (indicator) {
            setConfiguringIndicator(indicator);
        } else {
            console.warn(`Indicator with id ${id} not found for configuration`);
        }
    };

    // Debugging log to see what's being returned
    console.log("useIndicators hook returning indicators:",
        indicators?.map(i => ({id: i.id, name: i.name, category: i.category})));

    return {
        indicators,
        addIndicator,
        removeIndicator,
        updateIndicator,
        configureIndicator,
        configuringIndicator,
        setConfiguringIndicator
    };
}
