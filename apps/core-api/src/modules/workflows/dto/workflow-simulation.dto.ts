import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class WorkflowSimulationInputsDto {
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        description: 'Arbitrary workflow simulation inputs',
    })
    @IsObject()
    inputs!: Record<string, unknown>;
}
