"""
Unit tests for Business-native voice tools.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def ctx():
    from call_context import CallContext

    context = CallContext(call_sid="CA_test")
    context.call_id = "call-1"
    context.business_id = "biz-1"
    context.business_name = "Test Family Medicine"
    context.caller_phone = "+15550000001"
    return context


@pytest.fixture
def mock_api(monkeypatch):
    api = MagicMock()
    api.check_insurance_plan = AsyncMock(
        return_value={"isAccepted": True, "carrierName": "Blue Cross", "planName": "PPO"}
    )
    api.create_appointment = AsyncMock(
        return_value={
            "recordId": "appt-1",
            "handledLive": True,
            "message": "Your appointment request was submitted successfully.",
        }
    )
    api.create_prescription_refill = AsyncMock(
        return_value={
            "recordId": "rx-1",
            "handledLive": False,
            "followUpTaskId": "task-1",
            "message": "I have captured your refill request for staff follow-up.",
        }
    )
    api.get_departments = AsyncMock(return_value=[{"name": "Cardiology", "phoneNumber": "555-0100"}])
    api.create_escalation = AsyncMock(return_value={"id": "esc-1"})

    import tools

    monkeypatch.setattr(tools, "api_client", api)
    return api


class TestCheckInsurance:
    @pytest.mark.asyncio
    async def test_returns_accepted_status(self, ctx, mock_api):
        from tools import check_insurance

        result = await check_insurance(ctx, carrier_name="Blue Cross")

        assert result["accepted"] is True
        assert result["carrier_name"] == "Blue Cross"
        mock_api.check_insurance_plan.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_passes_business_context(self, ctx, mock_api):
        from tools import check_insurance

        await check_insurance(ctx, carrier_name="Aetna", plan_name="Aetna Gold")

        call_kwargs = mock_api.check_insurance_plan.await_args.kwargs
        assert call_kwargs["business_id"] == "biz-1"
        assert call_kwargs["plan_name"] == "Aetna Gold"

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.check_insurance_plan.side_effect = Exception("API timeout")
        from tools import check_insurance

        result = await check_insurance(ctx, carrier_name="Unknown")

        assert result["accepted"] is False


class TestScheduleAppointment:
    @pytest.mark.asyncio
    async def test_requires_confirmation_before_submit(self, ctx, mock_api):
        from tools import schedule_appointment

        result = await schedule_appointment(
            ctx,
            patient_name="Jane Smith",
            patient_phone="+15550001",
            service_type="Annual Exam",
        )

        assert result["requires_confirmation"] is True
        assert ctx.pending_confirmation_required is True
        assert ctx.pending_action_name == "appointment-request"
        mock_api.create_appointment.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_executes_after_confirmation(self, ctx, mock_api):
        from tools import schedule_appointment

        result = await schedule_appointment(
            ctx,
            patient_name="Jane Smith",
            patient_phone="+15550001",
            service_type="Consultation",
            preferred_date="2026-03-25",
            preferred_time="09:00",
            notes="Needs morning slot",
            confirmed=True,
        )

        assert result["success"] is True
        assert result["appointment_id"] == "appt-1"
        call_kwargs = mock_api.create_appointment.await_args.kwargs
        assert call_kwargs["business_id"] == "biz-1"
        assert call_kwargs["confirmed"] is True

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.create_appointment.side_effect = Exception("Service unavailable")
        from tools import schedule_appointment

        result = await schedule_appointment(
            ctx,
            patient_name="Fail",
            patient_phone="+1",
            service_type="X",
            confirmed=True,
        )

        assert result["success"] is False


class TestRequestPrescriptionRefill:
    @pytest.mark.asyncio
    async def test_requires_confirmation_before_submit(self, ctx, mock_api):
        from tools import request_prescription_refill

        result = await request_prescription_refill(
            ctx,
            patient_name="Bob",
            patient_phone="+15550002",
            medication_name="Lisinopril",
        )

        assert result["requires_confirmation"] is True
        assert ctx.pending_confirmation_required is True
        assert ctx.pending_action_name == "refill-request"
        mock_api.create_prescription_refill.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_executes_confirmed_refill(self, ctx, mock_api):
        from tools import request_prescription_refill

        result = await request_prescription_refill(
            ctx,
            patient_name="Bob",
            patient_phone="+15550002",
            medication_name="Metformin",
            pharmacy_name="CVS",
            pharmacy_phone="+15550099",
            confirmed=True,
        )

        assert result["success"] is True
        assert result["refill_id"] == "rx-1"
        assert result["follow_up_task_id"] == "task-1"
        call_kwargs = mock_api.create_prescription_refill.await_args.kwargs
        assert call_kwargs["business_id"] == "biz-1"
        assert call_kwargs["confirmed"] is True

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.create_prescription_refill.side_effect = RuntimeError("DB error")
        from tools import request_prescription_refill

        result = await request_prescription_refill(
            ctx,
            patient_name="X",
            patient_phone="+1",
            medication_name="Y",
            confirmed=True,
        )

        assert result["success"] is False


class TestLookupDepartment:
    @pytest.mark.asyncio
    async def test_returns_department_info(self, ctx, mock_api):
        from tools import lookup_department

        result = await lookup_department(ctx, service_type="Cardiology")

        assert result["found"] is True
        assert "Cardiology" in str(result)

    @pytest.mark.asyncio
    async def test_returns_not_found_for_unknown_service(self, ctx, mock_api):
        mock_api.get_departments.return_value = []
        from tools import lookup_department

        result = await lookup_department(ctx, service_type="Nonexistent Department")

        assert result["found"] is False

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.get_departments.side_effect = Exception("Network error")
        from tools import lookup_department

        result = await lookup_department(ctx, service_type="Cardiology")

        assert result["found"] is False


class TestTransferToHuman:
    @pytest.mark.asyncio
    async def test_creates_escalation_record(self, ctx, mock_api):
        from tools import transfer_to_human

        result = await transfer_to_human(ctx, reason="Patient requested human", specialization="general")

        mock_api.create_escalation.assert_awaited_once()
        assert result["success"] is True
        assert result["assignment_id"] == "esc-1"

    @pytest.mark.asyncio
    async def test_passes_business_context_to_api(self, ctx, mock_api):
        from tools import transfer_to_human

        await transfer_to_human(ctx, reason="Billing question", specialization="billing")

        escalation_payload = mock_api.create_escalation.await_args.args[0]
        assert escalation_payload["businessId"] == "biz-1"
        assert escalation_payload["specialization"] == "billing"

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self, ctx, mock_api):
        mock_api.create_escalation.side_effect = Exception("API down")
        from tools import transfer_to_human

        result = await transfer_to_human(ctx, reason="Emergency", specialization="clinical")

        assert result["success"] is True
