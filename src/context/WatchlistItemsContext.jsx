import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWatchlistItems as useWatchlistHook } from '../hooks/useWatchlistItems.js';

// Create the context
const WatchlistItemsContext = createContext(null);

// Provider component
export function WatchlistProvider({ children }) {
    const watchlistData = useWatchlistHook();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    const lastSearchParamsRef = useRef({
        type: 'fetchAll',
        platform: '',
        symbol: ''
    });

    useEffect(() => {
        setLastUpdate(Date.now());
    }, [watchlistData.watchlistItems]);

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

    const searchWatchlistItemsWithMemory = useCallback((platform, symbol) => {
        lastSearchParamsRef.current = {
            type: 'search',
            platform,
            symbol
        };
        return watchlistData.searchWatchlistItems(platform, symbol);
    }, [watchlistData]);

    const fetchWatchlistItemsWithMemory = useCallback(() => {
        lastSearchParamsRef.current = {
            type: 'fetchAll',
            platform: '',
            symbol: ''
        };
        return watchlistData.fetchWatchlistItems();
    }, [watchlistData]);

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
