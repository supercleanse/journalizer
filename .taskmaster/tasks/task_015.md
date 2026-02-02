# Task ID: 15

**Title:** Build dashboard page with entry timeline, calendar, and search

**Status:** pending

**Dependencies:** 14

**Priority:** high

**Description:** Implement the main dashboard UI showing chronological journal entries with filtering, calendar sidebar, search functionality, and streak tracking as specified in PRD section 8.3.

**Details:**

Create `frontend/src/pages/Dashboard.tsx` matching the layout from PRD section 8.3:

Components:
- **Header**: Logo, search input, settings icon, user avatar
- **Calendar sidebar** (desktop): Calendar widget showing current month, days with entries highlighted (dot indicator)
- **View toggles**: Month/Week/Day view (affects grouping and display)
- **Entry timeline**: Scrollable list of EntryCard components, infinite scroll with react-query
- **Entry card**: Shows date/time, entry type badge (SMS/Web), polished content (max 3 paragraphs preview), media thumbnails, "View Original" toggle, Edit/Audio buttons
- **Stats footer**: Streak counter (consecutive days with entries), total entries this month

Implementation:
- Use react-query for entries list with pagination
- Implement full-text search that queries GET /api/entries?search={query}
- Calendar sidebar uses date-fns to render month grid, highlights dates with entries
- Infinite scroll using Intersection Observer
- "View Original" shows modal or side-by-side view of raw vs polished content
- Click entry card to navigate to /entries/:id detail view

Glass spec:
- `glass/frontend/dashboard.glass` - Intent: primary journal viewing interface; Contract: guarantees performant rendering, accurate streak calculation, responsive search, accessible UI

**Test Strategy:**

Test with 0 entries, 1 entry, 100+ entries. Verify infinite scroll loads more entries. Test search with various queries. Verify calendar highlights correct dates. Test view toggles (Month/Week/Day). Test "View Original" toggle. Measure performance with large entry counts.

## Subtasks

### 15.1. Create Dashboard.tsx page component with basic layout structure

**Status:** pending  
**Dependencies:** None  

Initialize the Dashboard page component in frontend/src/pages/Dashboard.tsx with the foundational layout structure including placeholders for header, sidebar, timeline, and footer sections.

**Details:**

Create the main Dashboard.tsx component file with basic React structure. Set up the page layout grid/flexbox to accommodate header at top, calendar sidebar on left (desktop only), main timeline in center, and stats footer at bottom. Use responsive design patterns (CSS Grid or Flexbox) to ensure mobile compatibility. Import necessary dependencies (React, react-query, date-fns). This establishes the foundation for all subsequent dashboard components.

### 15.2. Implement header with search input, logo, and user avatar

**Status:** pending  
**Dependencies:** 15.1  

Build the dashboard header containing logo, search input field, settings icon, and user avatar matching PRD section 8.3 specifications.

**Details:**

Create Header component within Dashboard.tsx or as separate component. Include: (1) Logo/branding element on left, (2) Search input field with placeholder text 'Search entries...', (3) Settings icon that links to /settings, (4) User avatar showing current user (integrate with auth context to get user data). Style header with appropriate spacing, alignment, and responsive behavior for mobile. Search input will be wired up to functionality in subtask 8.

### 15.3. Implement calendar sidebar with date-fns month grid rendering

**Status:** pending  
**Dependencies:** 15.1  

Create calendar sidebar widget that renders the current month using date-fns library, displaying a proper calendar grid with day names and dates.

**Details:**

Create CalendarSidebar component using date-fns utilities. Implement: (1) Month header showing current month/year, (2) Grid of day names (Sun-Sat), (3) Calendar grid showing all dates in current month using date-fns functions like startOfMonth, endOfMonth, eachDayOfInterval, getDay for proper alignment, (4) Navigation arrows for prev/next month, (5) Hide on mobile/tablet viewports (desktop-only component). Style calendar with clean grid layout and proper spacing.

### 15.4. Implement calendar date highlighting logic for entries

**Status:** pending  
**Dependencies:** 15.3  

Add logic to query entries by date and visually highlight calendar dates that have journal entries with dot indicators.

**Details:**

Extend CalendarSidebar to fetch entry dates from API. Create react-query hook to fetch GET /api/entries?fields=entryDate (or similar lightweight endpoint returning only dates). Process response to create Set or Map of dates with entries. For each calendar date cell, check if date exists in entries set and render dot indicator if true. Implement efficient date comparison logic using date-fns isSameDay or similar. Handle loading and error states for entry date fetching.

### 15.5. Implement view toggles (Month/Week/Day) with state management

**Status:** pending  
**Dependencies:** 15.1  

Create view toggle controls allowing users to switch between Month, Week, and Day views, with state management to track selected view and affect timeline grouping.

**Details:**

Create ViewToggle component with three buttons: Month, Week, Day. Use React useState or context to manage selected view. Style active view with visual distinction. Position toggles above entry timeline section. Implement state that will be consumed by EntryTimeline component to determine grouping and display logic (Month groups by month, Week groups by week, Day shows individual days). Consider using URL query params to persist view preference (e.g., ?view=week).

### 15.6. Create EntryCard component for timeline display

**Status:** pending  
**Dependencies:** 15.1  

Build reusable EntryCard component that displays individual journal entries with date/time, type badge, content preview, media thumbnails, and action buttons.

**Details:**

