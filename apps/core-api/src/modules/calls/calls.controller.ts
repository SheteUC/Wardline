import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CallsService } from './calls.service';

@ApiTags('calls')
@Controller('hospitals/:hospitalId/calls')
export class CallsController {
    constructor(private readonly callsService: CallsService) { }

    @Get()
    findAll(@Param('hospitalId') hospitalId: string, @Query() filters: any) {
        return this.callsService.findAllByHospital(hospitalId, filters);
    }

    @Get('analytics')
    getAnalytics(
        @Param('hospitalId') hospitalId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.callsService.getAnalytics(
            hospitalId,
            new Date(startDate),
            new Date(endDate),
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.callsService.findOne(id);
    }
}
