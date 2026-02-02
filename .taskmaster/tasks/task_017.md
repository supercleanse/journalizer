# Task ID: 17

**Title:** Implement settings page with voice preferences, phone verification, and reminders UI

**Status:** pending

**Dependencies:** 14, 15

**Priority:** high

**Description:** Build comprehensive settings interface for profile management, AI voice customization, phone verification workflow, reminder configuration, and data export options.

**Details:**

Create `frontend/src/pages/Settings.tsx` matching PRD section 8.3 layout:

**Sections:**

1. **Profile**
   - Display name input
   - Email (read-only, from Google)
   - Timezone dropdown (IANA zones)

2. **SMS Journaling**
   - Phone number input (E.164 format with country code dropdown)
   - "Verify" button (triggers POST /api/settings/verify-phone)
   - Verification modal: 6-digit code input, "Confirm" button
   - Status indicator: ✅ Verified or ⚠️ Unverified

3. **AI Voice Preferences**
   - Voice style dropdown: Natural, Conversational, Reflective, Polished
   - Custom instructions textarea (500 char limit)
   - "Test AI" button (shows before/after example)

4. **Reminders**
   - Daily reminder checkbox + time picker
   - Weekly reminder checkbox + day selector + time picker
   - Monthly reminder checkbox + day of month (1-28) + time picker
   - Smart nudge checkbox + threshold slider (1-14 days)
   - All reminders show active/inactive toggle

5. **Data**
   - "Export All Entries" button (downloads JSON)
   - "Export as PDF" button (future: print-ready format)

6. **Print Subscription** (Phase 2, show "Coming Soon" placeholder)

Validation:
- E.164 phone format
- Timezone from valid list
- Time fields HH:MM format

Glass spec:
- `glass/frontend/settings.glass` - Intent: user preference management UI; Contract: guarantees input validation, phone verification flow, reminder configuration persistence, data export functionality

**Test Strategy:**

Test updating each setting field and verify API calls succeed. Test phone verification flow end-to-end. Test invalid phone formats are rejected. Test all reminder configurations save correctly. Test data export downloads valid JSON. Test timezone changes affect reminder display.

## Subtasks

### 17.1. Create Settings.tsx with multi-section layout structure

**Status:** pending  
**Dependencies:** None  

Initialize Settings page component with sections for Profile, SMS Journaling, AI Voice Preferences, Reminders, Data Export, and Print Subscription placeholder.

**Details:**

Create `frontend/src/pages/Settings.tsx` with React component structure. Define section containers for: (1) Profile, (2) SMS Journaling, (3) AI Voice Preferences, (4) Reminders, (5) Data, (6) Print Subscription. Add section headers and basic layout styling. Import necessary UI components (form inputs, buttons, modals). Set up component state management structure for form fields.

### 17.2. Implement profile section with display name, email, and timezone

**Status:** pending  
**Dependencies:** 17.1  

Build profile section with display name input (editable), email field (read-only from Google OAuth), and timezone dropdown placeholder.

**Details:**

Add form fields to Profile section: (1) Display name text input with state binding, (2) Email input field marked read-only and populated from auth context/user data, (3) Timezone dropdown component (initially empty select, will be populated in next subtask). Wire up state management for display name changes. Add form validation for required fields.

### 17.3. Populate timezone dropdown with IANA timezone options

**Status:** pending  
**Dependencies:** 17.2  

Integrate IANA timezone database into timezone dropdown with proper formatting and user-friendly display.

**Details:**

Import IANA timezone list (use library like `countries-and-timezones` or manual list). Populate timezone dropdown with all valid IANA zones (e.g., 'America/New_York', 'Europe/London'). Format display names for readability (show UTC offset). Set user's current timezone as default selection. Ensure dropdown supports search/filter for hundreds of options.

### 17.4. Implement SMS journaling section with phone input and country code

**Status:** pending  
**Dependencies:** 17.1  

Build phone number input field with country code dropdown supporting E.164 format validation.

**Details:**

Create SMS Journaling section with: (1) Country code dropdown (e.g., +1, +44, +91) using library like `react-phone-number-input` or custom implementation, (2) Phone number input field that combines with country code to form E.164 format, (3) Client-side validation for E.164 format (+ followed by country code and number), (4) 'Verify' button (initially disabled until valid phone entered). Add state management for phone number and country code.

### 17.5. Implement phone verification trigger API call

**Status:** pending  
**Dependencies:** 17.4  

Wire 'Verify' button to trigger POST /api/settings/verify-phone and handle response states.

**Details:**

Implement onClick handler for 'Verify' button that: (1) Makes POST request to /api/settings/verify-phone with phone number in E.164 format, (2) Handles loading state (disable button, show spinner), (3) Handles success response (opens verification modal), (4) Handles error responses (invalid phone, rate limit, server error) with user-friendly error messages. Add error state management and display error messages below phone input.

### 17.6. Create verification modal with 6-digit code input UI

