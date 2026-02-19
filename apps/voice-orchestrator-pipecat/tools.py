"""
Five pre-built AI tools for Wardline Voice AI.

Each tool is an async function that accepts a CallContext as its first
argument (so agents can pass hospital/call metadata) and keyword
arguments matching the tool's parameter schema.

Tools:
  1. check_insurance       -- verify if a carrier/plan is accepted
  2. schedule_appointment  -- book an appointment for a patient
  3. request_prescription_refill -- submit a refill request
  4. lookup_department     -- find a department's contact info
  5. transfer_to_human     -- escalate to a human agent/queue
"""
from typing import Any, Dict, Optional
from loguru import logger

from call_context import CallContext, IntentType
from core_api_client import api_client


# ---------------------------------------------------------------------------
# 1. Insurance check
# ---------------------------------------------------------------------------

async def check_insurance(
    context: CallContext,
    carrier_name: str,
    plan_name: str = "",
) -> Dict[str, Any]:
    """
    Check whether an insurance carrier / plan is accepted by the hospital.

    Returns a dict with:
      - accepted (bool)
      - carrier_name (str)
      - plan_name (str)
      - plan_type (str)
      - message (str) – human-readable summary
    """
    logger.info(f"[Tool] check_insurance: carrier={carrier_name!r} plan={plan_name!r}")
    try:
        result = await api_client.check_insurance_plan(
            hospital_id=context.hospital_id,
            carrier_name=carrier_name,
        )

        if result is None:
            return {
                "accepted": False,
                "carrier_name": carrier_name,
                "message": (
                    f"I wasn't able to verify {carrier_name} at the moment. "
                    "Please call our billing department for confirmation."
                ),
            }

        accepted = result.get("isAccepted", False)
        msg = (
            f"{carrier_name} is accepted at our facility."
            if accepted
            else f"Unfortunately we do not currently accept {carrier_name}. "
                 "Please contact our billing team to discuss payment options."
        )
        return {
            "accepted": accepted,
            "carrier_name": result.get("carrierName", carrier_name),
            "plan_name": result.get("planName", plan_name),
            "plan_type": result.get("planType", ""),
            "message": msg,
        }
    except Exception as e:
        logger.error(f"check_insurance tool error: {e}")
        return {
            "accepted": False,
            "carrier_name": carrier_name,
            "message": "I'm unable to verify insurance information right now. Please try again later.",
        }


# ---------------------------------------------------------------------------
# 2. Schedule appointment
# ---------------------------------------------------------------------------

async def schedule_appointment(
    context: CallContext,
    patient_name: str,
    patient_phone: str,
    service_type: str,
    preferred_date: str = "",
) -> Dict[str, Any]:
    """
    Schedule a new appointment for a patient.

    Returns a dict with:
      - success (bool)
      - appointment_id (str | None)
      - message (str)
    """
    logger.info(
        f"[Tool] schedule_appointment: patient={patient_name!r} "
        f"service={service_type!r} date={preferred_date!r}"
    )
    try:
        result = await api_client.create_appointment(
            hospital_id=context.hospital_id,
            call_id=context.call_id,
            patient_name=patient_name,
            patient_phone=patient_phone,
            service_type=service_type,
            preferred_date=preferred_date,
        )

        if result:
            context.detected_intent = IntentType.SCHEDULING
            return {
                "success": True,
                "appointment_id": result.get("id"),
                "message": (
                    f"I've submitted your appointment request for {service_type}. "
                    "Our scheduling team will confirm the exact date and time with you shortly."
                ),
            }
        else:
            return {
                "success": False,
                "appointment_id": None,
                "message": (
                    "I wasn't able to schedule the appointment at the moment. "
                    "Let me transfer you to our scheduling team."
                ),
            }
    except Exception as e:
        logger.error(f"schedule_appointment tool error: {e}")
        return {
            "success": False,
            "appointment_id": None,
            "message": "I'm having trouble with scheduling right now. Please hold while I transfer you.",
        }


# ---------------------------------------------------------------------------
# 3. Prescription refill
# ---------------------------------------------------------------------------

