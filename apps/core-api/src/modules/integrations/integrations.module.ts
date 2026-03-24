import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationConnectorsService } from './integration-connectors.service';

@Module({
    controllers: [IntegrationsController],
    providers: [IntegrationsService, IntegrationConnectorsService],
    exports: [IntegrationsService, IntegrationConnectorsService],
})
export class IntegrationsModule {}
