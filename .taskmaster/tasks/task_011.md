# Task ID: 11

**Title:** Implement reminder configuration API and storage

**Status:** pending

**Dependencies:** 10

**Priority:** medium

**Description:** Build API for users to configure journal reminders (daily, weekly, monthly, smart nudge) with timezone-aware scheduling and active/inactive state management.

**Details:**

Create `src/routes/api/reminders.ts`:

- GET /api/reminders - List all reminders for user
- POST /api/reminders - Create reminder. Body: { reminderType: 'daily'|'weekly'|'monthly'|'smart', timeOfDay: 'HH:MM', dayOfWeek?: 0-6, dayOfMonth?: 1-28, smartThreshold?: number (days), isActive: boolean }. Validate: timeOfDay is valid time, dayOfWeek 0-6 for weekly, dayOfMonth 1-28 for monthly, smartThreshold 1-14 for smart
- PUT /api/reminders/:id - Update reminder settings
- DELETE /api/reminders/:id - Delete reminder

Store in reminders table. Multiple reminders per user allowed (e.g., daily + smart).

For daily: fires every day at timeOfDay in user's timezone
For weekly: fires every week on dayOfWeek at timeOfDay
For monthly: fires every month on dayOfMonth at timeOfDay
For smart: fires only if (today - last_entry_date) >= smartThreshold

Glass spec:
- `glass/routes/reminders.glass` - Intent: configurable journal prompts; Contract: guarantees timezone handling, validation of time/day fields, user isolation, multiple reminders support

**Test Strategy:**

Test creating all reminder types with valid/invalid parameters. Verify timezone conversion logic. Test multiple reminders per user. Test updating active/inactive state. Verify validation errors for out-of-range values.

## Subtasks

### 11.1. Implement GET /api/reminders endpoint to list user reminders

**Status:** pending  
**Dependencies:** None  

Create the GET /api/reminders route to retrieve all reminders for the authenticated user from the reminders table.

**Details:**

In src/routes/api/reminders.ts, create GET endpoint that: (1) authenticates user via JWT middleware, (2) queries reminders table filtering by user_id, (3) returns array of reminder objects with all fields (id, user_id, reminderType, timeOfDay, dayOfWeek, dayOfMonth, smartThreshold, isActive, created_at, updated_at), (4) returns 200 with empty array if no reminders exist, (5) returns 401 if not authenticated.

### 11.2. Create Zod validation schema for reminder creation

**Status:** pending  
**Dependencies:** None  

Define comprehensive Zod schema for POST /api/reminders request body with type-specific conditional validation.

**Details:**

Create Zod schema that validates: (1) reminderType as enum ('daily', 'weekly', 'monthly', 'smart'), (2) timeOfDay as string matching HH:MM format (00:00-23:59), (3) dayOfWeek as optional number 0-6 (required for weekly), (4) dayOfMonth as optional number 1-28 (required for monthly), (5) smartThreshold as optional number 1-14 (required for smart), (6) isActive as boolean. Use Zod refinements to enforce conditional requirements based on reminderType.

### 11.3. Implement reminderType enum validation

**Status:** pending  
**Dependencies:** 11.2  

Validate that reminderType is one of the four allowed values: daily, weekly, monthly, or smart.

**Details:**

Within the Zod schema created in subtask 2, use z.enum(['daily', 'weekly', 'monthly', 'smart']) to strictly validate reminderType. Ensure validation error messages clearly indicate allowed values. This validation is critical for downstream scheduling logic.

### 11.4. Implement timeOfDay format validation (HH:MM)

**Status:** pending  
**Dependencies:** 11.2  

Validate that timeOfDay follows HH:MM 24-hour format with valid hour (00-23) and minute (00-59) values.

**Details:**

In the Zod schema, create custom validation for timeOfDay string using regex pattern /^([01]\d|2[0-3]):([0-5]\d)$/ to match HH:MM format. Additionally validate that parsed hours are 0-23 and minutes are 0-59. Return clear error message if format is invalid (e.g., '25:00', '12:60', '1:30' without leading zero).

### 11.5. Implement dayOfWeek validation (0-6) for weekly reminders

**Status:** pending  
**Dependencies:** 11.2, 11.3  

Validate that dayOfWeek is an integer from 0 (Sunday) to 6 (Saturday) when reminderType is 'weekly'.

**Details:**

Add Zod refinement to schema: when reminderType === 'weekly', dayOfWeek must be present and be an integer between 0 and 6 inclusive. Use z.number().int().min(0).max(6) with conditional logic. Return error if weekly reminder lacks dayOfWeek or value is out of range.

### 11.6. Implement dayOfMonth validation (1-28) for monthly reminders

**Status:** pending  
**Dependencies:** 11.2, 11.3  

Validate that dayOfMonth is an integer from 1 to 28 when reminderType is 'monthly'.

**Details:**

Add Zod refinement: when reminderType === 'monthly', dayOfMonth must be present and be an integer between 1 and 28 inclusive (limited to 28 to avoid issues with February). Use z.number().int().min(1).max(28) with conditional logic. Return error if monthly reminder lacks dayOfMonth or value is out of range.

### 11.7. Implement smartThreshold validation (1-14) for smart reminders

**Status:** pending  
**Dependencies:** 11.2, 11.3  

Validate that smartThreshold is an integer from 1 to 14 days when reminderType is 'smart'.

**Details:**

Add Zod refinement: when reminderType === 'smart', smartThreshold must be present and be an integer between 1 and 14 inclusive (representing days since last entry). Use z.number().int().min(1).max(14) with conditional logic. Return error if smart reminder lacks smartThreshold or value is out of range.

### 11.8. Implement POST /api/reminders endpoint with complete validation

**Status:** pending  
**Dependencies:** 11.2, 11.3, 11.4, 11.5, 11.6, 11.7  

Create POST endpoint to create new reminders using validated Zod schema and insert into reminders table.

**Details:**

In src/routes/api/reminders.ts, create POST endpoint that: (1) authenticates user, (2) validates request body using complete Zod schema from subtasks 2-7, (3) inserts reminder into reminders table with user_id from JWT, (4) allows multiple reminders per user (no uniqueness constraint), (5) returns 201 with created reminder object including generated id, (6) returns 400 with validation errors if schema validation fails, (7) returns 401 if not authenticated.

### 11.9. Implement PUT /api/reminders/:id and DELETE /api/reminders/:id endpoints with Glass spec

**Status:** pending  
**Dependencies:** 11.1, 11.8  

Create PUT and DELETE endpoints for updating and deleting reminders, then document in Glass specification file.

**Details:**

In src/routes/api/reminders.ts: (1) PUT /api/reminders/:id - authenticate user, validate same Zod schema as POST, verify reminder belongs to user (user_id match), update all fields, return 200 with updated reminder or 404 if not found/not owned. (2) DELETE /api/reminders/:id - authenticate user, verify ownership, delete reminder, return 204 on success or 404 if not found/not owned. Create glass/routes/reminders.glass with Intent: 'configurable journal prompts', Contract: guarantees timezone handling, validation of time/day fields, user isolation (user can only access own reminders), multiple reminders support, and complete validation rules for all four reminder types.
