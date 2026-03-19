import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('api/businesses/:businessId/agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    // -------------------------------------------------------------------------
    // Catalog (read-only templates)
    // -------------------------------------------------------------------------

    @Get('catalog')
    getCatalog() {
        return this.agentsService.getCatalog();
    }

    @Get('catalog/:catalogId')
    getCatalogItem(@Param('catalogId') catalogId: string) {
        return this.agentsService.getCatalogItem(catalogId);
    }

    // -------------------------------------------------------------------------
    // Deployed Agents
    // -------------------------------------------------------------------------

    @Get()
    findAll(@Param('businessId') businessId: string) {
        return this.agentsService.findAll(businessId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.agentsService.findOne(id);
    }

    @Get(':id/stats')
    getStats(
        @Param('id') id: string,
        @Param('businessId') businessId: string,
    ) {
        return this.agentsService.getStats(id, businessId);
    }

    /** Deploy a catalog agent for this business */
    @Post('deploy/:catalogId')
    @HttpCode(HttpStatus.CREATED)
    deploy(
        @Param('businessId') businessId: string,
        @Param('catalogId') catalogId: string,
    ) {
        return this.agentsService.deploy(businessId, catalogId);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' },
    ) {
        return this.agentsService.updateStatus(id, body.status);
    }

    @Patch(':id/tool-config')
    updateToolConfig(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateToolConfig(id, body);
    }

    @Patch(':id/agent-config')
    updateAgentConfig(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateAgentConfig(id, body);
    }

    @Patch(':id/node-graph')
    updateNodeGraph(
        @Param('id') id: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.agentsService.updateNodeGraph(id, body);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async undeploy(@Param('id') id: string) {
        await this.agentsService.undeploy(id);
    }
}
