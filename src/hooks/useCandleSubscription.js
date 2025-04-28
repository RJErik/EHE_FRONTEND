// src/hooks/useCandleSubscription.js
import { useState, useEffect, useContext, useCallback } from 'react';
import { ChartContext } from '../components/stockMarket/ChartContext';
import webSocketService, { CHART_CANDLES_QUEUE, INDICATOR_CANDLES_QUEUE } from '../services/websocketService';
import { useToast } from './use-toast';

// Global persistent subscription manager - lives outside React lifecycle
const SubscriptionManager = {
    // Active subscription tracking for both types
    activeSubscriptions: {
        chart: null,     // For display candles
        indicator: null  // For indicator calculations
    },

    currentSubscription: {
        platformName: null,
        stockSymbol: null,
        timeframe: null
    },

    // Heartbeat tracking
    lastHeartbeatTime: null,
    heartbeatCount: 0,

    // WebSocket connection state
    isConnected: false,
    subscriptions: {
        chart: null,
        indicator: null
    },

    // Track initialization and message handlers
    initialized: false,
    messageHandlers: {
        chart: new Set(),
        indicator: new Set()
    },

    // Initialize the global websocket connection (once)
    async initialize() {
        if (this.initialized) {
            console.log("[SubscriptionManager] Already initialized");
            return;
        }

        try {
            // Connect to WebSocket
            await webSocketService.connect();
            console.log("[SubscriptionManager] WebSocket connected globally");
            this.isConnected = true;

            // Subscribe to the chart candles queue
            this.subscriptions.chart = await webSocketService.subscribe(
                CHART_CANDLES_QUEUE,
                (message) => this.handleGlobalMessage(message, 'chart')
            );
            
            console.log("[SubscriptionManager] Subscribed to chart candles queue");
            
            this.initialized = true;
            console.log("[SubscriptionManager] Global WebSocket initialization complete");
        } catch (err) {
            console.error("[SubscriptionManager] Failed to initialize global WebSocket:", err);
            throw err;
        }
    },

    // Global message handler that handles messages from specific queues
    handleGlobalMessage(message, queueType) {
        console.log(`[###########################ALMA############################`);
        // Parse the message if it's a string
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Track heartbeats
        if (data.updateType === "HEARTBEAT") {
            this.recordHeartbeat(data.subscriptionId, queueType);
            return; // Skip further processing for heartbeats
        }

        if (queueType === 'chart') {
            console.log(`[SubscriptionManager] Routing message from chart queue for subscription ${data.subscriptionId || 'unknown'}`);
            this.messageHandlers.chart.forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error("[SubscriptionManager] Error in chart message handler:", err);
                }
            });
        }
        else if (queueType === 'indicator') {
            console.log(`[SubscriptionManager] Routing message from indicator queue for subscription ${data.subscriptionId || 'unknown'}`);
            this.messageHandlers.indicator.forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error("[SubscriptionManager] Error in indicator message handler:", err);
                }
            });
        }
        else {
            console.log(`[SubscriptionManager] Message with unknown queue type: ${queueType}`);
        }
    },

    // Record heartbeat information
    recordHeartbeat(subscriptionId, queueType) {
        this.lastHeartbeatTime = new Date();
        this.heartbeatCount++;

        const timestamp = new Date().toISOString().substr(11, 12);
        const isExpectedId = subscriptionId === this.activeSubscriptions[queueType];

        console.log(`[${timestamp}] Heartbeat #${this.heartbeatCount} for ${queueType} subscription: ${subscriptionId}`);

        // Clean up stale subscriptions that are still sending heartbeats
        if (!isExpectedId && subscriptionId) {
            console.log(`[SubscriptionManager] Cleaning up stale subscription: ${subscriptionId}`);
            webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: subscriptionId
            }).catch(() => {});
        }

        return isExpectedId;
    },

    // Set active subscription by type
    setActiveSubscription(type, id) {
        if (!type || !id) return;

        console.log(`[SubscriptionManager] Setting active ${type} subscription to: ${id}`);
        this.activeSubscriptions[type] = id;
    },

    // Clear active subscription by type
    clearActiveSubscription(type) {
        if (!type) return;

        console.log(`[SubscriptionManager] Clearing active ${type} subscription: ${this.activeSubscriptions[type]}`);
        this.activeSubscriptions[type] = null;
    },

    // Update current symbol/platform/timeframe info
    updateCurrentSubscriptionInfo(details) {
        if (details) {
            this.currentSubscription = { ...details };
            console.log(`[SubscriptionManager] Updated subscription details:`, this.currentSubscription);
        }
    },

    // Register a message handler for a specific type
    registerHandler(type, handler) {
        if (!type || !handler) return () => {};

        console.log(`[SubscriptionManager] Registering new ${type} message handler`);
        this.messageHandlers[type].add(handler);
        return () => this.unregisterHandler(type, handler);
    },

    // Unregister a message handler for a specific type
    unregisterHandler(type, handler) {
        if (!type || !handler) return;

        console.log(`[SubscriptionManager] Unregistering ${type} message handler`);
        this.messageHandlers[type].delete(handler);
    },

    // Explicitly unsubscribe a specific type
    async unsubscribe(type) {
        if (!type || !this.activeSubscriptions[type]) {
            return Promise.resolve(true);
        }

        try {
            console.log(`[SubscriptionManager] Explicitly unsubscribing ${type} subscription: ${this.activeSubscriptions[type]}`);

            await webSocketService.safeSend('/app/candles/unsubscribe', {
                subscriptionId: this.activeSubscriptions[type]
            });

            this.clearActiveSubscription(type);
            
            // If unsubscribing from indicator, also clean up the queue subscription
            if (type === 'indicator' && this.subscriptions.indicator) {
                console.log(`[SubscriptionManager] Unsubscribing from indicator queue`);
                webSocketService.unsubscribe(INDICATOR_CANDLES_QUEUE);
                this.subscriptions.indicator = null;
            }
            
            return true;
        } catch (err) {
            console.error(`[SubscriptionManager] Error unsubscribing ${type}:`, err);
            return false;
        }
    },

    // Unsubscribe from all active subscriptions
    async unsubscribeAll() {
        const results = [];

        if (this.activeSubscriptions.chart) {
            results.push(await this.unsubscribe('chart'));
        }

        if (this.activeSubscriptions.indicator) {
            results.push(await this.unsubscribe('indicator'));
        }

        return results.every(success => success);
    }
};

