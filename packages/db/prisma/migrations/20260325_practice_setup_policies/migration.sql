ALTER TABLE "public"."business_settings"
ADD COLUMN "enabled_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "after_hours_policy" JSONB,
ADD COLUMN "refill_policy" JSONB,
ADD COLUMN "billing_policy" JSONB,
ADD COLUMN "insurance_policy" JSONB,
ADD COLUMN "knowledge_config" JSONB,
ADD COLUMN "escalation_config" JSONB;
