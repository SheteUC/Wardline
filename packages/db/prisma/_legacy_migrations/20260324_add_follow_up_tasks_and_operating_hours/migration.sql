-- AlterTable
ALTER TABLE "business_settings"
ADD COLUMN "operating_hours" JSONB;

-- CreateEnum
CREATE TYPE "FollowUpTaskType" AS ENUM (
    'URGENT_CALLBACK',
    'VOICEMAIL_REVIEW',
    'MANUAL_REVIEW',
    'APPOINTMENT_REQUEST',
    'REFILL_REQUEST',
    'INSURANCE_CHECK',
    'BILLING_REQUEST'
);

-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "FollowUpTaskPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
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
    "urgency_keywords" TEXT[] NOT NULL,
    "metadata" JSONB,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_tasks_voicemail_id_key" ON "follow_up_tasks"("voicemail_id");

-- CreateIndex
CREATE INDEX "follow_up_tasks_business_id_status_priority_idx"
ON "follow_up_tasks"("business_id", "status", "priority");

-- CreateIndex
CREATE INDEX "follow_up_tasks_business_id_type_created_at_idx"
ON "follow_up_tasks"("business_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "follow_up_tasks_call_id_idx"
ON "follow_up_tasks"("call_id");

-- AddForeignKey
ALTER TABLE "follow_up_tasks"
ADD CONSTRAINT "follow_up_tasks_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks"
ADD CONSTRAINT "follow_up_tasks_call_id_fkey"
FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks"
ADD CONSTRAINT "follow_up_tasks_voicemail_id_fkey"
FOREIGN KEY ("voicemail_id") REFERENCES "voicemail_records"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
