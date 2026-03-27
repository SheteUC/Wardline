"""
Integration smoke tests for Twilio Gather mode.

These tests exercise the FastAPI webhook surface directly with mocked Core API
dependencies so the current V1 policy flow stays deterministic:
  - emergency redirect
  - after-hours urgent voicemail
  - confirmation-gated runtime action execution

Run with (from this package directory):
  python -m pytest tests/integration/test_gather_voice_e2e.py -q -o addopts=--strict-markers
From the repository root (matches ``pnpm test:smoke:voice:gather``):
  python -m pytest apps/voice-orchestrator-pipecat/tests/integration/test_gather_voice_e2e.py -q -o addopts=--strict-markers
"""
from __future__ import annotations

import importlib
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient


def _fresh_server_module(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "auth_test")
    monkeypatch.setenv("TWILIO_PHONE_NUMBER", "+15551230001")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "speech_test")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus2")
    monkeypatch.setenv("AZURE_OPENAI_KEY", "openai_test")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.setenv("VOICE_AGENT_TYPE", "conversational")
    monkeypatch.setenv("USE_STREAMING", "false")
    monkeypatch.setenv("CORE_API_BASE_URL", "http://localhost:3001")

    for module_name in ["server", "config"]:
        sys.modules.pop(module_name, None)

    server = importlib.import_module("server")
    server.context_manager._contexts.clear()
    server.context_manager._call_id_to_sid.clear()
    return server


def _closed_hours():
    return [
        {
            "dayOfWeek": day,
            "isClosed": True,
            "startTime": None,
            "endTime": None,
        }
        for day in range(7)
    ]


def _open_hours():
    return [
        {
            "dayOfWeek": day,
            "isClosed": False,
            "startTime": "00:00",
            "endTime": "23:59",
        }
        for day in range(7)
    ]


@pytest.fixture
def server_module(monkeypatch):
    server = _fresh_server_module(monkeypatch)

    server.api_client.get_business_by_phone = AsyncMock(
        return_value={
            "id": "business-1",
            "name": "Smoke Family Medicine",
            "timeZone": "America/New_York",
            "phoneNumbers": [
                {
                    "id": "phone-1",
                    "twilioPhoneNumber": "+15551230001",
                }
            ],
        }
    )
    server.api_client.get_runtime_config = AsyncMock(
        return_value={
            "business": {
                "id": "business-1",
                "name": "Smoke Family Medicine",
                "timeZone": "America/New_York",
            },
            "settings": {
                "operatingHours": _open_hours(),
                "emergencyKeywords": [],
            },
        }
    )
    server.api_client.create_call_session = AsyncMock(
        return_value={
            "id": "call-1",
            "phoneNumberId": "phone-1",
        }
    )
    server.api_client.get_call_by_twilio_sid = AsyncMock(return_value=None)
    server.api_client.update_call_session = AsyncMock(return_value=None)
    server.api_client.create_voicemail = AsyncMock(return_value={"id": "vm-1"})
    server.api_client.create_appointment = AsyncMock(
        return_value={
            "recordId": "appt-1",
            "handledLive": True,
            "message": "Your appointment request was submitted successfully.",
        }
    )
    server.api_client.create_billing_request = AsyncMock(
        return_value={
            "recordId": "billing-1",
            "handledLive": False,
            "message": "I have captured your billing request for staff follow-up.",
        }
    )
    server.generate_ai_response = AsyncMock(return_value="How can I help you today?")

    yield server

    server.context_manager._contexts.clear()
    server.context_manager._call_id_to_sid.clear()


@pytest.fixture
def client(server_module):
    with TestClient(server_module.app) as test_client:
        yield test_client


