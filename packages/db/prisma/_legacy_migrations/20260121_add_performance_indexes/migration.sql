-- Migration: Add Performance Indexes
-- This migration adds indexes to improve query performance for common operations

-- ============================================================================
-- Call Sessions Indexes
-- ============================================================================

-- Index for filtering calls by status (used in calls list filtering)
CREATE INDEX IF NOT EXISTS "call_sessions_status_idx" 
ON "call_sessions" ("status");

-- Composite index for hospital + status queries (very common)
CREATE INDEX IF NOT EXISTS "call_sessions_hospital_status_idx" 
ON "call_sessions" ("hospital_id", "status");

-- Index for filtering emergency calls
CREATE INDEX IF NOT EXISTS "call_sessions_is_emergency_idx" 
ON "call_sessions" ("is_emergency") WHERE "is_emergency" = true;

-- Composite index for analytics date range queries (hospital + date range)
CREATE INDEX IF NOT EXISTS "call_sessions_hospital_started_at_idx" 
ON "call_sessions" ("hospital_id", "started_at" DESC);

-- Index for sentiment-based queries
CREATE INDEX IF NOT EXISTS "call_sessions_sentiment_idx" 
ON "call_sessions" ("sentiment_overall_score") 
WHERE "sentiment_overall_score" IS NOT NULL;

-- ============================================================================
-- Transcript Segments Indexes
-- ============================================================================

-- Index for faster transcript segment retrieval
CREATE INDEX IF NOT EXISTS "transcript_segments_call_start_time_idx" 
ON "transcript_segments" ("call_id", "start_time_ms");

-- ============================================================================
-- Intents Indexes
-- ============================================================================

-- Index for intent lookups by key (used when updating calls)
CREATE INDEX IF NOT EXISTS "intents_hospital_key_idx" 
ON "intents" ("hospital_id", "key");

-- ============================================================================
-- Patients Indexes
-- ============================================================================

-- Index for patient search by phone
CREATE INDEX IF NOT EXISTS "patients_phone_idx" 
ON "patients" ("primary_phone") 
WHERE "primary_phone" IS NOT NULL;

-- Note: Trigram index for name search requires pg_trgm extension
-- Enable extension first if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for patient search by name (case-insensitive with trigram similarity)
CREATE INDEX IF NOT EXISTS "patients_name_idx" 
ON "patients" USING gin (lower("name") gin_trgm_ops)
WHERE "name" IS NOT NULL;

-- ============================================================================
-- Appointments Indexes  
-- ============================================================================

-- Index for upcoming appointments queries
CREATE INDEX IF NOT EXISTS "appointments_hospital_scheduled_idx" 
ON "appointments" ("hospital_id", "scheduled_at");

-- ============================================================================
-- Audit Logs Indexes
-- ============================================================================

-- Index for audit log queries by entity
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" 
ON "audit_logs" ("entity_type", "entity_id");

-- ============================================================================
-- Phone Numbers Indexes
-- ============================================================================

-- Index for phone number lookup (important for incoming calls)
CREATE INDEX IF NOT EXISTS "phone_numbers_twilio_number_idx" 
ON "phone_numbers" ("twilio_phone_number");
