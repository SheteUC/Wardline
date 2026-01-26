# Multi-Agent Platform - Next Steps

## ✅ What's Been Implemented

The **complete backend infrastructure** for the multi-agent platform has been implemented, including:

- Database schema with 4 new models (Agent, CallQueue, CallAssignment, AgentSession)
- 21 REST API endpoints for agent and queue management
- Workflow execution engine with 15 node types
- Workflow validator with safety rule enforcement
- Voice orchestrator client for call control
- Medical triage guard with 60+ medical keywords
- WebSocket gateway for real-time updates
- Complete audit logging

See `MULTI_AGENT_IMPLEMENTATION_SUMMARY.md` for full details.

## 🚀 Getting Started

### 1. Install Dependencies

```bash
# Install WebSocket dependencies
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io

# Generate Prisma client
cd packages/db
npx prisma generate
```

### 2. Run Database Migration

```bash
cd packages/db
npx prisma migrate deploy
```

### 3. Set Environment Variables

Add to your `.env` file:

```env
VOICE_ORCHESTRATOR_URL=http://localhost:3002
WEB_URL=http://localhost:3000
```

### 4. Start the Backend

```bash
pnpm --filter @wardline/core-api dev
```

## 📝 Immediate Next Steps

### 1. Test the Backend APIs

Use the following endpoints to test the implementation:

**Create an AI Agent:**
```bash
curl -X POST http://localhost:3001/api/hospitals/{hospitalId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AI",
    "name": "Scheduling Assistant",
    "description": "AI agent specialized in appointment scheduling",
    "aiConfig": {
      "persona": "Friendly scheduling assistant",
      "systemPrompt": "You are a helpful scheduling assistant...",
      "capabilities": ["schedule_appointments", "reschedule_appointments"],
      "escalationRules": []
    }
  }'
```

**Create a Human Agent:**
```bash
curl -X POST http://localhost:3001/api/hospitals/{hospitalId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "HUMAN",
    "name": "Dr. Smith",
    "description": "Clinical staff member",
    "humanProfile": {
      "userId": "{userId}",
      "specialization": ["clinical", "triage"],
      "skills": ["emergency_response", "patient_assessment"],
      "availability": {
        "timezone": "America/New_York",
        "schedule": [
          {"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00"}
        ]
      },
      "maxConcurrentCalls": 3,
      "contactInfo": {"phone": "+1234567890"},
      "notificationPreferences": {"inApp": true, "sms": true, "email": false}
    }
  }'
```

**Create a Queue:**
```bash
curl -X POST http://localhost:3001/api/hospitals/{hospitalId}/queues \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clinical Staff Queue",
    "specialization": "clinical",
    "priority": 1,
    "maxWaitTime": 120
  }'
```

### 2. Integrate with Voice Orchestrator

The voice orchestrator needs to be updated to:

1. **Use the Workflow Execution Engine** when processing calls
2. **Call the VoiceOrchestratorClient endpoints** from the backend
3. **Send medical keyword detections** to the Medical Triage Guard

Example integration in voice orchestrator:

```python
# When processing a call step
response = requests.post(
    f"{CORE_API_URL}/api/workflows/{workflow_id}/execute",
    json={
        "nodeId": current_node_id,
        "callContext": {
            "callId": call.id,
            "hospitalId": call.hospital_id,
            "phoneNumberId": call.phone_number_id,
            "direction": "inbound",
            "transcript": transcript_segments,
            "detectedIntent": detected_intent,
            "extractedFields": extracted_fields,
            "sentiment": sentiment_score,
            "isEmergency": is_emergency
        }
    }
)

# Handle execution result
if response.json()["status"] == "waiting_for_agent":
    # Put call on hold
    await put_on_hold(call.id)
```

### 3. Connect the Frontend

#### Install Socket.IO Client:
```bash
cd apps/web
pnpm add socket.io-client
```

