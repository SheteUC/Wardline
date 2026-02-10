# Wardline User Guide & System Manual

Welcome to the Wardline documentation. Wardline is an enterprise-grade, HIPAA-compliant multi-agent voice AI platform designed specifically for healthcare call centers. This guide provides instructions for administrators, clinical agents, and technical staff on how to interact with the system.

## Table of Contents

* Introduction
* Getting Started
* Administrator Guide
* Clinical Agent Guide
* Workflow Automation
* Medical Safety & Compliance
* Frequently Asked Questions (FAQ)

---

## 1. Introduction

Wardline revolutionizes hospital call triage by blending ultra-low latency voice AI with human orchestration. The platform ensures that patients receive immediate assistance from AI agents for administrative tasks, while critical or complex medical concerns are instantly routed to the appropriate clinical staff.

### Core Philosophy

* **AI-First Triage**: Handle 24/7 high-volume inquiries (scheduling, refills) without human intervention.
* **Hybrid Orchestration**: Seamlessly transfer calls between AI and humans based on sentiment or medical necessity.
* **Safety Guaranteed**: Real-time monitoring for emergency keywords to protect patients and the institution.

---

## 2. Getting Started

### Accessing the Platform

Wardline is a web-based dashboard accessible via your institution's specific URL (e.g., `https://wardline.yourhospital.org`).

* **Authentication**: Sign in using your hospital credentials. Wardline uses Clerk for secure, role-based access control (RBAC).
* **Role Assignment**: Your dashboard view will automatically adjust based on whether you are an Administrator or a Clinical Agent.
* **Connectivity**: Ensure you have a stable internet connection and, if you are a clinical agent, a headset for handling escalated voice calls.

---

## 3. Administrator Guide

As an administrator, you manage the "brains" of the operation: the agents, the queues, and the logic.

### Agent Management

Navigate to the **Agent Management** tab to configure your workforce:

* **AI Agents**: Create agents with specific personas (e.g., a *Friendly Pharmacy Assistant*). Define their system prompt to control tone, behavior, and tool access (e.g., insurance checks, department lookup).
* **Human Agents**: Onboard clinical staff and assign them to specific specializations (e.g., Pediatrics, Billing, Emergency).

### Queue Management

Queues determine how calls are prioritized when they require human attention.

**Assignment Strategies**:

* **Skill-Based**: Routes to the agent best qualified for the patient's issue.
* **Round-Robin**: Distributes calls equally among available staff.
* **Least-Busy**: Routes to the agent with the lowest total call volume.
* **Priority**: Ensures urgent calls are handled first.

---

## 4. Clinical Agent Guide

The Agent Dashboard is designed for high-efficiency call handling with real-time context.

### Managing Your Status

Use the status toggle to control availability:

* **Online**: Ready to receive call assignments.
* **Break**: Temporarily unavailable but still logged in.
* **Offline**: Finished with your shift.

### Handling an Escalated Call

When an AI agent detects the need for human intervention:

* **Incoming Alert**: A notification appears with the patient's intent.
* **Context Summary**: A real-time transcript shows what the patient has already told the AI.
* **Accepting the Call**: Click *Accept* to join the audio stream and speak directly with the patient while viewing medical safety indicators.

---

## 5. Workflow Automation

Wardline includes a **Visual Workflow Editor** (powered by ReactFlow) that allows teams to design patient journeys without writing code.

### Node Types

* **AI Agent Node**: Assigns AI responsibility for a portion of the conversation.
* **Human Queue Node**: Routes calls to a specific clinical staff queue.
* **Safety Check Node**: Explicitly checks for medical keywords before continuing.
* **Integration Node**: Connects to external systems such as NexHealth or TimeTap for scheduling.

---

## 6. Medical Safety & Compliance

Safety is the cornerstone of Wardline's healthcare implementation.

### Medical Triage Guard

The system actively monitors for 60+ medical keywords categorized by severity:

* **Emergency** (e.g., *chest pain*, *shortness of breath*): Triggers immediate escalation to emergency staff and notifies supervisors via WebSocket alerts.
* **Clinical** (e.g., *fever*, *infection*): Routes to clinical triage for further assessment.
* **Mental Health**: Triggers specialized routing to crisis intervention staff.

### HIPAA Compliance

Wardline enforces HIPAA standards by:

* Logging every routing decision in a secure audit trail.
* Using TLS 1.3 for all data in transit.
* Supporting Business Associate Agreements (BAAs) with Azure and Twilio.

---

## 7. Frequently Asked Questions (FAQ)

**Q: How fast is the AI response time?**
A: Wardline is optimized for sub-200ms latency, enabling responses as fast as a human and eliminating awkward pauses.

**Q: What happens if the patient speaks a different language?**
A: Wardline leverages Azure Neural Voices and can detect language automatically, routing to multilingual AI agents or human translator queues.

**Q: Can patients schedule appointments directly?**
A: Yes. AI agents integrate with hospital scheduling systems to verify insurance, confirm availability, and book appointments automatically.

**Q: How do I know if a call was an emergency?**
A: Emergency events are logged prominently in the Analytics dashboard, and supervisors receive real-time visual alerts.

**Q: What if the AI gets stuck?**
A: If frustration is detected via sentiment analysis or the AI fails three times, it automatically apologizes and transfers the call to a live human agent.

---

**Wardline Enterprise v1.0**
*Proprietary and Confidential*
