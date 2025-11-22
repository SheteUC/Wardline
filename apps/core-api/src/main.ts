import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@wardline/utils';

const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS
    app.enableCors({
        origin: process.env.WEB_BASE_URL || 'http://localhost:3000',
        credentials: true,
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

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.info(`🚀 Core API is running on: http://localhost:${port}`);
    logger.info(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
