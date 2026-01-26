import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@wardline/utils';
import compression from 'compression';

const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    // Enable response compression for faster data transfer
    // Compresses responses larger than 1kb by default
    app.use(compression({
        threshold: 1024, // Only compress responses larger than 1kb
        level: 6, // Compression level (1-9), 6 is a good balance
        filter: (req, res) => {
            // Don't compress if client doesn't accept it
            if (req.headers['x-no-compression']) {
                return false;
            }
            // Default compression filter
            return compression.filter(req, res);
        },
    }));

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS with preflight caching for faster subsequent requests
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or Postman)
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                process.env.WEB_BASE_URL || 'http://localhost:3000',
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
            ];
            
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        maxAge: 86400, // Cache preflight response for 24 hours
    });

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Wardline Core API')
        .setDescription('HIPAA-compliant hospital call triage platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 4000;
    await app.listen(port);

    logger.info(`🚀 Core API is running on: http://localhost:${port}`);
    logger.info(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
