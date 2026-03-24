-- CreateEnum
CREATE TYPE "HospitalStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RecordingDefault" AS ENUM ('ON', 'OFF', 'ASK');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT', 'READONLY');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'ONGOING', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingConsent" AS ENUM ('IMPLICIT', 'EXPLICIT', 'DECLINED');

-- CreateEnum
CREATE TYPE "CallTag" AS ENUM ('SCHEDULING', 'BILLING_INSURANCE', 'RECORDS_FORMS', 'REFILL_PRIOR_AUTH', 'CLINICAL_ESCALATION');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('CALLER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('NEGATIVE', 'NEUTRAL', 'POSITIVE');

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" "HospitalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "recording_default" "RecordingDefault" NOT NULL DEFAULT 'ON',
    "transcript_retention_days" INTEGER NOT NULL DEFAULT 30,
    "e911_enabled" BOOLEAN NOT NULL DEFAULT false,
    "timetap_base_url" TEXT,
    "timetap_api_key" TEXT,
    "nexhealth_base_url" TEXT,
    "nexhealth_api_key" TEXT,
    "stripe_customer_id" TEXT,
    "posthog_project_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_users" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "twilio_phone_number" TEXT NOT NULL,
    "twilio_sid" TEXT NOT NULL,
    "workflow_id" TEXT,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intents" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "required_fields" JSONB NOT NULL,
    "routing_rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "graph_json" JSONB NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT,
    "dob" DATE,
    "primary_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "recording_consent" "RecordingConsent",
    "intent_id" TEXT,
    "tag" "CallTag",
    "patient_id" TEXT,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "sentiment_overall_score" DECIMAL(3,2),
    "ai_confidence" DECIMAL(3,2),
    "handoff_target" TEXT,
    "handoff_reason" TEXT,
    "recording_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "text" TEXT NOT NULL,
    "start_time_ms" INTEGER NOT NULL,
    "end_time_ms" INTEGER NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_snapshots" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "offset_ms" INTEGER NOT NULL,
    "score" DECIMAL(3,2) NOT NULL,
    "label" "SentimentLabel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_subscriptions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "stripe_usage_record_id" TEXT,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_name_key" ON "hospitals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_slug_key" ON "hospitals"("slug");

-- CreateIndex
CREATE INDEX "hospitals_slug_idx" ON "hospitals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_settings_hospital_id_key" ON "hospital_settings"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE INDEX "users_clerk_user_id_idx" ON "users"("clerk_user_id");

-- CreateIndex
CREATE INDEX "hospital_users_hospital_id_idx" ON "hospital_users"("hospital_id");

-- CreateIndex
CREATE INDEX "hospital_users_user_id_idx" ON "hospital_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_users_hospital_id_user_id_key" ON "hospital_users"("hospital_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_twilio_phone_number_key" ON "phone_numbers"("twilio_phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_twilio_sid_key" ON "phone_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "phone_numbers_hospital_id_idx" ON "phone_numbers"("hospital_id");

-- CreateIndex
CREATE INDEX "phone_numbers_twilio_sid_idx" ON "phone_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "intents_hospital_id_idx" ON "intents"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "intents_hospital_id_key_key" ON "intents"("hospital_id", "key");

-- CreateIndex
CREATE INDEX "workflows_hospital_id_idx" ON "workflows"("hospital_id");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_number_key" ON "workflow_versions"("workflow_id", "version_number");

-- CreateIndex
CREATE INDEX "patients_hospital_id_idx" ON "patients"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_hospital_id_external_id_key" ON "patients"("hospital_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_twilio_call_sid_key" ON "call_sessions"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "call_sessions_hospital_id_started_at_idx" ON "call_sessions"("hospital_id", "started_at");

-- CreateIndex
CREATE INDEX "call_sessions_tag_idx" ON "call_sessions"("tag");

-- CreateIndex
CREATE INDEX "call_sessions_patient_id_idx" ON "call_sessions"("patient_id");

-- CreateIndex
CREATE INDEX "call_sessions_twilio_call_sid_idx" ON "call_sessions"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "transcript_segments_call_id_idx" ON "transcript_segments"("call_id");

-- CreateIndex
CREATE INDEX "sentiment_snapshots_call_id_idx" ON "sentiment_snapshots"("call_id");

-- CreateIndex
CREATE INDEX "handoffs_call_id_idx" ON "handoffs"("call_id");

-- CreateIndex
CREATE INDEX "audit_logs_hospital_id_created_at_idx" ON "audit_logs"("hospital_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_subscriptions_stripe_subscription_id_key" ON "stripe_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_hospital_id_idx" ON "stripe_subscriptions"("hospital_id");

-- CreateIndex
CREATE INDEX "usage_records_hospital_id_metric_timestamp_idx" ON "usage_records"("hospital_id", "metric", "timestamp");

-- AddForeignKey
ALTER TABLE "hospital_settings" ADD CONSTRAINT "hospital_settings_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_users" ADD CONSTRAINT "hospital_users_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_users" ADD CONSTRAINT "hospital_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intents" ADD CONSTRAINT "intents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_snapshots" ADD CONSTRAINT "sentiment_snapshots_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
