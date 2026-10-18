# HAR Sanitizer & Privacy Guard

Sanitize HTTP Archive (`.har`) files directly in your browser before attaching them to bug tickets, sharing with colleagues, or publishing to public repositories.

## The Problem
Modern web debugging requires inspecting network waterfalls and API payloads. However, `.har` exports contain raw requests with:
- `Authorization: Bearer ...` and Basic Auth headers
- Session and authentication cookies (`connect.sid`, `jwt`, `token`, `sessionid`)
- API keys in query parameters (`?api_key=...`, `?token=...`)
- Sensitive JSON payload keys (`password`, `access_token`, `client_secret`)

Uploading these logs to online tools leaks production credentials.

## The Solution
HAR Sanitizer runs entirely in your local browser sandbox:
- Zero server uploads or analytics.
- Scans requests, responses, headers, cookies, query strings, and post bodies.
- Lets you customize redaction masks (Mask, Strip, or Pseudonymize).
- Allows one-click download of the clean, valid `.har` file or single sanitized cURL commands.

## Quick Start
Open `index.html` in any modern web browser. Click **Load Sample HAR** or drag-and-drop an existing `.har` file.
