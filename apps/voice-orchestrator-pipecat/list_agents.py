"""
List all agents in Azure AI Foundry project
"""
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

ENDPOINT = "https://perplxserper-resource.services.ai.azure.com/api/projects/perplxserper"

print(f"Listing agents in project: {ENDPOINT}\n")

try:
    project_client = AIProjectClient(
        endpoint=ENDPOINT,
        credential=DefaultAzureCredential(),
    )
    
    # List all agents
    agents = project_client.agents.list()
    
    print("Available agents:")
    print("=" * 60)
    for agent in agents:
        print(f"Name: {agent.name}")
        print(f"ID: {agent.id}")
        print(f"Model: {getattr(agent, 'model', 'N/A')}")
        print("-" * 60)
    
except Exception as e:
    print(f"Error: {e}")
    print("\nNote: If the agent doesn't exist, you may need to create it first in Azure AI Foundry portal:")
    print("https://ai.azure.com/")
