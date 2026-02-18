/**
 * Deposit Detection Service
 *
 * Monitors deposit addresses for incoming NFTs.
 * Strategy:
 *   EVM:    Alchemy webhooks (primary) + alchemy_getAssetTransfers polling (fallback)
 *   Solana: Helius webhooks (primary)  + getSignaturesForAddress polling (fallback)
 *   Sui:    sui_getOwnedObjects polling (no webhook, short interval)
 *
 * Webhook endpoints consumed by:
 *   POST /webhooks/alchemy  → EVM deposits
 *   POST /webhooks/helius   → Solana deposits
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import type { DB, DepositRecord } from '../db.js';
import type { Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';
import { randomUUID } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TokenStandard = 'ERC721' | 'ERC1155' | 'Metaplex' | 'SuiObject' | 'AptosToken';

export interface DetectedDeposit {
  chain: string;
  chainId: number;
  depositAddress: string;
  contractAddress: string;
  tokenId: string;
  tokenStandard: TokenStandard;
  txHash: string;
  blockNumber: number;
  sender: string;
  detectedAt: number;
}

export interface ChainWatchConfig {
  chain: string;
  chainId: number;
  rpcUrl: string;
  alchemyNetwork?: string; // e.g. 'eth-mainnet', 'polygon-mainnet'
  type: 'evm' | 'solana' | 'sui';
}

export interface DepositDetectorConfig {
  alchemyApiKey: string;
  alchemyWebhookSecret?: string;
  heliusApiKey: string;
  pollIntervalMs: number;
  supportedChains: ChainWatchConfig[];
}

type DepositCallback = (deposit: DetectedDeposit) => Promise<void>;

// ── Watched address registry ──────────────────────────────────────────────────

interface WatchEntry {
  address: string;
  chain: string;
  dwalletId: string;
  lastBlock?: number;
  lastSignature?: string;  // Solana cursor
}

// ── Alchemy Webhook payload shapes ───────────────────────────────────────────

interface AlchemyTransfer {
  from: string;
  to: string;
  contract?: string;
  tokenId?: string;
  category?: string;  // 'erc721' | 'erc1155'
  hash?: string;
  blockNum?: string;
  rawContract?: { address: string };
}

interface AlchemyWebhookPayload {
  webhookId?: string;
  id?: string;
  type?: string;
  event?: {
    network?: string;
    activity?: AlchemyTransfer[];
  };
  // v2 format
  activity?: AlchemyTransfer[];
}

// ── Helius Webhook payload shapes ─────────────────────────────────────────────

interface HeliusTransaction {
  signature: string;
  slot?: number;
  type?: string;
  tokenTransfers?: Array<{
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export interface DepositDetector {
  /** Start monitoring a list of addresses (called on startup) */
  startMonitoring(addresses: Array<{ address: string; chain: string; dwalletId: string }>): Promise<void>;
  /** Add a new address to watch */
  addAddress(address: string, chain: string, dwalletId: string): Promise<void>;
  /** Register callback invoked on each detected deposit */
  onDeposit(callback: DepositCallback): void;
  /** Handle raw Alchemy webhook body (call from HTTP endpoint) */
  handleAlchemyWebhook(body: AlchemyWebhookPayload): Promise<void>;
  /** Handle raw Helius webhook body (call from HTTP endpoint) */
  handleHeliusWebhook(transactions: HeliusTransaction[]): Promise<void>;
  /** Force a poll cycle (for testing / manual trigger) */
  forcePoll(): Promise<void>;
  stop(): void;
}

