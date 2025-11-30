import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import {
    CreateDepartmentDto,
    UpdateDepartmentDto,
    CreateDirectoryInquiryDto,
    UpdateDirectoryInquiryDto,
    DepartmentResponseDto,
} from './dto/department.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    // Department endpoints
    @Post()
    @ApiOperation({ summary: 'Create a new department' })
    @ApiResponse({ status: 201, description: 'Department created', type: DepartmentResponseDto })
    @Permissions(UserRole.ADMIN)
    @Auditable('department', 'CREATE')
    createDepartment(@Body() createDepartmentDto: CreateDepartmentDto): Promise<any> {
        return this.departmentsService.createDepartment(createDepartmentDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all departments for a hospital' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'List of departments', type: [DepartmentResponseDto] })
    @Permissions(UserRole.READONLY)
    findAllDepartments(
        @Query('hospitalId') hospitalId: string,
        @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
    ): Promise<any[]> {
        return this.departmentsService.findAllDepartments(hospitalId, includeInactive);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search departments by name, description, or service type' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'q', required: true })
    @ApiResponse({ status: 200, description: 'List of matching departments', type: [DepartmentResponseDto] })
    @Permissions(UserRole.READONLY)
    searchDepartments(
        @Query('hospitalId') hospitalId: string,
        @Query('q') query: string,
    ): Promise<any[]> {
        return this.departmentsService.searchDepartments(hospitalId, query);
    }

    @Get('by-service')
    @ApiOperation({ summary: 'Find departments by service type' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'serviceType', required: true })
    @ApiResponse({ status: 200, description: 'List of departments offering the service', type: [DepartmentResponseDto] })
    @Permissions(UserRole.READONLY)
    findByServiceType(
        @Query('hospitalId') hospitalId: string,
        @Query('serviceType') serviceType: string,
    ): Promise<any[]> {
        return this.departmentsService.findDepartmentsByServiceType(hospitalId, serviceType);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get department by ID' })
    @ApiResponse({ status: 200, description: 'Department found', type: DepartmentResponseDto })
    @ApiResponse({ status: 404, description: 'Department not found' })
    @Permissions(UserRole.READONLY)
    findOne(@Param('id') id: string): Promise<any> {
        return this.departmentsService.findDepartmentById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update department' })
    @ApiResponse({ status: 200, description: 'Department updated', type: DepartmentResponseDto })
    @ApiResponse({ status: 404, description: 'Department not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('department', 'UPDATE')
    updateDepartment(@Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto): Promise<any> {
        return this.departmentsService.updateDepartment(id, updateDepartmentDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Deactivate department (soft delete)' })
    @ApiResponse({ status: 200, description: 'Department deactivated' })
    @ApiResponse({ status: 404, description: 'Department not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('department', 'DELETE')
    deleteDepartment(@Param('id') id: string): Promise<any> {
        return this.departmentsService.deleteDepartment(id);
    }

    // Directory Inquiry endpoints
    @Post('inquiries')
    @ApiOperation({ summary: 'Create a directory inquiry' })
    @ApiResponse({ status: 201, description: 'Directory inquiry created' })
    @Permissions(UserRole.AGENT)
    @Auditable('directory_inquiry', 'CREATE')
    createInquiry(@Body() createDirectoryInquiryDto: CreateDirectoryInquiryDto): Promise<any> {
        return this.departmentsService.createDirectoryInquiry(createDirectoryInquiryDto);
    }

    @Get('inquiries')
    @ApiOperation({ summary: 'Get all directory inquiries' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'resolved', required: false, type: Boolean })
    @ApiQuery({ name: 'departmentId', required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of directory inquiries' })
    @Permissions(UserRole.READONLY)
    findAllInquiries(
        @Query('hospitalId') hospitalId: string,
        @Query('resolved', new ParseBoolPipe({ optional: true })) resolved?: boolean,
        @Query('departmentId') departmentId?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<any> {
        return this.departmentsService.findAllDirectoryInquiries(hospitalId, {
            resolved,
            departmentId,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Patch('inquiries/:id')
    @ApiOperation({ summary: 'Update a directory inquiry' })
    @ApiResponse({ status: 200, description: 'Directory inquiry updated' })
    @Permissions(UserRole.AGENT)
    @Auditable('directory_inquiry', 'UPDATE')
    updateInquiry(
        @Param('id') id: string,
        @Body() updateDirectoryInquiryDto: UpdateDirectoryInquiryDto,
    ): Promise<any> {
        return this.departmentsService.updateDirectoryInquiry(id, updateDirectoryInquiryDto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get directory inquiry statistics' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiResponse({ status: 200, description: 'Directory statistics' })
    @Permissions(UserRole.SUPERVISOR)
    getStats(
        @Query('hospitalId') hospitalId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<any> {
        return this.departmentsService.getDirectoryStats(
            hospitalId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }
}
