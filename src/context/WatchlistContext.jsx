// src/context/WatchlistContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWatchlist as useWatchlistHook } from '../hooks/useWatchlist';

// Create the context
const WatchlistContext = createContext(null);

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
        console.log('[WatchlistContext] Refreshing with last search:', lastSearchParamsRef.current);

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
        <WatchlistContext.Provider value={contextValue}>
            {children}
        </WatchlistContext.Provider>
    );
}

// Custom hook to use the watchlist context
export function useWatchlist() {
    const context = useContext(WatchlistContext);
    if (!context) {
        throw new Error('useWatchlist must be used within a WatchlistProvider');
    }
    return context;
}
