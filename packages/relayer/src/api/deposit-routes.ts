/**
 * Deposit Flow API Routes
 *
 * Handles:
 *   POST /api/seal/start          — Assign a dWallet from pool, return deposit address
 *   GET  /api/seal/:dwalletId/status — Current seal processing status
 *   GET  /api/pool/status          — Pool statistics (available/assigned/sealed per curve)
 *   POST /webhooks/alchemy         — Alchemy NFT transfer webhook receiver
 *   POST /webhooks/helius          — Helius NFT transfer webhook receiver
 *
 * No external framework — uses the same Node.js http module pattern as health.ts.
 */

import http from 'http';
import crypto from 'crypto';
import type { DB } from '../db.js';
import type { Logger } from '../logger.js';
import type { DWalletPool } from '../services/dwallet-pool.js';
import type { DepositDetector } from '../services/deposit-detector.js';
import type { PoolCurve } from '../db.js';

// ── Seal status (deposit-flow view) ──────────────────────────────────────────

export type SealFlowStatus =
  | 'waiting_deposit'   // dWallet assigned, waiting for NFT deposit
  | 'detected'          // Deposit seen on-chain
  | 'fetching_metadata' // Fetching NFT metadata
  | 'uploading'         // Uploading to Walrus/Arweave
  | 'minting'           // Minting reborn NFT on Solana
  | 'complete'          // Done
  | 'failed';

// ── Chain → curve mapping ─────────────────────────────────────────────────────

const EVM_CHAINS = new Set([
  'ethereum', 'eth',
  'polygon', 'matic',
  'arbitrum',
  'optimism', 'op',
  'base',
  'bsc', 'bnb',
  'avalanche', 'avax',
  'fantom', 'ftm',
  'moonbeam',
  'celo',
  'scroll',
  'linea',
  'blast',
  'gnosis',
  'mantle',
]);

