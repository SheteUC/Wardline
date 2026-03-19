import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';

export interface HospitalConfig {
    // Module enablement
    enabledModules: {
        billing: boolean;
        insurance: boolean;
        appointments: boolean;
        prescriptions: boolean;
        departments: boolean;
        events: boolean;
    };

    // Custom prompts
    customGreeting?: string;
    customClosing?: string;
    businessHours?: {
        [day: string]: { open: string; close: string };
    };

    // Escalation rules
    escalationRules: {
        maxAIAttempts: number;
        sentimentThreshold: number; // 0-1, escalate if below
        emergencyKeywords: string[];
        autoEscalateAfterMinutes: number;
    };

    // Tool configuration
    tools: {
        [toolName: string]: {
            enabled: boolean;
            config?: Record<string, any>;
        };
    };

    // Integration endpoints
    integrations: {
        ehr?: { enabled: boolean; endpoint?: string };
        scheduling?: { enabled: boolean; provider?: string; endpoint?: string };
        billing?: { enabled: boolean; endpoint?: string };
    };

    // Safety overrides
    safetyKeywords?: {
        custom: string[];
        disabled: string[];
    };
}

const DEFAULT_CONFIG: HospitalConfig = {
    enabledModules: {
        billing: true,
        insurance: true,
        appointments: true,
        prescriptions: true,
        departments: true,
        events: false,
    },
    escalationRules: {
        maxAIAttempts: 3,
        sentimentThreshold: 0.3,
        emergencyKeywords: [],
        autoEscalateAfterMinutes: 5,
    },
    tools: {
        scheduling: { enabled: true },
        insurance: { enabled: true },
        departments: { enabled: true },
        prescriptions: { enabled: false },
        billing: { enabled: false },
    },
    integrations: {},
};

@Injectable()
export class HospitalConfigService {
    private readonly logger = new Logger(HospitalConfigService.name);

    // In-memory cache for hospital configurations
    private configCache = new Map<string, { config: HospitalConfig; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Get hospital configuration with caching
     */
    async getConfig(hospitalId: string): Promise<HospitalConfig> {
        // Check cache
        const cached = this.configCache.get(hospitalId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.config;
        }

        // Verify hospital exists
        const hospital = await this.prisma.hospital.findUnique({
            where: { id: hospitalId },
            include: { settings: true },
        });

        if (!hospital) {
            throw new NotFoundException(`Hospital ${hospitalId} not found`);
        }

        // Build configuration from various sources
        const config: HospitalConfig = {
            ...DEFAULT_CONFIG,
            // Can be extended to read from hospital.settings or separate config table
        };

        // Check if hospital has custom settings
        if (hospital.settings) {
            // Merge custom settings if they exist
            // For now, use defaults
        }

        // Cache the configuration
        this.configCache.set(hospitalId, {
            config,
            timestamp: Date.now(),
        });

        this.logger.info(`Loaded configuration for hospital ${hospitalId}`);

        return config;
    }

    /**
     * Update hospital configuration
     */
    async updateConfig(
        hospitalId: string,
        updates: Partial<HospitalConfig>,
    ): Promise<HospitalConfig> {
        // Verify hospital exists
        const hospital = await this.prisma.hospital.findUnique({
            where: { id: hospitalId },
        });

        if (!hospital) {
            throw new NotFoundException(`Hospital ${hospitalId} not found`);
        }

        // Get current config
        const currentConfig = await this.getConfig(hospitalId);

        // Merge updates
        const updatedConfig: HospitalConfig = {
            ...currentConfig,
            ...updates,
            enabledModules: {
                ...currentConfig.enabledModules,
                ...(updates.enabledModules || {}),
            },
            escalationRules: {
                ...currentConfig.escalationRules,
                ...(updates.escalationRules || {}),
            },
            tools: {
                ...currentConfig.tools,
                ...(updates.tools || {}),
            },
            integrations: {
                ...currentConfig.integrations,
                ...(updates.integrations || {}),
            },
        };

        // In production, save to database
        // For now, just update cache
        this.configCache.set(hospitalId, {
            config: updatedConfig,
            timestamp: Date.now(),
        });

        this.logger.info(`Updated configuration for hospital ${hospitalId}`);

        return updatedConfig;
    }

    /**
     * Clear configuration cache for a hospital
     */
    invalidateCache(hospitalId: string): void {
        this.configCache.delete(hospitalId);
        this.logger.info(`Cleared config cache for hospital ${hospitalId}`);
    }

    /**
     * Get enabled tools for a hospital
     */
    async getEnabledTools(hospitalId: string): Promise<string[]> {
        const config = await this.getConfig(hospitalId);
        return Object.entries(config.tools)
            .filter(([, toolConfig]) => toolConfig.enabled)
            .map(([toolName]) => toolName);
    }

    /**
     * Check if a specific module is enabled
     */
    async isModuleEnabled(hospitalId: string, moduleName: keyof HospitalConfig['enabledModules']): Promise<boolean> {
        const config = await this.getConfig(hospitalId);
        return config.enabledModules[moduleName] ?? false;
    }
}
