import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAlerts as useAlertHook } from '../hooks/useAlerts.js';

// Create the context
const AlertsContext = createContext(null);

// Provider component
export function AlertProvider({ children }) {
    const alertData = useAlertHook();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        platform: '',
        symbol: '',
        conditionType: ''
    });

    useEffect(() => {
        setLastUpdate(Date.now());
    }, [alertData.alerts]);

    const refreshLatestSearch = useCallback(() => {
        console.log('[AlertsContext] Refreshing with last search:', lastSearchParamsRef.current);

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

    const searchAlertsWithMemory = useCallback((platform, symbol, conditionType) => {
        lastSearchParamsRef.current = {
            type: 'search',
            platform,
            symbol,
            conditionType
        };
        return alertData.searchAlerts(platform, symbol, conditionType);
    }, [alertData]);

    const fetchAlertsWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            platform: '',
            symbol: '',
            conditionType: ''
        };
        return alertData.fetchAlerts();
    }, [alertData]);

    const contextValue = {
        ...alertData,
        lastUpdate,
        searchAlerts: searchAlertsWithMemory,
        fetchAlerts: fetchAlertsWithMemory,
        refreshLatestSearch
    };

    return (
        <AlertsContext.Provider value={contextValue}>
            {children}
        </AlertsContext.Provider>
    );
}

// Custom hook to use the alert context
export function useAlert() {
    const context = useContext(AlertsContext);
    if (!context) {
        throw new Error('useAlerts must be used within an AlertProvider');
    }
    return context;
}