export function createDepositDetector(
  config: DepositDetectorConfig,
  db: DB,
  logger: Logger,
): DepositDetector {
  const emitter = new EventEmitter();
  const watched = new Map<string, WatchEntry>(); // key = `${address}:${chain}`
  const callbacks: DepositCallback[] = [];
  let pollTimer: NodeJS.Timeout | undefined;
  let stopped = false;

  const chainMap = new Map<string, ChainWatchConfig>();
  for (const c of config.supportedChains) {
    chainMap.set(c.chain.toLowerCase(), c);
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  function watchKey(address: string, chain: string): string {
    return `${address.toLowerCase()}:${chain.toLowerCase()}`;
  }

  async function emitDeposit(deposit: DetectedDeposit): Promise<void> {
    // Deduplicate by tx_hash
    const existing = db.getDepositByTxHash(deposit.txHash);
    if (existing) {
      logger.debug(`Deposit already recorded: ${deposit.txHash}`);
      return;
    }

    // Find dwalletId for this address
    const key = watchKey(deposit.depositAddress, deposit.chain);
    const entry = watched.get(key);
    const dwalletId = entry?.dwalletId ?? '';

    const record: DepositRecord = {
      id: randomUUID(),
      dwallet_id: dwalletId,
      chain: deposit.chain,
      contract_address: deposit.contractAddress,
      token_id: deposit.tokenId,
      tx_hash: deposit.txHash,
      block_number: deposit.blockNumber,
      sender: deposit.sender,
      status: 'detected',
      detected_at: deposit.detectedAt,
      metadata: null,
    };
    db.createDeposit(record);

    logger.info(`Deposit detected: ${deposit.chain} tx=${deposit.txHash} contract=${deposit.contractAddress} tokenId=${deposit.tokenId}`);

    for (const cb of callbacks) {
      try {
        await cb(deposit);
      } catch (err) {
        logger.error(`Deposit callback error: ${err}`);
      }
    }
  }

  // ── EVM polling via Alchemy REST ───────────────────────────────────────────

  async function pollEVMDeposits(entry: WatchEntry): Promise<void> {
    const chainCfg = chainMap.get(entry.chain.toLowerCase());
    if (!chainCfg?.alchemyNetwork || !config.alchemyApiKey) return;

    const url = `https://${chainCfg.alchemyNetwork}.g.alchemy.com/v2/${config.alchemyApiKey}`;

    try {
      // alchemy_getAssetTransfers — filter ERC721/ERC1155 transfers TO our address
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          toAddress: entry.address,
          category: ['erc721', 'erc1155'],
          withMetadata: true,
          maxCount: '0x14', // 20
          fromBlock: entry.lastBlock ? `0x${entry.lastBlock.toString(16)}` : 'earliest',
        }],
      };

      const res = await axios.post(url, body, { timeout: 10_000 });
      const transfers: Array<{
        from: string;
        to: string;
        asset?: string;
        rawContract?: { address: string };
        tokenId?: string;
        hash?: string;
        blockNum?: string;
        category?: string;
      }> = res.data?.result?.transfers ?? [];

      for (const t of transfers) {
        const contract = t.rawContract?.address ?? '';
        const tokenId  = t.tokenId ?? '0';
        const txHash   = t.hash ?? '';
        const blockNum = t.blockNum ? parseInt(t.blockNum, 16) : 0;
        const standard: TokenStandard = t.category === 'erc1155' ? 'ERC1155' : 'ERC721';

        if (txHash) {
          await emitDeposit({
            chain: entry.chain,
            chainId: chainCfg.chainId,
            depositAddress: entry.address,
            contractAddress: contract,
            tokenId,
            tokenStandard: standard,
            txHash,
            blockNumber: blockNum,
            sender: t.from ?? '',
            detectedAt: Date.now(),
          });

          // Advance cursor
          if (blockNum > (entry.lastBlock ?? 0)) {
            entry.lastBlock = blockNum + 1;
          }
        }
      }
    } catch (err) {
      logger.debug(`EVM poll error (${entry.chain} ${entry.address}): ${err}`);
    }
  }

  // ── Solana polling via Helius / public RPC ────────────────────────────────

  async function pollSolanaDeposits(entry: WatchEntry): Promise<void> {
    const rpcUrl = config.heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`
      : 'https://api.mainnet-beta.solana.com';

    try {
      // getSignaturesForAddress — up to 20 recent transactions
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          entry.address,
          {
            limit: 20,
            ...(entry.lastSignature ? { until: entry.lastSignature } : {}),
          },
        ],
      };

      const res = await axios.post(rpcUrl, body, { timeout: 10_000 });
      const sigs: Array<{ signature: string; slot: number; err: unknown }> =
        res.data?.result ?? [];

      if (sigs.length === 0) return;

      // Update cursor to newest signature
      entry.lastSignature = sigs[0].signature;

      for (const sig of sigs) {
        if (sig.err) continue;

        // Get parsed transaction to find NFT transfers
        await parseSolanaTransaction(sig.signature, entry, rpcUrl);
      }
    } catch (err) {
      logger.debug(`Solana poll error (${entry.address}): ${err}`);
    }
  }

  async function parseSolanaTransaction(
    signature: string,
    entry: WatchEntry,
    rpcUrl: string,
  ): Promise<void> {
    try {
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      };
      const res = await axios.post(rpcUrl, body, { timeout: 10_000 });
      const tx = res.data?.result;
      if (!tx) return;

      const slot: number = tx.slot ?? 0;

      // Look for token account changes that arrived at our address
      const postTokenBalances: Array<{
        mint?: string;
        owner?: string;
        uiTokenAmount?: { uiAmount?: number | null };
      }> = tx.meta?.postTokenBalances ?? [];

      const preTokenBalances: Array<{
        mint?: string;
        owner?: string;
        uiTokenAmount?: { uiAmount?: number | null };
      }> = tx.meta?.preTokenBalances ?? [];

      for (const post of postTokenBalances) {
        if (post.owner?.toLowerCase() !== entry.address.toLowerCase()) continue;

        const mint = post.mint ?? '';
        const postAmt = post.uiTokenAmount?.uiAmount ?? 0;

        // Find pre-balance
        const pre = preTokenBalances.find(
          (p) => p.mint === mint && p.owner === post.owner
        );
        const preAmt = pre?.uiTokenAmount?.uiAmount ?? 0;

        // NFT arrived (balance increased from 0 to 1)
        if (postAmt > preAmt && postAmt === 1) {
          // Find the sender (owner of the mint in pre-balances or first instruction signer)
          const sender =
            preTokenBalances.find((p) => p.mint === mint && p.owner !== entry.address)?.owner ??
            tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? '';

          await emitDeposit({
            chain: 'solana',
            chainId: 0,
            depositAddress: entry.address,
            contractAddress: mint,
            tokenId: mint,
            tokenStandard: 'Metaplex',
            txHash: signature,
            blockNumber: slot,
            sender,
            detectedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      logger.debug(`Solana tx parse error (${signature}): ${err}`);
    }
  }

  // ── Sui polling ────────────────────────────────────────────────────────────

  async function pollSuiDeposits(entry: WatchEntry): Promise<void> {
    const chainCfg = chainMap.get('sui');
    const rpcUrl = chainCfg?.rpcUrl ?? 'https://fullnode.mainnet.sui.io:443';

    try {
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getOwnedObjects',
        params: [
          entry.address,
          {
            filter: { Package: '0x2' }, // Sui framework (includes NFT objects)
            options: { showContent: true, showType: true },
          },
          null,
          20,
        ],
      };

      const res = await axios.post(rpcUrl, body, { timeout: 10_000 });
      const objects: Array<{
        data?: { objectId?: string; type?: string; content?: unknown; digest?: string };
      }> = res.data?.result?.data ?? [];

      for (const obj of objects) {
        const objectId = obj.data?.objectId ?? '';
        const objType  = obj.data?.type ?? '';

        // Check for new objects since last known state
        const txHash = obj.data?.digest ?? objectId;
        if (!objectId) continue;

        await emitDeposit({
          chain: 'sui',
          chainId: 0,
          depositAddress: entry.address,
          contractAddress: objType,
          tokenId: objectId,
          tokenStandard: 'SuiObject',
          txHash,
          blockNumber: 0,
          sender: '',
          detectedAt: Date.now(),
        });
      }
    } catch (err) {
      logger.debug(`Sui poll error (${entry.address}): ${err}`);
    }
  }

  // ── Alchemy webhook setup ──────────────────────────────────────────────────

  async function setupAlchemyWebhook(
    address: string,
    alchemyNetwork: string,
  ): Promise<void> {
    if (!config.alchemyApiKey) return;

    try {
      // Alchemy Notify API — create or update webhook
      const res = await axios.post(
        'https://dashboard.alchemyapi.io/api/create-webhook',
        {
          network: alchemyNetwork,
          webhook_type: 'ADDRESS_ACTIVITY',
          webhook_url: `${process.env.RELAYER_WEBHOOK_URL ?? 'http://localhost:3471'}/webhooks/alchemy`,
          addresses: [address],
        },
        {
          headers: {
            'X-Alchemy-Token': config.alchemyApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );
      logger.info(`Alchemy webhook created for ${address}: ${res.data?.data?.id ?? 'ok'}`);
    } catch (err) {
      logger.warn(`Alchemy webhook setup failed (will use polling): ${err}`);
    }
  }

  // ── Helius webhook setup ───────────────────────────────────────────────────

  async function setupHeliusWebhook(address: string): Promise<void> {
    if (!config.heliusApiKey) return;

    try {
      const res = await axios.post(
        `https://api.helius.xyz/v0/webhooks?api-key=${config.heliusApiKey}`,
        {
          webhookURL: `${process.env.RELAYER_WEBHOOK_URL ?? 'http://localhost:3471'}/webhooks/helius`,
          transactionTypes: ['NFT_SALE', 'NFT_LISTING', 'TRANSFER'],
          accountAddresses: [address],
          webhookType: 'enhanced',
        },
        { timeout: 10_000 },
      );
      logger.info(`Helius webhook created for ${address}: ${res.data?.webhookID ?? 'ok'}`);
    } catch (err) {
      logger.warn(`Helius webhook setup failed (will use polling): ${err}`);
    }
  }

  // ── Poll loop ──────────────────────────────────────────────────────────────

  async function runPollCycle(): Promise<void> {
    if (stopped) return;

    const entries = Array.from(watched.values());
    for (const entry of entries) {
      if (stopped) return;
      const chainCfg = chainMap.get(entry.chain.toLowerCase());
      if (!chainCfg) continue;

      try {
        if (chainCfg.type === 'evm') {
          await pollEVMDeposits(entry);
        } else if (chainCfg.type === 'solana') {
          await pollSolanaDeposits(entry);
        } else if (chainCfg.type === 'sui') {
          await pollSuiDeposits(entry);
        }
      } catch (err) {
        logger.debug(`Poll cycle error for ${entry.chain}/${entry.address}: ${err}`);
      }
    }
  }

  function startPolling(): void {
    pollTimer = setInterval(() => {
      if (!stopped) {
        runPollCycle().catch((err) => logger.error(`Poll cycle error: ${err}`));
      }
    }, config.pollIntervalMs);
    logger.info(`Deposit detector polling started (interval: ${config.pollIntervalMs}ms)`);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function startMonitoring(
    addresses: Array<{ address: string; chain: string; dwalletId: string }>,
  ): Promise<void> {
    for (const { address, chain, dwalletId } of addresses) {
      await addAddress(address, chain, dwalletId);
    }
    startPolling();
    logger.info(`Deposit detector monitoring ${watched.size} addresses`);
  }

  async function addAddress(
    address: string,
    chain: string,
    dwalletId: string,
  ): Promise<void> {
    const key = watchKey(address, chain);
    if (watched.has(key)) return;

    watched.set(key, { address, chain, dwalletId });
    logger.info(`Watching ${chain} address: ${address}`);

    const chainCfg = chainMap.get(chain.toLowerCase());
    if (!chainCfg) return;

    // Attempt webhook registration (non-fatal)
    if (chainCfg.type === 'evm' && chainCfg.alchemyNetwork) {
      await setupAlchemyWebhook(address, chainCfg.alchemyNetwork).catch(() => undefined);
    } else if (chainCfg.type === 'solana') {
      await setupHeliusWebhook(address).catch(() => undefined);
    }
  }

  function onDeposit(callback: DepositCallback): void {
    callbacks.push(callback);
  }

  async function handleAlchemyWebhook(body: AlchemyWebhookPayload): Promise<void> {
    const activity: AlchemyTransfer[] =
      body.event?.activity ?? body.activity ?? [];

    for (const t of activity) {
      const to       = (t.to ?? '').toLowerCase();
      const key      = watchKey(to, 'ethereum'); // Alchemy doesn't always include chain
      const watching = watched.has(key);

      if (!watching) {
        // Try to find by address across all EVM chains
        const found = Array.from(watched.entries()).find(
          ([k]) => k.startsWith(to + ':')
        );
        if (!found) continue;
      }

      const contract = t.rawContract?.address ?? t.contract ?? '';
      const tokenId  = t.tokenId ?? '0';
      const txHash   = t.hash ?? '';
      const blockNum = t.blockNum ? parseInt(t.blockNum, 16) : 0;
      const standard: TokenStandard = t.category === 'erc1155' ? 'ERC1155' : 'ERC721';

      if (!txHash) continue;

      // Determine chain from body or watched entry
      const chainKey = Array.from(watched.keys()).find((k) => k.startsWith(to + ':'));
      const chain    = chainKey ? chainKey.split(':')[1] : 'ethereum';
      const chainCfg = chainMap.get(chain) ?? { chainId: 1 };

      await emitDeposit({
        chain,
        chainId: (chainCfg as ChainWatchConfig).chainId ?? 1,
        depositAddress: to,
        contractAddress: contract,
        tokenId,
        tokenStandard: standard,
        txHash,
        blockNumber: blockNum,
        sender: t.from ?? '',
        detectedAt: Date.now(),
      });
    }
  }

  async function handleHeliusWebhook(transactions: HeliusTransaction[]): Promise<void> {
    for (const tx of transactions) {
      if (!tx.tokenTransfers) continue;

      for (const transfer of tx.tokenTransfers) {
        const to      = transfer.toUserAccount ?? '';
        const key     = watchKey(to, 'solana');
        const entry   = watched.get(key);
        if (!entry) continue;

        // Only track NFT transfers (amount = 1)
        if (transfer.tokenAmount !== 1) continue;

        await emitDeposit({
          chain: 'solana',
          chainId: 0,
          depositAddress: to,
          contractAddress: transfer.mint,
          tokenId: transfer.mint,
          tokenStandard: 'Metaplex',
          txHash: tx.signature,
          blockNumber: tx.slot ?? 0,
          sender: transfer.fromUserAccount ?? '',
          detectedAt: Date.now(),
        });
      }
    }
  }

  async function forcePoll(): Promise<void> {
    await runPollCycle();
  }

  function stop(): void {
    stopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
    logger.info('Deposit detector stopped');
  }

  return {
    startMonitoring,
    addAddress,
    onDeposit,
    handleAlchemyWebhook,
    handleHeliusWebhook,
    forcePoll,
    stop,
  };
}