export function useCandleSubscription() {
    const [isConnected, setIsConnected] = useState(SubscriptionManager.isConnected);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Get chart context for data management
    const {
        setDisplayCandles,
        setIndicatorCandles,
        calculateRequiredDataRange,
        setViewStartIndex,
        displayedCandles,
        setIsWaitingForData,
        applyIndicatorsToCandleDisplay,
        indicators
    } = useContext(ChartContext);

    // Calculate start date based on timeframe and number of candles
    const calculateStartDate = useCallback((endDate, timeframe, candleCount) => {
        let timeframeMinutes = 1; // default to 1 minute

        // Convert timeframe to lowercase for case-insensitive matching
        const normalizedTimeframe = timeframe.toLowerCase();

        // Parse timeframe to get minutes
        if (normalizedTimeframe.endsWith('m')) {
            timeframeMinutes = parseInt(timeframe);
        } else if (normalizedTimeframe.endsWith('h')) {
            timeframeMinutes = parseInt(timeframe) * 60;
        } else if (normalizedTimeframe.endsWith('d')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24;
        } else if (normalizedTimeframe.endsWith('w')) {
            timeframeMinutes = parseInt(timeframe) * 60 * 24 * 7;
        }

        // Calculate how far back to go based on candle count and timeframe
        const minutesBack = timeframeMinutes * candleCount;
        return new Date(endDate.getTime() - (minutesBack * 60 * 1000));
    }, []);

    // Transform candle data from backend format to frontend format
    const transformCandleData = useCallback((backendCandle, stockSymbol) => {
        return {
            timestamp: new Date(backendCandle.timestamp).getTime(),
            open: backendCandle.openPrice,
            high: backendCandle.highPrice,
            low: backendCandle.lowPrice,
            close: backendCandle.closePrice,
            volume: backendCandle.volume,
            ticker: stockSymbol || SubscriptionManager.currentSubscription.stockSymbol,
            indicatorValues: {}
        };
    }, []);

    // Handle incoming chart candle data
    const handleChartCandleMessage = useCallback((data) => {
        // Skip heartbeats - already handled in SubscriptionManager
        if (data.updateType === "HEARTBEAT") return;

        // Handle subscription response
        if (data.subscriptionId && data.updateType === undefined) {
            if (data.success === false) {
                console.error("[useCandleSubscription] Chart subscription error:", data.message);
                setError(data.message);

                toast({
                    title: "Chart Subscription Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 5000
                });
                return;
            }

            // Store the new subscription ID
            SubscriptionManager.setActiveSubscription('chart', data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed to chart data with ID: ${data.subscriptionId}`);
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received chart candle updates:", data.updatedCandles.length);

            // Get timestamps from first and last candles to log data range received
            const firstCandleTime = new Date(data.updatedCandles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.updatedCandles[data.updatedCandles.length-1].timestamp).toISOString();
            console.log(`[WebSocket Data] Received chart candle update range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, SubscriptionManager.currentSubscription.stockSymbol));

            // Update display candles only
            updateDisplayCandles(newCandles);
        }
        // Handle initial data load
        else if (data.candles) {
            console.log("[useCandleSubscription] Received initial chart candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Chart data fetch error:", data.message);
                setError(data.message);
                setIsWaitingForData(false);
                return;
            }

            // Log the received data range
            if (data.candles.length > 0) {
                const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
                const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
                console.log(`[WebSocket Data] Received initial chart data range: ${firstCandleTime} to ${lastCandleTime}`);
                console.log(`[WebSocket Data] Platform: ${data.platformName}, Symbol: ${data.stockSymbol}, Timeframe: ${data.timeframe}`);
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol));

            // Update display candles with new data
            updateDisplayCandles(newCandles, true);

            setViewStartIndex(Math.max(0, newCandles.length - displayedCandles));
            setError(null);
            setIsWaitingForData(false);
        }
    }, [setDisplayCandles, setViewStartIndex, displayedCandles, setIsWaitingForData, toast, transformCandleData]);

    // Handle incoming indicator candle data
    const handleIndicatorCandleMessage = useCallback((data) => {
        // Skip heartbeats - already handled in SubscriptionManager
        if (data.updateType === "HEARTBEAT") return;

        // Handle subscription response
        if (data.subscriptionId && data.updateType === undefined) {
            if (data.success === false) {
                console.error("[useCandleSubscription] Indicator subscription error:", data.message);
                // Don't set global error for indicator data issues

                toast({
                    title: "Indicator Data Error",
                    description: data.message,
                    variant: "destructive",
                    duration: 3000
                });
                return;
            }

            // Store the new subscription ID
            SubscriptionManager.setActiveSubscription('indicator', data.subscriptionId);
            console.log(`[useCandleSubscription] Successfully subscribed to indicator data with ID: ${data.subscriptionId}`);
        }
        // Handle candle updates
        else if (data.updateType === "UPDATE" && data.updatedCandles?.length > 0) {
            console.log("[useCandleSubscription] Received indicator candle updates:", data.updatedCandles.length);

            // Get timestamps from first and last candles to log data range received
            const firstCandleTime = new Date(data.updatedCandles[0].timestamp).toISOString();
            const lastCandleTime = new Date(data.updatedCandles[data.updatedCandles.length-1].timestamp).toISOString();
            console.log(`[WebSocket Data] Received indicator candle update range: ${firstCandleTime} to ${lastCandleTime}`);

            // Transform backend candles to frontend format
            const newCandles = data.updatedCandles.map(candle =>
                transformCandleData(candle, SubscriptionManager.currentSubscription.stockSymbol));

            // Update indicator candles only
            updateIndicatorCandles(newCandles);
        }
        // Handle initial data load
        else if (data.candles) {
            console.log("[useCandleSubscription] Received initial indicator candle data:", data.candles.length);

            if (data.success === false) {
                console.error("[useCandleSubscription] Indicator data fetch error:", data.message);
                // Don't set global error for indicator data issues
                return;
            }

            // Log the received data range
            if (data.candles.length > 0) {
                const firstCandleTime = new Date(data.candles[0].timestamp).toISOString();
                const lastCandleTime = new Date(data.candles[data.candles.length-1].timestamp).toISOString();
                console.log(`[WebSocket Data] Received initial indicator data range: ${firstCandleTime} to ${lastCandleTime}`);
            }

            // Transform the new candles
            const newCandles = data.candles
                .map(c => transformCandleData(c, SubscriptionManager.currentSubscription.stockSymbol));

            // Update indicator candles with new data
            updateIndicatorCandles(newCandles, true);

            // Apply indicators after data is loaded
            setTimeout(() => {
                applyIndicatorsToCandleDisplay();
            }, 50);
        }
    }, [setIndicatorCandles, applyIndicatorsToCandleDisplay, toast, transformCandleData]);

    // Helper function to update only display candles
    const updateDisplayCandles = useCallback((newCandles, isInitialLoad = false) => {
        setDisplayCandles(prevCandles => {
            console.log('[Chart] Updating display candles - Initial load:', isInitialLoad);

            // For initial load or when explicitly refreshing, replace the entire buffer
            if (isInitialLoad) {
                return [...newCandles].sort((a, b) => a.timestamp - b.timestamp);
            }

            // Create a copy of the buffer to modify
            const updatedBuffer = [...prevCandles];

            // Update or add each candle
            newCandles.forEach(newCandle => {
                const existingIndex = updatedBuffer.findIndex(
                    c => c.timestamp === newCandle.timestamp
                );

                if (existingIndex >= 0) {
                    updatedBuffer[existingIndex] = newCandle;
                } else {
                    updatedBuffer.push(newCandle);
                }
            });

            // Sort by timestamp
            return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
        });
    }, [setDisplayCandles]);

    // Helper function to update only indicator candles
    const updateIndicatorCandles = useCallback((newCandles, isInitialLoad = false) => {
        setIndicatorCandles(prevCandles => {
            console.log('[Indicator] Updating indicator candles - Initial load:', isInitialLoad);

            // For initial load or when explicitly refreshing, replace the entire buffer
            if (isInitialLoad) {
                return [...newCandles].sort((a, b) => a.timestamp - b.timestamp);
            }

            // Create a copy of the buffer to modify
            const updatedBuffer = [...prevCandles];

            // Update or add each candle
            newCandles.forEach(newCandle => {
                const existingIndex = updatedBuffer.findIndex(
                    c => c.timestamp === newCandle.timestamp
                );

                if (existingIndex >= 0) {
                    updatedBuffer[existingIndex] = newCandle;
                } else {
                    updatedBuffer.push(newCandle);
                }
            });

            // Sort by timestamp
            return updatedBuffer.sort((a, b) => a.timestamp - b.timestamp);
        });
    }, [setIndicatorCandles]);

    // Subscribe to candles for the chart display
    const subscribeToChartCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for chart subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        // If we're already subscribed to this exact combination for chart data, no need to resubscribe
        if (
            SubscriptionManager.currentSubscription.platformName === platformName &&
            SubscriptionManager.currentSubscription.stockSymbol === stockSymbol &&
            SubscriptionManager.currentSubscription.timeframe === timeframe &&
            SubscriptionManager.activeSubscriptions.chart
        ) {
            console.log("[useCandleSubscription] Already subscribed to this chart data");
            return Promise.resolve(SubscriptionManager.activeSubscriptions.chart);
        }

        setIsSubscribing(true);
        setIsWaitingForData(true);

        try {
            // First, unsubscribe from any existing chart subscription
            if (SubscriptionManager.activeSubscriptions.chart) {
                console.log(`[useCandleSubscription] Unsubscribing from current chart subscription before creating new one`);
                await SubscriptionManager.unsubscribe('chart');
                // Small delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Update subscription details - store centrally for both subscriptions
            SubscriptionManager.updateCurrentSubscriptionInfo({
                platformName,
                stockSymbol,
                timeframe
            });

            // For chart data, request exactly displayedCandles worth of data
            const now = new Date();
            const endDate = now;
            const startDate = calculateStartDate(endDate, timeframe, displayedCandles);

            console.log("--------- CHART CANDLE DATA REQUEST ---------");
            console.log(`[Chart Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Chart Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Chart Request] End date: ${endDate.toISOString()}`);
            console.log(`[Chart Request] Candles needed: ${displayedCandles}`);
            console.log("---------------------------------------------");

            const chartSubscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                destinationQueue: CHART_CANDLES_QUEUE  // Specify destination queue
            };

            console.log("[useCandleSubscription] Subscribing to chart candles:", chartSubscriptionRequest);

            await webSocketService.send('/app/candles/subscribe', chartSubscriptionRequest);
            console.log("[useCandleSubscription] Chart subscription request sent");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to chart candles:", err);
            setError("Failed to subscribe: " + err.message);
            setIsWaitingForData(false);
            throw err;
        } finally {
            setIsSubscribing(false);
        }
    }, [calculateStartDate, setIsWaitingForData, displayedCandles]);

    // Subscribe to candles for indicator calculations
    const subscribeToIndicatorCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        // Only subscribe if we have indicators
        if (indicators.length === 0) {
            console.log("[useCandleSubscription] No indicators active, skipping indicator subscription");
            return Promise.resolve(null);
        }

        if (!platformName || !stockSymbol || !timeframe) {
            console.warn("[useCandleSubscription] Missing parameters for indicator subscription");
            return Promise.reject(new Error("Missing required parameters"));
        }

        try {
            // First, unsubscribe from any existing indicator subscription
            if (SubscriptionManager.activeSubscriptions.indicator) {
                console.log(`[useCandleSubscription] Unsubscribing from current indicator subscription before creating new one`);
                await SubscriptionManager.unsubscribe('indicator');
                // Small delay to ensure backend processes the unsubscribe
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Subscribe to the indicator queue if not already subscribed
            if (!SubscriptionManager.subscriptions.indicator) {
                console.log("[SubscriptionManager] Setting up indicator queue subscription");
                SubscriptionManager.subscriptions.indicator = await webSocketService.subscribe(
                    INDICATOR_CANDLES_QUEUE,
                    (message) => SubscriptionManager.handleGlobalMessage(message, 'indicator')
                );
                console.log("[SubscriptionManager] Subscribed to indicator candles queue");
            }

            // Calculate the required data range for indicators
            const range = calculateRequiredDataRange();

            // For indicator data, use the calculated range or a sensible default
            const now = new Date();
            const endDate = range.end ? new Date(range.end) : now;

            // Start date should be further back based on indicator requirements
            const startDate = range.start ? new Date(range.start) :
                calculateStartDate(endDate, timeframe, displayedCandles * 3); // Use 3x display candles as safe default

            console.log("--------- INDICATOR CANDLE DATA REQUEST ---------");
            console.log(`[Indicator Request] Platform: ${platformName}, Symbol: ${stockSymbol}, Timeframe: ${timeframe}`);
            console.log(`[Indicator Request] Start date: ${startDate.toISOString()}`);
            console.log(`[Indicator Request] End date: ${endDate.toISOString()}`);
            console.log(`[Indicator Request] Lookback needed: ${range.lookbackNeeded || 'default'} candles`);
            console.log(`[Indicator Request] Active indicators: ${indicators.length}`);
            console.log("--------------------------------------------------");

            const indicatorSubscriptionRequest = {
                platformName,
                stockSymbol,
                timeframe,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                resetData: true,  // Always true for indicator data
                destinationQueue: INDICATOR_CANDLES_QUEUE  // Specify destination queue
            };

            console.log("[useCandleSubscription] Subscribing to indicator candles:", indicatorSubscriptionRequest);

            await webSocketService.send('/app/candles/subscribe', indicatorSubscriptionRequest);
            console.log("[useCandleSubscription] Indicator subscription request sent");

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error subscribing to indicator candles:", err);

            toast({
                title: "Indicator Data Error",
                description: "Failed to subscribe to indicator data: " + err.message,
                variant: "destructive",
                duration: 3000
            });

            return null;
        }
    }, [calculateRequiredDataRange, calculateStartDate, displayedCandles, indicators, toast]);

    // Update indicator subscription when indicator requirements change
    const updateIndicatorSubscription = useCallback(async () => {
        // Only proceed if we have an active chart subscription and indicators
        if (!SubscriptionManager.activeSubscriptions.chart || indicators.length === 0) {
            return;
        }

        const { platformName, stockSymbol, timeframe } = SubscriptionManager.currentSubscription;
        if (!platformName || !stockSymbol || !timeframe) {
            console.log("[useCandleSubscription] Cannot update indicator subscription - missing details");
            return;
        }

        console.log("[useCandleSubscription] Updating indicator subscription due to indicator changes");
        await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
    }, [indicators, subscribeToIndicatorCandles]);

    // Main subscription function exposed to components
    const subscribeToCandles = useCallback(async (platformName, stockSymbol, timeframe) => {
        try {
            // First subscribe to chart data
            await subscribeToChartCandles(platformName, stockSymbol, timeframe);

            // After subscribing to chart data, also subscribe to indicator data if needed
            if (indicators.length > 0) {
                // Small delay to ensure backend processes the first subscription
                await new Promise(resolve => setTimeout(resolve, 200));
                await subscribeToIndicatorCandles(platformName, stockSymbol, timeframe);
            }

            return "pending";
        } catch (err) {
            console.error("[useCandleSubscription] Error in main subscription function:", err);
            throw err;
        }
    }, [subscribeToChartCandles, subscribeToIndicatorCandles, indicators]);

    // Listen for indicator requirement changes
    useEffect(() => {
        // Define event handler for indicator requirement changes
        const handleIndicatorRequirementsChanged = async (event) => {
            console.log(`[Indicator Monitor] Detected indicator requirements change event`);
            await updateIndicatorSubscription();
        };

        // Register event listener for indicator changes
        window.addEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);

        // Clean up event listener
        return () => {
            window.removeEventListener('indicatorRequirementsChanged', handleIndicatorRequirementsChanged);
        };
    }, [updateIndicatorSubscription]);

    // Initialize and setup effect
    useEffect(() => {
        console.log("[useCandleSubscription] Setting up WebSocket connection");

        const setup = async () => {
            try {
                // Initialize the global WebSocket if not already done
                await SubscriptionManager.initialize();
                setIsConnected(true);
                setError(null);
            } catch (err) {
                console.error("[useCandleSubscription] Setup error:", err);
                setIsConnected(false);
                setError("Failed to connect: " + err.message);

                toast({
                    title: "Connection Error",
                    description: "Failed to connect to server for live data.",
                    variant: "destructive",
                    duration: 5000
                });
            }
        };

        setup();

        // Register our handlers
        const unregisterChartHandler = SubscriptionManager.registerHandler('chart', handleChartCandleMessage);
        const unregisterIndicatorHandler = SubscriptionManager.registerHandler('indicator', handleIndicatorCandleMessage);

        // Cleanup function - just unregister our handlers, don't disconnect
        return () => {
            console.log("[useCandleSubscription] Component unmounting - keeping WebSocket alive");
            unregisterChartHandler();
            unregisterIndicatorHandler();
        };
    }, [handleChartCandleMessage, handleIndicatorCandleMessage, toast]);

    // Watch for indicator changes to manage indicator subscription lifecycle
    useEffect(() => {
        // If indicators are added and we have an active chart subscription but no indicator subscription
        if (indicators.length > 0 &&
            SubscriptionManager.activeSubscriptions.chart &&
            !SubscriptionManager.activeSubscriptions.indicator) {

            const { platformName, stockSymbol, timeframe } = SubscriptionManager.currentSubscription;
            if (platformName && stockSymbol && timeframe) {
                console.log("[useCandleSubscription] Indicators added - creating indicator subscription");
                subscribeToIndicatorCandles(platformName, stockSymbol, timeframe).catch(err => {
                    console.error("[useCandleSubscription] Failed to create indicator subscription:", err);
                });
            }
        }
        // If indicators are removed and we have an active indicator subscription
        else if (indicators.length === 0 && SubscriptionManager.activeSubscriptions.indicator) {
            console.log("[useCandleSubscription] No indicators active - removing indicator subscription");
            SubscriptionManager.unsubscribe('indicator').catch(err => {
                console.error("[useCandleSubscription] Failed to remove indicator subscription:", err);
            });
            
            // Also unsubscribe from the indicator queue if we're not using it anymore
            if (SubscriptionManager.subscriptions.indicator) {
                console.log("[useCandleSubscription] Unsubscribing from indicator queue");
                webSocketService.unsubscribe(INDICATOR_CANDLES_QUEUE);
                SubscriptionManager.subscriptions.indicator = null;
            }
        }
    }, [indicators, subscribeToIndicatorCandles]);

    // Expose the unsubscribe function for explicit use
    const unsubscribeFromCandles = useCallback(async () => {
        return SubscriptionManager.unsubscribeAll();
    }, []);

    return {
        isConnected,
        isSubscribing,
        // Return subscription IDs for debugging
        subscriptionIds: {
            chart: SubscriptionManager.activeSubscriptions.chart,
            indicator: SubscriptionManager.activeSubscriptions.indicator
        },
        error,
        subscribeToCandles,
        unsubscribeFromCandles,
        updateIndicatorSubscription
    };
}