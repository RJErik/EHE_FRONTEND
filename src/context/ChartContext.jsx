// src/components/stockMarket/ChartContext.jsx
import { createContext, useState } from 'react';

export const ChartContext = createContext(null);

export function ChartProvider({ children }) {
    const [timeframeInMs, setTimeframeInMs] = useState(24 * 60 * 60000); // Default 1D
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedStock, setSelectedStock] = useState('');

    return (
        <ChartContext.Provider value={{
            timeframeInMs,
            setTimeframeInMs,
            selectedPlatform,
            setSelectedPlatform,
            selectedStock,
            setSelectedStock
        }}>
            {children}
        </ChartContext.Provider>
    );
}
