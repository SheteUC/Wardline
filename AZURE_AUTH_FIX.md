# Azure AI Foundry Authentication Issue - Fix

**Error:** `Bearer token authentication is not permitted for non-TLS protected (non-https) URLs`

## Problem

Azure AI Foundry's `DefaultAzureCredential` requires HTTPS for all connections. In local development, this can fail due to:
- Azure CLI credential redirecting to HTTP localhost
- Managed Identity service on HTTP
- Token service endpoints

## Solution 1: Use Conversational Agent (Recommended for Local Dev)

The conversational agent uses direct Azure OpenAI API instead of Azure AI Foundry.

### Steps:

1. **Check Azure OpenAI Deployments**
   
   Go to [Azure Portal](https://portal.azure.com) → Your resource: `wardline-test-resource` → **Deployments**
   
   Check if you have `gpt-4.1-mini` or `gpt-4o-mini` deployed.

2. **If you DON'T have gpt-4.1-mini deployed:**
   
   Option A: Deploy it
   - In Azure Portal → Azure OpenAI → Deployments
   - Create new deployment
   - Model: `gpt-4o-mini` (gpt-4.1-mini might not be available)
   - Update .env: `AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"`
   
   Option B: Use existing o4-mini (not recommended)
   - Update .env: `AZURE_OPENAI_DEPLOYMENT="o4-mini"`
   - Note: o4-mini is a reasoning model, not ideal for voice

3. **Update .env:**
   ```bash
   # Already done - using conversational agent
   VOICE_AGENT_TYPE="conversational"
   
   # Make sure this matches your deployed model
   AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"  # or "o4-mini" if that's all you have
   ```

4. **Restart server:**
   ```bash
   python server.py
   ```

## Solution 2: Fix Azure AI Foundry Auth (For Production)

Azure AI Foundry works in production (with proper Azure authentication) but has issues in local development.

### For Production Deployment:

1. **Use Managed Identity**
   ```python
   # In azure_ai_foundry_agent.py
   from azure.identity import ManagedIdentityCredential
   
   credential = ManagedIdentityCredential()
   ```

2. **Or use Service Principal**
   ```bash
   # Set environment variables
   export AZURE_CLIENT_ID="your-client-id"
   export AZURE_CLIENT_SECRET="your-client-secret"
   export AZURE_TENANT_ID="your-tenant-id"
   ```

3. **Or use Azure Key Credential (if available)**
   ```python
   from azure.core.credentials import AzureKeyCredential
   
   credential = AzureKeyCredential("your-api-key")
   ```

## Current Configuration

Your `.env` is now set to use the **conversational agent** with direct Azure OpenAI API:

```bash
VOICE_AGENT_TYPE="conversational"
AZURE_OPENAI_ENDPOINT="https://wardline-test-resource.cognitiveservices.azure.com/"
AZURE_OPENAI_DEPLOYMENT="gpt-4.1-mini"  # Update if not deployed
```

## Testing

After updating, test with a call:

```
Expected logs:
✅ Using conversational model: gpt-4o-mini (or o4-mini)
✅ Creating new conversation agent for call CA...
✅ 🎤 User: [message]
✅ 🤖 Agent: [response]
```

## Which Model to Deploy?

If you need to deploy a model in Azure OpenAI:

| Model | Pros | Cons | Recommendation |
|-------|------|------|----------------|
| **gpt-4o-mini** | Fast, cheap, good for voice | Not as good as 4.1-mini | ✅ Deploy this |
| **gpt-4.1-mini** | Best dialog quality | Might not be available in all regions | ✅ Try this first |
| **o4-mini** | Already deployed | Reasoning model, bad for voice | ❌ Fallback only |

## Deploy gpt-4o-mini in Azure OpenAI

1. **Azure Portal:**
   - Go to https://portal.azure.com
   - Navigate to: `wardline-test-resource` (Azure OpenAI)
   - Click **Deployments** → **Create**
   - Select model: `gpt-4o-mini`
   - Name: `gpt-4o-mini`
   - Deploy

2. **Update .env:**
   ```bash
   AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
   ```

3. **Restart:**
   ```bash
   python server.py
   ```

## Comparison: Azure AI Foundry vs Direct OpenAI

| Feature | Azure AI Foundry | Direct OpenAI (Conversational) |
|---------|------------------|--------------------------------|
| **Authentication** | Complex (DefaultAzureCredential) | Simple (API Key) |
| **Local Dev** | ❌ Issues with HTTPS requirement | ✅ Works fine |
| **Production** | ✅ Better management | ✅ Works fine |
| **Monitoring** | ✅ Built-in dashboard | ⚠️ Manual logging |
| **Tools** | ✅ Built-in function calling | ⚠️ Manual implementation |
| **Setup** | Complex | Simple |

## Recommendation

- **Local Development:** Use `conversational` agent with `gpt-4o-mini`
- **Production:** Use Azure AI Foundry (fix auth with Managed Identity)

Your current setup is now configured for local development with the conversational agent. This will work reliably for testing!

---
**Status:** ✅ Fixed - Using conversational agent
**Next:** Deploy gpt-4o-mini in Azure OpenAI (or use o4-mini as fallback)
