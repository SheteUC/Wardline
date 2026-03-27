# Staging Validation

Use this document as the launch-readiness checklist during the Voice Runtime V2 migration.

## Goal

Prove that the Practice Setup-driven runtime behaves correctly with real staging secrets, real Twilio callbacks, and one canonical family-medicine business before any broader feature work resumes.

Current migration defaults:

- Voice Runtime V2 is the target runtime for new staging and pilot validation.
- The legacy Python orchestrator remains a rollback path only until V2 reaches parity.
- Practice Setup remains the only customer-facing configuration surface in both cases.

## Preconditions

1. Local smoke is green:
   - `pnpm test:smoke`
2. Staging environment variables are present:
   - `pnpm test:staging:env`
3. The staging validation tenant exists:
   - `pnpm db:seed:staging`

## Canonical Staging Tenant

The staging seed creates:

- one owner user
- one active family-medicine business
- one phone number
- one generated published runtime workflow compiled from practice setup
- one integration record per active category
- no agent deployment surface in the default setup path

Default seed values are controlled by:

- `STAGING_BUSINESS_NAME`
- `STAGING_BUSINESS_SLUG`
- `STAGING_PHONE_NUMBER`
- `STAGING_TWILIO_SID`
- `STAGING_CLERK_USER_ID`
- `STAGING_USER_EMAIL`
- `STAGING_USER_NAME`

Integration endpoint configuration can be controlled by:

- `STAGING_INTEGRATION_BASE_URL`
- `STAGING_SCHEDULING_BASE_URL`
- `STAGING_EHR_REFILL_BASE_URL`
- `STAGING_INSURANCE_BASE_URL`
- `STAGING_BILLING_BASE_URL`
- `STAGING_*_HEALTH_PATH`
- `STAGING_SCHEDULING_APPOINTMENT_PATH`
- `STAGING_EHR_REFILL_PATH`
- `STAGING_INSURANCE_CHECK_PATH`
- `STAGING_BILLING_REQUEST_PATH`
- `STAGING_*_CREDENTIALS_REF`

## Required Staging Validation

### Practice readiness

In `/dashboard/settings`:

1. Confirm the staging business is selected.
2. Confirm hours are configured.
3. Confirm service policies are saved.
4. Confirm FAQ / knowledge content is present.
5. Confirm the readiness checklist shows the business as ready for live calls once integrations are connected.
6. Treat the generated runtime workflow as an internal artifact behind these settings; do not use the workflow editor for normal staging setup.

### Integration health

In `/dashboard/integration-failures`:

1. Save settings for all four live categories.
2. Run a health check for:
   - `SCHEDULING`
   - `EHR_REFILL`
   - `INSURANCE`
   - `BILLING`
3. Confirm each health check returns `CONNECTED` when credentials and endpoints are valid.
4. Record the latency shown in the health-check result.

### Runtime actions

Validate all active runtime actions against the staging business:

1. `appointment-request`
   - one live success
   - one fallback case
2. `refill-request`
   - one live success
   - one fallback case
3. `insurance-check`
   - one live success
   - one fallback case
4. `billing-request`
   - one live success if supported
   - otherwise one verified fallback case

For every run, confirm:

- `handledLive`
- `fallbackCreated`
- `requiresStaffFollowUp`
- integration category/vendor metadata
- fallback reason when downgraded
- linked follow-up task when fallback happens

### Gather voice path

This is a rollback-only validation set during migration. Keep it green until Twilio traffic fully cuts over to V2.

Validate one full Gather scenario set:

1. emergency redirect
2. after-hours urgent voicemail
3. confirmed live appointment request
4. confirmed fallback case
5. confirmation repair:
   - caller asks to repeat or summarize the pending request
   - caller says they want to change the pending request before submission
6. receptionist quality:
   - office-hours question gets a direct answer
   - practice-services question gets a direct answer
   - the caller can recover after a misunderstanding without the conversation stalling

### Streaming voice path

This is the parity target for Voice Runtime V2. Validate the same business outcomes under one supervisor-led receptionist flow.

Validate one full streaming scenario set:

1. connection stays healthy end to end
2. confirmation gate blocks write actions until explicit approval
3. one live action succeeds
4. one fallback case creates the correct follow-up metadata
5. the same confirmation-repair and receptionist-quality checks used for Gather behave acceptably in streaming mode

### Voice Runtime V2 text-turn harness

Before or alongside full telephony cutover, validate the V2 control-plane harness locally:

1. start the service with `pnpm voice:v2:dev`
2. run `pnpm test:voice:v2`
3. confirm the V2 runtime can:
   - interrupt for emergencies
   - complete scheduling confirmation
   - continue an in-progress refill intake across turns
   - persist runtime-action outcomes without relying on workflow graphs

### Operator review

For each staged call outcome, open the linked call detail page and confirm:

1. the operator summary explains what happened in plain language
2. the next step is obvious without reading raw JSON-style metadata
3. runtime-action history shows whether the request was handled live or downgraded
4. fallback reason text is human-readable
5. linked follow-ups and voicemails are visible from the same call record

## Latency Targets

Capture p50 and p95 where possible for:

- phone-number to business lookup
- runtime-config fetch
- generated active workflow load
- confirmation to runtime-action completion
- connector execution / fallback creation
- dashboard queue loads for:
  - calls
  - follow-ups
  - voicemails

Use the current runtime logs as the source of truth for voice/bootstrap and connector timing.

## Release Gate

Wardline is staging-ready only when all of the following are true:

- local smoke suite is green
- CI smoke-validation is green
- staging env check passes
- staging integration health is green
- one Gather rollback validation set passes
- one streaming / Voice Runtime V2 validation set passes
- each runtime-action category has:
  - one successful live path
  - one verified fallback path
- dashboard queues correctly reflect:
  - calls
  - voicemails
  - urgent items
  - follow-ups
- call detail pages clearly explain what happened and what staff should do next

If any of the above fail, fix staging trust and responsiveness before resuming broader feature work.
