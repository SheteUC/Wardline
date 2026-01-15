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
            
            # Get all hospitals with their phone numbers
            response = await self.client.get(
                f"{self.base_url}/hospitals",
                params={"includeSettings": "true"}
            )
            
            if response.status_code == 200:
                hospitals = response.json()
                
                # Find hospital with matching phone number
                for hospital in hospitals:
                    phone_numbers = hospital.get("phoneNumbers", [])
                    for pn in phone_numbers:
                        twilio_number = pn.get("twilioPhoneNumber", "")
                        # Strip formatting from stored number too
                        stored_digits = ''.join(filter(str.isdigit, twilio_number))
                        if stored_digits == formatted or stored_digits.endswith(formatted[-10:]):
                            logger.info(f"Found matching hospital: {hospital.get('name')}")
                            return hospital
                
                # If no phone match, return first hospital as default
                if hospitals:
                    logger.warning(f"No phone match found, using first hospital")
                    return hospitals[0]
            
            return None
        except Exception as e:
            logger.error(f"Error fetching hospital: {e}")
            return None
    
    async def get_hospital(self, hospital_id: str) -> Optional[Dict[str, Any]]:
        """Get hospital by ID"""
        try:
            response = await self.client.get(f"{self.base_url}/hospitals/{hospital_id}")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error fetching hospital {hospital_id}: {e}")
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
                return response.json()
            return []
        except Exception as e:
            logger.error(f"Error fetching intents: {e}")
            return []
    
    async def get_departments(self, hospital_id: str) -> List[Dict[str, Any]]:
        """Get all departments for a hospital"""
        try:
            response = await self.client.get(
                f"{self.base_url}/departments",
                params={"hospitalId": hospital_id}
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            logger.error(f"Error fetching departments: {e}")
            return []
    
    async def create_call_session(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new call session"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/calls",
                json=data
            )
            if response.status_code in [200, 201]:
                return response.json()
            logger.warning(f"Failed to create call session: {response.status_code}")
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
            response = await self.client.get(
                f"{self.base_url}/insurance/plans/check",
                params={"hospitalId": hospital_id, "carrierName": carrier_name}
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Error checking insurance: {e}")
            return None


# Singleton instance
api_client = CoreAPIClient()

