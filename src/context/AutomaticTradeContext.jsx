// src/context/AutomaticTradeContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAutomaticTrade } from '../hooks/useAutomaticTrade';

// Create the context
const AutomaticTradeContext = createContext(null);

// Provider component
export function AutomaticTradeProvider({ children }) {
    const automaticTradeData = useAutomaticTrade();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Use a ref for last search params to prevent unnecessary renders
    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        portfolioId: null,
        platform: null,
        symbol: null,
        conditionType: null,
        actionType: null,
        quantityType: null,
        minThresholdValue: null,
        maxThresholdValue: null
    });

    // Force a re-render when automatic trade rules change
    useEffect(() => {
        setLastUpdate(Date.now());
    }, [automaticTradeData.automaticTradeRules]);

    // Create a method to refresh using the last search parameters
    const refreshLatestSearch = useCallback(() => {
        console.log('[AutomaticTradeContext] Refreshing with last search:', lastSearchParamsRef.current);

        if (lastSearchParamsRef.current.type === 'search') {
            automaticTradeData.searchAutomaticTradeRules(
                lastSearchParamsRef.current.portfolioId,
                lastSearchParamsRef.current.platform,
                lastSearchParamsRef.current.symbol,
                lastSearchParamsRef.current.conditionType,
                lastSearchParamsRef.current.actionType,
                lastSearchParamsRef.current.quantityType,
                lastSearchParamsRef.current.minThresholdValue,
                lastSearchParamsRef.current.maxThresholdValue
            );
        } else {
            automaticTradeData.fetchAutomaticTradeRules();
        }
    }, [automaticTradeData]);

    // Extended search function that stores the parameters
    const searchAutomaticTradeRulesWithMemory = useCallback((
        portfolioId,
        platform,
        symbol,
        conditionType,
        actionType,
        quantityType,
        minThresholdValue,
        maxThresholdValue
    ) => {
        lastSearchParamsRef.current = {
            type: 'search',
            portfolioId,
            platform,
            symbol,
            conditionType,
            actionType,
            quantityType,
            minThresholdValue,
            maxThresholdValue
        };
        return automaticTradeData.searchAutomaticTradeRules(
            portfolioId,
            platform,
            symbol,
            conditionType,
            actionType,
            quantityType,
            minThresholdValue,
            maxThresholdValue
        );
    }, [automaticTradeData]);

    // Extended fetchAutomaticTradeRules function that stores it was a general fetch
    const fetchAutomaticTradeRulesWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            portfolioId: null,
            platform: null,
            symbol: null,
            conditionType: null,
            actionType: null,
            quantityType: null,
            minThresholdValue: null,
            maxThresholdValue: null
        };
        return automaticTradeData.fetchAutomaticTradeRules();
    }, [automaticTradeData]);

    // Memoize the context value to prevent unnecessary renders
    const contextValue = {
        ...automaticTradeData,
        lastUpdate,
        searchAutomaticTradeRules: searchAutomaticTradeRulesWithMemory,
        fetchAutomaticTradeRules: fetchAutomaticTradeRulesWithMemory,
        refreshLatestSearch
    };

    return (
        <AutomaticTradeContext.Provider value={contextValue}>
            {children}
        </AutomaticTradeContext.Provider>
    );
}

// Custom hook to use the automatic trade context
export function useAutomaticTradeContext() {
    const context = useContext(AutomaticTradeContext);
    if (!context) {
        throw new Error('useAutomaticTradeContext must be used within an AutomaticTradeProvider');
    }
    return context;
}