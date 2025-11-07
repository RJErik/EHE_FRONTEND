// src/context/WatchlistItemsContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWatchlistItems as useWatchlistHook } from '../hooks/useWatchlistItems.js';

// Create the context
const WatchlistItemsContext = createContext(null);

// Provider component
export function WatchlistProvider({ children }) {
    const watchlistData = useWatchlistHook();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Use a ref for last search params to prevent unnecessary renders
    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        platform: '',
        symbol: ''
    });

    // Force a re-render when watchlist items change
    useEffect(() => {
        setLastUpdate(Date.now());
    }, [watchlistData.watchlistItems]);

    // Create a method to refresh using the last search parameters
    const refreshLatestSearch = useCallback(() => {
        console.log('[WatchlistItemsContext] Refreshing with last search:', lastSearchParamsRef.current);

        if (lastSearchParamsRef.current.type === 'search') {
            watchlistData.searchWatchlistItems(
                lastSearchParamsRef.current.platform,
                lastSearchParamsRef.current.symbol
            );
        } else {
            watchlistData.fetchWatchlistItems();
        }
    }, [watchlistData]);

    // Extended search function that stores the parameters
    const searchWatchlistItemsWithMemory = useCallback((platform, symbol) => {
        lastSearchParamsRef.current = {
            type: 'search',
            platform,
            symbol
        };
        return watchlistData.searchWatchlistItems(platform, symbol);
    }, [watchlistData]);

    // Extended fetchWatchlistItems function that stores it was a general fetch
    const fetchWatchlistItemsWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            platform: '',
            symbol: ''
        };
        return watchlistData.fetchWatchlistItems();
    }, [watchlistData]);

    // Memoize the context value to prevent unnecessary renders
    const contextValue = {
        ...watchlistData,
        lastUpdate,
        searchWatchlistItems: searchWatchlistItemsWithMemory,
        fetchWatchlistItems: fetchWatchlistItemsWithMemory,
        refreshLatestSearch
    };

    return (
        <WatchlistItemsContext.Provider value={contextValue}>
            {children}
        </WatchlistItemsContext.Provider>
    );
}

// Custom hook to use the watchlist context
export function useWatchlist() {
    const context = useContext(WatchlistItemsContext);
    if (!context) {
        throw new Error('useWatchlistItems must be used within a WatchlistProvider');
    }
    return context;
}
