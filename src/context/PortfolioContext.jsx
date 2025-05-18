// src/context/PortfolioContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';

// Create the context
const PortfolioContext = createContext(null);

// Provider component
export function PortfolioProvider({ children }) {
    const portfolioData = usePortfolio();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Use a ref for last search params to prevent unnecessary renders
    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        portfolioType: null,
        platform: null,
        minValue: null,
        maxValue: null
    });

    // Force a re-render when portfolio items change
    useEffect(() => {
        setLastUpdate(Date.now());
    }, [portfolioData.portfolios]);

    // Create a method to refresh using the last search parameters
    const refreshLatestSearch = useCallback(() => {
        console.log('[PortfolioContext] Refreshing with last search:', lastSearchParamsRef.current);

        if (lastSearchParamsRef.current.type === 'search') {
            portfolioData.searchPortfolios(
                lastSearchParamsRef.current.portfolioType,
                lastSearchParamsRef.current.platform,
                lastSearchParamsRef.current.minValue,
                lastSearchParamsRef.current.maxValue
            );
        } else {
            portfolioData.fetchPortfolios();
        }
    }, [portfolioData]);

    // Extended search function that stores the parameters
    const searchPortfoliosWithMemory = useCallback((portfolioType, platform, minValue, maxValue) => {
        lastSearchParamsRef.current = {
            type: 'search',
            portfolioType,
            platform,
            minValue,
            maxValue
        };
        return portfolioData.searchPortfolios(portfolioType, platform, minValue, maxValue);
    }, [portfolioData]);

    // Extended fetchPortfolios function that stores it was a general fetch
    const fetchPortfoliosWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            portfolioType: null,
            platform: null,
            minValue: null,
            maxValue: null
        };
        return portfolioData.fetchPortfolios();
    }, [portfolioData]);

    // Memoize the context value to prevent unnecessary renders
    const contextValue = {
        ...portfolioData,
        lastUpdate,
        searchPortfolios: searchPortfoliosWithMemory,
        fetchPortfolios: fetchPortfoliosWithMemory,
        refreshLatestSearch
    };

    return (
        <PortfolioContext.Provider value={contextValue}>
            {children}
        </PortfolioContext.Provider>
    );
}

// Custom hook to use the portfolio context
export function usePortfolioContext() {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolioContext must be used within a PortfolioProvider');
    }
    return context;
}
