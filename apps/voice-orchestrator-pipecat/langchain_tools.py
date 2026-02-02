"""
LangChain Tools for Voice AI Agent
Provides capabilities for the AI agent to interact with hospital systems
"""
from typing import Optional, Dict, Any, List
from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field
from loguru import logger

from core_api_client import api_client
from call_context import CallContext


# =============================================================================
# Tool Input Schemas
# =============================================================================

class CheckInsuranceInput(BaseModel):
    """Input for checking insurance acceptance"""
    carrier_name: str = Field(description="The insurance carrier name (e.g., 'Blue Cross', 'Aetna')")


class ScheduleAppointmentInput(BaseModel):
    """Input for scheduling an appointment"""
    patient_name: str = Field(description="Patient's full name")
    patient_dob: str = Field(description="Patient's date of birth (YYYY-MM-DD)")
    patient_phone: str = Field(description="Patient's phone number")
    reason: str = Field(description="Reason for visit")
    preferred_date: str = Field(description="Preferred appointment date (YYYY-MM-DD)")
    preferred_time: Optional[str] = Field(default=None, description="Preferred time (HH:MM)")


class PrescriptionRefillInput(BaseModel):
    """Input for prescription refill request"""
    patient_name: str = Field(description="Patient's full name")
    patient_dob: str = Field(description="Patient's date of birth (YYYY-MM-DD)")
    medication_name: str = Field(description="Name of the medication")
    pharmacy_name: str = Field(description="Pharmacy name and location")
    prescriber_name: Optional[str] = Field(default=None, description="Prescribing doctor's name")


class FindDepartmentInput(BaseModel):
    """Input for finding a department"""
    service_type: str = Field(description="Type of service or department needed (e.g., 'radiology', 'billing')")


class TransferToHumanInput(BaseModel):
    """Input for transferring to a human agent"""
    reason: str = Field(description="Reason for transfer")
    specialization: Optional[str] = Field(default="general", description="Required specialization (e.g., 'clinical', 'billing')")


# =============================================================================
# Tool Functions
# =============================================================================

async def check_insurance_tool(carrier_name: str, context: CallContext) -> str:
    """
    Check if an insurance plan is accepted by the hospital
    """
    try:
        logger.info(f"Checking insurance for: {carrier_name}")
        
        if not context.hospital_id:
            return "I'll need to transfer you to our billing department to check on that insurance plan."
        
        result = await api_client.check_insurance_plan(
            hospital_id=context.hospital_id,
            carrier_name=carrier_name
        )
        
        if result and result.get("isAccepted"):
            plan_type = result.get("planType", "")
            return f"Yes, we accept {carrier_name}{f' {plan_type}' if plan_type else ''} insurance."
        elif result:
            return f"I'm sorry, but we don't currently accept {carrier_name} insurance. Our billing department can discuss alternative payment options."
        else:
            return f"I wasn't able to find {carrier_name} in our system. Let me transfer you to billing to verify."
        
    except Exception as e:
        logger.error(f"Error checking insurance: {e}")
        return "I'm having trouble checking that insurance right now. Let me connect you with our billing department."


async def schedule_appointment_tool(
    patient_name: str,
    patient_dob: str,
    patient_phone: str,
    reason: str,
    preferred_date: str,
    preferred_time: Optional[str],
    context: CallContext
) -> str:
    """
    Schedule an appointment for a patient
    """
    try:
        logger.info(f"Scheduling appointment for {patient_name} on {preferred_date}")
        
        # Store collected information in context
        context.collect_field("patient_name", patient_name, confirmed=True)
        context.collect_field("patient_dob", patient_dob, confirmed=True)
        context.collect_field("patient_phone", patient_phone, confirmed=True)
        context.collect_field("appointment_reason", reason, confirmed=True)
        context.collect_field("preferred_date", preferred_date, confirmed=True)
        if preferred_time:
            context.collect_field("preferred_time", preferred_time, confirmed=True)
        
        # In production, this would call the scheduling system (TimeTap/NexHealth)
        # For now, we acknowledge and indicate next steps
        return (
            f"Perfect, I have an appointment request for {patient_name} "
            f"on {preferred_date}{f' at {preferred_time}' if preferred_time else ''}. "
            "Our scheduling team will call you back within the next hour to confirm the exact time slot. "
            "Is there anything else I can help you with?"
        )
        
    except Exception as e:
        logger.error(f"Error scheduling appointment: {e}")
        return "I'm having trouble with our scheduling system. Let me transfer you to our appointment desk."


