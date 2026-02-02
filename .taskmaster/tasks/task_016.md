# Task ID: 16

**Title:** Build new entry creation form with media upload and AI toggle

**Status:** pending

**Dependencies:** 14, 15

**Priority:** high

**Description:** Implement web-based entry creation interface with text editor, file upload for photos/audio/video, in-browser audio recording, mood selector, tags, and optional AI polish toggle.

**Details:**

Create `frontend/src/pages/NewEntry.tsx` matching PRD section 8.3 layout:

**Form fields:**
- Date picker (defaults to today, can select past dates)
- Textarea for entry content (markdown support optional)
- File upload buttons: Photo, Audio, Video (accept multiple)
- In-browser audio recording using MediaRecorder API (record/stop/play buttons)
- AI polish checkbox (default: checked)
- Tags input (comma-separated or autocomplete)
- Mood selector (emoji buttons: 😊 😐 😢 😡 🤔)
- Location field (optional, future: geolocation)
- Save button

**Implementation:**
- Upload media files to POST /api/media/upload first, get media IDs
- On save, POST /api/entries with { rawContent, entryDate, tags, mood, mediaIds, polishWithAI }
- Show loading indicator during AI polish (may take 3-10 seconds)
- On success, navigate to entry detail or dashboard
- Autosave draft to localStorage every 30 seconds

**Audio recording:**
- Use MediaRecorder API with getUserMedia()
- Record as WebM or MP3
- Show waveform visualization (optional)
- Preview playback before saving

Glass spec:
- `glass/frontend/new-entry.glass` - Intent: web-based entry creation; Contract: guarantees media upload success, autosave functionality, audio recording compatibility, form validation

**Test Strategy:**

Test creating entries with text only, with photos, with audio (recorded and uploaded), with video. Test AI polish toggle on/off. Test mood and tags. Verify autosave works. Test date picker past dates. Test on different browsers for MediaRecorder support.

## Subtasks

### 16.1. Create NewEntry.tsx with basic form structure and state management

**Status:** pending  
**Dependencies:** None  

Set up the NewEntry page component with React state management for all form fields including content, date, tags, mood, location, AI polish toggle, and media files.

**Details:**

Create `frontend/src/pages/NewEntry.tsx` with useState hooks for: entryContent (string), entryDate (Date), tags (string[]), mood (string), location (string), polishWithAI (boolean, default true), uploadedMedia (File[]), recordedAudio (Blob | null), mediaIds (string[]). Set up form structure with proper TypeScript types. Initialize entryDate to current date. Create form submission handler stub.

### 16.2. Implement date picker with past date selection capability

**Status:** pending  
**Dependencies:** 16.1  

Add a date picker input that defaults to today's date but allows users to select any past date for journal entries.

**Details:**

Use HTML5 date input or a React date picker library (like react-datepicker). Set max attribute to today's date to prevent future dates. Default value should be current date. Wire up onChange handler to update entryDate state. Format date properly for API submission (ISO format).

### 16.3. Implement textarea for entry content with optional markdown support

**Status:** pending  
**Dependencies:** 16.1  

Create a textarea input for journal entry content with optional markdown rendering preview.

**Details:**

Add textarea element with appropriate styling and placeholder text. Wire up to entryContent state. Optionally implement markdown preview using a library like react-markdown. Add character count indicator. Ensure textarea expands with content or has sufficient height. Apply proper styling for readability.

### 16.4. Implement file upload UI for photos, audio, and video

**Status:** pending  
**Dependencies:** 16.1  

Create file upload buttons for photos, audio, and video files with support for multiple file selection and preview.

**Details:**

