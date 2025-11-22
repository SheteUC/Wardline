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
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto, UpdateHospitalDto, HospitalResponseDto } from './dto/hospital.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('hospitals')
@ApiBearerAuth()
@Controller('hospitals')
export class HospitalsController {
    constructor(private readonly hospitalsService: HospitalsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new hospital' })
    @ApiResponse({ status: 201, description: 'Hospital created', type: HospitalResponseDto })
    @ApiResponse({ status: 409, description: 'Hospital already exists' })
    @Permissions(UserRole.OWNER)
    @Auditable('hospital', 'CREATE')
    create(@Body() createHospitalDto: CreateHospitalDto) {
        return this.hospitalsService.create(createHospitalDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all hospitals' })
    @ApiQuery({ name: 'includeSettings', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'List of hospitals', type: [HospitalResponseDto] })
    @Permissions(UserRole.READONLY)
    findAll(@Query('includeSettings', new ParseBoolPipe({ optional: true })) includeSettings?: boolean) {
        return this.hospitalsService.findAll(includeSettings);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get hospital by ID' })
    @ApiQuery({ name: 'includeRelations', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'Hospital found', type: HospitalResponseDto })
    @ApiResponse({ status: 404, description: 'Hospital not found' })
    @Permissions(UserRole.READONLY)
    findOne(
        @Param('id') id: string,
        @Query('includeRelations', new ParseBoolPipe({ optional: true })) includeRelations?: boolean,
    ) {
        return this.hospitalsService.findOne(id, includeRelations);
    }

    @Get('slug/:slug')
    @ApiOperation({ summary: 'Get hospital by slug' })
    @ApiResponse({ status: 200, description: 'Hospital found', type: HospitalResponseDto })
    @ApiResponse({ status: 404, description: 'Hospital not found' })
    findBySlug(@Param('slug') slug: string) {
        return this.hospitalsService.findBySlug(slug);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update hospital' })
    @ApiResponse({ status: 200, description: 'Hospital updated', type: HospitalResponseDto })
    @ApiResponse({ status: 404, description: 'Hospital not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('hospital', 'UPDATE')
    update(@Param('id') id: string, @Body() updateHospitalDto: UpdateHospitalDto) {
        return this.hospitalsService.update(id, updateHospitalDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete hospital (sets status to SUSPENDED)' })
    @ApiResponse({ status: 200, description: 'Hospital suspended' })
    @ApiResponse({ status: 404, description: 'Hospital not found' })
    @Permissions(UserRole.OWNER)
    @Auditable('hospital', 'DELETE')
    remove(@Param('id') id: string) {
        return this.hospitalsService.remove(id);
    }

    @Patch(':id/settings')
    @ApiOperation({ summary: 'Update hospital settings' })
    @ApiResponse({ status: 200, description: 'Settings updated' })
    @Permissions(UserRole.ADMIN)
    @Auditable('hospital', 'UPDATE_SETTINGS')
    updateSettings(@Param('id') id: string, @Body() settings: any) {
        return this.hospitalsService.updateSettings(id, settings);
    }
}
