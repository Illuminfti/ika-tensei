/**
 * dWallet Pool Manager
 *
 * Manages a pre-created pool of dWallets ready for assignment.
 * Two pools: secp256k1 (EVM chains) and Ed25519 (Solana/Sui/Aptos/NEAR)
 *
 * Address derivation:
 *   EVM  (secp256k1): keccak256(pubkey_raw64)[12:] → 0x-prefixed (same on all EVMs)
 *   Solana (ed25519): base58(pubkey[32])
 *   Sui   (ed25519): blake2b-256(0x00 || pubkey)[0:32] → 0x-prefixed
 */

import { randomUUID } from 'crypto';
import { keccak_256 } from '@noble/hashes/sha3';
import { blake2b } from '@noble/hashes/blake2b';
import bs58 from 'bs58';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { IkaDWalletService, type IkaDWalletConfig } from '@ika-tensei/shared';
import type { DB, PooledDWallet, PoolCurve } from '../db.js';
import type { ProcessingQueue } from '../queue.js';
import type { Logger } from '../logger.js';
import type { RelayerConfig } from '../config.js';

// ── Address Derivation ─────────────────────────────────────────────────────────

/**
 * Derive EVM (0x-prefixed) address from a secp256k1 public key.
 * Handles both 64-byte (raw x,y) and 65-byte (04|x|y) formats.
 */
export function deriveEVMAddress(publicKeyBytes: Uint8Array): string {
  // Drop the 0x04 prefix for uncompressed keys
  const raw = publicKeyBytes.length === 65 ? publicKeyBytes.slice(1) : publicKeyBytes;
  const hash = keccak_256(raw);
  return '0x' + Buffer.from(hash.slice(12)).toString('hex');
}

/**
 * Derive Solana address (base58) from a 32-byte Ed25519 public key.
 */
export function deriveSolanaAddress(publicKeyBytes: Uint8Array): string {
  const pk = publicKeyBytes.length > 32 ? publicKeyBytes.slice(0, 32) : publicKeyBytes;
  return bs58.encode(pk);
}

/**
 * Derive Sui address from a 32-byte Ed25519 public key.
 * Sui address = blake2b-256(0x00 || pubkey)
 */
export function deriveSuiAddress(publicKeyBytes: Uint8Array): string {
  const pk = publicKeyBytes.length > 32 ? publicKeyBytes.slice(0, 32) : publicKeyBytes;
  const input = new Uint8Array(33);
  input[0] = 0x00; // Ed25519 scheme byte
  input.set(pk, 1);
  const hash = blake2b(input, { dkLen: 32 });
  return '0x' + Buffer.from(hash).toString('hex');
}

/**
 * Derive a deposit address for a given chain from a public key.
 * @param curve     - 'secp256k1' or 'ed25519'
 * @param pubkeyHex - hex-encoded public key bytes
 * @param chain     - target chain name ('ethereum', 'solana', 'sui', etc.)
 */
export function deriveAddressForChain(
  curve: PoolCurve,
  pubkeyHex: string,
  chain: string,
): string {
  const pubkey = Buffer.from(pubkeyHex.replace(/^0x/, ''), 'hex');
  const chainLower = chain.toLowerCase();

  if (curve === 'secp256k1') {
    // All EVM chains share the same address
    return deriveEVMAddress(pubkey);
  }

  // Ed25519 — derive per-chain
  if (chainLower === 'sui') {
    return deriveSuiAddress(pubkey);
  }
  // Default: Solana-compatible (base58)
  return deriveSolanaAddress(pubkey);
}

// ── Pool Manager ───────────────────────────────────────────────────────────────

export interface DWalletPoolConfig {
  targetPoolSize: number;
  replenishThreshold: number;
  ikaRpcUrl: string;
  ikaNetwork: 'mainnet' | 'testnet' | 'devnet';
  suiKeypairBytes: Uint8Array;
}

export interface PoolStatus {
  secp256k1: { available: number; assigned: number; sealed: number; total: number };
  ed25519: { available: number; assigned: number; sealed: number; total: number };
  replenishNeeded: boolean;
}

export interface AssignedDWallet {
  dwalletId: string;
  dwalletCapId: string;
  depositAddress: string;
  curve: PoolCurve;
}

