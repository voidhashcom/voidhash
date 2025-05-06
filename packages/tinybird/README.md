# Website Analytics Platform with Tinybird

## Tinybird

### Overview
This project uses Tinybird to build a real-time website analytics platform that captures and analyzes visitor data, page views, and traffic sources. It also includes webhook event tracking functionality.

### Data sources

#### `website_visitors`
Captures website visitor data including page views, session information, and user properties.

**Sample ingestion request:**
```bash
curl -X POST "https://api.us-east.aws.tinybird.co/v0/events?name=website_visitors" \
  -H "Authorization: Bearer $TB_ADMIN_TOKEN" \
  -d '{
    "timestamp": "2023-04-15 14:30:25.123",
    "visitor_id": "v-123456789",
    "session_id": "s-987654321",
    "page_url": "https://example.com/products",
    "referrer": "https://google.com",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "ip_address": "192.168.1.1",
    "country": "United States",
    "city": "New York",
    "device_type": "desktop",
    "browser": "Chrome",
    "os": "macOS",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "spring_sale",
    "time_on_page": 120,
    "is_new_visitor": 1,
    "is_new_session": 1
  }'
```

#### `voidhash_webhook_events`
Stores webhook event data including request/response information and event status.

**Sample ingestion request:**
```bash
curl -X POST "https://api.us-east.aws.tinybird.co/v0/events?name=voidhash_webhook_events" \
  -H "Authorization: Bearer $TB_ADMIN_TOKEN" \
  -d '{
    "timestamp": "2023-04-15 14:32:45.789",
    "event_id": "evt-123456",
    "webhook_id": "wh-789012",
    "url": "https://api.example.com/webhook",
    "event": "payment.success",
    "http_status": 200,
    "request_body": "{\"payment_id\":\"pay-123\",\"amount\":99.99}",
    "response_body": "{\"status\":\"received\"}",
    "message_id": "msg-456789"
  }'
```

### Endpoints

#### `traffic_sources`
Analyzes traffic sources and attribution channels for website visitors.

**Sample request:**
```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/traffic_sources.json?token=$TB_ADMIN_TOKEN&start_date=2023-01-01%2000:00:00&end_date=2023-12-31%2023:59:59&limit=10"
```

Parameters:
- `start_date` (optional): Start date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `end_date` (optional): End date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `limit` (optional, default: 20): Maximum number of traffic sources to return

#### `top_pages`
Retrieves the most viewed pages on the website with visitor metrics.

**Sample request:**
```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/top_pages.json?token=$TB_ADMIN_TOKEN&start_date=2023-01-01%2000:00:00&end_date=2023-12-31%2023:59:59&limit=5"
```

Parameters:
- `start_date` (optional): Start date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `end_date` (optional): End date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `limit` (optional, default: 10): Maximum number of pages to return

#### `visitor_analytics`
Analyze website visitor data with filtering options by date range, page URL, and visitor segments.

**Sample request:**
```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/visitor_analytics.json?token=$TB_ADMIN_TOKEN&start_date=2023-01-01%2000:00:00&end_date=2023-12-31%2023:59:59&page_url=https://example.com/products&device_type=mobile&utm_source=google"
```

Parameters:
- `start_date` (optional): Start date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `end_date` (optional): End date for data filtering (format: YYYY-MM-DD HH:MM:SS)
- `page_url` (optional): Filter by specific page URL
- `device_type` (optional): Filter by device type (e.g., desktop, mobile, tablet)
- `utm_source` (optional): Filter by traffic source
