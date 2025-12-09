# System Status Dashboard Guide

## Overview

The System Status Dashboard is a unified page that combines three previously separate routes into a single tabbed interface:

- **System Status** - Shows system health and operational status
- **Test Panel** - Provides testing tools for Meshy API integration
- **Debug Panel** - Offers debugging tools and diagnostics

## URL Structure

The dashboard uses URL parameters to control which tab is displayed:

- `/system-status` - Default view (System Status tab)
- `/system-status?tab=system-status` - System Status tab
- `/system-status?tab=test-panel` - Test Panel tab
- `/system-status?tab=debug-panel` - Debug Panel tab

## Navigation

### From Footer
The footer contains three buttons that navigate to specific tabs:

1. **System Status** → `/system-status?tab=system-status`
2. **Test Panel** → `/system-status?tab=test-panel`
3. **Debug Panel** → `/system-status?tab=debug-panel`

### Direct Navigation
Users can also navigate directly to any tab by:
- Typing the URL with the appropriate `tab` parameter
- Using browser bookmarks with specific tab parameters
- Sharing links to specific tabs

## Features

### Tab Switching
- Smooth transitions between tabs with fade-in animations
- URL updates automatically when switching tabs
- Browser back/forward buttons work correctly
- Invalid tab parameters redirect to the default System Status tab

### Responsive Design
- Works on desktop and mobile devices
- Tab navigation adapts to screen size
- Content panels are responsive

### Visual Indicators
- Each tab has a unique color scheme:
  - System Status: Cyan
  - Test Panel: Green
  - Debug Panel: Yellow
- Active tab is highlighted with background color and border
- Icons provide visual context for each tab

## Implementation Details

### Components Used
- `SystemStatus` - Main dashboard component
- `ServiceStatusPanel` - System status display
- `MeshyTestPanel` - Testing interface
- `MeshyDebugPanel` - Debugging tools

### State Management
- Uses React Router's `useSearchParams` for URL parameter management
- Local state tracks the active tab
- URL validation ensures only valid tabs are accessible

### Animations
- CSS fade-in animation for tab content transitions
- Smooth hover effects on tab buttons
- Backdrop blur effects for modern UI feel

## Migration Notes

### Old Routes (Removed)
- `/service-status` → Now `/system-status?tab=system-status`
- `/test-panel` → Now `/system-status?tab=test-panel`
- `/debug-panel` → Now `/system-status?tab=debug-panel`

### Benefits
- Unified user experience
- Reduced route complexity
- Better navigation flow
- Easier maintenance
- Consistent styling across all panels 