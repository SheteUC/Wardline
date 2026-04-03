import { buildCorsOriginAllowlist, isCorsOriginAllowed } from './cors';

describe('CORS bootstrap helpers', () => {
    it('builds an allowlist from the primary URL, env overrides, and local dev defaults', () => {
        const origins = buildCorsOriginAllowlist({
            WEB_BASE_URL: 'https://app.wardline.health',
            CORE_API_ALLOWED_ORIGINS:
                'https://preview.wardline.health, https://staging.wardline.health , https://app.wardline.health',
        });

        expect(origins).toEqual([
            'https://app.wardline.health',
            'https://preview.wardline.health',
            'https://staging.wardline.health',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3003',
        ]);
    });

    it('rejects invalid origin values at startup', () => {
        expect(() =>
            buildCorsOriginAllowlist({
                WEB_BASE_URL: 'https://app.wardline.health',
                CORE_API_ALLOWED_ORIGINS: 'not-a-url',
            }),
        ).toThrow('Invalid CORS origin: not-a-url');
    });

    it('normalizes incoming origins before matching them', () => {
        const allowlist = ['https://app.wardline.health'];

        expect(isCorsOriginAllowed('https://app.wardline.health/some/path', allowlist)).toBe(true);
        expect(isCorsOriginAllowed('https://evil.example.com', allowlist)).toBe(false);
    });
});