class TestGatherVoiceFlow:
    @pytest.mark.integration
    def test_incoming_call_uses_gather_mode(self, client, server_module):
        response = client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_gather",
                "From": "+15550000001",
                "To": "+15551230001",
            },
        )

        assert response.status_code == 200
        assert "<Gather" in response.text
        assert "How can I help you today" in response.text
        server_module.api_client.create_call_session.assert_awaited_once()

    @pytest.mark.integration
    def test_emergency_phrase_short_circuits_with_911_redirect(self, client, server_module):
        client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_emergency",
                "From": "+15550000002",
                "To": "+15551230001",
            },
        )

        response = client.post(
            "/voice/process",
            data={
                "CallSid": "CA_emergency",
                "SpeechResult": "I have chest pain and I cannot breathe",
                "Confidence": "0.92",
            },
        )

        assert response.status_code == 200
        assert "call 911 immediately" in response.text
        assert "<Hangup" in response.text
        server_module.api_client.update_call_session.assert_awaited()

    @pytest.mark.integration
    def test_after_hours_urgent_creates_priority_voicemail_flow(self, client, server_module):
        server_module.api_client.get_runtime_config = AsyncMock(
            return_value={
                "business": {
                    "id": "business-1",
                    "name": "Smoke Family Medicine",
                    "timeZone": "America/New_York",
                },
                "settings": {
                    "operatingHours": _closed_hours(),
                    "emergencyKeywords": [],
                },
            }
        )

        client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_after_hours",
                "From": "+15550000003",
                "To": "+15551230001",
            },
        )

        response = client.post(
            "/voice/process",
            data={
                "CallSid": "CA_after_hours",
                "SpeechResult": "This is urgent and I need help as soon as possible",
                "Confidence": "0.90",
            },
        )

        assert response.status_code == 200
        assert "urgent calls live after hours" in response.text
        assert "/voice/voicemail/complete?priority=urgent" in response.text

    @pytest.mark.integration
    def test_confirmation_executes_pending_appointment_request(self, client, server_module):
        client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_confirm",
                "From": "+15550000004",
                "To": "+15551230001",
            },
        )

        context = server_module.context_manager.get_context("CA_confirm")
        context.call_id = "call-1"
        context.business_id = "business-1"
        context.caller_name = "Smoke Caller"
        context.set_pending_action(
            "appointment-request",
            "your appointment request",
            {
                "patient_name": "Smoke Caller",
                "patient_phone": "+15550000004",
                "service_type": "Annual Physical",
                "preferred_date": "2026-03-25",
            },
        )

        response = client.post(
            "/voice/process",
            data={
                "CallSid": "CA_confirm",
                "SpeechResult": "yes please do that",
                "Confidence": "0.99",
            },
        )

        assert response.status_code == 200
        assert "submitted successfully" in response.text
        assert context.pending_confirmation_required is False
        server_module.api_client.create_appointment.assert_awaited_once()
        call_kwargs = server_module.api_client.create_appointment.await_args.kwargs
        assert call_kwargs["business_id"] == "business-1"
        assert call_kwargs["confirmed"] is True

    @pytest.mark.integration
    def test_confirmation_repair_repeats_summary_without_submitting(self, client, server_module):
        client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_repair",
                "From": "+15550000005",
                "To": "+15551230001",
            },
        )

        context = server_module.context_manager.get_context("CA_repair")
        context.call_id = "call-1"
        context.business_id = "business-1"
        context.set_pending_action(
            "billing-request",
            "you'd like the practice to follow up about a billing statement for Smoke Caller.",
            {
                "caller_name": "Smoke Caller",
                "caller_phone": "+15550000005",
                "billing_topic": "statement question",
            },
        )

        response = client.post(
            "/voice/process",
            data={
                "CallSid": "CA_repair",
                "SpeechResult": "can you repeat that",
                "Confidence": "0.88",
            },
        )

        assert response.status_code == 200
        assert "To confirm" in response.text
        assert "billing statement" in response.text
        assert context.pending_confirmation_required is True
        server_module.api_client.create_billing_request.assert_not_awaited()

    @pytest.mark.integration
    def test_common_hours_question_gets_direct_practice_answer(self, client, server_module):
        client.post(
            "/voice/incoming",
            data={
                "CallSid": "CA_hours",
                "From": "+15550000006",
                "To": "+15551230001",
            },
        )

        response = client.post(
            "/voice/process",
            data={
                "CallSid": "CA_hours",
                "SpeechResult": "what time are you open today",
                "Confidence": "0.92",
            },
        )

        assert response.status_code == 200
        assert "The office is open today" in response.text
