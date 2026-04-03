import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { WorkflowSimulationInputsDto } from './dto/workflow-simulation.dto';

@Injectable()
export class WorkflowSimulationBodyPipe
    implements PipeTransform<unknown, WorkflowSimulationInputsDto>
{
    transform(value: unknown): WorkflowSimulationInputsDto {
        const dto = plainToInstance(WorkflowSimulationInputsDto, {
            inputs: value,
        });
        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        if (errors.length > 0) {
            throw new BadRequestException('Simulation body must be a JSON object');
        }

        return dto;
    }
}
