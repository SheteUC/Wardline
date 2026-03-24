-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RecordingDefault" AS ENUM ('ON', 'OFF', 'ASK');

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('SCHEDULING', 'EHR_REFILL', 'BILLING', 'INSURANCE', 'KNOWLEDGE');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT', 'READONLY');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'ONGOING', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingConsent" AS ENUM ('IMPLICIT', 'EXPLICIT', 'DECLINED');

-- CreateEnum
CREATE TYPE "CallTag" AS ENUM ('SCHEDULING', 'BILLING', 'INSURANCE', 'FAQ', 'PRESCRIPTION_REFILL', 'HUMAN_TRANSFER', 'EMERGENCY', 'VOICEMAIL');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('CALLER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FollowUpTaskType" AS ENUM ('URGENT_CALLBACK', 'VOICEMAIL_REVIEW', 'MANUAL_REVIEW', 'APPOINTMENT_REQUEST', 'REFILL_REQUEST', 'INSURANCE_CHECK', 'BILLING_REQUEST');

-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "RefillStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'PENDING', 'EXPIRED');

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "recording_default" "RecordingDefault" NOT NULL DEFAULT 'ON',
    "transcript_retention_days" INTEGER NOT NULL DEFAULT 30,
    "operating_hours" JSONB,
    "out_of_scope_keywords" TEXT[],
    "emergency_keywords" TEXT[],
    "timetap_base_url" TEXT,
    "timetap_api_key" TEXT,
    "nexhealth_base_url" TEXT,
    "nexhealth_api_key" TEXT,
    "stripe_customer_id" TEXT,
    "posthog_project_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_integrations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "vendor" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentials_ref" TEXT,
    "settings" JSONB,
    "capabilities" JSONB,
    "last_health_check_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_integrations_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "business_users" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "twilio_phone_number" TEXT NOT NULL,
    "twilio_sid" TEXT NOT NULL,
    "workflow_id" TEXT,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
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
CREATE TABLE "callers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "dob" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "callers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_integrations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "location_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "call_id" TEXT,
    "business_id" TEXT NOT NULL,
    "external_id" TEXT,
    "provider" TEXT NOT NULL,
    "caller_name" TEXT NOT NULL,
    "caller_phone" TEXT NOT NULL,
    "caller_email" TEXT,
    "provider_name" TEXT,
    "service_type" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "recording_consent" "RecordingConsent",
    "tag" "CallTag",
    "caller_id" TEXT,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "turns_json" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "sentiment_score" DECIMAL(3,2),
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
CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voicemail_records" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "caller_phone" TEXT NOT NULL,
    "caller_name" TEXT,
    "recording_url" TEXT NOT NULL,
    "transcription" TEXT,
    "context" TEXT NOT NULL,
    "is_listened" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voicemail_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_tasks" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT,
    "voicemail_id" TEXT,
    "type" "FollowUpTaskType" NOT NULL,
    "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "FollowUpTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "caller_name" TEXT,
    "caller_phone" TEXT,
    "urgency_keywords" TEXT[],
    "metadata" JSONB,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
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
    "business_id" TEXT NOT NULL,
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
    "business_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "stripe_usage_record_id" TEXT,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "node_graph" JSONB,
    "tool_config" JSONB,
    "agent_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_refills" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT,
    "caller_id" TEXT,
    "caller_name" TEXT NOT NULL,
    "caller_phone" TEXT NOT NULL,
    "caller_dob" DATE,
    "medication_name" TEXT NOT NULL,
    "prescriber_name" TEXT,
    "pharmacy_name" TEXT,
    "pharmacy_phone" TEXT,
    "status" "RefillStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_refills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "plan_type" TEXT,
    "is_accepted" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" DATE,
    "termination_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_inquiries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT,
    "insurance_plan_id" TEXT,
    "caller_name" TEXT,
    "caller_phone" TEXT,
    "carrier_name" TEXT,
    "plan_name" TEXT,
    "inquiry_type" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_verifications" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "insurance_plan_id" TEXT NOT NULL,
    "caller_id" TEXT,
    "caller_name" TEXT NOT NULL,
    "member_number" TEXT NOT NULL,
    "group_number" TEXT,
    "verification_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibility_status" "EligibilityStatus" NOT NULL,
    "authorization_required" BOOLEAN NOT NULL DEFAULT false,
    "authorization_number" TEXT,
    "coverage_details" JSONB,
    "copay" DECIMAL(10,2),
    "deductible" DECIMAL(10,2),
    "deductible_met" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_name_key" ON "businesses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_slug_idx" ON "businesses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_business_id_key" ON "business_settings"("business_id");

-- CreateIndex
CREATE INDEX "business_integrations_business_id_status_idx" ON "business_integrations"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_integrations_business_id_category_key" ON "business_integrations"("business_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE INDEX "users_clerk_user_id_idx" ON "users"("clerk_user_id");

-- CreateIndex
CREATE INDEX "business_users_business_id_idx" ON "business_users"("business_id");

-- CreateIndex
CREATE INDEX "business_users_user_id_idx" ON "business_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_users_business_id_user_id_key" ON "business_users"("business_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_twilio_phone_number_key" ON "phone_numbers"("twilio_phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_twilio_sid_key" ON "phone_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "phone_numbers_business_id_idx" ON "phone_numbers"("business_id");

-- CreateIndex
CREATE INDEX "phone_numbers_twilio_sid_idx" ON "phone_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "workflows_business_id_idx" ON "workflows"("business_id");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_number_key" ON "workflow_versions"("workflow_id", "version_number");

-- CreateIndex
CREATE INDEX "callers_business_id_idx" ON "callers"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "callers_business_id_phone_key" ON "callers"("business_id", "phone");

-- CreateIndex
CREATE INDEX "scheduling_integrations_business_id_idx" ON "scheduling_integrations"("business_id");

-- CreateIndex
CREATE INDEX "scheduling_integrations_provider_idx" ON "scheduling_integrations"("provider");

-- CreateIndex
CREATE INDEX "appointments_business_id_idx" ON "appointments"("business_id");

-- CreateIndex
CREATE INDEX "appointments_call_id_idx" ON "appointments"("call_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_twilio_call_sid_key" ON "call_sessions"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "call_sessions_business_id_started_at_idx" ON "call_sessions"("business_id", "started_at");

-- CreateIndex
CREATE INDEX "call_sessions_tag_idx" ON "call_sessions"("tag");

-- CreateIndex
CREATE INDEX "call_sessions_caller_id_idx" ON "call_sessions"("caller_id");

-- CreateIndex
CREATE INDEX "call_sessions_twilio_call_sid_idx" ON "call_sessions"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "transcript_segments_call_id_idx" ON "transcript_segments"("call_id");

-- CreateIndex
CREATE INDEX "handoffs_call_id_idx" ON "handoffs"("call_id");

-- CreateIndex
CREATE INDEX "voicemail_records_business_id_is_listened_idx" ON "voicemail_records"("business_id", "is_listened");

-- CreateIndex
CREATE INDEX "voicemail_records_call_id_idx" ON "voicemail_records"("call_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_tasks_voicemail_id_key" ON "follow_up_tasks"("voicemail_id");

-- CreateIndex
CREATE INDEX "follow_up_tasks_business_id_status_priority_idx" ON "follow_up_tasks"("business_id", "status", "priority");

-- CreateIndex
CREATE INDEX "follow_up_tasks_business_id_type_created_at_idx" ON "follow_up_tasks"("business_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "follow_up_tasks_call_id_idx" ON "follow_up_tasks"("call_id");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_subscriptions_stripe_subscription_id_key" ON "stripe_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_business_id_idx" ON "stripe_subscriptions"("business_id");

-- CreateIndex
CREATE INDEX "usage_records_business_id_metric_timestamp_idx" ON "usage_records"("business_id", "metric", "timestamp");

-- CreateIndex
CREATE INDEX "agents_business_id_catalog_id_status_idx" ON "agents"("business_id", "catalog_id", "status");

-- CreateIndex
CREATE INDEX "prescription_refills_business_id_idx" ON "prescription_refills"("business_id");

-- CreateIndex
CREATE INDEX "prescription_refills_call_id_idx" ON "prescription_refills"("call_id");

-- CreateIndex
CREATE INDEX "prescription_refills_status_idx" ON "prescription_refills"("status");

-- CreateIndex
CREATE INDEX "insurance_plans_business_id_idx" ON "insurance_plans"("business_id");

-- CreateIndex
CREATE INDEX "insurance_plans_carrier_id_idx" ON "insurance_plans"("carrier_id");

-- CreateIndex
CREATE INDEX "insurance_inquiries_business_id_idx" ON "insurance_inquiries"("business_id");

-- CreateIndex
CREATE INDEX "insurance_inquiries_call_id_idx" ON "insurance_inquiries"("call_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_business_id_idx" ON "insurance_verifications"("business_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_insurance_plan_id_idx" ON "insurance_verifications"("insurance_plan_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_verification_date_idx" ON "insurance_verifications"("verification_date");

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_integrations" ADD CONSTRAINT "business_integrations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_users" ADD CONSTRAINT "business_users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_users" ADD CONSTRAINT "business_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callers" ADD CONSTRAINT "callers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_integrations" ADD CONSTRAINT "scheduling_integrations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "callers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voicemail_records" ADD CONSTRAINT "voicemail_records_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voicemail_records" ADD CONSTRAINT "voicemail_records_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_voicemail_id_fkey" FOREIGN KEY ("voicemail_id") REFERENCES "voicemail_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "callers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_insurance_plan_id_fkey" FOREIGN KEY ("insurance_plan_id") REFERENCES "insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_insurance_plan_id_fkey" FOREIGN KEY ("insurance_plan_id") REFERENCES "insurance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "callers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
