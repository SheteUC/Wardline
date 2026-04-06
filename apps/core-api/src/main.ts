import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { coreApiEnvSchema, validateEnv } from '@wardline/config';
import { AppModule } from './app.module';
import { Logger } from '@wardline/utils';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { requestContextExpressMiddleware } from './observability/request-context.express.middleware';
import { buildCorsOriginAllowlist, isCorsOriginAllowed } from './bootstrap/cors';
import { resolveCompressionThreshold, resolveCorsMaxAgeSeconds } from './config/runtime-settings';

const logger = new Logger('Bootstrap');

async function bootstrap() {
    const env = validateEnv(coreApiEnvSchema);
    const defaultBodyLimit = env.CORE_API_BODY_LIMIT ?? '2mb';
    const allowedOrigins = buildCorsOriginAllowlist(env);
    const compressionThreshold = resolveCompressionThreshold(env.CORE_API_COMPRESSION_THRESHOLD_BYTES);
    const corsMaxAge = resolveCorsMaxAgeSeconds(env.CORE_API_CORS_MAX_AGE_SECONDS);
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
        bodyParser: false,
    });
    const expressApp = app.getHttpAdapter().getInstance();

    app.enableShutdownHooks();
    expressApp.disable('x-powered-by');

    app.use(json({ limit: defaultBodyLimit }));
    app.use(urlencoded({ extended: true, limit: defaultBodyLimit }));

    app.use(requestContextExpressMiddleware);
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('X-Download-Options', 'noopen');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

        if (env.NODE_ENV === 'production') {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        next();
    });

    app.use(
        compression({
            threshold: compressionThreshold,
            level: 6,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
        }),
    );

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
        prefix: 'v',
    });

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (isCorsOriginAllowed(origin, allowedOrigins)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        maxAge: corsMaxAge,
    });

    let swaggerEnabled = false;
    try {
        const config = new DocumentBuilder()
            .setTitle('Wardline Core API')
            .setDescription('HIPAA-compliant business call automation platform API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
        swaggerEnabled = true;
    } catch (error) {
        logger.warn(
            `Swagger bootstrap skipped due to startup error: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }

    const port = Number(env.PORT) || 3001;
    await app.listen(port);

    logger.info(`Core API is running on: http://localhost:${port}`);
    if (swaggerEnabled) {
        logger.info(`Swagger docs available at: http://localhost:${port}/api/docs`);
    }
}

bootstrap();
