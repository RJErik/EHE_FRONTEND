import { createContext, useContext, useState, useEffect } from 'react';
import { useWatchlist as useWatchlistHook } from '../hooks/useWatchlist';

// Create the context
const WatchlistContext = createContext(null);

// Provider component
export function WatchlistProvider({ children }) {
    const watchlistData = useWatchlistHook();
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Force a re-render when watchlist items change
    useEffect(() => {
        setLastUpdate(Date.now());
    }, [watchlistData.watchlistItems]);

    return (
        <WatchlistContext.Provider value={{...watchlistData, lastUpdate}}>
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
