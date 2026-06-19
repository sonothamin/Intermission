# Intermission API Documentation

All API endpoints are hosted via Supabase Edge Functions. 

**Base URL:** `https://<PROJECT_REF>.supabase.co/functions/v1`  
**Authentication:** All endpoints (except public profiles) require a Bearer token in the `Authorization` header.

```http
Authorization: Bearer <USER_ACCESS_TOKEN>
```

---

## 1. Media Search (`/media-search`)
Search for movies or TV shows, or get trending media if no query is provided.

**GET** `/media-search`
* **Query Params:**
  * `q` (string): Search query. Leave empty for trending.
  * `type` (string): `movie`, `tv`, or `all` (default: `all`)
  * `page` (number): Pagination (default: `1`)

**Example Request:**
```http
GET /media-search?q=Inception&type=movie
```

**Example Response:**
```json
{
  "results": [
    {
      "tmdb_id": 27205,
      "media_type": "movie",
      "title": "Inception",
      "release_year": 2010,
      "poster_url": "https://image.tmdb.org/t/p/w500/...jpg",
      "genres": ["Action", "Science Fiction"],
      "user_status": {
        "status": "watching",
        "rating": null
      },
      "in_watchlist": false
    }
  ],
  "total_results": 1,
  "total_pages": 1,
  "source": "tmdb"
}
```

---

## 2. Media Details (`/media-details`)
Get full details for a movie or TV show, merged with the user's library state.

**GET** `/media-details`
* **Query Params:**
  * `tmdb_id` (number, required)
  * `type` (string, required): `movie` or `tv`

**Example Request:**
```http
GET /media-details?tmdb_id=27205&type=movie
```

**Example Response:**
```json
{
  "media": {
    "title": "Inception",
    "runtime_minutes": 148,
    "overview": "Cobb, a skilled thief...",
    "genres": ["Action", "Science Fiction"]
    // ... extensive TMDB metadata
  },
  "user_entry": {
    "id": "uuid-1234",
    "status": "completed",
    "rating": 9.5,
    "times_watched": 2
  },
  "episode_progress": null
}
```

---

## 3. Season Details (`/season-details`)
Get full metadata for a specific TV show season.

**GET** `/season-details`
* **Query Params:**
  * `tmdb_id` (number, required)
  * `season_number` (number, required)

---

## 4. Library (`/library`)
CRUD operations for the user's core media tracking collection.

### List Library
**GET** `/library`
* **Query Params:** `status`, `type`, `genre`, `sort_by`, `sort_dir`, `page`, `limit`

**Example Response:**
```json
{
  "data": [
    {
      "id": "uuid-1234",
      "tmdb_id": 27205,
      "title": "Inception",
      "status": "completed",
      "rating": 9.5,
      "times_watched": 2,
      "updated_at": "2026-06-19T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
}
```

### Add to Library
**POST** `/library`
* **Body:**
```json
{
  "tmdb_id": 27205,
  "media_type": "movie",
  "status": "watching",
  "rating": 9.5,
  "notes": "Masterpiece"
}
```

### Update Library Item
**PATCH** `/library?id=<LIBRARY_UUID>`
* **Body (Partial updates allowed):**
```json
{
  "status": "completed",
  "rating": 10.0,
  "episodes_watched": 5,
  "current_season": 1,
  "current_episode": 5
}
```

### Remove from Library
**DELETE** `/library?id=<LIBRARY_UUID>`

---

## 5. Episode Progress (`/episode-progress`)
Granular tracking for TV shows down to the episode level.

### Get Progress
**GET** `/episode-progress?tmdb_id=1399&season_number=1`

### Mark Episode
**POST** `/episode-progress`
* **Body:**
```json
{
  "tmdb_id": 1399,
  "season_number": 1,
  "episode_number": 1,
  "watched": true,
  "rating": 8.0
}
```

### Bulk Mark Episodes
**POST** `/episode-progress`
* **Body:**
```json
{
  "bulk": true,
  "tmdb_id": 1399,
  "season_number": 1,
  "episodes": [1, 2, 3, 4],
  "watched": true
}
```

### Update/Remove Episode Log
* **PATCH** `/episode-progress?id=<UUID>` (Update rating/notes)
* **DELETE** `/episode-progress?id=<UUID>`

---

## 6. Watchlist (`/watchlist`)
Queue of media the user plans to watch.

### List Watchlist
**GET** `/watchlist`
* **Query Params:** `type`, `sort_by` (priority, created_at, title), `sort_dir`, `page`

### Add to Watchlist
**POST** `/watchlist`
* **Body:**
```json
{
  "tmdb_id": 157336,
  "media_type": "movie",
  "priority": 10
}
```

### Update/Remove Watchlist Item
* **PATCH** `/watchlist?id=<UUID>` (Update priority/notes)
* **DELETE** `/watchlist?id=<UUID>`

---

## 7. Scrobble (`/scrobble`)
Auto-tracking events from a video player or client. Automatically handles library status transitions (e.g. promoting a movie to "completed" at 90% progress).

**POST** `/scrobble`
* **Body:**
```json
{
  "tmdb_id": 27205,
  "media_type": "movie",
  "event": "progress",
  "progress_pct": 95
}
```
* **Event Types:** `start`, `progress`, `complete`, `pause`

**Example Response (Auto-Complete Triggered):**
```json
{
  "event": "complete",
  "media_type": "movie",
  "times_watched": 3
}
```

---

## 8. Analytics (`/analytics`)
Aggregated statistics for charts and dashboard.

**GET** `/analytics`
* **Query Params:** `period` (all, 30d, 90d, 1y), `type` (movie, tv)

**Example Response:**
```json
{
  "period": "all",
  "summary": {
    "total_items": 150,
    "movies_watched": 100,
    "series_tracked": 50,
    "total_hours_watched": 345.5,
    "avg_rating": 8.2
  },
  "series_status": {
    "watching": 5,
    "completed": 40,
    "dropped": 5
  },
  "genres": [
    { "name": "Action", "count": 80 }
  ],
  "rating_distribution": [
    { "score": 10, "count": 25 },
    { "score": 9, "count": 45 }
  ]
}
```

---

## 9. Settings (`/settings`)
User preferences.

**GET** `/settings`
**PATCH** `/settings`
* **Body:**
```json
{
  "theme": "dark",
  "adult_content": true,
  "default_list_view": "compact"
}
```

---

## 10. Profile (`/profile`)
Public and private user profiles.

**GET** `/profile` (or `?user_id=<UUID>` for public profiles)
**PATCH** `/profile`
* **Body:**
```json
{
  "display_name": "Cinephile99",
  "bio": "I watch too many movies."
}
```

**POST** `/profile`
* **Headers:** `Content-Type: multipart/form-data`
* **Body:** Form data containing `avatar` file upload. Returns new `avatar_url`.

---

## 11. Account (`/account`)
Account management and GDPR compliance.

### Summary
**GET** `/account`
Returns combined profile, user_id, email, and counts (library, watchlist).

### Data Export (GDPR)
**POST** `/account?action=export`
Returns a downloadable `application/json` file with the user's entire library, watchlist, stats, and profile history.

### Delete Account
**DELETE** `/account`
* **Body:**
```json
{
  "confirm": "DELETE MY ACCOUNT"
}
```
Permanently deletes the user from Auth and cascades deletions across all database tables.
