"""
Test script for Azure AI Foundry Agent
Run this to verify the agent is properly configured and accessible.

Prerequisites:
1. Run `az login` first
2. Set the correct subscription: `az account set --subscription "ea0fa670-be7b-4f09-9c73-934540bd1b20"`
"""

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from config import settings

# Configuration from settings
ENDPOINT = settings.azure_ai_project_endpoint
AGENT_NAME = settings.azure_ai_agent_name


def test_agent():
    print(f"[INFO] Testing Azure AI Foundry agent: {AGENT_NAME}")
    print(f"[INFO] Endpoint: {ENDPOINT}")
    
    try:
        # Create project client
        print("\n1. Creating AIProjectClient...")
        project_client = AIProjectClient(
            endpoint=ENDPOINT,
            credential=DefaultAzureCredential(),
        )
        print("   [OK] AIProjectClient created")
        
        # Get the agent
        print(f"\n2. Retrieving agent '{AGENT_NAME}'...")
        agent = project_client.agents.get(agent_name=AGENT_NAME)
        print(f"   [OK] Retrieved agent: {agent.name}")
        
        # Get OpenAI client
        print("\n3. Getting OpenAI client...")
        openai_client = project_client.get_openai_client()
        print("   [OK] OpenAI client initialized")
        
        # Test a simple query
        print("\n4. Testing agent response...")
        response = openai_client.responses.create(
            input=[{"role": "user", "content": "Tell me what you can help with."}],
            extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
        )
        print(f"   [OK] Response received:")
        print(f"   Response: {response.output_text}")
        
        print("\n" + "="*50)
        print("[SUCCESS] All tests passed! Agent is ready to use.")
        print("="*50)
        
    except Exception as e:
        print(f"\n[ERROR] {e}")
        print("\nTroubleshooting:")
        print("1. Run 'az login' to authenticate")
        print("2. Run 'az account set --subscription \"ea0fa670-be7b-4f09-9c73-934540bd1b20\"'")
        print("3. Verify agent name in Azure AI Foundry portal")
        raise


if __name__ == "__main__":
    test_agent()
