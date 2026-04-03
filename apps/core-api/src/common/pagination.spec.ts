import { createPaginatedResponse, normalizePagination } from './pagination';

describe('pagination helpers', () => {
    it('uses canonical page and pageSize params', () => {
        expect(normalizePagination({ page: 3, pageSize: 25 })).toEqual({
            page: 3,
            pageSize: 25,
            skip: 50,
            take: 25,
        });
    });

    it('accepts deprecated limit and offset aliases during migration', () => {
        expect(normalizePagination({ limit: 10, offset: 20 })).toEqual({
            page: 3,
            pageSize: 10,
            skip: 20,
            take: 10,
        });
    });

    it('clamps pageSize to the configured max', () => {
        expect(normalizePagination({ pageSize: 999 }, { maxPageSize: 50 })).toEqual({
            page: 1,
            pageSize: 50,
            skip: 0,
            take: 50,
        });
    });

    it('creates the canonical paginated response envelope', () => {
        expect(createPaginatedResponse([{ id: 'call-1' }], 42, { page: 2, pageSize: 20 })).toEqual({
            data: [{ id: 'call-1' }],
            total: 42,
            page: 2,
            pageSize: 20,
        });
    });
});
