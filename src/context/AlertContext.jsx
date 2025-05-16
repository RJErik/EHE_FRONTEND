// src/context/AlertContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAlert as useAlertHook } from '../hooks/useAlert';

// Create the context
const AlertContext = createContext(null);

// Provider component
export function AlertProvider({ children }) {
    const alertData = useAlertHook();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Use a ref for last search params to prevent unnecessary renders
    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        platform: '',
        symbol: '',
        conditionType: ''
    });

    // Force a re-render when alerts change
    useEffect(() => {
        setLastUpdate(Date.now());
    }, [alertData.alerts]);

    // Create a method to refresh using the last search parameters
    const refreshLatestSearch = useCallback(() => {
        console.log('[AlertContext] Refreshing with last search:', lastSearchParamsRef.current);

        if (lastSearchParamsRef.current.type === 'search') {
            alertData.searchAlerts(
                lastSearchParamsRef.current.platform,
                lastSearchParamsRef.current.symbol,
                lastSearchParamsRef.current.conditionType
            );
        } else {
            alertData.fetchAlerts();
        }
    }, [alertData]);

    // Extended search function that stores the parameters
    const searchAlertsWithMemory = useCallback((platform, symbol, conditionType) => {
        lastSearchParamsRef.current = {
            type: 'search',
            platform,
            symbol,
            conditionType
        };
        return alertData.searchAlerts(platform, symbol, conditionType);
    }, [alertData]);

    // Extended fetchAlerts function that stores it was a general fetch
    const fetchAlertsWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            platform: '',
            symbol: '',
            conditionType: ''
        };
        return alertData.fetchAlerts();
    }, [alertData]);

    // Memoize the context value to prevent unnecessary renders
    const contextValue = {
        ...alertData,
        lastUpdate,
        searchAlerts: searchAlertsWithMemory,
        fetchAlerts: fetchAlertsWithMemory,
        refreshLatestSearch
    };

    return (
        <AlertContext.Provider value={contextValue}>
            {children}
        </AlertContext.Provider>
    );
}

// Custom hook to use the alert context
export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}
