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

    def test_twilio_bootstrap_returns_transport_metadata(self):
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
                "/telephony/twilio/bootstrap",
                data={"CallSid": "CA123", "From": "+15550000001", "To": "+15551230001"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["transport"]["transport"], "livekit")

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


if __name__ == "__main__":
    unittest.main()
