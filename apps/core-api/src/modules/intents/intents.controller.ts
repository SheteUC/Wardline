import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IntentsService } from './intents.service';

@ApiTags('intents')
@Controller('hospitals/:hospitalId/intents')
export class IntentsController {
    constructor(private readonly intentsService: IntentsService) { }

    @Post()
    create(@Param('hospitalId') hospitalId: string, @Body() data: any) {
        return this.intentsService.create(hospitalId, data);
    }

    @Get()
    findAll(@Param('hospitalId') hospitalId: string) {
        return this.intentsService.findAllByHospital(hospitalId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.intentsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.intentsService.update(id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.intentsService.remove(id);
    }
}