Create EntryCard.tsx component accepting entry data as props. Render: (1) Date/time header using date-fns format, (2) Entry type badge (SMS/Web) with distinct styling, (3) Polished content preview (max 3 paragraphs with truncation), (4) Media thumbnails grid (if entry has media), (5) 'View Original' toggle button, (6) Edit and Audio action buttons, (7) Click handler for navigation to /entries/:id. Style card with clean design, appropriate padding, hover effects, and responsive layout. Support both compact and expanded states for different view modes.

### 15.7. Implement infinite scroll with react-query and Intersection Observer

**Status:** pending  
**Dependencies:** 15.5, 15.6  

Build the entry timeline with infinite scroll functionality using react-query for pagination and Intersection Observer API for detecting scroll position.

**Details:**

Create EntryTimeline component that uses react-query's useInfiniteQuery hook to fetch paginated entries from GET /api/entries?page={n}&limit={limit}. Implement Intersection Observer to detect when user scrolls near bottom of timeline and trigger fetchNextPage(). Group entries by selected view (Month/Week/Day) using date-fns grouping logic. Render EntryCard components for each entry. Handle loading states (initial load, loading more), error states, and empty state (no entries). Implement proper cleanup for Intersection Observer on unmount.

### 15.8. Implement full-text search with debouncing and API integration

**Status:** pending  
**Dependencies:** 15.2, 15.7  

Wire up search input in header to perform full-text search against entries API with debouncing to minimize unnecessary requests.

**Details:**

In header search input, implement onChange handler with debouncing (300-500ms delay using useDebouncedValue or similar). When search value changes, update react-query to fetch GET /api/entries?search={query}. Replace/update the timeline's entry list with search results. Show loading indicator in search input during search. Handle empty search (revert to normal timeline). Show 'No results found' message when search returns 0 entries. Consider adding search result count display. Ensure search works across all view modes (Month/Week/Day).

### 15.9. Implement 'View Original' toggle with modal or side-by-side view

**Status:** pending  
**Dependencies:** 15.6  

Create functionality to toggle between polished and raw content views, showing a modal or side-by-side comparison when user clicks 'View Original' button.

**Details:**

In EntryCard component, implement 'View Original' button click handler. Options: (1) Modal approach - show dialog/modal with tabs or split view showing raw vs polished content, or (2) Inline approach - expand card to show both versions side-by-side. Implement state management for which entry's original is being viewed. Include close/dismiss functionality. Style raw content with monospace font or distinct styling to differentiate from polished. Handle cases where raw and polished are identical or when raw content is empty.

### 15.10. Implement entry navigation to detail view /entries/:id

**Status:** pending  
**Dependencies:** 15.6  

Add click handler to EntryCard that navigates user to detailed entry view page at /entries/:id when card is clicked.

**Details:**

In EntryCard component, add onClick handler to card container (excluding action buttons) that uses React Router's useNavigate() to navigate to /entries/:id where id is the entry's unique identifier. Ensure click doesn't fire when clicking buttons (Edit, Audio, View Original) using event.stopPropagation() on button clicks. Add visual affordance (cursor pointer, hover effect) to indicate card is clickable. Consider adding keyboard navigation support (Enter key) for accessibility.

### 15.11. Implement streak counter logic for consecutive days calculation

**Status:** pending  
**Dependencies:** 15.7  

Build streak calculation logic that determines consecutive days with journal entries and displays current streak count in stats footer.

**Details:**

Create utility function calculateStreak(entries) that: (1) Groups entries by date, (2) Sorts dates descending from today, (3) Counts consecutive days with at least one entry starting from today (or most recent entry date), (4) Returns streak count. Use date-fns functions like isSameDay, differenceInDays, parseISO for date logic. Fetch all entry dates (not full entries) for current user. Display streak in footer with icon/label (e.g., '🔥 7 day streak'). Handle edge cases: no entries (0 streak), broken streak (show last streak?), same-day multiple entries.

### 15.12. Implement monthly entry count in stats footer

**Status:** pending  
**Dependencies:** 15.7  

Calculate and display total number of journal entries created in the current month in the dashboard stats footer.

**Details:**

Create utility or react-query hook to count entries in current month. Query GET /api/entries with date range filter (startOfMonth to endOfMonth using date-fns) or use client-side filtering if all entries are already loaded. Display count in stats footer with label (e.g., '42 entries this month'). Update count when: (1) Month changes (calendar navigation), (2) New entry is created, (3) Entry is deleted. Consider showing additional stats like entries this week or today for enhanced engagement.

### 15.13. Create Glass spec for frontend/dashboard.glass with performance contract

**Status:** pending  
**Dependencies:** 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12  

Write Glass framework specification file documenting dashboard component's intent, contract, guarantees for performance, accessibility, and functionality.

**Details:**

Create glass/frontend/dashboard.glass following GLASS.md format. Document: (1) Intent - primary journal viewing interface with filtering and navigation, (2) Contract - guarantees including: performant rendering with 100+ entries (< 100ms initial render), accurate streak calculation (consecutive days logic), responsive search with debouncing, infinite scroll without layout shift, accessible UI (keyboard nav, ARIA labels, screen reader support), calendar highlights match entry dates, (3) Dependencies on API endpoints, auth context, (4) Integration points with EntryCard, settings, detail views. Include performance benchmarks and accessibility requirements (WCAG 2.1 AA compliance).
