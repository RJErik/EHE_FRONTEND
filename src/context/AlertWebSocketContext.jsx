// src/context/AlertWebSocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import webSocketService from '../services/websocketService';
import { useToast } from '../hooks/use-toast';

// Create the context
const AlertWebSocketContext = createContext();

export function AlertWebSocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(webSocketService.isConnected());
    const subscriptionIdRef = useRef(null);
    const alertSubscriptionRef = useRef(null);
    const connectionCheckRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const isConnectedRef = useRef(isConnected);
    const { toast } = useToast();

    // Add a ref to store alert callback functions
    const alertCallbacksRef = useRef([]);

    // Function to register a callback when alerts are triggered
    const registerAlertCallback = useCallback((callback) => {
        alertCallbacksRef.current.push(callback);

        // Return unregister function
        return () => {
            alertCallbacksRef.current = alertCallbacksRef.current.filter(cb => cb !== callback);
        };
    }, []);

    // Update ref whenever isConnected changes
    useEffect(() => {
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    // Initialize WebSocket connection and subscription
    useEffect(() => {
        console.log('[AlertWebSocket] Initializing alert WebSocket connection...');

        // Connect and subscribe function
        const setupAlertSubscription = async () => {
            try {
                // Establish connection if not already connected
                if (!webSocketService.isConnected()) {
                    console.log('[AlertWebSocket] Connecting to WebSocket server...');
                    await webSocketService.connect();
                }

                setIsConnected(webSocketService.isConnected());

                // Only proceed with subscription if connected and not already subscribed
                if (webSocketService.isConnected() && !alertSubscriptionRef.current) {
                    console.log('[AlertWebSocket] Creating alert subscription...');

                    // First send subscription request to the server
                    const response = await webSocketService.send('/app/alerts/subscribe', {});
                    console.log('[AlertWebSocket] Subscription request sent:', response);

                    // Then subscribe to the user's alert queue
                    const subscription = await webSocketService.subscribe('/user/queue/alerts', handleAlertMessage);
                    alertSubscriptionRef.current = subscription;

                    console.log('[AlertWebSocket] Successfully subscribed to alerts');
                }
            } catch (error) {
                console.error('[AlertWebSocket] Setup error:', error);
                setIsConnected(false);
                alertSubscriptionRef.current = null;

                // Schedule reconnection attempt
                scheduleReconnect();

                // Notify user of connection issue
                toast({
                    title: 'Alert Connection Issue',
                    description: 'Unable to connect to the alert system. Retrying...',
                    variant: 'destructive',
                    duration: 5000,
                });
            }
        };

        // Start the initial setup
        setupAlertSubscription();

        // Set up periodic connection checking
        connectionCheckRef.current = setInterval(() => {
            const currentlyConnected = webSocketService.isConnected();

            // Update state if connection status has changed
            // Using the ref for comparison instead of the stale closure value
            if (isConnectedRef.current !== currentlyConnected) {
                console.log(`[AlertWebSocket] Connection status changed: ${currentlyConnected ? 'connected' : 'disconnected'}`);
                setIsConnected(currentlyConnected);

                // If connection was lost, clear subscription reference
                if (!currentlyConnected) {
                    alertSubscriptionRef.current = null;
                    scheduleReconnect();
                }
                // If connection was restored but not subscribed, resubscribe
                else if (!alertSubscriptionRef.current) {
                    setupAlertSubscription();
                }
            }
        }, 5000);

        // Clean up on unmount
        return () => {
            console.log('[AlertWebSocket] Cleaning up...');

            // Cancel subscription on the server if we have an ID (using ref)
            if (subscriptionIdRef.current) {
                console.log('[AlertWebSocket] Unsubscribing with ID:', subscriptionIdRef.current);
                // Send unsubscription request with the new DTO structure
                webSocketService.safeSend('/app/alerts/unsubscribe', {
                    subscriptionId: subscriptionIdRef.current
                });
            }

            // Clean up local subscription
            if (alertSubscriptionRef.current) {
                console.log('[AlertWebSocket] Unsubscribing from /user/queue/alerts');
                webSocketService.unsubscribe('/user/queue/alerts');
                alertSubscriptionRef.current = null;
            }

            // Clear timers
            if (connectionCheckRef.current) {
                clearInterval(connectionCheckRef.current);
                connectionCheckRef.current = null;
            }

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }

            console.log('[AlertWebSocket] Cleanup complete');
        };
    }, []); // Empty dependency array is fine - we use refs for cleanup

    // Schedule reconnection attempt
    const scheduleReconnect = () => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = setTimeout(() => {
            console.log('[AlertWebSocket] Attempting to reconnect...');

            // Reset subscription reference before attempting to reconnect
            alertSubscriptionRef.current = null;

            // Attempt to reconnect and subscribe
            webSocketService.connect().then(() => {
                setIsConnected(webSocketService.isConnected());

                if (webSocketService.isConnected()) {
                    webSocketService.send('/app/alerts/subscribe', {}).then(() => {
                        webSocketService.subscribe('/user/queue/alerts', handleAlertMessage).then(subscription => {
                            alertSubscriptionRef.current = subscription;
                            console.log('[AlertWebSocket] Reconnected and subscribed successfully');
                        });
                    });
                }
            }).catch(error => {
                console.error('[AlertWebSocket] Reconnection failed:', error);
                scheduleReconnect(); // Schedule another attempt
            });
        }, 5000); // Try every 5 seconds
    };

    // Handle incoming alert messages
    const handleAlertMessage = (message) => {
        console.log('[AlertWebSocket] Received message:', message);

        // Handle successful responses
        if (message.success) {
            // This is a subscription confirmation
            if (message.subscriptionId && !message.alertId) {
                // Extract the actual subscription ID from the response object
                const actualSubscriptionId = message.subscriptionId.subscriptionId;

                // Store in ref for cleanup
                subscriptionIdRef.current = actualSubscriptionId;
                console.log('[AlertWebSocket] Subscription confirmed, ID:', actualSubscriptionId);
            }
            // This is an actual alert notification
            else if (message.alertId) {
                // Format price values with appropriate decimal places
                const formatPrice = (price) => {
                    if (!price) return 'N/A';

                    // Determine decimal places based on price magnitude
                    const decimalPlaces = price < 1 ? 6 : 2;
                    return price.toLocaleString(undefined, {
                        minimumFractionDigits: decimalPlaces,
                        maximumFractionDigits: decimalPlaces
                    });
                };

                // Format threshold and current prices
                const formattedThreshold = formatPrice(message.thresholdValue);
                const formattedCurrent = formatPrice(message.currentPrice);

                // Get appropriate action verb based on condition type
                const priceAction = message.conditionType === 'PRICE_ABOVE'
                    ? 'rose above'
                    : 'fell below';

                // Create a user-friendly description
                const description = message.message ||
                    `${message.platformName} ${message.stockSymbol} ${priceAction} ${formattedThreshold} (Current: ${formattedCurrent})`;

                // Show the toast notification
                toast({
                    title: `${message.stockSymbol} Alert Triggered!`,
                    description: description,
                    duration: 10000, // 10 seconds for important alerts
                });

                console.log('[AlertWebSocket] Alert notification displayed for', message.stockSymbol);

                // Notify all registered callbacks about the alert
                if (alertCallbacksRef.current.length > 0) {
                    console.log('[AlertWebSocket] Notifying', alertCallbacksRef.current.length, 'callbacks about alert');
                    alertCallbacksRef.current.forEach(callback => {
                        try {
                            callback(message);
                        } catch (error) {
                            console.error('[AlertWebSocket] Error in alert callback:', error);
                        }
                    });
                }
            }
        }
        // Handle error responses
        else {
            console.error('[AlertWebSocket] Error from server:', message.message);

            // Only show toast for substantial errors (not just heartbeat issues)
            if (message.message && !message.message.includes('heartbeat')) {
                toast({
                    title: 'Alert System Issue',
                    description: message.message || 'Unknown error with alert system',
                    variant: 'destructive',
                    duration: 5000,
                });
            }
        }
    };

    // Manual reconnect function for external use
    const reconnect = () => {
        console.log('[AlertWebSocket] Manual reconnection requested');

        // Reset current state
        if (alertSubscriptionRef.current) {
            webSocketService.unsubscribe('/user/queue/alerts');
            alertSubscriptionRef.current = null;
        }

        // Try to reconnect
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
        }

        // Immediate reconnection attempt
        webSocketService.connect().then(() => {
            setIsConnected(webSocketService.isConnected());

            if (webSocketService.isConnected()) {
                webSocketService.send('/app/alerts/subscribe', {}).then(() => {
                    webSocketService.subscribe('/user/queue/alerts', handleAlertMessage).then(subscription => {
                        alertSubscriptionRef.current = subscription;
                        toast({
                            title: 'Alert System',
                            description: 'Successfully reconnected to alerts',
                            duration: 3000,
                        });
                    });
                });
            }
        }).catch(error => {
            console.error('[AlertWebSocket] Manual reconnection failed:', error);
            scheduleReconnect();

            toast({
                title: 'Reconnection Failed',
                description: 'Could not reconnect to alert system. Will retry automatically.',
                variant: 'destructive',
                duration: 5000,
            });
        });
    };

    // Provide alert connection state and methods to children
    return (
        <AlertWebSocketContext.Provider value={{
            isConnected,
            subscriptionId: subscriptionIdRef.current,
            reconnect,
            registerAlertCallback,
        }}>
            {children}
        </AlertWebSocketContext.Provider>
    );
}

// Custom hook to use the alert WebSocket context
export function useAlertWebSocket() {
    const context = useContext(AlertWebSocketContext);
    if (!context) {
        throw new Error('useAlertWebSocket must be used within an AlertWebSocketProvider');
    }
    return context;
}