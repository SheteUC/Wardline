import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
from observability import metrics  # noqa: E402
from service import VoiceRuntimeV2  # noqa: E402
from test_service import build_voice_policy  # noqa: E402


class MetricCoreApiClient:
    async def close(self):
        return None

    async def bootstrap_voice_session(self, _payload):
        return {
            "callId": "call-1",
            "runtimeConfigVersion": "test-version",
            "business": {
                "id": "business-1",
                "name": "Wardline Family Medicine",
                "slug": "wardline-family-medicine",
                "timeZone": "America/New_York",
                "status": "ACTIVE",
            },
            "settings": {
                "recordingDefault": "ASK",
                "transcriptRetentionDays": 30,
                "operatingHours": [
                    {"dayOfWeek": day, "isClosed": False, "startTime": "00:00", "endTime": "23:59"}
                    for day in range(7)
                ],
            },
            "phoneNumbers": [{"id": "phone-1", "label": "Main", "twilioPhoneNumber": "+15551230001"}],
            "integrations": [],
            "connectedIntegrationCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
            "voicePolicyV2": build_voice_policy(),
        }

    async def get_caller_context(self, _business_id: str, _caller_phone: str):
        return {"caller": None, "recentCalls": [], "knownInsurance": None, "knownMedications": []}

    async def ingest_call(self, _call_id: str, _payload):
        return {"accepted": True}

    async def update_call_session(self, _call_id: str, _payload):
        return {"ok": True}


class VoiceRuntimeMetricsTests(unittest.IsolatedAsyncioTestCase):
    async def test_session_completion_metrics_track_started_and_completed_sessions(self):
        started_before = metrics.voice_sessions_started_total._value.get()
        completed_before = metrics.voice_sessions_completed_total._value.get()
        active_before = metrics.voice_active_sessions._value.get()

        with patch.object(config.settings, "redis_url", ""), patch.object(
            config.settings,
            "voice_runtime_legacy_call_sync",
            False,
        ):
            runtime = VoiceRuntimeV2(api_client=MetricCoreApiClient())
            session = await runtime.start_session("CA123", "+15550000001", "+15551230001")
            session.turns = 1
            self.assertEqual(metrics.voice_active_sessions._value.get(), active_before + 1)

            await runtime.finalize_session(session.sessionId)

        self.assertEqual(metrics.voice_sessions_started_total._value.get(), started_before + 1)
        self.assertEqual(metrics.voice_sessions_completed_total._value.get(), completed_before + 1)
        self.assertEqual(metrics.voice_active_sessions._value.get(), active_before)

    async def test_session_failure_metrics_track_failed_sessions(self):
        failed_before = metrics.voice_sessions_failed_total._value.get()
        active_before = metrics.voice_active_sessions._value.get()

        with patch.object(config.settings, "redis_url", ""), patch.object(
            config.settings,
            "voice_runtime_legacy_call_sync",
            False,
        ):
            runtime = VoiceRuntimeV2(api_client=MetricCoreApiClient())
            session = await runtime.start_session("CA124", "+15550000002", "+15551230001")
            await runtime.finalize_session(session.sessionId, failure_reason="runtime error")

        self.assertEqual(metrics.voice_sessions_failed_total._value.get(), failed_before + 1)
        self.assertEqual(metrics.voice_active_sessions._value.get(), active_before)


if __name__ == "__main__":
    unittest.main()
