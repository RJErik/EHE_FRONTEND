// src/context/AlertWebSocketContext.jsx
import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import webSocketService from '../services/websocketService';
import {useToast} from '../hooks/use-toast';

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

    const alertCallbacksRef = useRef([]);

    // Function to register a callback when alerts are triggered
    const registerAlertCallback = useCallback((callback) => {
        alertCallbacksRef.current.push(callback);

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

        const setupAlertSubscription = async () => {
            try {
                if (!webSocketService.isConnected()) {
                    console.log('[AlertWebSocket] Connecting to WebSocket server...');
                    await webSocketService.connect();
                }

                setIsConnected(webSocketService.isConnected());

                if (webSocketService.isConnected() && !alertSubscriptionRef.current) {
                    console.log('[AlertWebSocket] Creating alert subscription...');

                    const response = await webSocketService.send('/app/alerts/subscribe', {});
                    console.log('[AlertWebSocket] Subscription request sent:', response);

                    // Subscribe to the user's alert queue
                    alertSubscriptionRef.current = await webSocketService.subscribe('/user/queue/alerts', handleAlertMessage);

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

        setupAlertSubscription();

        // Set up periodic connection checking
        connectionCheckRef.current = setInterval(() => {
            const currentlyConnected = webSocketService.isConnected();

            if (isConnectedRef.current !== currentlyConnected) {
                console.log(`[AlertWebSocket] Connection status changed: ${currentlyConnected ? 'connected' : 'disconnected'}`);
                setIsConnected(currentlyConnected);

                if (!currentlyConnected) {
                    alertSubscriptionRef.current = null;
                    scheduleReconnect();
                }
                else if (!alertSubscriptionRef.current) {
                    setupAlertSubscription();
                }
            }
        }, 5000);

        // Clean up on unmount
        return () => {
            console.log('[AlertWebSocket] Cleaning up...');

            if (subscriptionIdRef.current) {
                console.log('[AlertWebSocket] Unsubscribing with ID:', subscriptionIdRef.current);
                webSocketService.safeSend('/app/alerts/unsubscribe', {
                    subscriptionId: subscriptionIdRef.current
                });
            }

            if (alertSubscriptionRef.current) {
                console.log('[AlertWebSocket] Unsubscribing from /user/queue/alerts');
                webSocketService.unsubscribe('/user/queue/alerts');
                alertSubscriptionRef.current = null;
            }

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
    }, []);

    const scheduleReconnect = () => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = setTimeout(() => {
            console.log('[AlertWebSocket] Attempting to reconnect...');

            alertSubscriptionRef.current = null;

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
                scheduleReconnect();
            });
        }, 5000);
    };

    // Handle incoming alert messages
    const handleAlertMessage = (message) => {
        console.log('[AlertWebSocket] Received message:', message);

        // Handle successful responses
        if (message.success) {
            // This is a subscription confirmation
            if (message.subscriptionId && !message.alertId) {
                const actualSubscriptionId = message.subscriptionId.subscriptionId;

                subscriptionIdRef.current = actualSubscriptionId;
                console.log('[AlertWebSocket] Subscription confirmed, ID:', actualSubscriptionId);
            }
            // This is an actual alert notification
            else if (message.alertId) {
                const formatPrice = (price) => {
                    if (!price) return 'N/A';

                    const decimalPlaces = price < 1 ? 6 : 2;
                    return price.toLocaleString(undefined, {
                        minimumFractionDigits: decimalPlaces,
                        maximumFractionDigits: decimalPlaces
                    });
                };

                const formattedThreshold = formatPrice(message.thresholdValue);
                const formattedCurrent = formatPrice(message.currentPrice);

                const priceAction = message.conditionType === 'PRICE_ABOVE'
                    ? 'rose above'
                    : 'fell below';

                const description = message.message ||
                    `${message.platformName} ${message.stockSymbol} ${priceAction} ${formattedThreshold} (Current: ${formattedCurrent})`;

                // Show the toast notification
                toast({
                    title: `${message.stockSymbol} Alert Triggered!`,
                    description: description,
                    duration: 10000,
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

    const reconnect = () => {
        console.log('[AlertWebSocket] Manual reconnection requested');

        if (alertSubscriptionRef.current) {
            webSocketService.unsubscribe('/user/queue/alerts');
            alertSubscriptionRef.current = null;
        }

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
        }

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