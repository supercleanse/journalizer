# Task ID: 18

**Title:** Build entry detail view with media player and edit functionality

**Status:** pending

**Dependencies:** 14, 15, 16

**Priority:** medium

**Description:** Create single entry detail page showing full content, all media attachments with inline players, original/polished toggle, and edit capabilities.

**Details:**

Create `frontend/src/pages/EntryView.tsx` for route `/entries/:id`.

**Layout:**
- Back button to dashboard
- Entry metadata: date, time, source badge (SMS/Web)
- Polished content display (full text, markdown rendering)
- "View Original" toggle button (shows raw content side-by-side or replaces polished)
- Media gallery:
  - Photos: Grid layout, lightbox on click
  - Audio: Custom audio player with waveform, play/pause, seek bar, duration
  - Video: HTML5 video player with controls
  - For audio/video with transcriptions: Show transcript below player
- Tags display (clickable, filters dashboard by tag)
- Mood indicator
- Edit button (opens edit modal or inline editor)
- Delete button (confirmation modal)

**Edit functionality:**
- Inline editing of polished content (not raw)
- Add/remove tags
- Change mood
- Save triggers PUT /api/entries/:id

**Media player requirements:**
- Use Howler.js or Wavesurfer.js for audio
- Lazy load video
- Show loading states

Glass spec:
- `glass/frontend/entry-view.glass` - Intent: detailed entry viewing and editing; Contract: guarantees media playback, edit persistence, delete confirmation, original content preservation

**Test Strategy:**

Test loading entries with different media types. Test audio/video playback. Test original/polished toggle. Test editing content and tags. Test delete with confirmation. Verify back navigation. Test on mobile viewport.

## Subtasks

### 18.1. Create EntryView.tsx component with route setup and basic layout structure

**Status:** pending  
**Dependencies:** None  

Initialize the EntryView page component at frontend/src/pages/EntryView.tsx and configure routing for /entries/:id path. Set up basic component structure with back button, metadata section placeholders, and content area containers.

**Details:**

Create frontend/src/pages/EntryView.tsx. Configure React Router route in App.tsx for /entries/:id. Implement useParams hook to extract entry ID from URL. Add back button navigation using useNavigate hook to return to dashboard. Create basic layout structure with semantic HTML sections for metadata, content, media gallery, and action buttons. Add Glass spec reference in component header comments.

### 18.2. Implement entry data fetching with media attachments on component mount

**Status:** pending  
**Dependencies:** 18.1  

Fetch complete entry data including metadata, raw content, polished content, tags, mood, and all media attachments (photos, audio, video) from GET /api/entries/:id endpoint when component mounts.

**Details:**

Use React useEffect hook to fetch entry data on mount. Call GET /api/entries/:id using authenticated API client. Implement loading state with spinner/skeleton. Handle error states (404 not found, 403 forbidden, network errors) with user-friendly messages. Store fetched entry data in component state including metadata (createdAt, source, userId), content (raw, polished), tags array, mood, and media attachments array with URLs and types. Add retry logic for failed requests.

### 18.3. Display entry metadata including date, time, and source badge

**Status:** pending  
**Dependencies:** 18.2  

Render entry metadata section showing formatted creation date, time, and source indicator badge (SMS or Web) with appropriate styling and icons.

**Details:**

Format createdAt timestamp using date-fns or similar library to display human-readable date and time (e.g., 'January 15, 2026 at 2:30 PM'). Create source badge component that displays 'SMS' or 'Web' with distinct colors and icons. Position metadata section prominently below back button. Add relative time display (e.g., '2 hours ago') alongside absolute time. Ensure timestamp handles timezone correctly. Style badges with rounded corners and subtle background colors.

### 18.4. Render polished content with markdown formatting support

**Status:** pending  
**Dependencies:** 18.2  

Display the polished entry content with full markdown rendering support including headings, lists, links, emphasis, and paragraph breaks.

**Details:**

Install and configure react-markdown or marked library for markdown parsing. Create content display area that renders entry.polishedContent with markdown support. Configure markdown renderer to support: paragraphs, headings (h1-h6), bold/italic/strikethrough, unordered/ordered lists, links (sanitized), blockquotes, and code blocks. Apply appropriate CSS styling for readable typography with good line-height and spacing. Sanitize markdown output to prevent XSS attacks. Add prose styling for optimal readability.

### 18.5. Implement 'View Original' toggle with side-by-side or replace view

**Status:** pending  
**Dependencies:** 18.4  

Add toggle button to switch between polished and original content views, supporting both side-by-side comparison and replace modes with smooth transitions.

**Details:**

Add 'View Original' toggle button/switch component below metadata section. Implement state management (useState) for toggle state. Create two view modes: (1) side-by-side layout showing polished on left and raw on right in two columns, (2) replace mode that swaps polished content with raw content in single column. Add smooth CSS transitions when toggling. Display raw content in preformatted text or plain textarea to show exactly as entered. Add visual indicator showing which version is currently displayed. Persist toggle preference in sessionStorage.

