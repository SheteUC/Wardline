import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'wl1:';

/** AES-256-GCM for integration and settings secrets at rest (application-layer). */
@Injectable()
export class CredentialsCryptoService implements OnModuleInit {
    private readonly logger = new Logger(CredentialsCryptoService.name);
    private key: Buffer | null = null;

    onModuleInit() {
        const raw = process.env.WARDLINE_APP_CREDENTIALS_KEY?.trim();
        if (!raw) {
            if ((process.env.NODE_ENV ?? 'development') === 'production') {
                this.logger.warn(
                    'WARDLINE_APP_CREDENTIALS_KEY is unset; credential fields will be stored in plaintext',
                );
            }
            return;
        }
        let buf: Buffer;
        try {
            buf = Buffer.from(raw, 'base64');
        } catch {
            buf = Buffer.alloc(0);
        }
        if (buf.length === 32) {
            this.key = buf;
            return;
        }
        if (raw.length >= 16) {
            this.key = scryptSync(raw, 'wardline-credentials-salt', 32);
            this.logger.warn(
                'WARDLINE_APP_CREDENTIALS_KEY is not 32-byte base64; derived key via scrypt (prefer base64-encoded 32 raw bytes)',
            );
            return;
        }
        this.logger.error('WARDLINE_APP_CREDENTIALS_KEY is invalid; encryption disabled');
    }

    isEnabled(): boolean {
        return this.key !== null;
    }

    encrypt(plain: string | null | undefined): string | null | undefined {
        if (plain === null || plain === undefined) {
            return plain;
        }
        if (!this.key || plain === '') {
            return plain;
        }
        if (typeof plain === 'string' && plain.startsWith(PREFIX)) {
            return plain;
        }
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        const out = Buffer.concat([iv, enc, tag]).toString('base64url');
        return `${PREFIX}${out}`;
    }

    decrypt(stored: string | null | undefined): string | null | undefined {
        if (stored === null || stored === undefined) {
            return stored;
        }
        if (!this.key || typeof stored !== 'string' || !stored.startsWith(PREFIX)) {
            return stored;
        }
        try {
            const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url');
            const iv = raw.subarray(0, 12);
            const tag = raw.subarray(raw.length - 16);
            const enc = raw.subarray(12, raw.length - 16);
            const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
        } catch {
            this.logger.warn('Failed to decrypt credential field; returning stored value');
            return stored;
        }
    }

    encryptIntegrationSettingsJson(value: unknown): unknown {
        return this.mapSensitiveJson(value, (s) => this.encrypt(s) ?? s);
    }

    decryptIntegrationSettingsJson(value: unknown): unknown {
        return this.mapSensitiveJson(value, (s) => this.decrypt(s) ?? s);
    }

    private mapSensitiveJson(value: unknown, fn: (s: string) => string): unknown {
        if (value === null || value === undefined) {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((v) => this.mapSensitiveJson(v, fn));
        }
        if (typeof value === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                if (this.isSensitiveKey(k) && typeof v === 'string') {
                    out[k] = fn(v);
                } else {
                    out[k] = this.mapSensitiveJson(v, fn);
                }
            }
            return out;
        }
        return value;
    }

    private isSensitiveKey(key: string): boolean {
        const lower = key.toLowerCase();
        return (
            lower === 'apikey'
            || lower === 'api_key'
            || lower === 'clientsecret'
            || lower === 'client_secret'
            || lower === 'accesstoken'
            || lower === 'access_token'
            || lower === 'refreshtoken'
            || lower === 'refresh_token'
            || lower === 'password'
            || lower === 'secret'
            || lower === 'privatekey'
            || lower === 'private_key'
        );
    }
}
