import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import server  # noqa: E402


class VoiceRuntimeV2ServerTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)

    def test_twilio_bootstrap_returns_twiml_stream_response(self):
        session = AsyncMock()
        session.sessionId = "session-1"
        session.callId = "call-1"
        session.businessId = "business-1"
        session.messages = [type("Message", (), {"text": "Hello there"})()]

        with patch.object(server.runtime, "start_session", AsyncMock(return_value=session)), patch.object(
            server.runtime,
            "build_twilio_bootstrap_response",
            return_value='<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://voice.example.com/telephony/twilio/media"><Parameter name="sessionId" value="session-1" /></Stream></Connect></Response>',
        ):
            response = self.client.post(
                "/telephony/twilio/bootstrap",
                data={"CallSid": "CA123", "From": "+15550000001", "To": "+15551230001"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/xml")
        self.assertIn("<Stream", response.text)
        self.assertIn('sessionId" value="session-1"', response.text)

    def test_transport_event_endpoint_records_events(self):
        with patch.object(
            server.runtime,
            "record_transport_event",
            return_value={"accepted": True, "eventType": "participant_joined"},
        ):
            response = self.client.post(
                "/sessions/session-1/events",
                json={"type": "participant_joined", "payload": {"participantIdentity": "agent"}},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["eventType"], "participant_joined")

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


if __name__ == "__main__":
    unittest.main()
