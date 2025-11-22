import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableMetadata {
    entityType: string;
    action: string;
}

/**
 * Decorator to mark routes for automatic audit logging
 * 
 * @param entityType - Type of entity being modified (e.g., 'user', 'hospital', 'workflow')
 * @param action - Action being performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * 
 * @example
 * @Auditable('user', 'UPDATE')
 * @Put(':id')
 * updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
 *   return this.usersService.update(id, dto);
 * }
 */
export const Auditable = (entityType: string, action: string) =>
    SetMetadata(AUDITABLE_KEY, { entityType, action } as AuditableMetadata);
