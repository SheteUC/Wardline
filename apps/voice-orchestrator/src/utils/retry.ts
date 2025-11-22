/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 100,
        maxDelay = 5000,
        backoffFactor = 2,
    } = options;

    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxAttempts) {
                break;
            }

            console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);

            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * backoffFactor, maxDelay);
        }
    }

    throw lastError || new Error('Retry failed');
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
    private failureCount = 0;
    private lastFailureTime: number | null = null;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000 // 1 minute
    ) { }

    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            console.warn(`Circuit breaker opened after ${this.failureCount} failures`);
        }
    }

    private shouldAttemptReset(): boolean {
        return (
            this.lastFailureTime !== null &&
            Date.now() - this.lastFailureTime >= this.timeout
        );
    }

    public getState(): string {
        return this.state;
    }
}
