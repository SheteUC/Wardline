import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { voiceRoutes } from './routes/voice.routes';
import { errorHandler } from './middleware/error-handler';
import { MediaStreamServer } from './websocket/media-stream.server';

class VoiceOrchestratorServer {
    private app: Express;
    private httpServer: Server | null = null;
    private wsServer: WebSocketServer | null = null;
    private mediaStreamServer: MediaStreamServer | null = null;

    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    private setupMiddleware(): void {
        // Security
        this.app.use(helmet());
        this.app.use(cors());

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((_req: Request, _res: Response, next: NextFunction) => {
            console.log(`[${new Date().toISOString()}] ${_req.method} ${_req.path}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (_req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                service: 'voice-orchestrator',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        });

        // Readiness check
        this.app.get('/ready', (_req: Request, res: Response) => {
            const isReady = this.httpServer !== null && this.wsServer !== null;

            if (isReady) {
                res.json({ ready: true });
            } else {
                res.status(503).json({ ready: false, message: 'Service not ready' });
            }
        });

        // Voice webhooks
        this.app.use('/voice', voiceRoutes);
    }

    private setupErrorHandling(): void {
        this.app.use(errorHandler);
    }

    public async start(): Promise<void> {
        const port = config.port;

        // Start HTTP server
        this.httpServer = this.app.listen(port, () => {
            console.log(`🚀 Voice Orchestrator running on port ${port}`);
            console.log(`📞 Twilio webhook: http://localhost:${port}/voice/incoming`);
            console.log(`🔌 WebSocket: ws://localhost:${port}`);
        });

        // Start WebSocket server
        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.mediaStreamServer = new MediaStreamServer(this.wsServer);

        console.log('✅ Voice Orchestrator started successfully');
    }

    public async stop(): Promise<void> {
        console.log('🛑 Shutting down Voice Orchestrator...');

        if (this.mediaStreamServer) {
            this.mediaStreamServer.close();
        }

        if (this.wsServer) {
            this.wsServer.close();
        }

        if (this.httpServer) {
            await new Promise<void>((resolve) => {
                this.httpServer!.close(() => resolve());
            });
        }

        console.log('✅ Voice Orchestrator stopped');
    }
}

// Bootstrap
const server = new VoiceOrchestratorServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
});

// Start server
server.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
