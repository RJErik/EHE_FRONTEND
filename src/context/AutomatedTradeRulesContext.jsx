import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAutomatedTradeRules } from '../hooks/useAutomatedTradeRules.js';

// Create the context
const AutomatedTradeRulesContext = createContext(null);

// Provider component
export function AutomaticTradeProvider({ children }) {
    const automaticTradeData = useAutomatedTradeRules();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

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

    useEffect(() => {
        setLastUpdate(Date.now());
    }, [automaticTradeData.automaticTradeRules]);

    const refreshLatestSearch = useCallback(() => {
        console.log('[AutomatedTradeRulesContext] Refreshing with last search:', lastSearchParamsRef.current);

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

    const contextValue = {
        ...automaticTradeData,
        lastUpdate,
        searchAutomaticTradeRules: searchAutomaticTradeRulesWithMemory,
        fetchAutomaticTradeRules: fetchAutomaticTradeRulesWithMemory,
        refreshLatestSearch
    };

    return (
        <AutomatedTradeRulesContext.Provider value={contextValue}>
            {children}
        </AutomatedTradeRulesContext.Provider>
    );
}

// Custom hook to use the automatic trade context
export function useAutomatedTradeRuleContext() {
    const context = useContext(AutomatedTradeRulesContext);
    if (!context) {
        throw new Error('useAutomatedTradeRuleContext must be used within an AutomatedTradeRuleProvider');
    }
    return context;
}