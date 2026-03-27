import {
    Controller, Get, Post, Patch, Delete, Header,
    Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AgentsService } from './agents.service';

const DEPRECATION_NOTICE =
    'Voice Runtime V2 replaces deployed agent records with internal specialists.';

@Controller('api/businesses/:businessId/agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    // -------------------------------------------------------------------------
    // Catalog (read-only templates)
    // -------------------------------------------------------------------------

    @Get('catalog')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    getCatalog() {
        return this.agentsService.getCatalog();
    }

    @Get('catalog/:catalogId')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    getCatalogItem(@Param('catalogId') catalogId: string) {
        return this.agentsService.getCatalogItem(catalogId);
    }

    // -------------------------------------------------------------------------
    // Deployed Agents
    // -------------------------------------------------------------------------

    @Get()
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    findAll(@Param('businessId') businessId: string) {
        return this.agentsService.findAll(businessId);
    }

    @Get(':id')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    findOne(@Param('id') id: string) {
        return this.agentsService.findOne(id);
    }

    @Get(':id/stats')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    getStats(
        @Param('id') id: string,
        @Param('businessId') businessId: string,
    ) {
        return this.agentsService.getStats(id, businessId);
    }

    /** Deploy a catalog agent for this business */
    @Post('deploy/:catalogId')
    @HttpCode(HttpStatus.CREATED)
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    deploy(
        @Param('businessId') businessId: string,
        @Param('catalogId') catalogId: string,
    ) {
        return this.agentsService.deploy(businessId, catalogId);
    }

    @Patch(':id/status')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    updateStatus(
        @Param('id') id: string,
        @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' },
    ) {
        return this.agentsService.updateStatus(id, body.status);
    }

    @Patch(':id/tool-config')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    updateToolConfig(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateToolConfig(id, body);
    }

    @Patch(':id/agent-config')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    updateAgentConfig(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateAgentConfig(id, body);
    }

    @Patch(':id/node-graph')
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    updateNodeGraph(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateNodeGraph(id, body);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Header('X-Wardline-Deprecated', DEPRECATION_NOTICE)
    async undeploy(@Param('id') id: string) {
        await this.agentsService.undeploy(id);
    }
}
