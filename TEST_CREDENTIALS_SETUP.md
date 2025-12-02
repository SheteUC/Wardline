# Test Credentials Setup Guide

This guide explains how to set up the 3 test user accounts and test the voice orchestration with your Twilio phone number.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Run database migrations
pnpm db:migrate

# 3. Seed test data (creates users, patients, calls, etc.)
pnpm db:seed:test

# 4. Start all services
pnpm dev
```

---

## Test User Credentials

### 1️⃣ Patient Dashboard (`/patient`)

| Field | Value |
|-------|-------|
| Email | `patient@wardline.test` |
| Clerk User ID | `user_test_patient_001` |
| Full Name | Sarah Johnson |
| **Clerk Metadata Role** | `patient` |

**Features to test:**
- View upcoming appointments
- Check insurance coverage
- Pay bills
- View test results
- Book new appointments

---

### 2️⃣ Call Center Dashboard (`/dashboard`, `/admin/call-center`)

| Field | Value |
|-------|-------|
| Email | `callcenter@wardline.test` |
| Clerk User ID | `user_test_callcenter_001` |
| Full Name | Mike Chen |
| **Clerk Metadata Role** | `admin` |

**Features to test:**
- View live calls and call history
- Monitor real-time sentiment
- Handle escalated calls
- View analytics
- Manage appointments
- Process prescription refills
- Review call transcripts

---

### 3️⃣ System Admin Dashboard (`/admin/system`)

| Field | Value |
|-------|-------|
| Email | `sysadmin@wardline.test` |
| Clerk User ID | `user_test_sysadmin_001` |
| Full Name | Alex Rivera |
| **Clerk Metadata Role** | `system_admin` |

**Features to test:**
- View system overview
- Manage workflows
- Configure phone number routing
- Monitor integration health
- View audit logs

---

## Clerk Setup Instructions

### Option A: Create Test Users in Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)

2. Navigate to **Users** → **Create User**

3. For each test user:
   - Enter the email from the table above
   - Set a password (e.g., `TestPassword123!`)
   - Click **Create**

4. After creating each user:
   - Click on the user
   - Go to **Metadata** tab
   - In **Public metadata**, add:
   ```json
   {
     "role": "<role_from_table>"
   }
   ```
   
   For example, for the patient user:
   ```json
   {
     "role": "patient"
   }
   ```

5. Copy the Clerk User ID and update in `packages/db/src/seed-test-data.ts` if needed

6. Re-run: `pnpm db:seed:test`

### Option B: Use Clerk Test Mode

If your Clerk instance has test mode enabled, you can sign in with any email directly without creating real accounts.

---

## Twilio Voice Orchestration Setup

Your Twilio phone number: **(513) 951-1583**

### Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com)

2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**

3. Click on **+1 513-951-1583**

4. Under **Voice Configuration**:
   
   | Setting | Value |
   |---------|-------|
   | Configure with | Webhooks, TwiML Bins, Functions, Studio, or Proxy |
   | A CALL COMES IN | Webhook |
   | URL | `https://<your-url>/voice/incoming` |
   | HTTP Method | POST |

5. Under **Call Status Changes**:
   | Setting | Value |
   |---------|-------|
   | Status Callback URL | `https://<your-url>/voice/status` |
   | HTTP Method | POST |

6. Click **Save**

### Local Development with ngrok

For local testing, use ngrok to expose your voice orchestrator:

```bash
# Terminal 1: Start voice orchestrator
cd apps/voice-orchestrator
pnpm dev  # Runs on port 3002

# Terminal 2: Start ngrok
ngrok http 3002
```

Then use the ngrok URL (e.g., `https://abc123.ngrok.io`) in Twilio:
- Incoming Call URL: `https://abc123.ngrok.io/voice/incoming`
- Status Callback: `https://abc123.ngrok.io/voice/status`

### Test the Voice AI

1. Make sure the voice orchestrator is running:
   ```bash
   pnpm dev
   ```

2. Call **(513) 951-1583** from your phone

3. You should hear:
   > "Thank you for calling Wardline Test Medical Center. If this is a medical emergency, please hang up and call 911. How may I help you today?"

4. Try saying:
   - "I need to schedule an appointment"
   - "I have a question about my bill"
   - "I need a prescription refill"
   - "I'm having chest pain" (emergency escalation)

5. Monitor the call in real-time at `/admin/call-center`

---

## Environment Variables

Make sure these are set in your `.env` files:

### Voice Orchestrator (`apps/voice-orchestrator/.env`)

```env
PORT=3002
NODE_ENV=development

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Azure Speech (for speech-to-text)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastus

# Azure OpenAI (for AI responses)
AZURE_OPENAI_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4

# Core API
CORE_API_BASE_URL=http://localhost:3001
```

### Web App (`apps/web/.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Database (`packages/db/.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/wardline
```

---

## Testing Workflow

### 1. Test Patient Portal

1. Sign in as patient (`patient@wardline.test`)
2. View dashboard - should see mock data
3. Check appointments, bills, insurance info
4. Try booking a new appointment

### 2. Test Call Center Dashboard

1. Sign in as call center user (`callcenter@wardline.test`)
2. View `/dashboard` - see call history, analytics
3. Go to `/admin/call-center` - see real-time call monitoring
4. Make a test call to see it appear live
5. Check prescription refills at `/dashboard/prescriptions`

### 3. Test System Admin

1. Sign in as system admin (`sysadmin@wardline.test`)
2. View `/admin/system` - see system overview
3. Check workflow configuration
4. Review phone number routing
5. View audit logs

### 4. Test Voice AI

1. Call **(513) 951-1583**
2. Navigate through the voice menu
3. Watch the call appear in real-time on the call center dashboard
4. Check the call transcript after completion
5. Review sentiment analysis

---

## Troubleshooting

### "User not found" after sign-in
- Make sure you've run `pnpm db:seed:test`
- Verify the Clerk User ID matches

### Voice call not working
- Check ngrok is running and URL is correct in Twilio
- Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set
- Check voice orchestrator logs for errors

### Dashboard shows no data
- Run `pnpm db:seed:test` to populate test data
- Check the browser console for API errors
- Set the hospital ID: `localStorage.setItem('selectedHospitalId', '<id>')`

### Role-based access not working
- Verify Clerk metadata has the correct `role` field
- Check that the role matches exactly: `patient`, `admin`, or `system_admin`

---

## Seeded Test Data Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Hospital | 1 | "Wardline Test Medical Center" |
| Users | 3 | Patient, Call Center, System Admin |
| Departments | 6 | Emergency, Radiology, Cardiology, etc. |
| Patients | 5 | With DOB, phone numbers |
| Insurance Plans | 5 | BCBS, Aetna, UHC, Medicare, Medicaid |
| Call Sessions | 100+ | Mix of completed, ongoing, abandoned |
| Appointments | 40 | Past and future |
| Prescription Refills | 30 | Various statuses |
| Marketing Events | 5 | Seminars, workshops, screenings |
| Intents | 6 | Scheduling, Billing, Refill, etc. |
| Workflows | 1 | Published with full graph |

---

## Need Help?

- Check the console logs in the browser and terminal
- Review the API responses in the Network tab
- Look at Twilio debugger for call issues
- Check Clerk dashboard for authentication issues

