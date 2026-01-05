const API_BASE_URL = 'http://localhost:8080/api/user';

class CandleApiService {
    constructor() {
        this.refreshTokenFn = null;
    }

    setRefreshTokenFunction(fn) {
        this.refreshTokenFn = fn;
    }

    /**
     * Make an authenticated request with automatic token refresh
     */
    async authenticatedRequest(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };

        let response = await fetch(url, mergedOptions);

        // Handle 401 - Token expired
        if (response.status === 401 && this.refreshTokenFn) {
            try {
                await this.refreshTokenFn();
            } catch (refreshError) {
                throw new Error('Session expired. Please login again.');
            }

            // Retry the original request
            response = await fetch(url, mergedOptions);

            if (response.status === 401) {
                throw new Error('Session expired. Please login again.');
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get candles by sequence number range
     */
    async getCandlesBySequence(platform, stockSymbol, timeframe, fromSequence, toSequence) {
        console.log('[CandleApiService] getCandlesBySequence:', {
            platform,
            stockSymbol,
            timeframe,
            fromSequence,
            toSequence
        });

        const params = new URLSearchParams({
            platform,
            stockSymbol,
            timeframe,
            fromSequence: fromSequence.toString(),
            toSequence: toSequence.toString()
        });

        const response = await this.authenticatedRequest(
            `${API_BASE_URL}/candles/by-sequence?${params.toString()}`,
            {
                method: 'GET'
            }
        );

        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch candles by sequence');
        }

        return response.data;
    }

    /**
     * Get candles by date range
     */
    async getCandlesByDate(platform, stockSymbol, timeframe, fromDate, toDate) {
        console.log('[CandleApiService] getCandlesByDate:', {
            platform,
            stockSymbol,
            timeframe,
            fromDate: fromDate instanceof Date ? fromDate.toISOString() : fromDate,
            toDate: toDate instanceof Date ? toDate.toISOString() : toDate
        });

        const params = new URLSearchParams({
            platform,
            stockSymbol,
            timeframe,
            fromDate: fromDate instanceof Date ? fromDate.toISOString() : fromDate,
            toDate: toDate instanceof Date ? toDate.toISOString() : toDate
        });

        const response = await this.authenticatedRequest(
            `${API_BASE_URL}/candles/by-date?${params.toString()}`,
            {
                method: 'GET'
            }
        );

        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch candles by date');
        }

        return response.data;
    }

    /**
     * Get latest N candles
     */
    async getLatestCandles(platform, stockSymbol, timeframe, count = 200) {
        const timeframeMs = this.parseTimeframeToMs(timeframe);
        const now = new Date();
        const startDate = new Date(now.getTime() - (count * timeframeMs * 1.5)); // Extra buffer for gaps

        return this.getCandlesByDate(platform, stockSymbol, timeframe, startDate, now);
    }

    /**
     * Get candles before a specific sequence number
     */
    async getCandlesBeforeSequence(platform, stockSymbol, timeframe, beforeSequence, count = 100) {
        const fromSequence = Math.max(1, beforeSequence - count);
        const toSequence = beforeSequence - 1;

        if (fromSequence > toSequence) {
            console.log('[CandleApiService] No more candles before sequence', beforeSequence);
            return { candles: [], totalCandles: 0 };
        }

        return this.getCandlesBySequence(platform, stockSymbol, timeframe, fromSequence, toSequence);
    }

    /**
     * Get candles after a specific sequence number up to a limit
     */
    async getCandlesAfterSequence(platform, stockSymbol, timeframe, afterSequence, count = 100, maxSequence = null) {
        const fromSequence = afterSequence + 1;
        let toSequence = afterSequence + count;

        // Don't request beyond the known latest
        if (maxSequence !== null && toSequence > maxSequence) {
            toSequence = maxSequence;
        }

        if (fromSequence > toSequence) {
            console.log('[CandleApiService] No more candles after sequence', afterSequence);
            return { candles: [], totalCandles: 0 };
        }

        return this.getCandlesBySequence(platform, stockSymbol, timeframe, fromSequence, toSequence);
    }

    /**
     * Parse timeframe string to milliseconds
     */
    parseTimeframeToMs(timeframe) {
        const tf = timeframe.toLowerCase();

        if (tf.endsWith('m')) {
            return parseInt(timeframe) * 60 * 1000;
        } else if (tf.endsWith('h')) {
            return parseInt(timeframe) * 60 * 60 * 1000;
        } else if (tf.endsWith('d')) {
            return parseInt(timeframe) * 24 * 60 * 60 * 1000;
        } else if (tf.endsWith('w')) {
            return parseInt(timeframe) * 7 * 24 * 60 * 60 * 1000;
        }

        return 60 * 1000;
    }
}

// Export singleton instance
const candleApiService = new CandleApiService();
export default candleApiService;