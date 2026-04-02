import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import { AppModule } from './app.module';
import { Logger } from '@wardline/utils';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { requestContextExpressMiddleware } from './observability/request-context.express.middleware';

const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    app.use(requestContextExpressMiddleware);

    app.use(
        compression({
            threshold: 1024,
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

            const allowedOrigins = [
                process.env.WEB_BASE_URL || 'http://localhost:3000',
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3003',
            ];

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        maxAge: 86400,
    });

    const config = new DocumentBuilder()
        .setTitle('Wardline Core API')
        .setDescription('HIPAA-compliant business call automation platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.info(`Core API is running on: http://localhost:${port}`);
    logger.info(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
