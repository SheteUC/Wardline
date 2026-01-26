import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import {
    CreateAgentDto,
    UpdateAgentDto,
    UpdateAgentStatusDto,
    UpdateAgentAvailabilityDto,
    AgentQueryDto,
} from './dto/agent.dto';

@ApiTags('agents')
@Controller('api/hospitals/:hospitalId/agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) { }

    // ========================================
    // Agent CRUD
    // ========================================

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new agent (AI or Human)' })
    @ApiResponse({ status: 201, description: 'Agent created' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async create(
        @Param('hospitalId') hospitalId: string,
        @Body() dto: CreateAgentDto,
    ): Promise<any> {
        return this.agentsService.create(hospitalId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all agents for a hospital' })
    @ApiResponse({ status: 200, description: 'Agents retrieved' })
    async findAll(
        @Param('hospitalId') hospitalId: string,
        @Query() query: AgentQueryDto,
    ): Promise<any> {
        return this.agentsService.findAll(hospitalId, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get agent by ID' })
    @ApiResponse({ status: 200, description: 'Agent retrieved' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async findOne(@Param('id') id: string): Promise<any> {
        try {
            return await this.agentsService.findOne(id);
        } catch (error: any) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw error;
        }
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an agent' })
    @ApiResponse({ status: 200, description: 'Agent updated' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateAgentDto,
    ): Promise<any> {
        return this.agentsService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an agent' })
    @ApiResponse({ status: 204, description: 'Agent deleted' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async delete(@Param('id') id: string) {
        await this.agentsService.delete(id);
    }

    // ========================================
    // Agent Status & Availability
    // ========================================

    @Post(':id/status')
    @ApiOperation({ summary: 'Update agent status (ONLINE/OFFLINE/BUSY/BREAK/AWAY)' })
    @ApiResponse({ status: 200, description: 'Status updated' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateAgentStatusDto,
    ): Promise<any> {
        return this.agentsService.updateStatus(id, dto.status);
    }

    @Get(':id/availability')
    @ApiOperation({ summary: 'Get agent availability schedule' })
    @ApiResponse({ status: 200, description: 'Availability retrieved' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async getAvailability(@Param('id') id: string) {
        return this.agentsService.getAvailability(id);
    }

    @Post(':id/availability')
    @ApiOperation({ summary: 'Update agent availability schedule' })
    @ApiResponse({ status: 200, description: 'Availability updated' })
    @ApiResponse({ status: 404, description: 'Agent not found' })
    async updateAvailability(
        @Param('id') id: string,
        @Body() dto: UpdateAgentAvailabilityDto,
    ): Promise<any> {
        return this.agentsService.updateAvailability(id, dto.availability);
    }

    // ========================================
    // Agent Performance & History
    // ========================================

    @Get(':id/metrics')
    @ApiOperation({ summary: 'Get agent performance metrics' })
    @ApiResponse({ status: 200, description: 'Metrics retrieved' })
    async getMetrics(
        @Param('id') id: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.agentsService.getMetrics(
            id,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    @Get(':id/calls')
    @ApiOperation({ summary: 'Get agent call history' })
    @ApiResponse({ status: 200, description: 'Call history retrieved' })
    async getCallHistory(
        @Param('id') id: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.agentsService.getCallHistory(
            id,
            page ? parseInt(String(page)) : 1,
            limit ? parseInt(String(limit)) : 20,
        );
    }

    @Get(':id/session')
    @ApiOperation({ summary: 'Get current agent session' })
    @ApiResponse({ status: 200, description: 'Session retrieved' })
    async getCurrentSession(@Param('id') id: string) {
        return this.agentsService.getCurrentSession(id);
    }
}
