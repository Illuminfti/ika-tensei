/**
 * Presign Pool — In-memory FIFO pool of IKA UnverifiedPresignCaps.
 *
 * Presigns are created asynchronously by the IKA coordinator. The relayer
 * requests presigns on-chain (via orchestrator::request_presign), waits for
 * them to complete, then adds them to the pool.
 *
 * On each signing request, a presign is allocated from the pool (FIFO),
 * used for signing, then marked as USED. Expired allocations are released
 * back to AVAILABLE.
 *
 * Based on infinite_idol presign-pool pattern, adapted for in-memory storage.
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { IkaClient } from '@ika.xyz/sdk';
import type { IkaConfig } from '@ika.xyz/sdk';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import type { PresignEntry, PresignPoolStats } from './types.js';

/** How long an allocation lasts before auto-release (5 minutes) */
const ALLOCATION_TTL_MS = 5 * 60 * 1000;

export class PresignPool {
  private readonly pool: Map<string, PresignEntry> = new Map();
  private readonly sui: SuiClient;
  private readonly keypair: Ed25519Keypair;
  private readonly ikaClient: IkaClient;
  private readonly ikaConfig: IkaConfig;
  private replenishing = false;

  constructor(
    sui: SuiClient,
    keypair: Ed25519Keypair,
    ikaClient: IkaClient,
    ikaConfig: IkaConfig,
  ) {
    this.sui = sui;
    this.keypair = keypair;
    this.ikaClient = ikaClient;
    this.ikaConfig = ikaConfig;
  }

  /**
   * Add a completed presign to the pool.
   */
  add(objectId: string, presignId: string, presignBcs: Uint8Array): void {
    this.pool.set(objectId, {
      objectId,
      presignId,
      presignBcs,
      status: 'AVAILABLE',
    });
    logger.info({ objectId, presignId }, 'Presign added to pool');
  }

  /**
   * Allocate the oldest available presign for a signing operation.
   * Returns null if none available.
   */
  allocate(vaaHash: string): PresignEntry | null {
    // First, release expired allocations
    this.releaseExpired();

    // FIFO: find the first AVAILABLE entry
    for (const entry of this.pool.values()) {
      if (entry.status === 'AVAILABLE') {
        entry.status = 'ALLOCATED';
        entry.allocatedAt = Date.now();
        entry.allocatedFor = vaaHash;
        logger.info(
          { objectId: entry.objectId, vaaHash },
          'Presign allocated',
        );
        return entry;
      }
    }

    logger.warn('No presigns available in pool');
    return null;
  }

  /**
   * Mark a presign as used after successful signing.
   */
  markUsed(objectId: string): void {
    const entry = this.pool.get(objectId);
    if (entry) {
      entry.status = 'USED';
      logger.info({ objectId }, 'Presign marked as used');
    }
  }

  /**
   * Release expired allocations back to AVAILABLE.
   */
  releaseExpired(): void {
    const now = Date.now();
    for (const entry of this.pool.values()) {
      if (
        entry.status === 'ALLOCATED' &&
        entry.allocatedAt &&
        now - entry.allocatedAt > ALLOCATION_TTL_MS
      ) {
        entry.status = 'AVAILABLE';
        entry.allocatedAt = undefined;
        entry.allocatedFor = undefined;
        logger.info({ objectId: entry.objectId }, 'Released expired presign allocation');
      }
    }
  }

  /**
   * Get pool statistics.
   */
  stats(): PresignPoolStats {
    let available = 0;
    let allocated = 0;
    let used = 0;
    for (const entry of this.pool.values()) {
      if (entry.status === 'AVAILABLE') available++;
      else if (entry.status === 'ALLOCATED') allocated++;
      else if (entry.status === 'USED') used++;
    }
    return { available, allocated, used, total: this.pool.size };
  }

