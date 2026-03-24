-- CreateEnum
CREATE TYPE "RefillStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'PENDING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SEMINAR', 'LECTURE', 'CLASS', 'WORKSHOP', 'HEALTH_FAIR', 'SCREENING');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "service_types" TEXT[],
    "phone_number" TEXT NOT NULL,
    "extension" TEXT,
    "email_address" TEXT,
    "location" TEXT,
    "hours_of_operation" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_inquiries" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "call_id" TEXT,
    "department_id" TEXT,
    "service_type" TEXT NOT NULL,
    "patient_name" TEXT,
    "patient_phone" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_refills" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "call_id" TEXT,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL,
    "patient_phone" TEXT NOT NULL,
    "patient_dob" DATE,
    "medication_name" TEXT NOT NULL,
    "prescriber_id" TEXT,
    "prescriber_name" TEXT,
    "pharmacy_name" TEXT,
    "pharmacy_phone" TEXT,
    "status" "RefillStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "is_new_patient" BOOLEAN NOT NULL DEFAULT false,
    "assigned_provider_id" TEXT,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_refills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
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
    "hospital_id" TEXT NOT NULL,
    "call_id" TEXT,
    "insurance_plan_id" TEXT,
    "patient_name" TEXT,
    "patient_phone" TEXT,
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
    "hospital_id" TEXT NOT NULL,
    "insurance_plan_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "marketing_events" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "specialty" TEXT,
    "presenter" TEXT,
    "location" TEXT,
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "virtual_link" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "capacity" INTEGER,
    "registration_deadline" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "marketing_channel" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "call_id" TEXT,
    "patient_id" TEXT,
    "attendee_name" TEXT NOT NULL,
    "attendee_phone" TEXT NOT NULL,
    "attendee_email" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "attended" BOOLEAN,
    "became_patient" BOOLEAN NOT NULL DEFAULT false,
    "first_appointment_date" TIMESTAMP(3),
    "notes" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_hospital_id_idx" ON "departments"("hospital_id");

-- CreateIndex
CREATE INDEX "directory_inquiries_hospital_id_idx" ON "directory_inquiries"("hospital_id");

-- CreateIndex
CREATE INDEX "directory_inquiries_call_id_idx" ON "directory_inquiries"("call_id");

-- CreateIndex
CREATE INDEX "prescription_refills_hospital_id_idx" ON "prescription_refills"("hospital_id");

-- CreateIndex
CREATE INDEX "prescription_refills_call_id_idx" ON "prescription_refills"("call_id");

-- CreateIndex
CREATE INDEX "prescription_refills_status_idx" ON "prescription_refills"("status");

-- CreateIndex
CREATE INDEX "insurance_plans_hospital_id_idx" ON "insurance_plans"("hospital_id");

-- CreateIndex
CREATE INDEX "insurance_plans_carrier_id_idx" ON "insurance_plans"("carrier_id");

-- CreateIndex
CREATE INDEX "insurance_inquiries_hospital_id_idx" ON "insurance_inquiries"("hospital_id");

-- CreateIndex
CREATE INDEX "insurance_inquiries_call_id_idx" ON "insurance_inquiries"("call_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_hospital_id_idx" ON "insurance_verifications"("hospital_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_insurance_plan_id_idx" ON "insurance_verifications"("insurance_plan_id");

-- CreateIndex
CREATE INDEX "insurance_verifications_verification_date_idx" ON "insurance_verifications"("verification_date");

-- CreateIndex
CREATE INDEX "marketing_events_hospital_id_idx" ON "marketing_events"("hospital_id");

-- CreateIndex
CREATE INDEX "marketing_events_scheduled_at_idx" ON "marketing_events"("scheduled_at");

-- CreateIndex
CREATE INDEX "marketing_events_status_idx" ON "marketing_events"("status");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations"("event_id");

-- CreateIndex
CREATE INDEX "event_registrations_call_id_idx" ON "event_registrations"("call_id");

-- CreateIndex
CREATE INDEX "event_registrations_status_idx" ON "event_registrations"("status");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_inquiries" ADD CONSTRAINT "directory_inquiries_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_inquiries" ADD CONSTRAINT "directory_inquiries_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_inquiries" ADD CONSTRAINT "directory_inquiries_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refills" ADD CONSTRAINT "prescription_refills_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_inquiries" ADD CONSTRAINT "insurance_inquiries_insurance_plan_id_fkey" FOREIGN KEY ("insurance_plan_id") REFERENCES "insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_insurance_plan_id_fkey" FOREIGN KEY ("insurance_plan_id") REFERENCES "insurance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_verifications" ADD CONSTRAINT "insurance_verifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "marketing_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
