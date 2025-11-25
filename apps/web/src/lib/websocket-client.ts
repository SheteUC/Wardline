"use client";

/**
 * WebSocket client for real-time voice orchestrator updates
 * Connects to the voice orchestrator WebSocket server for live call events
 */

type WebSocketEventType = 'call:started' | 'call:updated' | 'call:completed' | 'call:error';

interface WebSocketMessage {
    type: WebSocketEventType;
    payload: any;
    timestamp: string;
}

type EventCallback = (payload: any) => void;

class VoiceWebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private eventHandlers: Map<WebSocketEventType, Set<EventCallback>> = new Map();
    private isIntentionalClose = false;

    constructor(url?: string) {
        this.url = url || process.env.NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL || 'ws://localhost:3002';

        // Convert http(s) to ws(s)
        if (this.url.startsWith('http://')) {
            this.url = this.url.replace('http://', 'ws://');
        } else if (this.url.startsWith('https://')) {
            this.url = this.url.replace('https://', 'wss://');
        }
    }

    connect(): void {
        if (typeof window === 'undefined') return; // Only run in browser

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[VoiceWS] Connected to voice orchestrator');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[VoiceWS] Failed to parse message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[VoiceWS] WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('[VoiceWS] Connection closed');
                if (!this.isIntentionalClose) {
                    this.attemptReconnect();
                }
            };
        } catch (error) {
            console.error('[VoiceWS] Failed to connect:', error);
            this.attemptReconnect();
        }
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[VoiceWS] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`[VoiceWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }

    private handleMessage(message: WebSocketMessage): void {
        const handlers = this.eventHandlers.get(message.type);
        if (handlers) {
            handlers.forEach(callback => {
                try {
                    callback(message.payload);
                } catch (error) {
                    console.error(`[VoiceWS] Error in event handler for ${message.type}:`, error);
                }
            });
        }
    }

    on(event: WebSocketEventType, callback: EventCallback): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(callback);
    }

    off(event: WebSocketEventType, callback: EventCallback): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(callback);
        }
    }

    send(type: string, payload: any): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('[VoiceWS] Cannot send message, connection not open');
        }
    }

    disconnect(): void {
        this.isIntentionalClose = true;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.eventHandlers.clear();
    }

    get isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

// Singleton instance
let wsClient: VoiceWebSocketClient | null = null;

export function getWebSocketClient(): VoiceWebSocketClient {
    if (!wsClient) {
        wsClient = new VoiceWebSocketClient();
    }
    return wsClient;
}

export function disconnectWebSocket(): void {
    if (wsClient) {
        wsClient.disconnect();
        wsClient = null;
    }
}