/**
 * Build DepositDetectorConfig from RelayerConfig with sensible defaults.
 */
export function detectorConfigFromRelayer(relayerConfig: RelayerConfig): DepositDetectorConfig {
  const supportedChains: ChainWatchConfig[] = [
    {
      chain: 'ethereum',
      chainId: 1,
      rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${relayerConfig.alchemyApiKey}`,
      alchemyNetwork: 'eth-mainnet',
      type: 'evm',
    },
    {
      chain: 'polygon',
      chainId: 137,
      rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${relayerConfig.alchemyApiKey}`,
      alchemyNetwork: 'polygon-mainnet',
      type: 'evm',
    },
    {
      chain: 'arbitrum',
      chainId: 42161,
      rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${relayerConfig.alchemyApiKey}`,
      alchemyNetwork: 'arb-mainnet',
      type: 'evm',
    },
    {
      chain: 'base',
      chainId: 8453,
      rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${relayerConfig.alchemyApiKey}`,
      alchemyNetwork: 'base-mainnet',
      type: 'evm',
    },
    {
      chain: 'solana',
      chainId: 0,
      rpcUrl: relayerConfig.heliusApiKey
        ? `https://mainnet.helius-rpc.com/?api-key=${relayerConfig.heliusApiKey}`
        : 'https://api.mainnet-beta.solana.com',
      type: 'solana',
    },
    {
      chain: 'sui',
      chainId: 0,
      rpcUrl: relayerConfig.suiRpcUrl,
      type: 'sui',
    },
  ];

  return {
    alchemyApiKey: relayerConfig.alchemyApiKey,
    alchemyWebhookSecret: relayerConfig.alchemyWebhookSecret,
    heliusApiKey: relayerConfig.heliusApiKey,
    pollIntervalMs: relayerConfig.depositPollIntervalMs,
    supportedChains,
  };
}