  /**
   * Request `count` new presigns on-chain and wait for them to complete.
   * Each presign requires a separate on-chain transaction.
   */
  async replenish(count: number): Promise<void> {
    if (this.replenishing) {
      logger.info('Presign replenishment already in progress');
      return;
    }
    this.replenishing = true;

    try {
      const config = getConfig();
      if (!config.suiOrchestratorStateId || !config.suiAdminCapId) {
        logger.warn('Missing orchestrator/admin cap IDs — cannot replenish presigns');
        return;
      }

      const networkEncryptionKey = await this.ikaClient.getLatestNetworkEncryptionKey();

      for (let i = 0; i < count; i++) {
        try {
          await this.requestAndWaitForPresign(
            config,
            networkEncryptionKey.id,
            i,
          );
        } catch (err) {
          logger.error({ err, index: i }, 'Failed to create presign');
        }
      }

      const { available } = this.stats();
      logger.info({ available, requested: count }, 'Presign replenishment complete');
    } finally {
      this.replenishing = false;
    }
  }

  /**
   * Ensure minimum available presigns, replenishing if needed.
   */
  async ensureMinimumAvailable(min: number): Promise<void> {
    const { available } = this.stats();
    if (available < min) {
      const config = getConfig();
      const deficit = config.presignPoolReplenishBatch;
      logger.info(
        { available, min, replenishing: deficit },
        'Presign pool below minimum — replenishing',
      );
      await this.replenish(deficit);
    }
  }

  /**
   * Request a single presign on-chain, parse the event, and wait for completion.
   */
  private async requestAndWaitForPresign(
    config: ReturnType<typeof getConfig>,
    encKeyId: string,
    requestIndex: number,
  ): Promise<void> {
    const coordinatorConfig = this.ikaConfig.objects.ikaDWalletCoordinator;

    const tx = new Transaction();
    const coordinatorRef = tx.sharedObjectRef({
      objectId: coordinatorConfig.objectID,
      initialSharedVersion: coordinatorConfig.initialSharedVersion,
      mutable: true,
    });

    tx.moveCall({
      target: `${config.suiPackageId}::orchestrator::request_presign`,
      arguments: [
        tx.object(config.suiOrchestratorStateId),
        coordinatorRef,
        tx.object(config.suiAdminCapId),
        tx.pure.id(encKeyId),
        tx.pure.u64(requestIndex),
      ],
    });

    const result = await this.sui.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: { showEvents: true, showObjectChanges: true },
    });

    logger.info({ txDigest: result.digest }, 'Presign request transaction submitted');

    // Parse PresignRequested event to get presign BCS
    const presignEvent = result.events?.find(
      (e) => e.type.includes('signing::PresignRequested'),
    );

    if (!presignEvent?.parsedJson) {
      throw new Error('PresignRequested event not found in transaction');
    }

    const eventData = presignEvent.parsedJson as {
      request: string;
      presign_bcs: number[];
    };
    const presignBcs = new Uint8Array(eventData.presign_bcs);

    // Find the created UnverifiedPresignCap object
    const presignCapChange = result.objectChanges?.find(
      (c) => c.type === 'created' && c.objectType?.includes('UnverifiedPresignCap'),
    );

    if (!presignCapChange || presignCapChange.type !== 'created') {
      throw new Error('UnverifiedPresignCap not found in object changes');
    }

    const objectId = presignCapChange.objectId;

    // Read the object to get the presign_id
    const presignObj = await this.sui.getObject({
      id: objectId,
      options: { showContent: true },
    });
    const objContent = presignObj.data?.content;
    if (objContent?.dataType !== 'moveObject') {
      throw new Error('Failed to read UnverifiedPresignCap');
    }
    const presignFields = objContent.fields as Record<string, unknown>;
    const presignId = presignFields.presign_id as string;

    // Wait for presign to be completed by IKA network
    logger.info({ presignId, objectId }, 'Waiting for presign completion');
    await this.ikaClient.getPresignInParticularState(
      presignId,
      'Completed',
      { timeout: 120_000 },
    );

    // Add to pool
    this.add(objectId, presignId, presignBcs);
  }
}