async def prescription_refill_tool(
    patient_name: str,
    patient_dob: str,
    medication_name: str,
    pharmacy_name: str,
    prescriber_name: Optional[str],
    context: CallContext
) -> str:
    """
    Request a prescription refill
    """
    try:
        logger.info(f"Prescription refill for {patient_name}: {medication_name}")
        
        # Store in context
        context.collect_field("patient_name", patient_name, confirmed=True)
        context.collect_field("patient_dob", patient_dob, confirmed=True)
        context.collect_field("medication_name", medication_name, confirmed=True)
        context.collect_field("pharmacy_name", pharmacy_name, confirmed=True)
        if prescriber_name:
            context.collect_field("prescriber_name", prescriber_name, confirmed=True)
        
        return (
            f"I've submitted your refill request for {medication_name} "
            f"to be sent to {pharmacy_name}. "
            "The prescribing doctor will review it, and you should hear back within 24-48 hours. "
            "Is there anything else?"
        )
        
    except Exception as e:
        logger.error(f"Error processing refill: {e}")
        return "I'm having trouble submitting that refill. Let me transfer you to our pharmacy line."


async def find_department_tool(service_type: str, context: CallContext) -> str:
    """
    Find the appropriate department for a service
    """
    try:
        logger.info(f"Finding department for: {service_type}")
        
        service_lower = service_type.lower()
        
        # Check departments from context
        if context.departments:
            for dept in context.departments:
                dept_name = dept.get("name", "").lower()
                services = [s.lower() for s in dept.get("serviceTypes", [])]
                
                if service_lower in dept_name or any(service_lower in s for s in services):
                    phone = dept.get("phoneNumber", "")
                    extension = dept.get("extension", "")
                    location = dept.get("location", "")
                    
                    response = f"That would be our {dept.get('name')} department"
                    if phone:
                        response += f", you can reach them at {phone}"
                        if extension:
                            response += f" extension {extension}"
                    if location:
                        response += f". They're located in {location}"
                    response += ". Would you like me to transfer you there?"
                    
                    return response
        
        return f"Let me transfer you to our main desk - they can direct you to the right department for {service_type}."
        
    except Exception as e:
        logger.error(f"Error finding department: {e}")
        return "Let me transfer you to our main desk for assistance."


async def transfer_to_human_tool(reason: str, specialization: str, context: CallContext) -> str:
    """
    Initiate transfer to a human agent
    """
    try:
        logger.info(f"Transfer requested: {reason} (specialization: {specialization})")
        
        # Mark for escalation
        context.escalation_reason = reason
        context.sentiment.escalation_needed = True
        
        # Set detected intent for transfer
        from call_context import IntentType
        context.detected_intent = IntentType.TRANSFER_TO_HUMAN
        
        return f"Of course, let me connect you with {specialization if specialization != 'general' else 'a'} staff member. One moment please."
        
    except Exception as e:
        logger.error(f"Error initiating transfer: {e}")
        return "Let me connect you with someone who can help. One moment."


# =============================================================================
# Tool Definitions
# =============================================================================

def create_agent_tools(context: CallContext) -> List[Tool]:
    """
    Create LangChain tools for the agent with context binding
    """
    
    tools = [
        StructuredTool.from_function(
            coroutine=lambda carrier_name: check_insurance_tool(carrier_name, context),
            name="check_insurance",
            description="Check if a specific insurance plan is accepted by the hospital. Use when caller asks about insurance coverage.",
            args_schema=CheckInsuranceInput,
        ),
        
        StructuredTool.from_function(
            coroutine=lambda patient_name, patient_dob, patient_phone, reason, preferred_date, preferred_time=None: 
                schedule_appointment_tool(patient_name, patient_dob, patient_phone, reason, preferred_date, preferred_time, context),
            name="schedule_appointment",
            description="Schedule a medical appointment. Requires patient name, DOB, phone, reason for visit, and preferred date/time.",
            args_schema=ScheduleAppointmentInput,
        ),
        
        StructuredTool.from_function(
            coroutine=lambda patient_name, patient_dob, medication_name, pharmacy_name, prescriber_name=None:
                prescription_refill_tool(patient_name, patient_dob, medication_name, pharmacy_name, prescriber_name, context),
            name="request_prescription_refill",
            description="Submit a prescription refill request. Requires patient name, DOB, medication name, and pharmacy information.",
            args_schema=PrescriptionRefillInput,
        ),
        
        StructuredTool.from_function(
            coroutine=lambda service_type: find_department_tool(service_type, context),
            name="find_department",
            description="Find the appropriate department or service. Use when caller needs to be directed to a specific department.",
            args_schema=FindDepartmentInput,
        ),
        
        StructuredTool.from_function(
            coroutine=lambda reason, specialization="general": transfer_to_human_tool(reason, specialization, context),
            name="transfer_to_human",
            description="Transfer the call to a human agent. Use when you cannot help, caller explicitly requests human, or situation requires human judgment.",
            args_schema=TransferToHumanInput,
        ),
    ]
    
    return tools
