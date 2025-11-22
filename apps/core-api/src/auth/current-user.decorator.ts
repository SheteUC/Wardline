import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to inject the authenticated user into route handlers
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: any) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
