/**
 * Sui event listener for NFTSealed events
 */

import { SuiClient } from '@mysten/sui/client';
import type { Logger } from '../logger';
import type { RelayerConfig } from '../config';
import type { NFTSealedEvent } from '../queue';

export interface SuiListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export function createSuiListener(
  config: RelayerConfig,
  logger: Logger,
  onSealed: (event: NFTSealedEvent) => void,
): SuiListener {
  const { suiRpcUrl, suiPackageId } = config;
  const client = new SuiClient({ url: suiRpcUrl });
  
  let running = false;
  let cursor: any;
  let pollTimer: NodeJS.Timeout | undefined;

  const POLL_INTERVAL_MS = 5000;

  async function fetchEvents(): Promise<void> {
    try {
      const response = await client.queryEvents({
        query: {
          MoveEventType: `${suiPackageId}::registry::NFTSealed`,
        },
        cursor,
        limit: 50,
        order: 'ascending',
      });

      if (response.data.length === 0) {
        return;
      }

      // Update cursor to last event
      cursor = response.nextCursor;

      for (const event of response.data) {
        const parsed = event.parsedJson as any;
        
        if (!parsed) {
          logger.warn(`Event ${event.id} has no parsed JSON`);
          continue;
        }

        // Parse seal hash from bytes
        const sealHashBytes = parsed.seal_hash || parsed.sealHash || parsed.seal_hash_bytes;
        let sealHash: string;
        
        if (Array.isArray(sealHashBytes)) {
          sealHash = Buffer.from(sealHashBytes).toString('hex');
        } else if (typeof sealHashBytes === 'string') {
          sealHash = sealHashBytes.replace(/^0x/, '');
        } else {
          sealHash = event.id.txDigest || event.id.eventSeq; // Fallback
        }

        // Parse dwallet pubkey
        const pubkeyBytes = parsed.dwallet_pubkey || parsed.dwalletPubkey || parsed.attestation_pubkey;
        let dwalletPubkey: string;
        
        if (Array.isArray(pubkeyBytes)) {
          dwalletPubkey = Buffer.from(pubkeyBytes).toString('hex');
        } else if (typeof pubkeyBytes === 'string') {
          dwalletPubkey = pubkeyBytes.replace(/^0x/, '');
        } else {
          dwalletPubkey = '';
        }

        const sealedEvent: NFTSealedEvent = {
          seal_hash: sealHash,
          source_chain: parsed.source_chain || parsed.sourceChain || 2, // Sui
          dest_chain: parsed.dest_chain || parsed.destChain || 3, // Solana
          source_contract: parsed.source_contract || parsed.sourceContract || suiPackageId,
          token_id: String(parsed.token_id || parsed.tokenId || parsed.token_id_bytes || '0'),
          nonce: parsed.nonce || parsed.nonce || 0,
          nft_name: parsed.nft_name || parsed.metadata_name || 'Ika Tensei NFT',
          nft_description: parsed.nft_description || parsed.metadata_description || '',
          metadata_uri: parsed.metadata_uri || parsed.metadata_uri || '',
          collection_name: parsed.collection_name || parsed.collection_name || 'Ika Tensei Genesis',
          dwallet_pubkey: dwalletPubkey,
          tx_digest: event.id.txDigest,
        };

        logger.info(`NFTSealed: ${sealHash.slice(0, 16)}... chain:${sealedEvent.source_chain}->${sealedEvent.dest_chain}`);
        onSealed(sealedEvent);
      }

      logger.debug(`Processed ${response.data.length} events, cursor: ${JSON.stringify(cursor)?.slice(0, 30)}...`);
    } catch (err) {
      logger.error(`Failed to fetch Sui events: ${err}`);
    }
  }

  async function start(): Promise<void> {
    if (running) {
      logger.warn('Sui listener already running');
      return;
    }

    logger.info('Starting Sui event listener...');

    // Initial fetch to get current cursor position
    try {
      const response = await client.queryEvents({
        query: {
          MoveEventType: `${suiPackageId}::registry::NFTSealed`,
        },
        cursor: undefined,
        limit: 1,
        order: 'descending',
      });

      if (response.data.length > 0) {
        cursor = response.nextCursor;
        logger.debug(`Starting from cursor: ${JSON.stringify(cursor)?.slice(0, 30)}...`);
      }
    } catch (err) {
      logger.warn(`Could not determine starting cursor: ${err}`);
    }

    running = true;

    // Start polling
    pollTimer = setInterval(fetchEvents, POLL_INTERVAL_MS);
    
    // Immediate first fetch
    await fetchEvents();

    logger.info(`Sui listener started (package: ${suiPackageId})`);
  }

  async function stop(): Promise<void> {
    if (!running) {
      return;
    }

    running = false;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }

    logger.info('Sui listener stopped');
  }

  return {
    start,
    stop,
    isRunning: () => running,
  };
}
