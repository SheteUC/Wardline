import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './public.decorator';
import { UsersService } from '../modules/users/users.service';
import * as crypto from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks/clerk')
export class ClerkWebhookController {
    private readonly logger = new Logger(ClerkWebhookController.name);

    constructor(private usersService: UsersService) { }

    @Post()
    @Public()
    @ApiOperation({ summary: 'Handle Clerk webhook events' })
    async handleWebhook(
        @Headers('svix-id') svixId: string,
        @Headers('svix-timestamp') svixTimestamp: string,
        @Headers('svix-signature') svixSignature: string,
        @Body() payload: any,
    ) {
        // Verify webhook signature
        if (!this.verifyWebhook(svixId, svixTimestamp, svixSignature, payload)) {
            this.logger.warn('Webhook signature verification failed');
            throw new UnauthorizedException('Invalid webhook signature');
        }

        const { type, data } = payload;

        this.logger.log(`Received Clerk webhook: ${type}`);

        try {
            switch (type) {
                case 'user.created':
                    await this.handleUserCreated(data);
                    break;

                case 'user.updated':
                    await this.handleUserUpdated(data);
                    break;

                case 'user.deleted':
                    await this.handleUserDeleted(data);
                    break;

                default:
                    this.logger.warn(`Unhandled webhook type: ${type}`);
            }

            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error handling webhook: ${errorMessage}`, error instanceof Error ? error.stack : error);
            throw error;
        }
    }

    private verifyWebhook(
        svixId: string,
        svixTimestamp: string,
        svixSignature: string,
        payload: any,
    ): boolean {
        const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
        if (!secret) {
            this.logger.error('CLERK_WEBHOOK_SIGNING_SECRET not configured');
            return false;
        }

        // Construct the signed content
        const signedContent = `${svixId}.${svixTimestamp}.${JSON.stringify(payload)}`;

        // Compute the expected signature
        const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
        const expectedSignature = crypto
            .createHmac('sha256', secretBytes)
            .update(signedContent, 'utf8')
            .digest('base64');

        // Compare signatures
        const signatures = svixSignature.split(' ');
        for (const versionedSignature of signatures) {
            const parts = versionedSignature.split(',');
            if (parts.length !== 2) continue;

            const [version, signature] = parts;
            if (version !== 'v1') continue;

            if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
                return true;
            }
        }

        return false;
    }

    private async handleUserCreated(data: any) {
        const clerkUserId = data.id;
        const email = data.email_addresses?.[0]?.email_address;
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || undefined;

        this.logger.log(`Creating user from Clerk: ${email}`);

        await this.usersService.findOrCreateByClerkId(clerkUserId, email, fullName);
    }

    private async handleUserUpdated(data: any) {
        const clerkUserId = data.id;
        const email = data.email_addresses?.[0]?.email_address;
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || undefined;

        this.logger.log(`Updating user from Clerk: ${email}`);

        // Note: findOrCreateByClerkId will update if user exists
        await this.usersService.findOrCreateByClerkId(clerkUserId, email, fullName);
    }

    private async handleUserDeleted(data: any) {
        const clerkUserId = data.id;

        this.logger.warn(`User deleted in Clerk: ${clerkUserId}`);

        // Note: We don't delete users from our database for audit trail purposes
        // You may want to add a "deleted" status or handle this differently
        this.logger.log('User deletion not implemented - preserving for audit trail');
    }
}