async def request_prescription_refill(
    context: CallContext,
    patient_name: str,
    patient_phone: str,
    medication_name: str,
    pharmacy_name: str = "",
    pharmacy_phone: str = "",
) -> Dict[str, Any]:
    """
    Submit a prescription refill request.

    Returns a dict with:
      - success (bool)
      - refill_id (str | None)
      - message (str)
    """
    logger.info(
        f"[Tool] request_prescription_refill: patient={patient_name!r} "
        f"medication={medication_name!r}"
    )
    try:
        result = await api_client.create_prescription_refill(
            hospital_id=context.hospital_id,
            call_id=context.call_id,
            patient_name=patient_name,
            patient_phone=patient_phone,
            medication_name=medication_name,
            pharmacy_name=pharmacy_name,
            pharmacy_phone=pharmacy_phone,
        )

        if result:
            context.detected_intent = IntentType.PRESCRIPTION_REFILL
            return {
                "success": True,
                "refill_id": result.get("id"),
                "message": (
                    f"Your refill request for {medication_name} has been submitted. "
                    "Your provider will review it within one business day and send it to your pharmacy."
                ),
            }
        else:
            return {
                "success": False,
                "refill_id": None,
                "message": (
                    "I wasn't able to submit the refill request. "
                    "Let me connect you with our pharmacy team."
                ),
            }
    except Exception as e:
        logger.error(f"request_prescription_refill tool error: {e}")
        return {
            "success": False,
            "refill_id": None,
            "message": "I'm having trouble processing refills right now. Transferring you now.",
        }


# ---------------------------------------------------------------------------
# 4. Department lookup
# ---------------------------------------------------------------------------

async def lookup_department(
    context: CallContext,
    service_type: str,
) -> Dict[str, Any]:
    """
    Find a hospital department by service type keyword.

    Returns a dict with:
      - found (bool)
      - department (dict | None)
      - message (str)
    """
    logger.info(f"[Tool] lookup_department: service_type={service_type!r}")
    try:
        departments = context.departments or await api_client.get_departments(
            context.hospital_id
        )

        # Case-insensitive partial match on name or service types
        service_lower = service_type.lower()
        match = None
        for dept in departments:
            dept_name = dept.get("name", "").lower()
            dept_services = [s.lower() for s in dept.get("serviceTypes", [])]
            if (
                service_lower in dept_name
                or dept_name in service_lower
                or any(service_lower in s or s in service_lower for s in dept_services)
            ):
                match = dept
                break

        if match:
            name = match.get("name", "")
            phone = match.get("phoneNumber", "")
            ext = match.get("extension", "")
            location = match.get("location", "")
            ext_str = f", extension {ext}" if ext else ""
            loc_str = f", located at {location}" if location else ""
            context.detected_intent = IntentType.DEPARTMENT_ROUTING
            return {
                "found": True,
                "department": match,
                "message": (
                    f"Our {name} department can be reached at {phone}{ext_str}{loc_str}."
                ),
            }
        else:
            return {
                "found": False,
                "department": None,
                "message": (
                    f"I don't have specific information for {service_type}. "
                    "Let me transfer you to our main reception who can direct your call."
                ),
            }
    except Exception as e:
        logger.error(f"lookup_department tool error: {e}")
        return {
            "found": False,
            "department": None,
            "message": "I'm unable to look up department information right now.",
        }


# ---------------------------------------------------------------------------
# 5. Transfer to human
# ---------------------------------------------------------------------------

async def transfer_to_human(
    context: CallContext,
    reason: str,
    specialization: str = "general",
) -> Dict[str, Any]:
    """
    Escalate the call to a human agent or clinical staff.

    Updates the call context and notifies the Core API.

    Returns a dict with:
      - success (bool)
      - assignment_id (str | None)
      - message (str)
    """
    logger.info(
        f"[Tool] transfer_to_human: reason={reason!r} specialization={specialization!r}"
    )
    try:
        result = await api_client.create_escalation({
            "callId": context.call_id,
            "hospitalId": context.hospital_id,
            "reason": reason,
            "specialization": specialization,
            "callerPhone": context.caller_phone,
            "transcript": context.get_conversation_text(last_n=10),
            "collectedFields": {
                k: v.value for k, v in context.collected_fields.items()
            },
        })

        context.escalation_reason = reason
        context.transfer_target = specialization
        context.detected_intent = IntentType.TRANSFER_TO_HUMAN

        if result:
            return {
                "success": True,
                "assignment_id": result.get("id"),
                "message": (
                    "I'm connecting you with a staff member now. "
                    "Please hold for just a moment."
                ),
            }
        else:
            return {
                "success": True,  # Still signal transfer even if API call failed
                "assignment_id": None,
                "message": "Let me transfer you to a team member who can assist you further.",
            }
    except Exception as e:
        logger.error(f"transfer_to_human tool error: {e}")
        return {
            "success": True,
            "assignment_id": None,
            "message": "I'll connect you with our team now. Please hold.",
        }