### 18.6. Create photo gallery with grid layout and lightbox functionality

**Status:** pending  
**Dependencies:** 18.2  

Build responsive photo grid gallery for image attachments with click-to-expand lightbox overlay for full-size viewing.

**Details:**

Filter media attachments for image types (image/jpeg, image/png, image/gif, image/webp). Create responsive CSS grid layout (3 columns on desktop, 2 on tablet, 1 on mobile) displaying photo thumbnails. Implement lightbox component using react-image-lightbox or custom modal with: full-size image display, prev/next navigation arrows, close button (X and ESC key), swipe gestures on mobile, image counter (e.g., '2 of 5'), zoom functionality. Lazy load images using loading='lazy' attribute. Add loading skeletons for images. Handle missing/broken images gracefully with placeholder.

### 18.7. Implement custom audio player with waveform visualization and controls

**Status:** pending  
**Dependencies:** 18.2  

Build custom audio player component with waveform visualization, play/pause, seek controls, duration display, and playback progress using Wavesurfer.js or Howler.js.

**Details:**

Install Wavesurfer.js library for audio visualization. Create AudioPlayer component that accepts audio URL prop. Initialize Wavesurfer instance with waveform container, configure colors (waveColor, progressColor), set responsive height. Implement controls: play/pause button with icon toggle, seek bar synced with waveform clicks, current time / total duration display (mm:ss format), playback speed selector (0.5x, 1x, 1.5x, 2x), volume control slider. Add loading state while audio loads. Handle playback errors gracefully. Cleanup Wavesurfer instance on unmount. Style player with modern UI matching app theme.

### 18.8. Implement HTML5 video player with lazy loading and standard controls

**Status:** pending  
**Dependencies:** 18.2  

Create video player component using native HTML5 video element with controls, lazy loading, and fallback for unsupported formats.

**Details:**

Filter media attachments for video types (video/mp4, video/webm, video/quicktime). Create VideoPlayer component using HTML5 <video> element with controls attribute enabled. Implement lazy loading using loading='lazy' or Intersection Observer to defer video load until scrolled into view. Add poster image (thumbnail if available). Configure video attributes: controls, preload='metadata', playsinline for mobile. Provide multiple source formats if available for browser compatibility. Add custom styling to video container with max-width constraints. Display video dimensions and file size. Handle video loading errors with fallback message. Add fullscreen capability.

### 18.9. Display transcripts below audio and video players

**Status:** pending  
**Dependencies:** 18.7, 18.8  

Show transcription text below audio and video media players when transcripts are available, with expandable/collapsible functionality for long transcripts.

**Details:**

Check media attachment objects for transcript property. If transcript exists, render transcript section below corresponding audio/video player. Implement expandable component: show first 3 lines with 'Show more' button for long transcripts, 'Show less' to collapse. Format transcript with proper paragraph breaks and timestamps if available. Add subtle styling (lighter text, smaller font, indented) to distinguish from main content. Add copy-to-clipboard button for full transcript. Handle missing or empty transcripts gracefully (don't show section). Support transcript search/highlight if transcript is long.

### 18.10. Build inline edit functionality with form validation and save persistence

**Status:** pending  
**Dependencies:** 18.4, 18.3  

Implement inline editing mode for polished content, tags, and mood with form validation and PUT request to /api/entries/:id endpoint to persist changes.

**Details:**

Add 'Edit' button that toggles edit mode state. In edit mode: replace markdown display with textarea for polished content editing (not raw content), render tag input component allowing add/remove tags with autocomplete, add mood selector dropdown/buttons. Implement form state management with React useState or useForm hook. Add validation: content cannot be empty, tags must be valid format, mood must be from allowed values. Add Save and Cancel buttons. On Save: call PUT /api/entries/:id with updated fields, show loading state, handle success (update local state and exit edit mode) and error responses (display error message), optimistic UI update. On Cancel: revert to original values and exit edit mode.

### 18.11. Add delete button with confirmation modal and API integration

**Status:** pending  
**Dependencies:** 18.1  

Implement delete functionality with confirmation modal dialog to prevent accidental deletion, calling DELETE /api/entries/:id and redirecting to dashboard on success.

**Details:**

Add 'Delete' button with danger styling (red color) in actions section. Create confirmation modal component that appears on delete click with: warning message 'Are you sure you want to delete this entry? This cannot be undone.', Cancel button (secondary style), Confirm Delete button (danger style). Implement modal state management (open/close). On confirm: call DELETE /api/entries/:id with authenticated request, show loading state in modal, on success: close modal, show success toast/notification, navigate to dashboard using useNavigate, on error: display error message in modal, keep modal open. Add keyboard support (ESC to cancel, Enter to confirm). Prevent accidental clicks with short delay or double confirmation for extra safety.
