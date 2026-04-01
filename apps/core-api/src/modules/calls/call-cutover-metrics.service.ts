import { Injectable } from '@nestjs/common';

@Injectable()
export class CallCutoverMetricsService {
    private fallbackReadCount = 0;
    private ingestFailureCount = 0;
    private projectionRebuildFailureCount = 0;

    recordFallbackRead() {
        this.fallbackReadCount += 1;
    }

    recordIngestFailure() {
        this.ingestFailureCount += 1;
    }

    recordProjectionRebuildFailure() {
        this.projectionRebuildFailureCount += 1;
    }

    snapshot() {
        return {
            fallbackReadCount: this.fallbackReadCount,
            ingestFailureCount: this.ingestFailureCount,
            projectionRebuildFailureCount: this.projectionRebuildFailureCount,
        };
    }
}