export interface DWalletPool {
  initPool(): Promise<void>;
  assignDWallet(curve: PoolCurve, userSolanaWallet: string): Promise<AssignedDWallet>;
  getDepositAddress(dwalletId: string, chain: string): string | null;
  markSealed(dwalletId: string, sealId: string): void;
  replenishPool(): Promise<void>;
  getPoolStatus(): PoolStatus;
  stop(): void;
}

export function createDWalletPool(
  config: DWalletPoolConfig,
  db: DB,
  queue: ProcessingQueue,
  logger: Logger,
): DWalletPool {
  let replenishTimer: NodeJS.Timeout | undefined;
  let stopped = false;

  // ── IkaDWalletService ────────────────────────────────────────────────────────
  const ikaDWalletConfig: IkaDWalletConfig = {
    suiRpcUrl: config.ikaRpcUrl,
    ikaNetwork: config.ikaNetwork,
    suiKeypairBytes: config.suiKeypairBytes,
    logger: {
      info: (msg: string) => logger.info(`[dWallet] ${msg}`),
      warn: (msg: string) => logger.warn(`[dWallet] ${msg}`),
      error: (msg: string) => logger.error(`[dWallet] ${msg}`),
      debug: (msg: string) => logger.debug(`[dWallet] ${msg}`),
    },
  };
  const dwalletService = new IkaDWalletService(ikaDWalletConfig);
  let serviceReady = false;

  async function ensureServiceReady(): Promise<void> {
    if (!serviceReady) {
      await dwalletService.initialize();
      serviceReady = true;
    }
  }

  // ── Core: create a single dWallet and add to pool ────────────────────────────
  async function createAndAddToPool(curve: PoolCurve): Promise<void> {
    await ensureServiceReady();

    const ikaCurve = curve === 'secp256k1' ? 'SECP256K1' : 'ED25519';
    logger.info(`Pool: creating ${curve} dWallet...`);

    const ref = await dwalletService.createDWallet(ikaCurve);

    // Derive deposit address (primary: EVM for secp256k1, Solana for ed25519)
    const pubkeyHex = Buffer.from(ref.publicKey).toString('hex');
    let depositAddress: string;
    if (curve === 'secp256k1') {
      depositAddress = deriveEVMAddress(ref.publicKey);
    } else {
      depositAddress = deriveSolanaAddress(ref.publicKey);
    }

    const entry: PooledDWallet = {
      id: randomUUID(),
      dwallet_id: ref.dwalletId,
      dwallet_cap_id: ref.dwalletCapId,
      public_key: pubkeyHex,
      curve,
      deposit_address: depositAddress,
      status: 'available',
      assigned_to: null,
      assigned_at: null,
      seal_id: null,
      created_at: Date.now(),
    };

    db.addToPool(entry);
    logger.info(`Pool: added ${curve} dWallet ${ref.dwalletId} → ${depositAddress}`);
  }

  // ── initPool: ensure minimum wallets exist on startup ────────────────────────
  async function initPool(): Promise<void> {
    logger.info('Pool: initialising dWallet pool...');

    const curves: PoolCurve[] = ['secp256k1', 'ed25519'];

    for (const curve of curves) {
      const available = db.countPoolByStatus(curve, 'available');
      const assigned  = db.countPoolByStatus(curve, 'assigned');
      const total     = available + assigned;
      const needed    = Math.max(0, config.targetPoolSize - total);

      logger.info(`Pool [${curve}]: available=${available} assigned=${assigned} → creating ${needed} new`);

      for (let i = 0; i < needed; i++) {
        try {
          await createAndAddToPool(curve);
        } catch (err) {
          logger.error(`Pool: failed to create ${curve} dWallet: ${err}`);
          // Continue — partial pool is better than none
        }
      }
    }

    logger.info('Pool: initialisation complete');
    startReplenishTimer();
  }

  // ── assignDWallet: pick from pool and mark assigned ──────────────────────────
  async function assignDWallet(
    curve: PoolCurve,
    userSolanaWallet: string,
  ): Promise<AssignedDWallet> {
    const entry = db.getAvailableFromPool(curve);

    if (!entry) {
      // Trigger async replenishment and return error
      replenishPool().catch((err) => logger.error(`Pool replenish error: ${err}`));
      throw new Error(`No available ${curve} dWallet in pool. Replenishment triggered.`);
    }

    const now = Date.now();
    const assigned = db.assignFromPool(entry.id, userSolanaWallet, now);

    if (!assigned) {
      // Race condition - someone else took it; recurse
      return assignDWallet(curve, userSolanaWallet);
    }

    logger.info(`Pool: assigned ${curve} dWallet ${entry.dwallet_id} to ${userSolanaWallet}`);

    // Check if replenishment is needed
    const remaining = db.countPoolByStatus(curve, 'available');
    if (remaining <= config.replenishThreshold) {
      logger.info(`Pool [${curve}]: below threshold (${remaining} left), triggering replenishment`);
      replenishPool().catch((err) => logger.error(`Pool replenish error: ${err}`));
    }

    return {
      dwalletId: entry.dwallet_id,
      dwalletCapId: entry.dwallet_cap_id,
      depositAddress: entry.deposit_address,
      curve: entry.curve,
    };
  }

  // ── getDepositAddress: derive address for a specific chain ───────────────────
  function getDepositAddress(dwalletId: string, chain: string): string | null {
    const entry = db.getPoolDwallet(dwalletId);
    if (!entry) return null;
    return deriveAddressForChain(entry.curve, entry.public_key, chain);
  }

  // ── markSealed ───────────────────────────────────────────────────────────────
  function markSealed(dwalletId: string, sealId: string): void {
    db.markPoolDwalletSealed(dwalletId, sealId);
    logger.info(`Pool: dWallet ${dwalletId} sealed (sealId=${sealId})`);
  }

  // ── replenishPool: background task to top up pool ────────────────────────────
  async function replenishPool(): Promise<void> {
    if (stopped) return;

    logger.info('Pool: running replenishment check...');
    const curves: PoolCurve[] = ['secp256k1', 'ed25519'];

    for (const curve of curves) {
      const available = db.countPoolByStatus(curve, 'available');
      const assigned  = db.countPoolByStatus(curve, 'assigned');
      const total     = available + assigned;
      const needed    = Math.max(0, config.targetPoolSize - total);

      if (needed > 0) {
        logger.info(`Pool [${curve}]: replenishing ${needed} dWallets (have ${available} available)`);
        for (let i = 0; i < needed; i++) {
          if (stopped) return;
          try {
            await createAndAddToPool(curve);
          } catch (err) {
            logger.error(`Pool: replenishment failed for ${curve}: ${err}`);
          }
        }
      }
    }
  }

  // ── getPoolStatus ────────────────────────────────────────────────────────────
  function getPoolStatus(): PoolStatus {
    const raw = db.getPoolStats();
    const secp256k1Available = raw.secp256k1.available;
    const ed25519Available   = raw.ed25519.available;

    const replenishNeeded =
      secp256k1Available <= config.replenishThreshold ||
      ed25519Available   <= config.replenishThreshold;

    return {
      secp256k1: {
        ...raw.secp256k1,
        total: raw.secp256k1.available + raw.secp256k1.assigned + raw.secp256k1.sealed,
      },
      ed25519: {
        ...raw.ed25519,
        total: raw.ed25519.available + raw.ed25519.assigned + raw.ed25519.sealed,
      },
      replenishNeeded,
    };
  }

  // ── background timer ─────────────────────────────────────────────────────────
  function startReplenishTimer(): void {
    // Poll every 5 minutes to check pool health
    replenishTimer = setInterval(async () => {
      if (stopped) return;
      const status = getPoolStatus();
      if (status.replenishNeeded) {
        await replenishPool().catch((err) =>
          logger.error(`Pool background replenish error: ${err}`)
        );
      }
    }, 5 * 60 * 1000);
  }

  function stop(): void {
    stopped = true;
    if (replenishTimer) {
      clearInterval(replenishTimer);
      replenishTimer = undefined;
    }
    logger.info('Pool: stopped');
  }

  return {
    initPool,
    assignDWallet,
    getDepositAddress,
    markSealed,
    replenishPool,
    getPoolStatus,
    stop,
  };
}

/**
 * Factory helper: build DWalletPoolConfig from RelayerConfig
 */
export function poolConfigFromRelayer(config: RelayerConfig): DWalletPoolConfig {
  // getSecretKey() returns bech32-encoded string; decode back to raw bytes
  const { secretKey } = decodeSuiPrivateKey(config.suiKeypair.getSecretKey());
  return {
    targetPoolSize: config.poolTargetSize,
    replenishThreshold: config.poolReplenishThreshold,
    ikaRpcUrl: config.suiRpcUrl,
    ikaNetwork: config.ikaNetwork,
    suiKeypairBytes: secretKey,
  };
}
