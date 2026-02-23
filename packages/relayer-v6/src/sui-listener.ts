/**
 * Sui Listener - Subscribes to SealSigned events
 * 
 * Uses @mysten/sui/client to subscribe to events from the Sui Orchestrator contract
 */

import { SuiClient } from '@mysten/sui/client';
import { getConfig } from './config.js';
import type { SealSignedEvent } from './types.js';
import { logger } from './logger.js';

export type EventHandler = (event: SealSignedEvent, eventId: string) => Promise<void>;

/**
 * SuiListener subscribes to SealSigned events from the Sui Orchestrator
 */
export class SuiListener {
  private client: SuiClient;
  private wsClient: SuiClient;
  private _unsubscribe: (() => void) | null = null;
  private isConnected: boolean = false;
  private eventHandler: EventHandler | null = null;

  constructor() {
    const config = getConfig();
    this.client = new SuiClient({ 
      url: config.suiRpcUrl 
    });
    this.wsClient = new SuiClient({ 
      url: config.suiWsUrl 
    });
  }

  /**
   * Check if the Sui client is connected
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.client.getLatestCheckpointSequenceNumber();
      return true;
    } catch (error) {
      logger.error({ error }, 'Sui connection check failed');
      return false;
    }
  }

  /**
   * Subscribe to SealSigned events
   */
  async subscribe(handler: EventHandler): Promise<void> {
    const config = getConfig();
    this.eventHandler = handler;

    const eventType = `${config.suiPackageId}::orchestrator::SealSigned`;
    
    logger.info({ eventType }, 'Subscribing to Sui events');

    try {
      this._unsubscribe = await this.wsClient.subscribeEvent({
        filter: {
          MoveEventType: eventType,
        },
        onMessage: async (event) => {
          await this.handleEvent(event);
        },
      });
      
      this.isConnected = true;
      logger.info('Successfully subscribed to SealSigned events');
    } catch (error) {
      logger.error({ error }, 'Failed to subscribe to Sui events');
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Handle incoming Sui event
   */
  private async handleEvent(event: any): Promise<void> {
    if (!this.eventHandler) {
      logger.warn('No event handler set, skipping event');
      return;
    }

    const eventId = event.id;
    const parsedJson = event.parsedJson as SealSignedEvent;

    if (!parsedJson) {
      logger.warn({ eventId }, 'Event has no parsedJson, skipping');
      return;
    }

    logger.info({
      eventId,
      sourceChain: parsedJson.source_chain,
      nftContract: parsedJson.nft_contract,
      tokenId: parsedJson.token_id,
      receiver: parsedJson.receiver,
    }, 'Received SealSigned event');

    try {
      await this.eventHandler(parsedJson, eventId);
    } catch (error) {
      logger.error({ error, eventId }, 'Error processing event');
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribeFromEvents(): Promise<void> {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
      this.isConnected = false;
      logger.info('Unsubscribed from Sui events');
    }
  }

  /**
   * Reconnect to Sui WebSocket
   */
  async reconnect(): Promise<void> {
    logger.info('Attempting to reconnect to Sui WebSocket');
    
    await this.unsubscribeFromEvents();
    
    if (this.eventHandler) {
      await this.subscribe(this.eventHandler);
    }
  }

  /**
   * Get connection status
   */
  get isActive(): boolean {
    return this.isConnected;
  }
}