function chainToCurve(chain: string): PoolCurve {
  return EVM_CHAINS.has(chain.toLowerCase()) ? 'secp256k1' : 'ed25519';
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function sendError(
  res: http.ServerResponse,
  status: number,
  message: string,
): void {
  sendJSON(res, status, { error: message });
}

// ── Alchemy webhook signature verification ───────────────────────────────────

function verifyAlchemySignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Route handler factory ──────────────────────────────────────────────────────

export interface DepositRoutesOptions {
  alchemyWebhookSecret?: string;
}

export function createDepositHandler(
  db: DB,
  pool: DWalletPool,
  detector: DepositDetector,
  logger: Logger,
  opts: DepositRoutesOptions = {},
): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<boolean> {
  /**
   * Returns true if the request was handled (matched a route), false otherwise.
   * Caller can chain with other handlers (e.g. health server).
   */
  return async function handleDepositRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<boolean> {
    const url    = new URL(req.url ?? '/', `http://localhost`);
    const path   = url.pathname;
    const method = req.method ?? 'GET';

    // Pre-flight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return true;
    }

    // ── POST /api/seal/start ────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/seal/start') {
      try {
        const raw  = await readBody(req);
        const body = JSON.parse(raw.toString()) as {
          solanaWallet?: string;
          sourceChain?: string;
        };

        if (!body.solanaWallet) {
          sendError(res, 400, 'solanaWallet is required');
          return true;
        }
        if (!body.sourceChain) {
          sendError(res, 400, 'sourceChain is required');
          return true;
        }

        const curve   = chainToCurve(body.sourceChain);
        const assigned = await pool.assignDWallet(curve, body.solanaWallet);

        // Derive chain-specific deposit address
        const depositAddress =
          pool.getDepositAddress(assigned.dwalletId, body.sourceChain) ??
          assigned.depositAddress;

        // Register address for monitoring
        await detector.addAddress(depositAddress, body.sourceChain, assigned.dwalletId);

        logger.info(`Seal start: wallet=${body.solanaWallet} chain=${body.sourceChain} addr=${depositAddress}`);

        sendJSON(res, 200, {
          dwalletId: assigned.dwalletId,
          depositAddress,
          chain: body.sourceChain,
          curve,
          status: 'waiting_deposit',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`POST /api/seal/start error: ${msg}`);
        sendError(res, 503, msg);
      }
      return true;
    }

    // ── GET /api/seal/:dwalletId/status ─────────────────────────────────────
    const sealStatusMatch = path.match(/^\/api\/seal\/([^/]+)\/status$/);
    if (method === 'GET' && sealStatusMatch) {
      const dwalletId = decodeURIComponent(sealStatusMatch[1]);

      const poolEntry = db.getPoolDwallet(dwalletId);
      if (!poolEntry) {
        sendError(res, 404, `dWallet not found: ${dwalletId}`);
        return true;
      }

      // Check deposit records for this dWallet
      const deposits = db.getDepositsByDwallet(dwalletId);
      const latestDeposit = deposits[0];

      // Check seal record (if exists)
      const sealRecord = poolEntry.seal_id
        ? db.getSealByHash(poolEntry.seal_id)
        : undefined;

      let status: SealFlowStatus = 'waiting_deposit';

      if (latestDeposit) {
        if (latestDeposit.status === 'detected') {
          status = 'detected';
        } else if (latestDeposit.status === 'processing') {
          status = 'fetching_metadata';
        } else if (latestDeposit.status === 'processed') {
          status = sealRecord ? mapSealStatus(sealRecord.status) : 'minting';
        } else if (latestDeposit.status === 'failed') {
          status = 'failed';
        }
      }

      if (poolEntry.status === 'sealed') {
        status = sealRecord?.status === 'completed' ? 'complete' : status;
      }

      sendJSON(res, 200, {
        dwalletId,
        status,
        poolStatus: poolEntry.status,
        depositAddress: poolEntry.deposit_address,
        curve: poolEntry.curve,
        deposit: latestDeposit
          ? {
              txHash: latestDeposit.tx_hash,
              chain: latestDeposit.chain,
              contractAddress: latestDeposit.contract_address,
              tokenId: latestDeposit.token_id,
              sender: latestDeposit.sender,
              detectedAt: latestDeposit.detected_at,
              status: latestDeposit.status,
            }
          : null,
        seal: sealRecord
          ? {
              status: sealRecord.status,
              mintAddress: sealRecord.solana_mint_address,
              error: sealRecord.error,
            }
          : null,
      });
      return true;
    }

    // ── GET /api/pool/status ────────────────────────────────────────────────
    if (method === 'GET' && path === '/api/pool/status') {
      const status = pool.getPoolStatus();
      sendJSON(res, 200, status);
      return true;
    }

    // ── POST /webhooks/alchemy ──────────────────────────────────────────────
    if (method === 'POST' && path === '/webhooks/alchemy') {
      try {
        const raw = await readBody(req);

        // Verify signature if secret is configured
        if (opts.alchemyWebhookSecret) {
          const sig = req.headers['x-alchemy-signature'] as string | undefined;
          if (!sig || !verifyAlchemySignature(raw, sig, opts.alchemyWebhookSecret)) {
            sendError(res, 401, 'Invalid webhook signature');
            return true;
          }
        }

        const payload = JSON.parse(raw.toString());
        await detector.handleAlchemyWebhook(payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (err) {
        logger.error(`Alchemy webhook error: ${err}`);
        res.writeHead(500);
        res.end('{"error":"internal"}');
      }
      return true;
    }

    // ── POST /webhooks/helius ───────────────────────────────────────────────
    if (method === 'POST' && path === '/webhooks/helius') {
      try {
        const raw          = await readBody(req);
        const transactions = JSON.parse(raw.toString());
        await detector.handleHeliusWebhook(transactions);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (err) {
        logger.error(`Helius webhook error: ${err}`);
        res.writeHead(500);
        res.end('{"error":"internal"}');
      }
      return true;
    }

    // Not handled
    return false;
  };
}

// ── Status mapping helper ─────────────────────────────────────────────────────

function mapSealStatus(
  sealStatus: string,
): SealFlowStatus {
  switch (sealStatus) {
    case 'sealed':
    case 'signing':
    case 'signed':
    case 'verifying':
    case 'verified':
      return 'uploading';
    case 'minting':
      return 'minting';
    case 'minted':
    case 'closing':
    case 'completed':
      return 'complete';
    case 'failed':
      return 'failed';
    default:
      return 'fetching_metadata';
  }
}

// ── Standalone API HTTP server ────────────────────────────────────────────────

export interface APIServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export function createAPIServer(
  port: number,
  db: DB,
  pool: DWalletPool,
  detector: DepositDetector,
  logger: Logger,
  alchemyWebhookSecret?: string,
): APIServer {
  const handler = createDepositHandler(db, pool, detector, logger, {
    alchemyWebhookSecret,
  });

  let server: http.Server | null = null;
  let running = false;

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const handled = await handler(req, res).catch(() => false);
    if (!handled) {
      sendError(res, 404, 'Not found');
    }
  }

  async function start(): Promise<void> {
    if (running) return;
    return new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
          logger.error(`API request error: ${err}`);
          try {
            res.writeHead(500);
            res.end('{"error":"internal"}');
          } catch {
            // ignore
          }
        });
      });

      server.listen(port, () => {
        running = true;
        logger.info(`API server started on port ${port}`);
        resolve();
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`API port ${port} already in use`);
        } else {
          logger.error(`API server error: ${err}`);
        }
        reject(err);
      });
    });
  }

  async function stop(): Promise<void> {
    if (!running || !server) return;
    return new Promise((resolve) => {
      server!.close(() => {
        running = false;
        server = null;
        logger.info('API server stopped');
        resolve();
      });
    });
  }

  return { start, stop, isRunning: () => running };
}
