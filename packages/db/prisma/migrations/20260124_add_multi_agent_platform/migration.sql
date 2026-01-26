-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CallAssignmentStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'ACCEPTED', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY', 'BREAK', 'AWAY');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ai_config" JSONB,
    "human_profile" JSONB,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_queues" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_wait_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_assignments" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "queue_id" TEXT,
    "agent_id" TEXT,
    "status" "CallAssignmentStatus" NOT NULL,
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "total_calls_handled" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_hospital_id_type_status_idx" ON "agents"("hospital_id", "type", "status");

-- CreateIndex
CREATE INDEX "call_queues_hospital_id_specialization_idx" ON "call_queues"("hospital_id", "specialization");

-- CreateIndex
CREATE INDEX "call_assignments_call_id_idx" ON "call_assignments"("call_id");

-- CreateIndex
CREATE INDEX "call_assignments_agent_id_status_idx" ON "call_assignments"("agent_id", "status");

-- CreateIndex
CREATE INDEX "call_assignments_queue_id_status_idx" ON "call_assignments"("queue_id", "status");

-- CreateIndex
CREATE INDEX "agent_sessions_agent_id_status_idx" ON "agent_sessions"("agent_id", "status");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_queues" ADD CONSTRAINT "call_queues_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_assignments" ADD CONSTRAINT "call_assignments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_assignments" ADD CONSTRAINT "call_assignments_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "call_queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_assignments" ADD CONSTRAINT "call_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
