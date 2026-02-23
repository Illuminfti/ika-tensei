/**
 * Sui Listener - Subscribes to SealSigned events from the Sui Orchestrator
 *
 * Features:
 * - Real-time WebSocket subscription via `subscribeEvent`
 * - Cursor persistence so missed events are replayed on restart
 * - Automatic reconnect on WebSocket disconnect
 */

import { SuiClient, type SuiEvent } from '@mysten/sui/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { getConfig } from './config.js';
import type { SealSignedEvent, EventCursor } from './types.js';
import { logger } from './logger.js';

export type EventHandler = (event: SealSignedEvent, eventId: string) => Promise<void>;

/** Filename stored next to the relayer working directory */
const CURSOR_FILE = path.join(process.cwd(), '.relayer-cursor.json');

/**
 * SuiListener handles subscription and historical replay of SealSigned events.
 */
export class SuiListener {
  private client: SuiClient;
  private wsClient: SuiClient;
  private _unsubscribe: (() => void) | null = null;
  private _isConnected = false;
  private _eventHandler: EventHandler | null = null;
  private _eventType: string;

  constructor() {
    const config = getConfig();
    this.client = new SuiClient({ url: config.suiRpcUrl });
    this.wsClient = new SuiClient({ url: config.suiWsUrl });
    this._eventType = `${config.suiPackageId}::orchestrator::SealSigned`;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Check that the Sui HTTP RPC is reachable.
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.client.getLatestCheckpointSequenceNumber();
      return true;
    } catch (err) {
      logger.error({ err }, 'Sui connection check failed');
      return false;
    }
  }

  /**
   * Start listening for events.
   *
   * 1. Loads the last-seen cursor from disk.
   * 2. Replays any missed events since that cursor.
   * 3. Switches to a live WebSocket subscription.
   */
  async start(handler: EventHandler): Promise<void> {
    this._eventHandler = handler;

    const cursor = this.loadCursor();
    if (cursor) {
      logger.info({ cursor }, 'Replaying missed events from cursor');
      await this.replayFromCursor(cursor, handler);
    }

    await this.subscribe(handler);
  }

  /**
   * Unsubscribe from real-time events and clean up.
   */
  async unsubscribeFromEvents(): Promise<void> {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
      this._isConnected = false;
      logger.info('Unsubscribed from Sui events');
    }
  }

  /**
   * Reconnect after a lost WebSocket connection.
   */
  async reconnect(): Promise<void> {
    logger.info('Reconnecting to Sui WebSocket');
    await this.unsubscribeFromEvents();
    if (this._eventHandler) {
      await this.subscribe(this._eventHandler);
    }
  }

  /** Whether the WebSocket subscription is live. */
  get isActive(): boolean {
    return this._isConnected;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Subscribe to real-time events via WebSocket.
   */
  private async subscribe(handler: EventHandler): Promise<void> {
    logger.info({ eventType: this._eventType }, 'Subscribing to Sui events');

    try {
      this._unsubscribe = await this.wsClient.subscribeEvent({
        filter: { MoveEventType: this._eventType },
        onMessage: async (event) => {
          await this.dispatchEvent(event, handler);
        },
      });
      this._isConnected = true;
      logger.info('Live subscription active');
    } catch (err) {
      this._isConnected = false;
      logger.error({ err }, 'Failed to subscribe to Sui events');
      throw err;
    }
  }

  /**
   * Use `queryEvents` to fetch and process all events since the given cursor.
   * This catches up on events that arrived while the relayer was offline.
   */
  private async replayFromCursor(
    startCursor: EventCursor,
    handler: EventHandler,
  ): Promise<void> {
    let cursor: EventCursor | undefined = startCursor;
    let replayed = 0;

    while (true) {
      const page = await this.client.queryEvents({
        query: { MoveEventType: this._eventType },
        cursor,
        limit: 50,
        order: 'ascending',
      });

      for (const event of page.data) {
        await this.dispatchEvent(event, handler);
        replayed++;
      }

      if (!page.hasNextPage || !page.nextCursor) {
        break;
      }
      cursor = {
        txDigest: page.nextCursor.txDigest,
        eventSeq: page.nextCursor.eventSeq,
      };
    }

    logger.info({ replayed }, 'Finished replaying missed events');
  }

  /**
   * Validate, parse and hand off a raw Sui event to the caller's handler.
   */
  private async dispatchEvent(event: SuiEvent, handler: EventHandler): Promise<void> {
    const rawId = event.id;
    if (!rawId) {
      logger.warn('Event missing id, skipping');
      return;
    }

    const eventId = `${rawId.txDigest}:${rawId.eventSeq}`;
    const parsedJson = event.parsedJson as Partial<SealSignedEvent> | undefined;

    if (!parsedJson) {
      logger.warn({ eventId }, 'Event has no parsedJson, skipping');
      return;
    }

    // Basic field validation
    if (
      parsedJson.source_chain === undefined ||
      !parsedJson.nft_contract ||
      !parsedJson.token_id ||
      !parsedJson.receiver ||
      !parsedJson.signature ||
      !parsedJson.dwallet_pubkey
    ) {
      logger.warn({ eventId, parsedJson }, 'Event missing required fields, skipping');
      return;
    }

    const sealEvent = parsedJson as SealSignedEvent;

    logger.info(
      {
        eventId,
        sourceChain: sealEvent.source_chain,
        nftContract: sealEvent.nft_contract,
        tokenId: sealEvent.token_id,
        receiver: sealEvent.receiver,
        dwalletPubkey: sealEvent.dwallet_pubkey,
      },
      'Received SealSigned event',
    );

    try {
      await handler(sealEvent, eventId);
      // Persist cursor after successful processing
      this.saveCursor({
        txDigest: rawId.txDigest,
        eventSeq: rawId.eventSeq,
      });
    } catch (err) {
      logger.error({ err, eventId }, 'Error processing SealSigned event');
      // Do NOT update cursor on failure so we retry on next restart
    }
  }

  // ─── Cursor Persistence ────────────────────────────────────────────────────

  /**
   * Load the last-seen cursor from disk. Returns null if not found or corrupt.
   */
  private loadCursor(): EventCursor | null {
    try {
      if (!existsSync(CURSOR_FILE)) return null;
      const raw = readFileSync(CURSOR_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as EventCursor;
      if (parsed.txDigest && parsed.eventSeq) {
        return parsed;
      }
      return null;
    } catch {
      logger.warn({ file: CURSOR_FILE }, 'Could not load cursor file, starting from live');
      return null;
    }
  }

  /**
   * Persist the last successfully processed event cursor.
   */
  private saveCursor(cursor: EventCursor): void {
    try {
      writeFileSync(CURSOR_FILE, JSON.stringify(cursor), 'utf-8');
    } catch (err) {
      logger.warn({ err, cursor }, 'Failed to save cursor');
    }
  }
}
