# Database Seeding Complete! 🎉

Your database has been populated with realistic test data.

## What Was Created

### Hospital
- **Name:** St. Mary's Regional Hospital
- **Hospital ID:** `86b63766-a748-44e5-ad4c-da493218724b`

### Users (3)
- Jane Doe (Owner) - jane.doe@stmarys.org
- Dr. Robert Chen (Admin) - robert.chen@stmarys.org  
- Sarah Miller (Supervisor) - sarah.miller@stmarys.org

### Data Overview
- **Calls:** 55 call records
  - Mix of completed, abandoned, and failed calls
  - Various intents: Scheduling, Billing, Refill, Clinical Triage
  - Different sentiments: Positive, Neutral, Negative
  - Some emergency flags
  - Timestamps spread over the last week
- **Patients:** 3 patient records with MRNs
- **Intents:** 4 configured intents
- **Workflows:** 1 published workflow with version
- **Phone Number:** 1 configured Twilio number

## Next Step: Set Hospital ID in Frontend

To see the data in your web app, you need to set the hospital ID in your browser:

### Option 1: Browser Console (Quick)
1. Open your web app: http://localhost:3000
2. Sign in with Clerk
3. Open browser DevTools (F12)
4. Go to Console tab
5. Run this command:
   ```javascript
   localStorage.setItem('selectedHospitalId', '86b63766-a748-44e5-ad4c-da493218724b')
   ```
6. Refresh the page

### Option 2: Set in Clerk User Metadata (Persistent)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Find your test user
3. Edit Public Metadata
4. Add:
   ```json
   {
     "defaultHospitalId": "86b63766-a748-44e5-ad4c-da493218724b"
   }
   ```
5. Save and refresh your web app

## Verify the Data

After setting the hospital ID, navigate through your dashboard:

1. **Dashboard** - Should show:
   - Total calls: 55
   - Call volume chart with data
   - Intent breakdown pie chart
   - Recent calls table with actual call data

2. **Calls Page** - Should show:
   - List of 55 calls
   - Filters working (all, emergency, completed, abandoned)
   - Search functionality
   - Pagination

3. **Analytics Page** - Should show:
   - Call volume trends
   - Sentiment analysis
   - Performance metrics

4. **Workflows Page** - Should show:
   - "General Triage Flow" workflow
   - Published status
   - Version information

5. **Team Page** - Should show:
   - 3 team members
   - Role badges
   - Status indicators

## Re-seed Database

If you want to reset the data or add more:

```bash
cd packages/db
pnpm seed
```

This will clean all existing data and create fresh test data.

## Connect Clerk User

To fully test with authentication, make sure your Clerk user is synced to the database. The backend webhook should create a User record when you sign up/sign in.

Alternatively, you can manually update one of the test users to use your Clerk ID:

```sql
UPDATE users 
SET clerk_user_id = 'YOUR_ACTUAL_CLERK_USER_ID_HERE'
WHERE email = 'jane.doe@stmarys.org';
```

Or create a new user via Prisma Studio:
```bash
cd packages/db
pnpm studio
```

Happy testing! 🚀
