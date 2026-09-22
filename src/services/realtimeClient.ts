/**
 * Realtime WebSocket Client
 * Connects to local server WebSocket event bus (/ws).
 * Handles authentication, heartbeat ping-pong, auto-reconnect, deduplication, and sequence gap detection.
 * NOTE: WS is strictly a notification/event channel — NEVER send business mutations over WS.
 */

import { authSession } from './authSession';

export type EventCallback = (event: any) => void;
export type SequenceGapCallback = (gap: { expected: number; received: number }) => void;
export type ConnectionStateCallback = (connected: boolean) => void;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private isConnected = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  private seenEventIds = new Set<string>();
  private maxSeenEventIds = 2000;
  private lastSequence = 0;

  private eventListeners: Set<EventCallback> = new Set();
  private gapListeners: Set<SequenceGapCallback> = new Set();
  private stateListeners: Set<ConnectionStateCallback> = new Set();

  /**
   * Connect to WebSocket server
   */
  public connect() {
    if (this.ws || this.isConnecting) return;

    const token = authSession.getToken();
    if (!token) {
      console.warn('[RealtimeClient] Cannot connect to WS without authenticated session token');
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyState(true);

        // Start ping heartbeat every 20s
        this.startPingHeartbeat();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.cleanup();
        this.notifyState(false);

        // Auto-reconnect if authenticated
        if (authSession.isAuthenticated()) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[RealtimeClient] WebSocket error:', err);
      };
    } catch (err) {
      this.cleanup();
      this.notifyState(false);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyState(false);
  }

  private cleanup() {
    this.isConnecting = false;
    this.isConnected = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startPingHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private handleMessage(rawData: string) {
    try {
      const msg = JSON.parse(rawData);

      if (msg.type === 'PONG') {
        return;
      }

      if (msg.type === 'AUTH_SUCCESS') {
        if (typeof msg.lastSequence === 'number') {
          this.lastSequence = msg.lastSequence;
        }
        return;
      }

      if (msg.type === 'AUTH_ERROR') {
        console.error('[RealtimeClient] Auth error:', msg.message);
        this.disconnect();
        return;
      }

      if (msg.type === 'EVENT' && msg.event) {
        const ev = msg.event;
        const eventId = ev.eventId;
        const seq = ev.sequenceNumber;

        // Deduplicate
        if (eventId && this.seenEventIds.has(eventId)) {
          return;
        }
        if (eventId) {
          this.seenEventIds.add(eventId);
          if (this.seenEventIds.size > this.maxSeenEventIds) {
            // Trim old entries
            const firstKey = this.seenEventIds.values().next().value;
            if (firstKey) this.seenEventIds.delete(firstKey);
          }
        }

        // Sequence gap detection
        if (seq && this.lastSequence > 0 && seq > this.lastSequence + 1) {
          console.warn(`[RealtimeClient] Sequence gap detected: expected ${this.lastSequence + 1}, got ${seq}`);
          this.notifyGap(this.lastSequence + 1, seq);
        }

        if (seq && seq > this.lastSequence) {
          this.lastSequence = seq;
        }

        // Dispatch event to listeners
        this.notifyEvent(ev);
      }
    } catch (err) {
      console.error('[RealtimeClient] Failed to parse WebSocket message:', err);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (authSession.isAuthenticated()) {
        this.connect();
      }
    }, delay);
  }

  // Listener subscriptions
  public onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  public onSequenceGap(callback: SequenceGapCallback): () => void {
    this.gapListeners.add(callback);
    return () => this.gapListeners.delete(callback);
  }

  public onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.stateListeners.add(callback);
    // Notify immediate state
    callback(this.isConnected);
    return () => this.stateListeners.delete(callback);
  }

  private notifyEvent(event: any) {
    this.eventListeners.forEach(cb => {
      try { cb(event); } catch (e) { console.error('[RealtimeClient] Listener error:', e); }
    });
  }

  private notifyGap(expected: number, received: number) {
    this.gapListeners.forEach(cb => {
      try { cb({ expected, received }); } catch (e) { console.error('[RealtimeClient] Gap listener error:', e); }
    });
  }

  private notifyState(connected: boolean) {
    this.stateListeners.forEach(cb => {
      try { cb(connected); } catch (e) { console.error('[RealtimeClient] State listener error:', e); }
    });
  }

  public getLastSequence(): number {
    return this.lastSequence;
  }

  public setLastSequence(seq: number) {
    this.lastSequence = seq;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const realtimeClient = new RealtimeClient();
