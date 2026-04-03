import pathlib
import sys
import unittest
import unittest.mock
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
from observability import metrics  # noqa: E402
import server  # noqa: E402


class VoiceRuntimeV2ServerTests(unittest.TestCase):
    def setUp(self):
        server.rate_limiter._events.clear()
        self._twilio_sig_patcher = unittest.mock.patch.object(
            config.settings,
            "twilio_skip_signature_validation",
            True,
        )
        self._twilio_sig_patcher.start()
        self._ready_patcher = unittest.mock.patch.multiple(
            server.runtime,
            readiness=lambda: {
                "livekit": {"configured": True, "twilioConfigured": True},
                "deepgram": {"configured": True},
                "tts": {"configured": True},
                "reasoning": {"configured": False},
            },
            real_call_preflight=lambda: {"ok": True, "errors": []},
            check_redis_readiness=AsyncMock(return_value={"ok": True, "detail": "not_configured"}),
            check_core_api_readiness=AsyncMock(return_value={"ok": True, "status": 200}),
        )
        self._ready_patcher.start()
        self.client = TestClient(server.app)

    def tearDown(self):
        server.rate_limiter._events.clear()
        self._ready_patcher.stop()
        self._twilio_sig_patcher.stop()

    def test_health_returns_status(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "healthy")
        self.assertEqual(body["service"], "voice-runtime-v2")
        self.assertIn("timestamp", body)

    def test_ready_includes_providers_and_preflight(self):
        response = self.client.get("/ready")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ready"])
        self.assertIn("providers", body)
        self.assertIn("preflight", body)
        self.assertIn("livekit", body["providers"])

    def test_twilio_bootstrap_returns_twiml_stream_response(self):
        session = AsyncMock()
        session.sessionId = "session-1"
        session.callId = "call-1"
        session.businessId = "business-1"
        session.messages = [type("Message", (), {"text": "Hello there"})()]

        with patch.object(
            server.runtime,
            "real_call_preflight",
            return_value={"ok": True, "errors": [], "callbackUrl": "https://voice.example.com"},
        ), patch.object(server.runtime, "start_session", AsyncMock(return_value=session)), patch.object(
            server.runtime,
            "build_twilio_bootstrap_response",
            AsyncMock(
                return_value='<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://voice.example.com/telephony/twilio/media"><Parameter name="sessionId" value="session-1" /></Stream></Connect></Response>',
            ),
        ):
            response = self.client.post(
                "/telephony/twilio/bootstrap",
                data={"CallSid": "CA123", "From": "+15550000001", "To": "+15551230001"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/xml")
        self.assertIn("<Stream", response.text)
        self.assertIn('sessionId" value="session-1"', response.text)

    def test_twilio_bootstrap_returns_error_twiml_when_preflight_fails(self):
        with patch.object(
            server.runtime,
            "real_call_preflight",
            return_value={"ok": False, "errors": ["missing callback url"], "callbackUrl": ""},
        ):
            response = self.client.post(
                "/telephony/twilio/bootstrap",
                data={"CallSid": "CA123", "From": "+15550000001", "To": "+15551230001"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/xml")
        self.assertIn("<Say>", response.text)
        self.assertIn("<Hangup", response.text)

    def test_transport_event_endpoint_records_events(self):
        with patch.object(
            server.runtime,
            "persist_transport_event",
            AsyncMock(return_value={"accepted": True, "eventType": "participant_joined"}),
        ):
            response = self.client.post(
                "/sessions/session-1/events",
                json={"type": "participant_joined", "payload": {"participantIdentity": "agent"}},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["eventType"], "participant_joined")

    def test_transfer_action_endpoint_returns_twiml(self):
        with patch.object(
            server.runtime,
            "handle_transfer_action_callback",
            AsyncMock(
                return_value='<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>',
            ),
        ) as mocked:
            response = self.client.post(
                "/telephony/twilio/transfer-action?sessionId=session-1",
                data={"DialCallStatus": "completed"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/xml")
        mocked.assert_awaited_once()
        self.assertIn("<Hangup", response.text)

    def test_turn_endpoint_returns_operator_summary(self):
        with patch.object(
            server.runtime,
            "process_text_turn",
            AsyncMock(
                return_value={
                    "sessionId": "session-1",
                    "reply": "I can help with appointments, refills, insurance questions, or billing support.",
                    "domain": "knowledge",
                    "stage": "intake",
                    "requiresConfirmation": False,
                    "awaitingVoicemail": False,
                    "awaitingAnythingElse": False,
                    "pendingAction": None,
                    "operatorSummary": {
                        "headline": "Answered practice services question",
                        "nextStep": "No staff follow-up is needed unless the caller asks for something else.",
                        "specialist": "knowledge",
                        "callerRequest": "Practice services question",
                        "followUpRequired": False,
                    },
                    "transport": {"runtime": "voice-runtime-v2", "transport": "livekit"},
                }
            ),
        ):
            response = self.client.post("/sessions/session-1/turn", json={"text": "What do you help with?"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["operatorSummary"]["headline"], "Answered practice services question")

    def test_start_session_endpoint_returns_runtime_bootstrap(self):
        session = AsyncMock()
        session.sessionId = "session-1"
        session.callId = "call-1"
        session.businessId = "business-1"
        session.messages = [type("Message", (), {"text": "Hello there"})()]
        session.transport = type(
            "Transport",
            (),
            {"model_dump": lambda self: {"runtime": "voice-runtime-v2", "transport": "livekit"}},
        )()

        with patch.object(server.runtime, "start_session", AsyncMock(return_value=session)):
            response = self.client.post(
                "/sessions",
                json={
                    "callSid": "CA123",
                    "callerPhone": "+15550000001",
                    "calledPhone": "+15551230001",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sessionId"], "session-1")
        self.assertEqual(response.json()["transport"]["transport"], "livekit")

    def test_start_session_endpoint_rate_limits_repeated_requests(self):
        session = AsyncMock()
        session.sessionId = "session-1"
        session.callId = "call-1"
        session.businessId = "business-1"
        session.messages = [type("Message", (), {"text": "Hello there"})()]
        session.transport = type(
            "Transport",
            (),
            {"model_dump": lambda self: {"runtime": "voice-runtime-v2", "transport": "livekit"}},
        )()

        with patch.object(
            config.settings,
            "voice_rate_limit_sessions_per_minute",
            1,
        ), patch.object(server.runtime, "start_session", AsyncMock(return_value=session)):
            first = self.client.post(
                "/sessions",
                json={
                    "callSid": "CA123",
                    "callerPhone": "+15550000001",
                    "calledPhone": "+15551230001",
                },
                headers={"X-Forwarded-For": "203.0.113.10"},
            )
            second = self.client.post(
                "/sessions",
                json={
                    "callSid": "CA124",
                    "callerPhone": "+15550000002",
                    "calledPhone": "+15551230001",
                },
                headers={"X-Forwarded-For": "203.0.113.10"},
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.json()["detail"], "Rate limit exceeded")

    def test_transcript_endpoint_passes_provider_session_id(self):
        with patch.object(
            server.runtime,
            "process_transcript_turn",
            AsyncMock(
                return_value={
                    "sessionId": "session-1",
                    "accepted": True,
                    "final": False,
                    "transport": {
                        "runtime": "voice-runtime-v2",
                        "transport": "livekit",
                        "providerSessionId": "dg-123",
                    },
                }
            ),
        ) as mocked:
            response = self.client.post(
                "/sessions/session-1/transcript",
                json={"text": "hello", "final": False, "providerSessionId": "dg-123"},
            )

        self.assertEqual(response.status_code, 200)
        mocked.assert_awaited_once_with("session-1", "hello", final=False, provider_session_id="dg-123")

    def test_invalid_twilio_signature_increments_provider_error_metric(self):
        errors_before = metrics.voice_provider_errors_total.labels(
            provider="twilio",
            error_type="signature_validation",
        )._value.get()

        with patch.object(config.settings, "twilio_skip_signature_validation", False), patch.object(
            config.settings,
            "twilio_auth_token",
            "secret",
        ):
            response = self.client.post(
                "/telephony/twilio/bootstrap",
                data={"CallSid": "CA123", "From": "+15550000001", "To": "+15551230001"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("<Say>", response.text)
        self.assertEqual(
            metrics.voice_provider_errors_total.labels(
                provider="twilio",
                error_type="signature_validation",
            )._value.get(),
            errors_before + 1,
        )


if __name__ == "__main__":
    unittest.main()
