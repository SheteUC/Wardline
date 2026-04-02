import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SafetyCheckDto {
    @ApiProperty()
    @IsString()
    text!: string;

    @ApiProperty()
    @IsString()
    businessId!: string;
}

export class QuickEmergencyCheckDto {
    @ApiProperty()
    @IsString()
    text!: string;
}
