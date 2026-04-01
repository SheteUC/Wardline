CREATE TABLE "call_events" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "domain" TEXT,
    "action_name" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_session_projections" (
    "call_id" UUID NOT NULL,
    "last_sequence_applied" INTEGER NOT NULL DEFAULT 0,
    "latest_domain" TEXT,
    "resolution" TEXT,
    "resolution_label" TEXT,
    "operator_next_step" TEXT,
    "latest_runtime_action" TEXT,
    "handled_live" BOOLEAN,
    "fallback_reason" TEXT,
    "transport_summary_json" JSONB,
    "intent_timeline_json" JSONB,
    "operator_summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_session_projections_pkey" PRIMARY KEY ("call_id")
);

CREATE UNIQUE INDEX "call_events_call_id_sequence_key" ON "call_events"("call_id", "sequence");
CREATE INDEX "call_events_call_id_created_at_idx" ON "call_events"("call_id", "created_at");
CREATE INDEX "call_events_call_id_sequence_idx" ON "call_events"("call_id", "sequence");

ALTER TABLE "call_events"
ADD CONSTRAINT "call_events_call_id_fkey"
FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_session_projections"
ADD CONSTRAINT "call_session_projections_call_id_fkey"
FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
