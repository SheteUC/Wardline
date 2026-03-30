# Operations Runbook

Use this runbook during pilot operations and incident response.

## Telephony Rollback

Use this when Voice Runtime V2 cannot safely handle live calls.

1. Remove the Twilio number webhook from `/telephony/twilio/bootstrap`.
2. Point the number to the approved fallback destination for the pilot practice.
3. Announce the rollback to the daily pilot owner and staff contact.
4. Preserve call and audit evidence before redeploying.
5. Run one proof call before restoring Wardline as the live target.

## Secret Rotation

Use this after suspected credential exposure or scheduled credential rotation.

1. Rotate the affected secret in the provider console.
2. Update the deployed environment store for every affected service.
3. Redeploy `core-api` and `voice-runtime-v2`.
4. Run `pnpm voice:v2:preflight`.
5. Re-run integration health checks and one inbound proof call.

## Manual Follow-Up During Runtime or Connector Outage

Use this when live execution is degraded but staff still need to service callers.

1. Treat all live runtime-action failures as manual follow-up work.
2. Review `/dashboard/follow-ups`, `/dashboard/urgent-calls`, and `/dashboard/voicemails`.
3. Confirm each urgent or voicemail item has an explicit owner.
4. Document the outage window and the affected calls.
5. After recovery, verify that new calls return to normal live-or-fallback behavior.

## Daily Pilot Ownership

Every pilot day needs named owners for:

- queue review
- telephony incident response
- secret rotation authority
- business/staff communications

Do not expand pilot traffic unless those owners are assigned for the current day.
