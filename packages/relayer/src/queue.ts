/**
 * In-memory processing queue for seal events
 */

import { EventEmitter } from 'events';
import { type Logger } from './logger';
import type { SealRecord } from './db.js';

export interface QueueItem {
  sealHash: string;
  eventData: NFTSealedEvent;
  priority: number;
  addedAt: Date;
  retries: number;
}

export interface NFTSealedEvent {
  seal_hash: string;
  source_chain: number;
  dest_chain: number;
  source_contract: string;
  token_id: string;
  nonce: number;
  nft_name?: string;
  nft_description?: string;
  metadata_uri?: string;
  collection_name?: string;
  collection_mint?: string;
  dwallet_pubkey: string;
  tx_digest: string;
}

export class ProcessingQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing = new Set<string>();
  // H3: Processing lock to prevent race conditions
  private processingLock = new Set<string>();
  private concurrency: number;
  private pollIntervalMs: number;
  private logger: Logger;
  private pollTimer?: NodeJS.Timeout;
  private stopped = false;

  constructor(concurrency: number = 5, pollIntervalMs: number = 5000, logger: Logger) {
    super();
    this.concurrency = concurrency;
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
  }

  /**
   * H3: Check if seal is locked (being processed)
   */
  isLocked(sealHash: string): boolean {
    return this.processingLock.has(sealHash);
  }

  /**
   * H3: Try to acquire processing lock
   * @returns true if lock acquired, false if already locked
   */
  tryLock(sealHash: string): boolean {
    if (this.processingLock.has(sealHash)) {
      return false;
    }
    this.processingLock.add(sealHash);
    return true;
  }

  /**
   * H3: Release processing lock
   */
  unlock(sealHash: string): void {
    this.processingLock.delete(sealHash);
  }

  /**
   * Add an event to the queue
   */
  enqueue(event: NFTSealedEvent, priority: number = 0): void {
    // H3: Check if already locked (being processed)
    if (this.processingLock.has(event.seal_hash)) {
      this.logger.debug(`Seal ${event.seal_hash} already processing (locked), skipping`);
      return;
    }
    
    if (this.queue.some(item => item.sealHash === event.seal_hash)) {
      this.logger.debug(`Seal ${event.seal_hash} already queued, skipping`);
      return;
    }

    const item: QueueItem = {
      sealHash: event.seal_hash,
      eventData: event,
      priority,
      addedAt: new Date(),
      retries: 0,
    };

    // Insert by priority (higher first), then by time
    const index = this.queue.findIndex(
      i => i.priority < priority || (i.priority === priority && i.addedAt > item.addedAt)
    );
    
    if (index === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(index, 0, item);
    }

    this.logger.info(`Queued seal: ${event.seal_hash}, queue size: ${this.queue.length}`);
    this.emit('enqueued', item);
  }

  /**
   * Get next item from queue (doesn't remove it)
   */
  peek(): QueueItem | undefined {
    return this.queue[0];
  }

  /**
   * Get items ready for processing
   */
  getNextBatch(): QueueItem[] {
    const available = this.concurrency - this.processing.size;
    if (available <= 0) return [];
    
    // H3: Filter out items already locked (being processed)
    const batch = this.queue
      .filter(item => !this.processing.has(item.sealHash) && !this.processingLock.has(item.sealHash))
      .slice(0, available);
    
    return batch;
  }

  /**
   * Mark an item as being processed
   */
  startProcessing(sealHash: string): void {
    // H3: Ensure lock is acquired
    if (!this.processingLock.has(sealHash)) {
      this.processingLock.add(sealHash);
    }
    this.processing.add(sealHash);
    const item = this.queue.find(i => i.sealHash === sealHash);
    if (item) {
      this.queue = this.queue.filter(i => i.sealHash !== sealHash);
    }
  }

  /**
   * Mark processing complete
   */
  finishProcessing(sealHash: string): void {
    this.processing.delete(sealHash);
    // H3: Release lock
    this.processingLock.delete(sealHash);
    this.emit('processed', sealHash);
  }

  /**
   * Re-queue a failed item with incremented retry count
   */
  requeue(item: QueueItem, maxRetries: number = 3): boolean {
    if (item.retries >= maxRetries) {
      this.logger.error(`Seal ${item.sealHash} exceeded max retries (${maxRetries})`);
      this.emit('failed', item);
      return false;
    }

    item.retries++;
    item.addedAt = new Date();
    // Lower priority on retry
    item.priority = Math.max(0, item.priority - 10);
    
    // Re-add to queue
    this.queue.push(item);
    this.logger.warn(`Re-queued seal ${item.sealHash}, retry ${item.retries}/${maxRetries}`);
    this.emit('requeued', item);
    return true;
  }

  /**
   * Remove from processing (for retry)
   */
  release(sealHash: string): void {
    this.processing.delete(sealHash);
    // H3: Also release lock on retry
    this.processingLock.delete(sealHash);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size,
    };
  }

  /**
   * H3: Get count of active (in-flight) operations
   */
  activeCount(): number {
    return this.processing.size;
  }

  /**
   * Check if seal is queued or processing
   */
  has(sealHash: string): boolean {
    return this.processingLock.has(sealHash) || this.processing.has(sealHash) || this.queue.some(i => i.sealHash === sealHash);
  }

  /**
   * Start polling for new items (for external event sources)
   */
  startPolling(pollFn: () => Promise<NFTSealedEvent[]>): void {
    if (this.stopped) return;
    
    this.pollTimer = setInterval(async () => {
      if (this.stopped) return;
      
      try {
        const events = await pollFn();
        for (const event of events) {
          this.enqueue(event);
        }
      } catch (err) {
        this.logger.error(`Polling error: ${err}`);
      }
    }, this.pollIntervalMs);

    this.logger.info(`Queue polling started (interval: ${this.pollIntervalMs}ms)`);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      this.logger.info('Queue polling stopped');
    }
  }

  /**
   * Stop the queue entirely
   */
  stop(): void {
    this.stopped = true;
    this.stopPolling();
    this.logger.info('Queue stopped');
  }

  /**
   * Wait for processing to complete
   */
  async waitForDrain(timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    
    while (this.queue.length > 0 || this.processing.size > 0) {
      if (Date.now() - start > timeoutMs) {
        return false;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    
    return true;
  }
}
