# Style Usage Tracking System

## Overview

This document describes the style usage tracking system that tracks how many times each skybox style is used across all users on the website. The system provides efficient, real-time tracking and display of style popularity in the explore page gallery.

## Architecture

### Components

1. **Backend Tracker** (`functions/src/utils/styleUsageTracker.ts`)
   - Utility functions for managing style usage statistics in Firestore
   - Uses Firestore transactions for safe, atomic increments
   - Handles both single and batch operations

2. **Client Service** (`server/client/src/services/styleUsageService.ts`)
   - Client-side service mirroring backend functionality
   - Used by React components to fetch and display usage stats

3. **Firestore Collection** (`style_usage_stats`)
   - Dedicated collection for style usage statistics
   - Document structure:
     ```typescript
     {
       styleId: string,
       usageCount: number,
       firstUsedAt: Timestamp,
       lastUsedAt: Timestamp,
       createdAt: Timestamp,
       updatedAt: Timestamp
     }
     ```

## Features

### Automatic Tracking
- **Backend Integration**: Automatically tracks style usage when skyboxes are completed via:
  - Status check endpoint (`GET /api/skybox/status/:generationId`)
  - Webhook handler (`POST /api/skybox/webhook`)
- **Client Integration**: Tracks style usage when skyboxes are saved in `MainSection.jsx`

### Efficient Queries
- **Explore Page**: Fetches usage stats from dedicated collection instead of querying all skyboxes
- **Real-time Updates**: Usage counts update automatically as new skyboxes are generated
- **Sorted Display**: Styles are sorted by usage count (most popular first)

### Security
- **Public Read Access**: Anyone can read style usage stats (needed for explore page)
- **Backend-Only Writes**: Only backend services can write to prevent manipulation
- **Firestore Rules**: Configured in `firestore.rules`

## API Endpoints

### Get Style Usage Statistics
```
GET /api/skybox/style-usage
```

**Query Parameters:**
- `styleIds` (optional): Comma-separated list of style IDs to fetch

**Response:**
```json
{
  "success": true,
  "data": {
    "usageStats": {
      "1": 150,
      "2": 89,
      "5": 234
    }
  },
  "message": "Retrieved usage statistics for 3 styles",
  "requestId": "..."
}
```

### Migrate Style Usage (Backfill)
```
POST /api/skybox/migrate-style-usage?dryRun=true
```

**Query Parameters:**
- `dryRun` (optional): If `true`, only counts without writing (default: `false`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSkyboxes": 1250,
    "completedSkyboxes": 1180,
    "stylesProcessed": 45,
    "styleCounts": {
      "1": 150,
      "2": 89,
      ...
    },
    "errors": [],
    "dryRun": false
  },
  "message": "Migration completed successfully. Processed 45 styles.",
  "requestId": "..."
}
```

## Usage in Code

### Backend (Firebase Functions)

```typescript
import { incrementStyleUsage, getAllStyleUsageStats } from '../utils/styleUsageTracker';

// Increment usage when skybox completes
await incrementStyleUsage(styleId, 1);

// Get all usage stats
const stats = await getAllStyleUsageStats();
```

### Client (React)

```typescript
import { getAllStyleUsageStats, getStyleUsageCount } from '../services/styleUsageService';

// Get all usage stats
const stats = await getAllStyleUsageStats();

// Get usage for specific style
const count = await getStyleUsageCount(styleId);
```

## Migration Guide

### Initial Setup

If you have existing skyboxes, run the migration script to backfill style usage statistics:

1. **Dry Run** (recommended first):
   ```bash
   curl -X POST "https://your-api-url/api/skybox/migrate-style-usage?dryRun=true"
   ```

2. **Live Migration**:
   ```bash
   curl -X POST "https://your-api-url/api/skybox/migrate-style-usage"
   ```

The migration script will:
- Query all completed skyboxes from the `skyboxes` collection
- Count usage for each `style_id`
- Create/update documents in `style_usage_stats` collection
- Process in batches to avoid overwhelming Firestore

### After Migration

Once migration is complete, new skybox completions will automatically update the usage statistics. No further manual intervention is needed.

## Firestore Security Rules

The `style_usage_stats` collection has the following rules:

```javascript
match /style_usage_stats/{styleId} {
  allow read: if true; // Public read access (needed for explore page)
  allow write: if false; // Only backend/service can write
}
```

## Performance Considerations

1. **Efficient Queries**: The explore page now fetches from a single collection instead of querying all skyboxes
2. **Batch Processing**: Migration script processes in batches of 100
3. **Transactions**: All updates use Firestore transactions for consistency
4. **Caching**: Consider adding caching for frequently accessed stats

## Monitoring

### Key Metrics to Monitor

- Number of styles with usage > 0
- Total usage count across all styles
- Migration script execution time
- Error rates in style tracking

### Logging

The system logs:
- Style usage increments
- Migration progress
- Errors during tracking

Check Firebase Functions logs for:
- `[requestId] Tracking style usage for style {styleId}`
- `[requestId] Migration completed successfully`

## Troubleshooting

### Style Usage Not Updating

1. Check that skyboxes have `style_id` field set
2. Verify Firestore rules allow writes (backend only)
3. Check Firebase Functions logs for errors
4. Ensure `incrementStyleUsage` is called when skybox status changes to `completed`

### Migration Issues

1. Run with `dryRun=true` first to check counts
2. Check for errors in migration response
3. Verify Firestore permissions
4. Check that completed skyboxes have valid `style_id` values

### Explore Page Not Showing Usage

1. Verify `getAllStyleUsageStats()` is being called
2. Check browser console for errors
3. Verify Firestore rules allow read access
4. Check that migration has been run (if using existing data)

## Future Enhancements

Potential improvements:
- Add style usage analytics dashboard
- Track usage trends over time
- Add style popularity badges
- Implement style recommendations based on usage
- Add usage statistics to admin panel

