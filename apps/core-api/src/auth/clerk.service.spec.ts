import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClerkService } from './clerk.service';

describe('ClerkService', () => {
    let service: ClerkService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClerkService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('test_secret_key'),
                    },
                },
            ],
        }).compile();

        service = module.get<ClerkService>(ClerkService);
        configService = module.get<ConfigService>(ConfigService);
    });

    describe('verifyToken', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            await expect(service.verifyToken('invalid-token')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should require CLERK_SECRET_KEY to be configured', () => {
            expect(configService.get).toHaveBeenCalledWith('CLERK_SECRET_KEY');
        });
    });

});