Create three file input elements with appropriate accept attributes: photos (image/*), audio (audio/*), video (video/*). Set multiple attribute to allow multiple file selection. Add visual upload buttons/zones with icons. Implement file preview functionality showing thumbnails for images, file names for audio/video. Store selected files in uploadedMedia state. Add ability to remove files before submission. Validate file types and sizes (e.g., max 50MB per file).

### 16.5. Implement MediaRecorder API integration for in-browser audio recording

**Status:** pending  
**Dependencies:** 16.1  

Set up MediaRecorder API with getUserMedia() to enable in-browser audio recording functionality.

**Details:**

Request microphone permissions using navigator.mediaDevices.getUserMedia({ audio: true }). Initialize MediaRecorder instance with appropriate MIME type (prefer audio/webm, fallback to audio/mp4 or audio/ogg). Handle browser compatibility checks and display appropriate error messages for unsupported browsers. Store recorded audio chunks in state. Implement error handling for permission denied scenarios. Create state variables for recording status (idle, recording, stopped) and recorded blob.

### 16.6. Add record/stop/play controls for audio recording with playback preview

**Status:** pending  
**Dependencies:** 16.5  

Implement UI controls for starting/stopping audio recording and playing back the recorded audio before submission.

**Details:**

Create three buttons: Record (start recording), Stop (stop recording), Play (preview playback). Update button states based on recording status (disable Record during recording, enable Stop only during recording, enable Play only when audio exists). Implement start recording handler that calls mediaRecorder.start(). Implement stop handler that calls mediaRecorder.stop() and saves blob. Create audio element for playback preview using URL.createObjectURL(). Add recording duration timer. Optionally implement waveform visualization using Web Audio API or a library like wavesurfer.js. Show visual feedback during recording (e.g., red dot, pulsing animation).

### 16.7. Implement AI polish checkbox with default checked state

**Status:** pending  
**Dependencies:** 16.1  

Add a checkbox input for the AI polish feature that defaults to checked, allowing users to opt out of AI processing.

**Details:**

Create checkbox input element labeled 'Polish with AI' or similar. Wire up to polishWithAI state (boolean, default true). Add informational tooltip or help text explaining that AI polish may take 3-10 seconds. Style checkbox for visibility. Ensure checked state persists if user navigates away and returns (via localStorage autosave).

### 16.8. Implement tags input with comma-separated parsing or autocomplete

**Status:** pending  
**Dependencies:** 16.1  

Create a tags input field that allows users to enter comma-separated tags or select from autocomplete suggestions.

**Details:**

Implement tags input using either: (1) simple text input with comma-separated parsing on blur/submit, or (2) autocomplete component (e.g., react-select or custom implementation) with multi-select capability. Store tags as string array in state. If using autocomplete, fetch existing tags from API endpoint (GET /api/tags) to populate suggestions. Display entered tags as removable chips/badges. Trim whitespace and convert to lowercase for consistency. Allow adding new tags not in suggestions.

### 16.9. Implement mood selector with emoji buttons

**Status:** pending  
**Dependencies:** 16.1  

Create a mood selector UI using emoji buttons for the five mood options: happy, neutral, sad, angry, and thoughtful.

**Details:**

Create five button elements with emojis: 😊 (happy), 😐 (neutral), 😢 (sad), 😡 (angry), 🤔 (thoughtful). Store selected mood as string in state (e.g., 'happy', 'neutral'). Implement single-select behavior (clicking a mood deselects others). Add visual indication for selected mood (border, background color, scale). Make mood selection optional (allow deselecting). Ensure proper spacing and touch-friendly sizes for mobile.

### 16.10. Implement optional location field with future geolocation support

**Status:** pending  
**Dependencies:** 16.1  

Add a location text input field that is optional, with placeholder for future geolocation integration.

**Details:**

Create text input for location with placeholder like 'Add location (optional)'. Wire up to location state. Add comment or TODO for future geolocation API integration (navigator.geolocation.getCurrentPosition). Style input consistently with other form fields. Location should be optional and not required for form submission.

### 16.11. Handle media upload to POST /api/media/upload and track media IDs

**Status:** pending  
**Dependencies:** 16.4, 16.6  

Implement functionality to upload media files to the API endpoint first, retrieve media IDs, and track them for entry creation.

**Details:**

Create async function uploadMediaFiles() that iterates through uploadedMedia array and recordedAudio blob. For each file/blob, create FormData and POST to /api/media/upload endpoint. Extract media ID from response and store in mediaIds state array. Show upload progress indicator for each file. Handle upload errors gracefully with retry option. Upload media files BEFORE submitting the entry form. Include proper headers and authentication token in fetch request.

### 16.12. Implement form submission to POST /api/entries with loading state

**Status:** pending  
**Dependencies:** 16.2, 16.3, 16.7, 16.8, 16.9, 16.10, 16.11  

Create form submission handler that posts entry data to the API with loading indicators during AI polish processing.

**Details:**

Implement handleSubmit async function that: (1) validates required fields (content, date), (2) calls uploadMediaFiles() to get mediaIds, (3) constructs request body with { rawContent, entryDate, tags, mood, location, mediaIds, polishWithAI }, (4) POSTs to /api/entries endpoint with authentication, (5) shows loading spinner with message 'Processing with AI...' if polishWithAI is true (3-10 seconds expected), (6) handles success by clearing form and navigating to entry detail page or dashboard, (7) handles errors with user-friendly messages. Disable submit button during submission to prevent double-submission.

### 16.13. Implement autosave to localStorage every 30 seconds

**Status:** pending  
**Dependencies:** 16.1  

Set up automatic draft saving to browser localStorage at 30-second intervals to prevent data loss.

**Details:**

Use useEffect hook with setInterval to save form state to localStorage every 30 seconds. Create autosave key like 'journalizer_draft'. Save object containing all form fields: { entryContent, entryDate, tags, mood, location, polishWithAI }. On component mount, check localStorage for existing draft and populate form if found. Clear localStorage draft after successful submission. Show visual indicator when autosave occurs (e.g., 'Draft saved' toast). Handle edge cases like browser storage limits. Note: uploaded files and recorded audio may not be saved to localStorage due to size limits.

### 16.14. Create Glass spec for frontend/new-entry.glass with contracts

**Status:** pending  
**Dependencies:** 16.12, 16.13  

Write Glass specification file documenting the NewEntry component's intent, contracts, and guarantees for media upload, autosave, and audio recording.

**Details:**

Create `glass/frontend/new-entry.glass` file following the Glass Framework format defined in GLASS.md. Document: (1) Intent: web-based entry creation with rich media support, (2) Contract: guarantees media upload success or error handling, autosave functionality every 30 seconds, audio recording browser compatibility checks, form validation for required fields, (3) Expectations: users have valid authentication, browser supports minimum required APIs, (4) Constraints: file size limits, audio recording format compatibility. Include examples of successful entry creation flow and error scenarios.
