import { SetMetadata } from '@nestjs/common';

export const INTERNAL_API_KEY = 'wardline_internal_api';

/** Require `X-Wardline-Internal-Secret` matching `WARDLINE_INTERNAL_API_SECRET` (used with @Public for voice/runtime). */
export const InternalApi = () => SetMetadata(INTERNAL_API_KEY, true);