#### Create WebSocket Hook (`apps/web/src/lib/hooks/use-websocket.ts`):
```typescript
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(agentId?: string) {
  const socketRef = useRef<Socket>();

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      auth: { agentId },
    });

    socketRef.current.on('assignment:new', (data) => {
      console.log('New assignment:', data);
      // Show notification
    });

    socketRef.current.on('emergency:alert', (data) => {
      console.log('Emergency alert:', data);
      // Show critical notification
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [agentId]);

  return socketRef.current;
}
```

#### Add API Services (`apps/web/src/lib/api-services.ts`):
```typescript
// Add these to your existing API service

export const agentService = {
  list: (hospitalId: string, filters?: any) =>
    fetch(`/api/hospitals/${hospitalId}/agents?${new URLSearchParams(filters)}`).then(r => r.json()),
  
  create: (hospitalId: string, data: any) =>
    fetch(`/api/hospitals/${hospitalId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  
  updateStatus: (hospitalId: string, agentId: string, status: string) =>
    fetch(`/api/hospitals/${hospitalId}/agents/${agentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
};

export const queueService = {
  list: (hospitalId: string) =>
    fetch(`/api/hospitals/${hospitalId}/queues`).then(r => r.json()),
  
  metrics: (hospitalId: string, queueId: string) =>
    fetch(`/api/hospitals/${hospitalId}/queues/${queueId}/metrics`).then(r => r.json()),
  
  assignments: (hospitalId: string, filters?: any) =>
    fetch(`/api/hospitals/${hospitalId}/assignments?${new URLSearchParams(filters)}`).then(r => r.json()),
};
```

### 4. Create Frontend Pages

#### Agent Management Page (`apps/web/src/app/dashboard/agents/page.tsx`):
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { agentService } from '@/lib/api-services';
import { useHospital } from '@/lib/hospital-context';

export default function AgentsPage() {
  const { hospitalId } = useHospital();
  const { data, isLoading } = useQuery({
    queryKey: ['agents', hospitalId],
    queryFn: () => agentService.list(hospitalId),
  });

  // Render agent list with status indicators
  // Add create/edit agent forms
  // Show performance metrics
}
```

#### Queue Dashboard (`apps/web/src/app/dashboard/queues/page.tsx`):
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { queueService } from '@/lib/api-services';
import { useHospital } from '@/lib/hospital-context';

export default function QueuesPage() {
  const { hospitalId } = useHospital();
  const { data: queues } = useQuery({
    queryKey: ['queues', hospitalId],
    queryFn: () => queueService.list(hospitalId),
  });

  // Render queue cards with real-time metrics
  // Show waiting calls
  // Add manual assignment interface
}
```

#### Agent Dashboard (`apps/web/src/app/agent/dashboard/page.tsx`):
```typescript
'use client';

import { useWebSocket } from '@/lib/hooks/use-websocket';
import { useState } from 'react';

export default function AgentDashboard() {
  const [status, setStatus] = useState('ONLINE');
  const socket = useWebSocket(currentAgentId);

  const handleStatusChange = (newStatus: string) => {
    socket?.emit('agent:status', { agentId: currentAgentId, status: newStatus });
    setStatus(newStatus);
  };

  // Render status toggle
  // Show incoming assignments
  // Display active call context
}
```

### 5. Update Workflow Editor

Add new node types to the workflow editor in `apps/web/src/app/dashboard/workflows/page.tsx`:

```typescript
const EXTENDED_NODE_TYPES = {
  // Existing types...
  'ai-agent': AIAgentNode,
  'human-agent-queue': HumanAgentQueueNode,
  'safety-check': SafetyCheckNode,
  'conditional': ConditionalNode,
};

// Custom node components handle node-specific configuration
```

## 🎯 Key Features to Demonstrate

### 1. Create a Complete Workflow

1. Go to Workflows page
2. Add a "Safety Check" node after emergency screening
3. Add a "Human Agent Queue" node for clinical escalation
4. Configure the queue to route to "clinical" specialization
5. Save and publish the workflow

### 2. Test Medical Keyword Detection

1. Create a test call with medical keywords
2. Observe automatic routing to clinical queue
3. Check audit logs for safety events

### 3. Manage Agents

1. Create AI and human agents
2. Set human agent availability schedules
3. Monitor agent status in real-time
4. View performance metrics

### 4. Monitor Queues

1. View queue depth and wait times
2. See SLA compliance
3. Manually assign calls if needed

## 📚 Architecture Reference

### Multi-Agent Call Flow

```
Incoming Call
    ↓
[Workflow Engine Evaluates]
    ↓
Safety Check Node → Medical Keywords Detected?
    ├─ YES → Force Route to Clinical Queue
    │         ↓
    │    Find Available Clinical Staff
    │         ↓
    │    Assign Call + Notify Agent (WebSocket)
    │         ↓
    │    Agent Accepts → Transfer Call
    │
    └─ NO → Continue to AI Agent Node
              ↓
         AI Handles Call
              ↓
         Check Escalation Rules
              ↓
         [Escalation Needed?]
              ├─ YES → Route to Appropriate Queue
              └─ NO → Complete Call
```

### Safety Architecture

```
Every Transcript Segment
    ↓
Medical Triage Guard Analysis
    ↓
[Medical Keywords Detected?]
    ├─ YES → Log Safety Event
    │         ↓
    │    Update Call Tag to CLINICAL_ESCALATION
    │         ↓
    │    Enforce Human Escalation
    │         ↓
    │    Alert Supervisors (if emergency)
    │
    └─ NO → Continue Normal Processing
```

## 🔒 Security Checklist

- [ ] Add authentication to WebSocket connections
- [ ] Implement rate limiting on API endpoints
- [ ] Encrypt sensitive fields in database (aiConfig, humanProfile)
- [ ] Set up RBAC permissions for agent management
- [ ] Enable audit logging for all PHI access
- [ ] Configure CORS properly for WebSocket
- [ ] Add input validation to all endpoints

## 📊 Monitoring Recommendations

### Key Metrics to Track

1. **Agent Metrics**:
   - Online/offline status
   - Average handle time
   - Calls handled per session
   - Utilization rate

2. **Queue Metrics**:
   - Queue depth
   - Average wait time
   - SLA compliance %
   - Abandonment rate

3. **Safety Metrics**:
   - Medical keyword detections
   - Escalations triggered
   - Time to clinical staff
   - Emergency alert response time

4. **System Metrics**:
   - WebSocket connection count
   - API response times
   - Workflow execution time
   - Database query performance

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Check CORS configuration
- Verify WEB_URL environment variable
- Ensure WebSocketModule is imported in app.module.ts

**Agent Not Receiving Assignments**
- Check agent status is ACTIVE
- Verify agent has an ONLINE session
- Check specialization matches queue
- Ensure maxConcurrentCalls not exceeded

**Medical Keyword Not Escalating**
- Check keyword is in MEDICAL_KEYWORDS array
- Verify workflow has safety-check node
- Ensure safety-check routes to clinical queue
- Check audit logs for safety events

**Workflow Validation Failing**
- Review validation errors in response
- Ensure all medical paths lead to clinical staff
- Check for cycles in graph
- Verify all nodes have proper connections

## 📖 Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **NestJS WebSockets**: https://docs.nestjs.com/websockets/gateways
- **Socket.IO**: https://socket.io/docs/v4/
- **ReactFlow**: https://reactflow.dev/

## 🎉 Success Criteria

The implementation is successful when:

- ✅ Agents can be created and managed via API
- ✅ Calls can be assigned to queues automatically
- ✅ Human agents receive real-time notifications
- ✅ Medical keywords trigger escalation
- ✅ Workflows validate safety rules
- ✅ Audit logs capture all decisions
- ✅ WebSocket updates work in real-time

---

**Need Help?** Review the implementation summary in `MULTI_AGENT_IMPLEMENTATION_SUMMARY.md`
