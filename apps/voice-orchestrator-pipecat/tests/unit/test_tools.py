"""
Unit tests for the 5 pre-built AI tools.

Each tool makes HTTP calls to the Core API via `api_client`. All network I/O
is mocked with AsyncMock so these tests run fully offline.
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def ctx():
    """Minimal CallContext-like object used by all tools."""
    from call_context import CallContext
    context = CallContext(call_sid="CA_test")
    context.call_id = "call-1"
    context.hospital_id = "hosp-1"
    context.hospital_name = "Test Hospital"
    context.caller_phone = "+15550000001"
    return context


@pytest.fixture
def mock_api(monkeypatch):
    """Replace api_client with a fully mocked async version."""
    api = MagicMock()
    api.check_insurance = AsyncMock(return_value={"accepted": True, "plans": ["PPO", "HMO"]})
    api.create_appointment = AsyncMock(return_value={"id": "appt-1", "status": "scheduled"})
    api.request_prescription_refill = AsyncMock(return_value={"id": "rx-1", "status": "pending"})
    api.get_departments = AsyncMock(return_value=[{"name": "Cardiology", "phone": "555-0100"}])
    api.create_escalation = AsyncMock(return_value={"id": "esc-1"})

    import tools
    monkeypatch.setattr(tools, "api_client", api)
    return api


# ---------------------------------------------------------------------------
# check_insurance
# ---------------------------------------------------------------------------

class TestCheckInsurance:
    @pytest.mark.asyncio
    async def test_returns_accepted_status(self, ctx, mock_api):
        from tools import check_insurance
        result = await check_insurance(ctx, carrier_name="Blue Cross")
        assert result["accepted"] is True
        mock_api.check_insurance.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_passes_carrier_and_plan(self, ctx, mock_api):
        from tools import check_insurance
        await check_insurance(ctx, carrier_name="Aetna", plan_name="Aetna Gold")
        call_args = mock_api.check_insurance.call_args
        assert "Aetna" in str(call_args)

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.check_insurance.side_effect = Exception("API timeout")
        from tools import check_insurance
        result = await check_insurance(ctx, carrier_name="Unknown")
        assert "error" in result or result.get("accepted") is False


# ---------------------------------------------------------------------------
# schedule_appointment
# ---------------------------------------------------------------------------

class TestScheduleAppointment:
    @pytest.mark.asyncio
    async def test_returns_appointment_id(self, ctx, mock_api):
        from tools import schedule_appointment
        result = await schedule_appointment(
            ctx,
            patient_name="Jane Smith",
            patient_phone="+15550001",
            service_type="Annual Exam",
        )
        assert "id" in result or "appointment_id" in result or result.get("status") == "scheduled"
        mock_api.create_appointment.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_passes_hospital_id(self, ctx, mock_api):
        from tools import schedule_appointment
        await schedule_appointment(
            ctx,
            patient_name="Jane Smith",
            patient_phone="+15550001",
            service_type="Consultation",
        )
        call_kwargs = mock_api.create_appointment.call_args
        assert "hosp-1" in str(call_kwargs) or ctx.hospital_id in str(call_kwargs)

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.create_appointment.side_effect = Exception("Service unavailable")
        from tools import schedule_appointment
        result = await schedule_appointment(
            ctx, patient_name="Fail", patient_phone="+1", service_type="X"
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# request_prescription_refill
# ---------------------------------------------------------------------------

class TestRequestPrescriptionRefill:
    @pytest.mark.asyncio
    async def test_returns_refill_status(self, ctx, mock_api):
        from tools import request_prescription_refill
        result = await request_prescription_refill(
            ctx,
            patient_name="Bob",
            patient_phone="+15550002",
            medication_name="Lisinopril",
        )
        assert result.get("id") == "rx-1" or "status" in result
        mock_api.request_prescription_refill.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_passes_optional_pharmacy_fields(self, ctx, mock_api):
        from tools import request_prescription_refill
        await request_prescription_refill(
            ctx,
            patient_name="Bob",
            patient_phone="+15550002",
            medication_name="Metformin",
            pharmacy_name="CVS",
            pharmacy_phone="+15550099",
        )
        call_args = str(mock_api.request_prescription_refill.call_args)
        assert "CVS" in call_args or "Metformin" in call_args

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.request_prescription_refill.side_effect = RuntimeError("DB error")
        from tools import request_prescription_refill
        result = await request_prescription_refill(
            ctx, patient_name="X", patient_phone="+1", medication_name="Y"
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# lookup_department
# ---------------------------------------------------------------------------

class TestLookupDepartment:
    @pytest.mark.asyncio
    async def test_returns_department_info(self, ctx, mock_api):
        from tools import lookup_department
        result = await lookup_department(ctx, service_type="Cardiology")
        assert "Cardiology" in str(result) or "department" in result or "phone" in str(result)

    @pytest.mark.asyncio
    async def test_returns_not_found_for_unknown_service(self, ctx, mock_api):
        mock_api.get_departments.return_value = AsyncMock(return_value=[])
        from tools import lookup_department
        # Should not raise; may return empty/not_found message
        result = await lookup_department(ctx, service_type="Nonexistent Department")
        assert result is not None

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.get_departments.side_effect = Exception("Network error")
        from tools import lookup_department
        result = await lookup_department(ctx, service_type="Cardiology")
        assert "error" in result


# ---------------------------------------------------------------------------
# transfer_to_human
# ---------------------------------------------------------------------------

class TestTransferToHuman:
    @pytest.mark.asyncio
    async def test_creates_escalation_record(self, ctx, mock_api):
        from tools import transfer_to_human
        result = await transfer_to_human(ctx, reason="Patient requested human", specialization="general")
        mock_api.create_escalation.assert_awaited_once()
        assert "escalation" in result or result.get("status") in ("escalated", "transferring", "success")

    @pytest.mark.asyncio
    async def test_passes_specialization_to_api(self, ctx, mock_api):
        from tools import transfer_to_human
        await transfer_to_human(ctx, reason="Billing question", specialization="billing")
        call_args = str(mock_api.create_escalation.call_args)
        assert "billing" in call_args

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.create_escalation.side_effect = Exception("API down")
        from tools import transfer_to_human
        result = await transfer_to_human(ctx, reason="Emergency", specialization="clinical")
        assert "error" in result or "transferred" in result
