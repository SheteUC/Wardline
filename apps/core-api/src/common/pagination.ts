import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
    @ApiPropertyOptional({ description: '1-based page number' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    pageSize?: number;

    @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias for pageSize' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;

    @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias for offset' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number;
}

export type PaginationInput = Partial<Pick<PaginationQueryDto, 'page' | 'pageSize' | 'limit' | 'offset'>>;

export type NormalizedPagination = {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
};

function clampPageSize(pageSize: number, maxPageSize: number) {
    return Math.min(Math.max(pageSize, 1), maxPageSize);
}

export function normalizePagination(
    input?: PaginationInput,
    defaults?: { page?: number; pageSize?: number; maxPageSize?: number },
): NormalizedPagination {
    const defaultPage = defaults?.page ?? 1;
    const defaultPageSize = defaults?.pageSize ?? 20;
    const maxPageSize = defaults?.maxPageSize ?? 200;
    const rawPageSize = input?.pageSize ?? input?.limit ?? defaultPageSize;
    const pageSize = clampPageSize(rawPageSize, maxPageSize);
    const page =
        input?.page ??
        (input?.offset !== undefined ? Math.floor(input.offset / pageSize) + 1 : defaultPage);
    const normalizedPage = Math.max(page, 1);
    const skip = input?.offset !== undefined && input?.page === undefined
        ? Math.max(input.offset, 0)
        : (normalizedPage - 1) * pageSize;

    return {
        page: normalizedPage,
        pageSize,
        skip,
        take: pageSize,
    };
}

export function createPaginatedResponse<T>(
    data: T[],
    total: number,
    pagination: Pick<NormalizedPagination, 'page' | 'pageSize'>,
) {
    return {
        data,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
    };
}
