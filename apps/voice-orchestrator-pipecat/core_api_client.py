"""
Client for communicating with the Wardline Core API
"""
import httpx
from typing import Optional, Dict, Any, List
from loguru import logger
from config import settings


class CoreAPIClient:
    """Client for Wardline Core API"""
    
    def __init__(self):
        self.base_url = settings.core_api_url
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    async def get_hospital_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        """Get hospital info by phone number"""
        try:
            # Strip formatting to get just digits
            formatted = ''.join(filter(str.isdigit, phone_number))
            logger.debug(f"Looking up hospital for phone: {formatted}")
            
            # Endpoint is /hospitals (no /api prefix)
            response = await self.client.get(
                f"{self.base_url}/hospitals",
                params={"includePhoneNumbers": "true"}
            )
            
            if response.status_code == 200:
                result = response.json()
                # Handle both array and paginated response
                hospitals = result if isinstance(result, list) else result.get("data", [])
                
                logger.debug(f"Found {len(hospitals)} hospitals")
                
                # Find hospital with matching phone number
                for hospital in hospitals:
                    phone_numbers = hospital.get("phoneNumbers", [])
                    logger.debug(f"Hospital {hospital.get('name')} has {len(phone_numbers)} phone numbers")
                    for pn in phone_numbers:
                        twilio_number = pn.get("twilioPhoneNumber", "")
                        # Strip formatting from stored number too
                        stored_digits = ''.join(filter(str.isdigit, twilio_number))
                        logger.debug(f"Comparing {stored_digits} with {formatted}")
                        if stored_digits == formatted or stored_digits.endswith(formatted[-10:]):
                            logger.info(f"✅ Found matching hospital: {hospital.get('name')}")
                            return hospital
                
                # If no phone match, return first hospital as default for testing
                if hospitals:
                    logger.warning(f"No phone match found, using first hospital: {hospitals[0].get('name')}")
                    return hospitals[0]
            else:
                logger.warning(f"API returned status {response.status_code}: {response.text}")
            
            return None
        except httpx.ConnectError as e:
            logger.error(f"Cannot connect to Core API at {self.base_url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching hospital: {e}")
            return None
    
    async def get_hospital(self, hospital_id: str) -> Optional[Dict[str, Any]]:
        """Get hospital by ID"""
        try:
            response = await self.client.get(
                f"{self.base_url}/hospitals/{hospital_id}",
                params={"includeRelations": "true"}
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error fetching hospital {hospital_id}: {e}")
            return None

    async def get_business_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        """Get business info by phone number."""
        try:
            formatted = ''.join(filter(str.isdigit, phone_number))
            response = await self.client.get(
                f"{self.base_url}/businesses/by-phone",
                params={"phoneNumber": formatted},
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error fetching business by phone: {e}")
            return None

    async def get_business(self, business_id: str) -> Optional[Dict[str, Any]]:
        """Get business by ID."""
        try:
            response = await self.client.get(
                f"{self.base_url}/businesses/{business_id}",
                params={"includeRelations": "true"},
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error fetching business {business_id}: {e}")
            return None

    async def get_business_config(self, business_id: str) -> Optional[Dict[str, Any]]:
        """Get business settings only."""
        try:
            business = await self.get_business(business_id)
            if business:
                return business.get("settings")
            return None
        except Exception as e:
            logger.error(f"Error fetching business config: {e}")
            return None
    
    async def get_workflow(self, hospital_id: str, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow configuration"""
        try:
            response = await self.client.get(
                f"{self.base_url}/hospitals/{hospital_id}/workflows/{workflow_id}"
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error fetching workflow: {e}")
            return None
    
    async def get_intents(self, hospital_id: str) -> List[Dict[str, Any]]:
        """Get all intents for a hospital"""
        try:
            response = await self.client.get(
                f"{self.base_url}/hospitals/{hospital_id}/intents"
            )
            if response.status_code == 200:
                result = response.json()
                return result if isinstance(result, list) else result.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Error fetching intents: {e}")
            return []
    
    async def get_departments(self, hospital_id: str) -> List[Dict[str, Any]]:
        """Get all departments for a hospital"""
        try:
            # Departments are at /departments with hospitalId query param
            response = await self.client.get(
                f"{self.base_url}/departments",
                params={"hospitalId": hospital_id}
            )
            if response.status_code == 200:
                result = response.json()
                return result if isinstance(result, list) else result.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Error fetching departments: {e}")
            return []
    
    async def get_call_by_twilio_sid(self, twilio_call_sid: str) -> Optional[Dict[str, Any]]:
        """Get an existing call session by Twilio call SID"""
        try:
            response = await self.client.get(
                f"{self.base_url}/api/calls",
                params={"twilioCallSid": twilio_call_sid}
            )
            if response.status_code == 200:
                result = response.json()
                # Handle both array and paginated response
                calls = result if isinstance(result, list) else result.get("data", [])
                if calls:
                    return calls[0]  # Return first match
            return None
        except Exception as e:
            logger.error(f"Error fetching call by SID: {e}")
            return None
    
    async def create_call_session(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new call session"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/calls",
                json=data
            )
            if response.status_code in [200, 201]:
                return response.json()
            logger.warning(f"Failed to create call session: {response.status_code}: {response.text}")
            return None
        except Exception as e:
            logger.error(f"Error creating call session: {e}")
            return None
    
    async def update_call_session(
        self, 
        call_id: str, 
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a call session"""
        try:
            response = await self.client.patch(
                f"{self.base_url}/api/calls/{call_id}",
                json=data
            )
            if response.status_code == 200:
                return response.json()
            logger.warning(f"Failed to update call session: {response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error updating call session: {e}")
            return None
    
    async def check_insurance_plan(
        self, 
        hospital_id: str, 
        carrier_name: str
    ) -> Optional[Dict[str, Any]]:
        """Check if an insurance plan is accepted"""
        try:
            # Use the dedicated check endpoint
            response = await self.client.get(
                f"{self.base_url}/insurance/plans/check",
                params={"hospitalId": hospital_id, "carrierName": carrier_name}
            )
            
            if response.status_code == 200:
                return response.json()
            
            # Fallback: search plans list
            response = await self.client.get(
                f"{self.base_url}/insurance/plans",
                params={"hospitalId": hospital_id, "search": carrier_name}
            )
            
            if response.status_code == 200:
                result = response.json()
                plans = result if isinstance(result, list) else result.get("data", [])
                
                # Find a matching plan
                carrier_lower = carrier_name.lower()
                for plan in plans:
                    plan_carrier = plan.get("carrierName", "").lower()
                    if carrier_lower in plan_carrier or plan_carrier in carrier_lower:
                        return {
                            "isAccepted": plan.get("isAccepted", False),
                            "planName": plan.get("planName"),
                            "planType": plan.get("planType"),
                            "carrierName": plan.get("carrierName"),
                        }
                
                # No matching plan found
                return {"isAccepted": False, "carrierName": carrier_name}
            
            return None
        except Exception as e:
            logger.error(f"Error checking insurance: {e}")
            return None
    
    async def create_appointment(
        self,
        hospital_id: str,
        patient_name: str,
        patient_phone: str,
        service_type: str,
        preferred_date: str = "",
        call_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a new appointment request via the scheduling API."""
        try:
            payload: Dict[str, Any] = {
                "hospitalId": hospital_id,
                "patientName": patient_name,
                "patientPhone": patient_phone,
                "serviceType": service_type,
                "provider": "manual",
                "scheduledAt": preferred_date or "TBD",
                "duration": 30,
                "status": "SCHEDULED",
            }
            if call_id:
                payload["callId"] = call_id

            response = await self.client.post(
                f"{self.base_url}/hospitals/{hospital_id}/appointments",
                json=payload,
            )
            if response.status_code in [200, 201]:
                return response.json()
            logger.warning(f"create_appointment failed: {response.status_code}: {response.text}")
            return None
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            return None

    async def create_prescription_refill(
        self,
        hospital_id: str,
        patient_name: str,
        patient_phone: str,
        medication_name: str,
        pharmacy_name: str = "",
        pharmacy_phone: str = "",
        call_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Submit a prescription refill request via the prescriptions API."""
        try:
            payload: Dict[str, Any] = {
                "hospitalId": hospital_id,
                "patientName": patient_name,
                "patientPhone": patient_phone,
                "medicationName": medication_name,
                "status": "PENDING",
            }
            if pharmacy_name:
                payload["pharmacyName"] = pharmacy_name
            if pharmacy_phone:
                payload["pharmacyPhone"] = pharmacy_phone
            if call_id:
                payload["callId"] = call_id

            response = await self.client.post(
                f"{self.base_url}/hospitals/{hospital_id}/prescriptions",
                json=payload,
            )
            if response.status_code in [200, 201]:
                return response.json()
            logger.warning(f"create_prescription_refill failed: {response.status_code}: {response.text}")
            return None
        except Exception as e:
            logger.error(f"Error creating prescription refill: {e}")
            return None

    # ========================================================================
    # Workflow Management APIs (Phase 1)
    # ========================================================================
    
    async def get_active_workflow(
        self, 
        hospital_id: str, 
        phone_number_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the active workflow configuration for a hospital
        
        Args:
            hospital_id: Hospital identifier
            phone_number_id: Optional phone number to get specific workflow
            
        Returns:
            Workflow configuration with graph JSON
        """
        try:
            # Try to get workflow by phone number first
            if phone_number_id:
                response = await self.client.get(
                    f"{self.base_url}/workflows/active",
                    params={"businessId": hospital_id, "phoneNumberId": phone_number_id}
                )
                
                if response.status_code == 200:
                    return response.json()
            
            # Fallback to hospital's default active workflow
            response = await self.client.get(
                f"{self.base_url}/workflows/active",
                params={"businessId": hospital_id}
            )
            
            if response.status_code == 200:
                return response.json()
            
            logger.warning(f"No active workflow found for hospital {hospital_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching active workflow: {e}")
            return None
    
    async def get_hospital_config(self, hospital_id: str) -> Optional[Dict[str, Any]]:
        """
        Get hospital-specific configuration
        
        Returns configuration including:
        - Enabled modules (billing, insurance, appointments, etc.)
        - Custom prompts and greetings
        - Escalation rules
        - Integration endpoints
        """
        try:
            response = await self.client.get(
                f"{self.base_url}/hospitals/{hospital_id}/config"
            )
            
            if response.status_code == 200:
                return response.json()
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching hospital config: {e}")
            return None
    
    # ========================================================================
    # Escalation & Queue Management APIs
    # ========================================================================
    
    async def create_escalation(self, context_package: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create an escalation request to human queue
        
        Args:
            context_package: Complete escalation context including:
                - call_id, hospital_id, queue_id
                - caller info, transcript, sentiment
                - collected fields, workflow path
        
        Returns:
            Created escalation record with ID
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/escalations",
                json=context_package
            )
            
            if response.status_code in [200, 201]:
                logger.info("Escalation created successfully")
                return response.json()
            else:
                logger.warning(f"Failed to create escalation: {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating escalation: {e}")
            return None
    
    async def get_available_agents(
        self, 
        hospital_id: str, 
        queue_id: str,
        required_skills: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get available human agents for a queue
        
        Args:
            hospital_id: Hospital identifier
            queue_id: Queue identifier
            required_skills: Optional list of required skills
            
        Returns:
            List of available agents
        """
        try:
            params = {
                "hospitalId": hospital_id,
                "queueId": queue_id,
                "status": "available"
            }
            
            if required_skills:
                params["skills"] = ",".join(required_skills)
            
            response = await self.client.get(
                f"{self.base_url}/agents/available",
                params=params
            )
            
            if response.status_code == 200:
                result = response.json()
                return result if isinstance(result, list) else result.get("data", [])
            
            return []
            
        except Exception as e:
            logger.error(f"Error fetching available agents: {e}")
            return []
    
    # ========================================================================
    # Progress Reporting & Analytics
    # ========================================================================
    
    async def update_call_workflow_progress(
        self, 
        call_id: str, 
        progress_data: Dict[str, Any]
    ) -> bool:
        """
        Update workflow execution progress for a call
        
        Args:
            call_id: Call identifier
            progress_data: Progress information including:
                - workflow_execution: execution state
                - current_state: call state
                - sentiment: sentiment data
        
        Returns:
            True if update successful
        """
        try:
            response = await self.client.patch(
                f"{self.base_url}/api/calls/{call_id}/progress",
                json=progress_data
            )
            
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Error updating workflow progress: {e}")
            return False
    
    async def create_safety_event(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a safety event record
        
        Args:
            event_data: Safety event information including:
                - call_id, hospital_id
                - keyword, category, severity
                - context, action_taken
        
        Returns:
            Created safety event record
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/safety/events",
                json=event_data
            )
            
            if response.status_code in [200, 201]:
                return response.json()
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating safety event: {e}")
            return None
    
    async def create_workflow_execution_log(
        self, 
        log_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Create a workflow execution log for audit trail
        
        Args:
            log_data: Execution log including:
                - call_id, workflow_id, hospital_id
                - execution_path, node_data
                - started_at, ended_at, outcome
        
        Returns:
            Created log record
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/workflows/executions",
                json=log_data
            )
            
            if response.status_code in [200, 201]:
                return response.json()
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating execution log: {e}")
            return None


# Singleton instance
api_client = CoreAPIClient()

