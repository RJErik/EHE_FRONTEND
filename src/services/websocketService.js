// src/services/websocketService.js
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

// Configuration constants
const SOCKET_URL = 'http://localhost:8080/ws';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

class WebSocketService {
    constructor() {
        this.stompClient = null;
        this.connected = false;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.connectionPromise = null;
    }

    // Connect to the WebSocket server
    connect() {
        if (!this.connectionPromise || this.connectionPromise.status !== 'pending') {
            this.connectionPromise = new Promise((resolve, reject) => {
                try {
                    console.log("[WebSocket] Attempting to connect...");

                    const socket = new SockJS(SOCKET_URL);
                    this.stompClient = new Client({
                        webSocketFactory: () => socket,
                        reconnectDelay: RECONNECT_DELAY_MS,
                        heartbeatIncoming: 10000,
                        heartbeatOutgoing: 10000,
                        onConnect: frame => {
                            console.log("[WebSocket] Connected:", frame);
                            this.connected = true;
                            this.reconnectAttempts = 0;
                            this.connectionPromise.status = 'resolved';
                            resolve(true);
                        },
                        onDisconnect: () => {
                            console.log("[WebSocket] Disconnected");
                            this.connected = false;
                        },
                        onStompError: frame => {
                            console.error("[WebSocket] Error:", frame);
                            this.connectionPromise.status = 'rejected';
                            reject(new Error(`STOMP error: ${frame.headers.message}`));
                        },
                        onWebSocketClose: (event) => {
                            console.log("[WebSocket] Socket closed:", event);
                            this.connected = false;

                            if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                                this.reconnectAttempts++;
                                console.log(`[WebSocket] Attempting to reconnect... (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

                                // Use exponential backoff
                                const timeout = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
                                setTimeout(() => this.connect(), timeout);
                            } else {
                                console.log("[WebSocket] Max reconnect attempts reached");
                            }
                        }
                    });

                    this.stompClient.activate();
                } catch (error) {
                    console.error("[WebSocket] Connection error:", error);
                    this.connectionPromise.status = 'rejected';
                    reject(error);
                }
            });

            this.connectionPromise.status = 'pending';
        }

        return this.connectionPromise;
    }

    // Disconnect from the WebSocket server
    disconnect() {
        if (this.stompClient && this.connected) {
            console.log("[WebSocket] Disconnecting...");
            this.stompClient.deactivate();
            this.connected = false;
        }
    }

    // Subscribe to a destination
    subscribe(destination, callback) {
        console.log(`[WebSocket] Subscribing to ${destination}`);

        return this.ensureConnected()
            .then(() => {
                // Create subscription
                const subscription = this.stompClient.subscribe(destination, message => {
                    const payload = JSON.parse(message.body);
                    callback(payload);
                });

                // Store the subscription
                this.subscriptions.set(destination, subscription);
                console.log(`[WebSocket] Subscribed to ${destination}`);

                return subscription;
            })
            .catch(error => {
                console.error(`[WebSocket] Error subscribing to ${destination}:`, error);
                throw error;
            });
    }

    // Unsubscribe from a destination
    unsubscribe(destination) {
        if (this.subscriptions.has(destination)) {
            console.log(`[WebSocket] Unsubscribing from ${destination}`);
            const subscription = this.subscriptions.get(destination);
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
        }
    }

    // Send a message to a destination
    send(destination, message) {
        console.log(`[WebSocket] Sending to ${destination}:`, message);

        return this.ensureConnected()
            .then(() => {
                this.stompClient.publish({
                    destination,
                    body: JSON.stringify(message)
                });
                console.log(`[WebSocket] Sent message to ${destination}`);
            })
            .catch(error => {
                console.error(`[WebSocket] Error sending to ${destination}:`, error);
                throw error;
            });
    }

    // Ensure the client is connected before performing operations
    ensureConnected() {
        if (this.connected) {
            return Promise.resolve(true);
        }
        return this.connect();
    }

    // Check if currently connected
    isConnected() {
        return this.connected;
    }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
