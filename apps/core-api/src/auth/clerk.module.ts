import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkService } from './clerk.service';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { UsersModule } from '../modules/users/users.module';

@Global()
@Module({
    imports: [ConfigModule, UsersModule],
    controllers: [ClerkWebhookController],
    providers: [ClerkService],
    exports: [ClerkService],
})
export class ClerkModule { }
