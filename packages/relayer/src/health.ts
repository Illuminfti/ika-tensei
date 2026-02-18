/**
 * HTTP health check endpoint
 */

import http from 'http';
import { type Logger } from './logger';
import type { DB } from './db.js';
import type { ProcessingQueue } from './queue.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    sui: { status: string; error?: string };
    solana: { status: string; error?: string };
    ika: { status: string; error?: string };
  };
  queue: {
    queued: number;
    processing: number;
    total: number;
  };
  database: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
}

export interface HealthServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStatus(): HealthStatus;
  setServiceStatus(service: 'sui' | 'solana' | 'ika', status: string, error?: string): void;
}

export function createHealthServer(
  port: number,
  logger: Logger,
  db: DB,
  queue: ProcessingQueue,
  uptimeStart: number,
  version: string = '3.0.0',
): HealthServer {
  let running = false;
  let server: http.Server | null = null;

  const serviceStatus = {
    sui: { status: 'unknown', error: undefined as string | undefined },
    solana: { status: 'unknown', error: undefined as string | undefined },
    ika: { status: 'unknown', error: undefined as string | undefined },
  };

  function calculateOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const services = Object.values(serviceStatus);
    const unhealthy = services.filter(s => s.status === 'unhealthy').length;
    const degraded = services.filter(s => s.status === 'degraded').length;

    if (unhealthy > 0) return 'unhealthy';
    if (degraded > 0 || services.some(s => s.status === 'unknown')) return 'degraded';
    return 'healthy';
  }

  function getStatus(): HealthStatus {
    const stats = db.getStats();
    const queueStats = queue.getStats();

    return {
      status: calculateOverallStatus(),
      timestamp: new Date().toISOString(),
      uptime: Date.now() - uptimeStart,
      version,
      services: { ...serviceStatus },
      queue: queueStats,
      database: stats,
    };
  }

  function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname === '/health' || url.pathname === '/') {
      const status = getStatus();
      const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status, null, 2));
      return;
    }

    if (url.pathname === '/ready') {
      const status = getStatus();
      const ready = status.services.sui.status !== 'unhealthy' &&
                    status.services.solana.status !== 'unhealthy' &&
                    status.services.ika.status !== 'unhealthy';
      
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready }));
      return;
    }

    if (url.pathname === '/live') {
      // Liveness probe - always return 200 if server is running
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alive: true }));
      return;
    }

    // 404 for unknown paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  async function start(): Promise<void> {
    if (running) return;

    return new Promise((resolve) => {
      server = http.createServer(handleRequest);
      
      server.listen(port, () => {
        running = true;
        logger.info(`Health server started on port ${port}`);
        resolve();
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`Port ${port} already in use`);
        } else {
          logger.error(`Health server error: ${err}`);
        }
        throw err;
      });
    });
  }

  async function stop(): Promise<void> {
    if (!running || !server) return;

    return new Promise((resolve) => {
      server!.close(() => {
        running = false;
        server = null;
        logger.info('Health server stopped');
        resolve();
      });
    });
  }

  return {
    start,
    stop,
    isRunning: () => running,
    getStatus,
    setServiceStatus(service, status, error) {
      serviceStatus[service] = { status, error };
      logger.debug(`Service ${service} status: ${status}${error ? ` (${error})` : ''}`);
    },
  };
}
