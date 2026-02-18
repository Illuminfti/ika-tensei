/**
 * SQLite state persistence for tracking seal processing
 */

import Database from 'better-sqlite3';
import { createLogger, type Logger } from './logger';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export type SealStatus = 
  | 'sealed'           // NFTSealed event detected
  | 'signing'         // IKA signing in progress
  | 'signed'          // Signature obtained
  | 'verifying'        // Verifying on Solana
  | 'verified'        // Seal verified on Solana
  | 'minting'         // Minting reborn NFT
  | 'minted'          // Reborn NFT minted
  | 'closing'         // Marking reborn on Sui
  | 'completed'       // Full flow complete
  | 'failed';         // Failed (check error column)

// ── dWallet Pool Types ─────────────────────────────────────────────────────────
export type PoolDWalletStatus = 'available' | 'assigned' | 'sealed';
export type PoolCurve = 'secp256k1' | 'ed25519';

export interface PooledDWallet {
  id: string;
  dwallet_id: string;
  dwallet_cap_id: string;
  public_key: string;      // hex-encoded public key bytes
  curve: PoolCurve;
  deposit_address: string; // primary derived address (EVM for secp256k1, Solana for ed25519)
  status: PoolDWalletStatus;
  assigned_to: string | null;  // user's Solana wallet pubkey
  assigned_at: number | null;  // unix ms
  seal_id: string | null;
  created_at: number;          // unix ms
}

// ── Deposit Types ──────────────────────────────────────────────────────────────
export type DepositStatus = 'detected' | 'processing' | 'processed' | 'failed';

export interface DepositRecord {
  id: string;
  dwallet_id: string;
  chain: string;
  contract_address: string;
  token_id: string;
  tx_hash: string;
  block_number: number;
  sender: string;
  status: DepositStatus;
  detected_at: number;  // unix ms
  metadata: string | null; // JSON blob
}

export interface SealRecord {
  id: number;
  seal_hash: string;
  status: SealStatus;
  source_chain: number;
  dest_chain: number;
  source_contract: string;
  token_id: string;
  nonce: number;
  nft_name: string;
  nft_description: string;
  metadata_uri: string;
  collection_name: string;
  dwallet_pubkey: string;
  solana_mint_address: string | null;
  signature: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  tx_seal: string | null;
  tx_sign: string | null;
  tx_verify: string | null;
  tx_mint: string | null;
  tx_close: string | null;
}

export interface DB {
  close(): void;
  // ── Seal methods ──────────────────────────────────────────────────────────────
  getSealByHash(sealHash: string): SealRecord | undefined;
  getSealsByStatus(status: SealStatus, limit?: number): SealRecord[];
  createSeal(record: Omit<SealRecord, 'id' | 'created_at' | 'updated_at'>): number;
  updateSealStatus(sealHash: string, status: SealStatus, error?: string): void;
  updateSealSignature(sealHash: string, signature: string, txSign: string): void;
  updateSealVerified(sealHash: string, txVerify: string): void;
  updateSealMinted(sealHash: string, mintAddress: string, txMint: string): void;
  updateSealCompleted(sealHash: string, txClose: string): void;
  getStats(): { total: number; pending: number; completed: number; failed: number };

  // ── dWallet Pool methods ──────────────────────────────────────────────────────
  addToPool(entry: PooledDWallet): void;
  getAvailableFromPool(curve: PoolCurve): PooledDWallet | undefined;
  assignFromPool(id: string, assignedTo: string, assignedAt: number): boolean;
  markPoolDwalletSealed(dwalletId: string, sealId: string): void;
  getPoolDwallet(dwalletId: string): PooledDWallet | undefined;
  countPoolByStatus(curve: PoolCurve, status: PoolDWalletStatus): number;
  getPoolStats(): { secp256k1: { available: number; assigned: number; sealed: number }; ed25519: { available: number; assigned: number; sealed: number } };
  getAllPoolDwallets(): PooledDWallet[];

  // ── Deposit methods ───────────────────────────────────────────────────────────
  createDeposit(record: DepositRecord): void;
  getDepositByTxHash(txHash: string): DepositRecord | undefined;
  getDepositsByDwallet(dwalletId: string): DepositRecord[];
  updateDepositStatus(id: string, status: DepositStatus): void;
}

