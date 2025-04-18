// src/components/stockMarket/indicators/useIndicators.js
import { useState, useEffect, useContext } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChartContext } from "../ChartContext.jsx";
import { calculateIndicator } from "./indicatorCalculations.js";

export function useIndicators() {
    const [indicators, setIndicators] = useState([]);
    const [configuringIndicator, setConfiguringIndicator] = useState(null);
    const { candleData } = useContext(ChartContext) || { candleData: [] };

    // Calculate values for all indicators when candle data changes
    useEffect(() => {
        if (!candleData || candleData.length === 0) return;

        // Calculate values for each indicator
        const updatedIndicators = indicators.map(indicator => {
            const values = calculateIndicator(indicator, candleData);
            return { ...indicator, values };
        });

        setIndicators(updatedIndicators);
    }, [candleData, indicators]);

    const addIndicator = (indicator) => {
        const newIndicator = {
            ...indicator,
            id: uuidv4()
        };

        setIndicators(prev => [...prev, newIndicator]);
    };

    const removeIndicator = (id) => {
        setIndicators(prev => prev.filter(ind => ind.id !== id));
    };

    const updateIndicator = (id, updates) => {
        setIndicators(prev =>
            prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind)
        );
    };

    const configureIndicator = (id) => {
        const indicator = indicators.find(ind => ind.id === id);
        setConfiguringIndicator(indicator);
    };

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
