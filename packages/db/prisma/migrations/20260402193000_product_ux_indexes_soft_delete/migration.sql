-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "business_users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "businesses_deleted_at_idx" ON "businesses"("deleted_at");

-- CreateIndex
CREATE INDEX "call_sessions_phone_number_id_idx" ON "call_sessions"("phone_number_id");

-- CreateIndex
CREATE INDEX "phone_numbers_workflow_id_idx" ON "phone_numbers"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_versions_created_by_user_id_idx" ON "workflow_versions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "workflow_versions_approved_by_user_id_idx" ON "workflow_versions"("approved_by_user_id");