export function createDB(dbPath: string, logger: Logger): DB {
  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS seals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seal_hash TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'sealed',
      source_chain INTEGER NOT NULL,
      dest_chain INTEGER NOT NULL,
      source_contract TEXT NOT NULL,
      token_id TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      nft_name TEXT,
      nft_description TEXT,
      metadata_uri TEXT,
      collection_name TEXT,
      dwallet_pubkey TEXT NOT NULL,
      solana_mint_address TEXT,
      signature TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      tx_seal TEXT,
      tx_sign TEXT,
      tx_verify TEXT,
      tx_mint TEXT,
      tx_close TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_seals_status ON seals(status);
    CREATE INDEX IF NOT EXISTS idx_seals_hash ON seals(seal_hash);
    CREATE INDEX IF NOT EXISTS idx_seals_updated ON seals(updated_at);

    CREATE TABLE IF NOT EXISTS dwallet_pool (
      id TEXT PRIMARY KEY,
      dwallet_id TEXT UNIQUE NOT NULL,
      dwallet_cap_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      curve TEXT NOT NULL,
      deposit_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      assigned_to TEXT,
      assigned_at INTEGER,
      seal_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pool_curve_status ON dwallet_pool(curve, status);
    CREATE INDEX IF NOT EXISTS idx_pool_dwallet_id ON dwallet_pool(dwallet_id);

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      dwallet_id TEXT NOT NULL,
      chain TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      token_id TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      block_number INTEGER NOT NULL,
      sender TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'detected',
      detected_at INTEGER NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_deposits_dwallet ON deposits(dwallet_id);
    CREATE INDEX IF NOT EXISTS idx_deposits_tx ON deposits(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
  `);

  logger.info(`Database initialized: ${dbPath}`);

  const stmtGetSealByHash = db.prepare(`
    SELECT * FROM seals WHERE seal_hash = ?
  `);

  const stmtGetSealsByStatus = db.prepare(`
    SELECT * FROM seals WHERE status = ? ORDER BY updated_at ASC LIMIT ?
  `);

  const stmtCreateSeal = db.prepare(`
    INSERT INTO seals (
      seal_hash, status, source_chain, dest_chain, source_contract, token_id,
      nonce, nft_name, nft_description, metadata_uri, collection_name,
      dwallet_pubkey, solana_mint_address, signature, error, tx_seal
    ) VALUES (
      @seal_hash, @status, @source_chain, @dest_chain, @source_contract, @token_id,
      @nonce, @nft_name, @nft_description, @metadata_uri, @collection_name,
      @dwallet_pubkey, @solana_mint_address, @signature, @error, @tx_seal
    )
  `);

  const stmtUpdateStatus = db.prepare(`
    UPDATE seals SET status = ?, error = ?, updated_at = datetime('now') WHERE seal_hash = ?
  `);

  const stmtUpdateSignature = db.prepare(`
    UPDATE seals SET signature = ?, tx_sign = ?, status = 'signed', updated_at = datetime('now') 
    WHERE seal_hash = ?
  `);

  const stmtUpdateVerified = db.prepare(`
    UPDATE seals SET tx_verify = ?, status = 'verified', updated_at = datetime('now') 
    WHERE seal_hash = ?
  `);

  const stmtUpdateMinted = db.prepare(`
    UPDATE seals SET solana_mint_address = ?, tx_mint = ?, status = 'minted', updated_at = datetime('now') 
    WHERE seal_hash = ?
  `);

  const stmtUpdateCompleted = db.prepare(`
    UPDATE seals SET tx_close = ?, status = 'completed', updated_at = datetime('now') 
    WHERE seal_hash = ?
  `);

  const stmtGetStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('sealed', 'signing', 'signed', 'verifying', 'verified', 'minting', 'closing') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM seals
  `);

  // ── Pool statements ────────────────────────────────────────────────────────
  const stmtAddToPool = db.prepare(`
    INSERT OR IGNORE INTO dwallet_pool
      (id, dwallet_id, dwallet_cap_id, public_key, curve, deposit_address, status, assigned_to, assigned_at, seal_id, created_at)
    VALUES
      (@id, @dwallet_id, @dwallet_cap_id, @public_key, @curve, @deposit_address, @status, @assigned_to, @assigned_at, @seal_id, @created_at)
  `);

  const stmtGetAvailableFromPool = db.prepare(`
    SELECT * FROM dwallet_pool WHERE curve = ? AND status = 'available' ORDER BY created_at ASC LIMIT 1
  `);

  const stmtAssignFromPool = db.prepare(`
    UPDATE dwallet_pool SET status = 'assigned', assigned_to = ?, assigned_at = ?
    WHERE id = ? AND status = 'available'
  `);

  const stmtMarkPoolSealed = db.prepare(`
    UPDATE dwallet_pool SET status = 'sealed', seal_id = ? WHERE dwallet_id = ?
  `);

  const stmtGetPoolDwallet = db.prepare(`
    SELECT * FROM dwallet_pool WHERE dwallet_id = ?
  `);

  const stmtCountPoolByStatus = db.prepare(`
    SELECT COUNT(*) as count FROM dwallet_pool WHERE curve = ? AND status = ?
  `);

  const stmtGetAllPoolDwallets = db.prepare(`
    SELECT * FROM dwallet_pool ORDER BY created_at ASC
  `);

  const stmtGetPoolStats = db.prepare(`
    SELECT curve, status, COUNT(*) as count FROM dwallet_pool GROUP BY curve, status
  `);

  // ── Deposit statements ─────────────────────────────────────────────────────
  const stmtCreateDeposit = db.prepare(`
    INSERT OR IGNORE INTO deposits
      (id, dwallet_id, chain, contract_address, token_id, tx_hash, block_number, sender, status, detected_at, metadata)
    VALUES
      (@id, @dwallet_id, @chain, @contract_address, @token_id, @tx_hash, @block_number, @sender, @status, @detected_at, @metadata)
  `);

  const stmtGetDepositByTxHash = db.prepare(`
    SELECT * FROM deposits WHERE tx_hash = ?
  `);

  const stmtGetDepositsByDwallet = db.prepare(`
    SELECT * FROM deposits WHERE dwallet_id = ? ORDER BY detected_at DESC
  `);

  const stmtUpdateDepositStatus = db.prepare(`
    UPDATE deposits SET status = ? WHERE id = ?
  `);

  return {
    close() {
      db.close();
      logger.info('Database closed');
    },

    getSealByHash(sealHash: string): SealRecord | undefined {
      const row = stmtGetSealByHash.get(sealHash) as SealRecord | undefined;
      return row;
    },

    getSealsByStatus(status: SealStatus, limit: number = 100): SealRecord[] {
      return stmtGetSealsByStatus.all(status, limit) as SealRecord[];
    },

    createSeal(record: Omit<SealRecord, 'id' | 'created_at' | 'updated_at'>): number {
      const result = stmtCreateSeal.run(record);
      logger.debug(`Created seal record: ${record.seal_hash}`);
      return result.lastInsertRowid as number;
    },

    updateSealStatus(sealHash: string, status: SealStatus, error?: string): void {
      stmtUpdateStatus.run(status, error || null, sealHash);
      logger.debug(`Seal ${sealHash} status -> ${status}${error ? ` (${error})` : ''}`);
    },

    updateSealSignature(sealHash: string, signature: string, txSign: string): void {
      stmtUpdateSignature.run(signature, txSign, sealHash);
      logger.debug(`Seal ${sealHash} signature updated`);
    },

    updateSealVerified(sealHash: string, txVerify: string): void {
      stmtUpdateVerified.run(txVerify, sealHash);
      logger.debug(`Seal ${sealHash} verified on Solana`);
    },

    updateSealMinted(sealHash: string, mintAddress: string, txMint: string): void {
      stmtUpdateMinted.run(mintAddress, txMint, sealHash);
      logger.debug(`Seal ${sealHash} minted: ${mintAddress}`);
    },

    updateSealCompleted(sealHash: string, txClose: string): void {
      stmtUpdateCompleted.run(txClose, sealHash);
      logger.info(`Seal ${sealHash} completed!`);
    },

    getStats() {
      return stmtGetStats.get() as { total: number; pending: number; completed: number; failed: number };
    },

    // ── dWallet Pool ───────────────────────────────────────────────────────────
    addToPool(entry: PooledDWallet): void {
      stmtAddToPool.run(entry);
      logger.debug(`Pool: added dWallet ${entry.dwallet_id} (${entry.curve})`);
    },

    getAvailableFromPool(curve: PoolCurve): PooledDWallet | undefined {
      return stmtGetAvailableFromPool.get(curve) as PooledDWallet | undefined;
    },

    assignFromPool(id: string, assignedTo: string, assignedAt: number): boolean {
      const result = stmtAssignFromPool.run(assignedTo, assignedAt, id);
      return result.changes > 0;
    },

    markPoolDwalletSealed(dwalletId: string, sealId: string): void {
      stmtMarkPoolSealed.run(sealId, dwalletId);
      logger.debug(`Pool: marked dWallet ${dwalletId} as sealed`);
    },

    getPoolDwallet(dwalletId: string): PooledDWallet | undefined {
      return stmtGetPoolDwallet.get(dwalletId) as PooledDWallet | undefined;
    },

    countPoolByStatus(curve: PoolCurve, status: PoolDWalletStatus): number {
      const row = stmtCountPoolByStatus.get(curve, status) as { count: number };
      return row.count;
    },

    getAllPoolDwallets(): PooledDWallet[] {
      return stmtGetAllPoolDwallets.all() as PooledDWallet[];
    },

    getPoolStats(): { secp256k1: { available: number; assigned: number; sealed: number }; ed25519: { available: number; assigned: number; sealed: number } } {
      const rows = stmtGetPoolStats.all() as Array<{ curve: string; status: string; count: number }>;
      const stats = {
        secp256k1: { available: 0, assigned: 0, sealed: 0 },
        ed25519: { available: 0, assigned: 0, sealed: 0 },
      };
      for (const row of rows) {
        const curve = row.curve as PoolCurve;
        const status = row.status as PoolDWalletStatus;
        if (curve in stats && status in stats[curve]) {
          stats[curve][status] = row.count;
        }
      }
      return stats;
    },

    // ── Deposits ───────────────────────────────────────────────────────────────
    createDeposit(record: DepositRecord): void {
      stmtCreateDeposit.run(record);
      logger.debug(`Deposit created: ${record.tx_hash} on ${record.chain}`);
    },

    getDepositByTxHash(txHash: string): DepositRecord | undefined {
      return stmtGetDepositByTxHash.get(txHash) as DepositRecord | undefined;
    },

    getDepositsByDwallet(dwalletId: string): DepositRecord[] {
      return stmtGetDepositsByDwallet.all(dwalletId) as DepositRecord[];
    },

    updateDepositStatus(id: string, status: DepositStatus): void {
      stmtUpdateDepositStatus.run(status, id);
      logger.debug(`Deposit ${id} status -> ${status}`);
    },
  };
}