**Status:** pending  
**Dependencies:** 17.5  

Build modal component for phone verification code entry with 6-digit input field and confirm button.

**Details:**

Create VerificationModal component with: (1) Modal overlay and container, (2) Header text explaining verification, (3) 6-digit code input (can use separate inputs for each digit or single masked input), (4) 'Confirm' button, (5) 'Resend Code' link, (6) 'Cancel' button to close modal. Add input validation to ensure exactly 6 digits entered. Auto-focus on first input when modal opens. Add state management for verification code and modal visibility.

### 17.7. Implement verification confirmation API call

**Status:** pending  
**Dependencies:** 17.6  

Wire verification modal 'Confirm' button to POST /api/settings/confirm-phone and handle verification result.

**Details:**

Implement confirmation handler that: (1) Makes POST request to /api/settings/confirm-phone with 6-digit code and phone number, (2) Handles loading state during verification, (3) On success: closes modal, updates verification status indicator, shows success toast/message, (4) On failure (invalid code, expired code, server error): displays error in modal, allows retry without closing modal. Add retry logic and error state management.

### 17.8. Add phone verification status indicator

**Status:** pending  
**Dependencies:** 17.7  

Display real-time verification status with visual indicators (verified checkmark or unverified warning).

**Details:**

Add status indicator below phone input showing: (1) ✅ 'Verified' with green styling when phone_verified=true, (2) ⚠️ 'Unverified' with yellow/warning styling when phone_verified=false or null, (3) Fetch initial verification status from user settings API on page load, (4) Update status dynamically after successful verification. Style indicators with appropriate colors and icons.

### 17.9. Implement AI voice preferences section

**Status:** pending  
**Dependencies:** 17.1  

Build voice customization UI with style dropdown, custom instructions textarea, and test preview functionality.

**Details:**

Create AI Voice Preferences section with: (1) Voice style dropdown with options: 'Natural', 'Conversational', 'Reflective', 'Polished', (2) Custom instructions textarea with 500 character limit and character counter, (3) 'Test AI' button that shows before/after example of voice transformation (can mock initially or call test endpoint), (4) State management for selected style and custom instructions. Add character count validation and visual feedback when approaching limit.

### 17.10. Implement reminders section with daily/weekly/monthly/smart configurations

**Status:** pending  
**Dependencies:** 17.1  

Build comprehensive reminder configuration UI with conditional inputs for different reminder types and active/inactive toggles.

**Details:**

Create Reminders section with four reminder types: (1) Daily reminder: checkbox + time picker (HH:MM format), (2) Weekly reminder: checkbox + day selector (Mon-Sun) + time picker, (3) Monthly reminder: checkbox + day of month input (1-28) + time picker, (4) Smart nudge: checkbox + threshold slider (1-14 days). Each reminder has active/inactive toggle. Implement conditional rendering (show day selector only when weekly checked, etc.). Add time picker component or use HTML time input. Validate all time inputs are HH:MM format. Add state management for all reminder configurations.

### 17.11. Implement data export buttons with download functionality

**Status:** pending  
**Dependencies:** 17.1  

Add export buttons that trigger JSON and PDF downloads of user's journal entries.

**Details:**

Create Data section with two export buttons: (1) 'Export All Entries' button that triggers GET /api/export/json and downloads resulting JSON file, (2) 'Export as PDF' button (show disabled state or 'Coming Soon' label for Phase 2). Implement download handler that: fetches export data, creates blob, triggers browser download with appropriate filename (e.g., 'journal-entries-YYYY-MM-DD.json'). Add loading states during export generation. Handle export errors gracefully.

### 17.12. Add print subscription placeholder section

**Status:** pending  
**Dependencies:** 17.1  

Create placeholder UI for future print subscription feature marked as 'Coming Soon'.

**Details:**

Create Print Subscription section with: (1) Section header 'Print Subscription', (2) 'Coming Soon' badge or label, (3) Brief description text explaining future feature (e.g., 'Get beautiful printed copies of your journal delivered monthly'), (4) Disabled state styling to indicate not yet available. Style consistently with other sections but clearly marked as unavailable.

### 17.13. Create Glass spec for settings frontend validation contract

**Status:** pending  
**Dependencies:** 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12  

Document Glass specification for settings page with validation rules, phone verification flow, and data contracts.

**Details:**

Create `glass/frontend/settings.glass` file with: (1) Intent: 'User preference management UI for profile, phone verification, AI voice, reminders, and data export', (2) Contract: guarantees E.164 phone format validation, IANA timezone validation, HH:MM time format validation, reminder day/threshold range validation (weekly 0-6, monthly 1-28, smart 1-14), phone verification flow (verify → modal → confirm → status update), 500 char limit on AI instructions, data export functionality. (3) Dependencies: auth context for user data, API endpoints for verify-phone, confirm-phone, reminders CRUD, export. Follow GLASS.md format conventions.
