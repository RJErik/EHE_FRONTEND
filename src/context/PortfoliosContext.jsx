import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePortfolios } from '../hooks/usePortfolios.js';

// Create the context
const PortfoliosContext = createContext(null);

// Provider component
export function PortfolioProvider({ children }) {
    const portfolioData = usePortfolios();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        platform: null,
        minValue: null,
        maxValue: null
    });

    useEffect(() => {
        setLastUpdate(Date.now());
    }, [portfolioData.portfolios]);

    const refreshLatestSearch = useCallback(() => {
        console.log('[PortfoliosContext] Refreshing with last search:', lastSearchParamsRef.current);

        if (lastSearchParamsRef.current.type === 'search') {
            portfolioData.searchPortfolios(
                lastSearchParamsRef.current.platform,
                lastSearchParamsRef.current.minValue,
                lastSearchParamsRef.current.maxValue
            );
        } else {
            portfolioData.fetchPortfolios();
        }
    }, [portfolioData]);

    const searchPortfoliosWithMemory = useCallback((platform, minValue, maxValue) => {
        lastSearchParamsRef.current = {
            type: 'search',
            platform,
            minValue,
            maxValue
        };
        return portfolioData.searchPortfolios(platform, minValue, maxValue);
    }, [portfolioData]);

    const fetchPortfoliosWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            platform: null,
            minValue: null,
            maxValue: null
        };
        return portfolioData.fetchPortfolios();
    }, [portfolioData]);

    const contextValue = {
        ...portfolioData,
        lastUpdate,
        searchPortfolios: searchPortfoliosWithMemory,
        fetchPortfolios: fetchPortfoliosWithMemory,
        refreshLatestSearch
    };

    return (
        <PortfoliosContext.Provider value={contextValue}>
            {children}
        </PortfoliosContext.Provider>
    );
}

// Custom hook to use the portfolio context
export function usePortfolioContext() {
    const context = useContext(PortfoliosContext);
    if (!context) {
        throw new Error('usePortfolioContext must be used within a PortfolioProvider');
    }
    return context;
}