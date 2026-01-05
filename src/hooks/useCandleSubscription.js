// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { ChartContext } from '@/feature/stockMarket/ChartContext';
import { useWebSocket } from '../context/CandleWebSocketContext.jsx';
import { useToast } from './use-toast';
import { useJwtRefresh } from './useJwtRefresh';
import candleApiService from '../services/candleApiService';

const WS_SEQUENCE_TIMEOUT = 5000;

export function useCandleSubscription() {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    const [currentDetails, setCurrentDetails] = useState({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    const {
        isConnected,
        subscribeToCandleUpdates,
        unsubscribeFromCandleUpdates,
        registerHandler,
        activeSubscriptionId,
        latestCandleInfo
    } = useWebSocket();

    const chartContext = useContext(ChartContext);
    const {
        initializeChart,
        mergeCandles,
        handleLiveCandleUpdate,
        updateLatestKnownSequence,
        setBufferLoading,
        setIsWaitingForData,
        displayedCandles,
        indicators,
        calculateMaxLookback,
        sequenceBounds,
        BUFFER_SIZE,
        FETCH_BATCH_SIZE
    } = chartContext;

    const pendingRequestsRef = useRef({
        past: { inFlight: false, abortController: null },
        future: { inFlight: false, abortController: null }
    });

    const previousSubscriptionRef = useRef({
        platformName: null,
        stockSymbol: null,
        timeframe: null
    });

    const latestSequenceFromWSRef = useRef(null);

    useEffect(() => {
        candleApiService.setRefreshTokenFunction(refreshToken);
    }, [refreshToken]);

    const parseTimeframeToMs = useCallback((timeframe) => {
        const tf = timeframe.toLowerCase();
        if (tf.endsWith('m')) return parseInt(timeframe) * 60 * 1000;
        if (tf.endsWith('h')) return parseInt(timeframe) * 60 * 60 * 1000;
        if (tf.endsWith('d')) return parseInt(timeframe) * 24 * 60 * 60 * 1000;
        if (tf.endsWith('w')) return parseInt(timeframe) * 7 * 24 * 60 * 60 * 1000;
        return 60 * 1000;
    }, []);

    const transformCandle = useCallback((backendCandle) => {
        return {
            sequence: backendCandle.sequence,
            timestamp: new Date(backendCandle.timestamp + 'Z').getTime(),
            open: parseFloat(backendCandle.openPrice),
            high: parseFloat(backendCandle.highPrice),
            low: parseFloat(backendCandle.lowPrice),
            close: parseFloat(backendCandle.closePrice),
            volume: parseFloat(backendCandle.volume),
            indicatorValues: {}
        };
    }, []);

    const transformCandles = useCallback((backendCandles) => {
        if (!backendCandles || !Array.isArray(backendCandles)) return [];
        return backendCandles.map(transformCandle);
    }, [transformCandle]);

    /**
     * Fetch initial/latest candles for a new subscription
     * Prefers sequence-based fetch if latestSequence is provided, falls back to date-based
     */
    const fetchInitialCandles = useCallback(async (platformName, stockSymbol, timeframe, latestSequence = null) => {
        console.log('[useCandleSubscription] fetchInitialCandles:', {
            platformName,
            stockSymbol,
            timeframe,
            latestSequence,
            method: latestSequence ? 'sequence-based' : 'date-based (fallback)'
        });

        const maxLookback = calculateMaxLookback(indicators);
        const totalNeeded = displayedCandles + BUFFER_SIZE + maxLookback;

        try {
            let response;

            if (latestSequence) {
                const fromSeq = Math.max(1, latestSequence - totalNeeded + 1);
                console.log('[useCandleSubscription] Fetching candles by sequence:', {
                    platformName,
                    stockSymbol,
                    timeframe,
                    fromSeq,
                    toSeq: latestSequence,
                    totalNeeded
                });

                response = await candleApiService.getCandlesBySequence(
                    platformName,
                    stockSymbol,
                    timeframe,
                    fromSeq,
                    latestSequence
                );
            } else {
                console.log('[useCandleSubscription] Fetching latest candles (date-based fallback):', {
                    platformName,
                    stockSymbol,
                    timeframe,
                    totalNeeded
                });

                response = await candleApiService.getLatestCandles(
                    platformName,
                    stockSymbol,
                    timeframe,
                    totalNeeded
                );
            }

            const candles = transformCandles(response.candles);

            console.log('[useCandleSubscription] Initial candles fetched:', {
                count: candles.length,
                firstSeq: candles[0]?.sequence,
                lastSeq: candles[candles.length - 1]?.sequence,
                method: latestSequence ? 'sequence' : 'date'
            });

            return candles;
        } catch (err) {
            console.error('[useCandleSubscription] Error fetching initial candles:', err);
            throw err;
        }
    }, [displayedCandles, BUFFER_SIZE, indicators, calculateMaxLookback, transformCandles]);

    /**
     * Fetch candles for timeframe switch (anchor to a timestamp)
     */
    const fetchCandlesForTimeframeSwitch = useCallback(async (
        platformName,
        stockSymbol,
        newTimeframe,
        anchorTimestamp
    ) => {
        console.log('[useCandleSubscription] fetchCandlesForTimeframeSwitch:', {
            platformName,
            stockSymbol,
            newTimeframe,
            anchorTimestamp: new Date(anchorTimestamp).toISOString()
        });

        const maxLookback = calculateMaxLookback(indicators);
        const tfMs = parseTimeframeToMs(newTimeframe);

        const startDate = new Date(anchorTimestamp - (maxLookback * tfMs));
        const endDate = new Date(Math.min(
            anchorTimestamp + (displayedCandles + BUFFER_SIZE) * tfMs,
            Date.now()
        ));

        try {
            const response = await candleApiService.getCandlesByDate(
                platformName,
                stockSymbol,
                newTimeframe,
                startDate,
                endDate
            );

            const candles = transformCandles(response.candles);

            let anchorSequence = null;
            for (const candle of candles) {
                if (candle.timestamp >= anchorTimestamp) {
                    anchorSequence = candle.sequence;
                    break;
                }
            }

            console.log('[useCandleSubscription] Timeframe switch candles fetched:', {
                count: candles.length,
                anchorSequence,
                firstSeq: candles[0]?.sequence,
                lastSeq: candles[candles.length - 1]?.sequence
            });

            return { candles, anchorSequence };
        } catch (err) {
            console.error('[useCandleSubscription] Error fetching candles for timeframe switch:', err);
            throw err;
        }
    }, [displayedCandles, BUFFER_SIZE, indicators, calculateMaxLookback, parseTimeframeToMs, transformCandles]);

    const fetchOlderCandles = useCallback(async () => {
        const { platformName, stockSymbol, timeframe } = currentDetails;

        if (!platformName || !stockSymbol || !timeframe) {
            console.warn('[useCandleSubscription] No active subscription for fetchOlderCandles');
            return;
        }

        if (pendingRequestsRef.current.past.inFlight) {
            console.log('[useCandleSubscription] Past request already in flight');
            return;
        }

        const { minLoadedSequence, oldestAvailableSequence } = sequenceBounds;

        if (minLoadedSequence <= oldestAvailableSequence) {
            console.log('[useCandleSubscription] Already at oldest available data');
            return;
        }

        console.log('[useCandleSubscription] Fetching older candles:', {
            minLoadedSequence,
            fetchCount: FETCH_BATCH_SIZE
        });

        pendingRequestsRef.current.past.inFlight = true;
        setBufferLoading('past', true);

        try {
            const response = await candleApiService.getCandlesBeforeSequence(
                platformName,
                stockSymbol,
                timeframe,
                minLoadedSequence,
                FETCH_BATCH_SIZE
            );

            const candles = transformCandles(response.candles);

            console.log('[useCandleSubscription] Older candles fetched:', {
                count: candles.length,
                firstSeq: candles[0]?.sequence,
                lastSeq: candles[candles.length - 1]?.sequence
            });

            if (candles.length > 0) {
                mergeCandles(candles, { direction: 'past' });
            } else {
                setBufferLoading('past', false);
            }
        } catch (err) {
            console.error('[useCandleSubscription] Error fetching older candles:', err);
            setBufferLoading('past', false);

            toast({
                title: "Data Error",
                description: "Failed to load older data",
                variant: "destructive",
                duration: 3000
            });
        } finally {
            pendingRequestsRef.current.past.inFlight = false;
        }
    }, [currentDetails, sequenceBounds, FETCH_BATCH_SIZE, transformCandles, mergeCandles, setBufferLoading, toast]);

    const fetchNewerCandles = useCallback(async () => {
        const { platformName, stockSymbol, timeframe } = currentDetails;

        if (!platformName || !stockSymbol || !timeframe) {
            console.warn('[useCandleSubscription] No active subscription for fetchNewerCandles');
            return;
        }

        if (pendingRequestsRef.current.future.inFlight) {
            console.log('[useCandleSubscription] Future request already in flight');
            return;
        }

        const { maxLoadedSequence, latestKnownSequence } = sequenceBounds;

        if (maxLoadedSequence >= latestKnownSequence) {
            console.log('[useCandleSubscription] Already at latest data');
            return;
        }

        console.log('[useCandleSubscription] Fetching newer candles:', {
            maxLoadedSequence,
            latestKnownSequence,
            fetchCount: FETCH_BATCH_SIZE
        });

        pendingRequestsRef.current.future.inFlight = true;
        setBufferLoading('future', true);

        try {
            const response = await candleApiService.getCandlesAfterSequence(
                platformName,
                stockSymbol,
                timeframe,
                maxLoadedSequence,
                FETCH_BATCH_SIZE,
                latestKnownSequence
            );

            const candles = transformCandles(response.candles);

            console.log('[useCandleSubscription] Newer candles fetched:', {
                count: candles.length,
                firstSeq: candles[0]?.sequence,
                lastSeq: candles[candles.length - 1]?.sequence
            });

            if (candles.length > 0) {
                mergeCandles(candles, { direction: 'future' });
            } else {
                setBufferLoading('future', false);
            }
        } catch (err) {
            console.error('[useCandleSubscription] Error fetching newer candles:', err);
            setBufferLoading('future', false);

            toast({
                title: "Data Error",
                description: "Failed to load newer data",
                variant: "destructive",
                duration: 3000
            });
        } finally {
            pendingRequestsRef.current.future.inFlight = false;
        }
    }, [currentDetails, sequenceBounds, FETCH_BATCH_SIZE, transformCandles, mergeCandles, setBufferLoading, toast]);

    const fetchIndicatorData = useCallback(async (lookbackNeeded) => {
        const { platformName, stockSymbol, timeframe } = currentDetails;

        if (!platformName || !stockSymbol || !timeframe) {
            return;
        }

        const { minLoadedSequence } = sequenceBounds;

        if (minLoadedSequence <= 1) {
            console.log('[useCandleSubscription] Already at oldest data for indicators');
            return;
        }

        console.log('[useCandleSubscription] Fetching indicator data:', {
            lookbackNeeded,
            minLoadedSequence
        });

        try {
            const response = await candleApiService.getCandlesBeforeSequence(
                platformName,
                stockSymbol,
                timeframe,
                minLoadedSequence,
                lookbackNeeded
            );

            const candles = transformCandles(response.candles);

            if (candles.length > 0) {
                mergeCandles(candles, { direction: 'past' });
            }
        } catch (err) {
            console.error('[useCandleSubscription] Error fetching indicator data:', err);
        }
    }, [currentDetails, sequenceBounds, transformCandles, mergeCandles]);

    const handleWebSocketMessage = useCallback((message) => {
        console.log('[useCandleSubscription] WebSocket message:', message.type);

        switch (message.type) {
            case 'SUBSCRIPTION_CONFIRMED':
                console.log('[useCandleSubscription] Subscription confirmed');
                break;

            case 'INITIAL_CANDLE':
                console.log('[useCandleSubscription] Initial candle received:', {
                    sequence: message.sequence,
                    timestamp: message.timestamp
                });

                if (message.sequence) {
                    latestSequenceFromWSRef.current = message.sequence;
                    updateLatestKnownSequence(message.sequence);
                }
                break;

            case 'NEW_CANDLE':
            case 'CANDLE_UPDATE':
                if (message.candles && message.candles.length > 0) {
                    const transformed = message.candles.map(c => ({
                        sequence: c.sequence,
                        timestamp: new Date(c.timestamp + 'Z').getTime(),
                        open: parseFloat(c.openPrice),
                        high: parseFloat(c.highPrice),
                        low: parseFloat(c.lowPrice),
                        close: parseFloat(c.closePrice),
                        volume: parseFloat(c.volume),
                        indicatorValues: {}
                    }));

                    handleLiveCandleUpdate(transformed, message.latestSequence);
                }
                break;

            default:
                console.log('[useCandleSubscription] Unknown message type:', message.type);
        }
    }, [updateLatestKnownSequence, handleLiveCandleUpdate]);

    /**
     * Wait for WebSocket to provide the latest sequence number
     */
    const waitForLatestSequence = useCallback((timeoutMs = WS_SEQUENCE_TIMEOUT) => {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;

                if (latestSequenceFromWSRef.current !== null) {
                    console.log('[useCandleSubscription] Got sequence from WebSocket:', latestSequenceFromWSRef.current);
                    clearInterval(checkInterval);
                    resolve(latestSequenceFromWSRef.current);
                } else if (elapsed >= timeoutMs) {
                    console.warn('[useCandleSubscription] Timeout waiting for WebSocket sequence, will use date-based fallback');
                    clearInterval(checkInterval);
                    resolve(null);
                }
            }, 100);
        });
    }, []);

    /**
     * Subscribe to candles for a stock
     *
     * Flow:
     * 1. Unsubscribe from existing WebSocket subscription
     * 2. Subscribe to WebSocket FIRST to get the latest sequence
     * 3. Wait for WebSocket to send INITIAL_CANDLE with sequence
     * 4. Fetch initial data via REST using the sequence
     * 5. Initialize chart with fetched data
     */
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn('[useCandleSubscription] Missing parameters');
            return Promise.reject(new Error("Missing required parameters"));
        }

        if (
            currentDetails.platformName === platformName &&
            currentDetails.stockSymbol === stockSymbol &&
            currentDetails.timeframe === timeframe &&
            activeSubscriptionId
        ) {
            console.log('[useCandleSubscription] Already subscribed to this');
            return activeSubscriptionId;
        }

        const prev = previousSubscriptionRef.current;
        const isTimeframeChangeOnly =
            prev.platformName === platformName &&
            prev.stockSymbol === stockSymbol &&
            prev.timeframe !== timeframe &&
            prev.timeframe !== null;

        console.log('[useCandleSubscription] Subscribing:', {
            platformName,
            stockSymbol,
            timeframe,
            isTimeframeChangeOnly
        });

        setIsSubscribing(true);
        setIsWaitingForData(true);
        setError(null);

        latestSequenceFromWSRef.current = null;

        try {
            if (activeSubscriptionId) {
                await unsubscribeFromCandleUpdates();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            console.log('[useCandleSubscription] Subscribing to WebSocket...');
            await subscribeToCandleUpdates(platformName, stockSymbol, timeframe);

            console.log('[useCandleSubscription] Waiting for latest sequence from WebSocket...');
            const latestSequence = await waitForLatestSequence();

            let candles;
            let anchorSequence = null;

            if (isTimeframeChangeOnly) {
                const currentCandles = chartContext.displayCandles || [];
                const viewStart = chartContext.viewStartIndex || 0;
                const anchorCandle = currentCandles[viewStart];

                if (anchorCandle) {
                    const result = await fetchCandlesForTimeframeSwitch(
                        platformName,
                        stockSymbol,
                        timeframe,
                        anchorCandle.timestamp
                    );
                    candles = result.candles;
                    anchorSequence = result.anchorSequence;
                } else {
                    candles = await fetchInitialCandles(platformName, stockSymbol, timeframe, latestSequence);
                }
            } else {
                candles = await fetchInitialCandles(platformName, stockSymbol, timeframe, latestSequence);
            }

            if (!candles || candles.length === 0) {
                throw new Error('No candle data available');
            }

            const latestSeq = latestSequence || candles[candles.length - 1]?.sequence;

            initializeChart(candles, {
                symbol: stockSymbol,
                platform: platformName,
                timeframe: timeframe,
                timeframeMs: parseTimeframeToMs(timeframe)
            }, {
                latestKnownSequence: latestSeq,
                anchorToSequence: anchorSequence
            });

            setCurrentDetails({ platformName, stockSymbol, timeframe });
            previousSubscriptionRef.current = { platformName, stockSymbol, timeframe };

            console.log('[useCandleSubscription] Subscription complete');
            return "success";

        } catch (err) {
            console.error('[useCandleSubscription] Subscription error:', err);
            setError(err.message);
            setIsWaitingForData(false);

            toast({
                title: "Subscription Error",
                description: err.message,
                variant: "destructive",
                duration: 5000
            });

            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [
        currentDetails,
        activeSubscriptionId,
        unsubscribeFromCandleUpdates,
        subscribeToCandleUpdates,
        waitForLatestSequence,
        fetchInitialCandles,
        fetchCandlesForTimeframeSwitch,
        initializeChart,
        parseTimeframeToMs,
        setIsWaitingForData,
        toast,
        chartContext
    ]);

    const unsubscribeFromCandles = useCallback(async () => {
        console.log('[useCandleSubscription] Unsubscribing');

        setCurrentDetails({
            platformName: null,
            stockSymbol: null,
            timeframe: null
        });

        previousSubscriptionRef.current = {
            platformName: null,
            stockSymbol: null,
            timeframe: null
        };

        latestSequenceFromWSRef.current = null;

        pendingRequestsRef.current.past.inFlight = false;
        pendingRequestsRef.current.future.inFlight = false;

        return unsubscribeFromCandleUpdates();
    }, [unsubscribeFromCandleUpdates]);

    useEffect(() => {
        const handleBufferNeeded = (event) => {
            const { direction } = event.detail || {};

            if (direction === 'past') {
                fetchOlderCandles();
            } else if (direction === 'future') {
                fetchNewerCandles();
            }
        };

        window.addEventListener('chartBufferNeeded', handleBufferNeeded);
        return () => window.removeEventListener('chartBufferNeeded', handleBufferNeeded);
    }, [fetchOlderCandles, fetchNewerCandles]);

    useEffect(() => {
        const handleIndicatorDataNeeded = (event) => {
            const { lookbackNeeded } = event.detail || {};

            if (lookbackNeeded > 0) {
                fetchIndicatorData(lookbackNeeded);
            }
        };

        window.addEventListener('indicatorDataNeeded', handleIndicatorDataNeeded);
        return () => window.removeEventListener('indicatorDataNeeded', handleIndicatorDataNeeded);
    }, [fetchIndicatorData]);

    useEffect(() => {
        const handleRestartRequest = async () => {
            const { platformName, stockSymbol, timeframe } = currentDetails;

            if (!platformName || !stockSymbol || !timeframe) {
                console.warn('[useCandleSubscription] Cannot restart - no active subscription');
                return;
            }

            console.log('[useCandleSubscription] Restarting chart');

            previousSubscriptionRef.current = {
                platformName: null,
                stockSymbol: null,
                timeframe: null
            };

            await unsubscribeFromCandles();
            await new Promise(resolve => setTimeout(resolve, 300));
            await subscribeToCandles(platformName, stockSymbol, timeframe);
        };

        window.addEventListener('restartChartRequested', handleRestartRequest);
        return () => window.removeEventListener('restartChartRequested', handleRestartRequest);
    }, [currentDetails, unsubscribeFromCandles, subscribeToCandles]);

    useEffect(() => {
        const unregister = registerHandler(handleWebSocketMessage);
        return () => unregister();
    }, [registerHandler, handleWebSocketMessage]);

    useEffect(() => {
        if (latestCandleInfo?.sequence) {
            updateLatestKnownSequence(latestCandleInfo.sequence);
        }
    }, [latestCandleInfo, updateLatestKnownSequence]);

    useEffect(() => {
        return () => {
            console.log('[useCandleSubscription] Cleaning up');
            pendingRequestsRef.current.past.inFlight = false;
            pendingRequestsRef.current.future.inFlight = false;
            latestSequenceFromWSRef.current = null;
        };
    }, []);

    return {
        isConnected,
        isSubscribing,
        activeSubscriptionId,
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        currentSubscriptionDetails: currentDetails,
        latestCandleInfo
    };
}