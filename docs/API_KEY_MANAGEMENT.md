# API Key Management

## Permission Levels (Tiers)

The Krawlet API uses a two-tier system for API keys:

### 🆓 Free Tier (Default)

- **Rate Limit:** 1,000 requests/hour
- **Use Case:** Personal projects, testing, low-volume applications
- **Features:** Full access to all V1 endpoints
- **Cost:** Free

### 💎 Premium Tier

- **Rate Limit:** 5,000 requests/hour (default, configurable)
- **Use Case:** Production applications, high-volume integrations
- **Features:** Full access to all V1 endpoints + higher rate limits
- **Cost:** Custom (managed by administrators)

### 📊 Comparison

| Feature          | Anonymous | Free Tier  | Premium Tier |
| ---------------- | --------- | ---------- | ------------ |
| Rate Limit       | 100/hour  | 1,000/hour | 5,000+/hour  |
| Authentication   | None      | API Key    | API Key      |
| Request Tracking | IP-based  | Key-based  | Key-based    |
| Usage Analytics  | ❌        | ✅         | ✅           |
| Custom Limits    | ❌        | ❌         | ✅           |

---

## Quick Codes 🚀

Quick codes are 6-digit temporary codes that allow easy API key retrieval without copy-pasting long strings. Perfect for in-game chatbox interactions!

### How Quick Codes Work

1. **Generate:** Use `\krawlet api` in-game or request via API
2. **Receive:** Get a 6-digit code like `003721`
3. **Redeem:** Call the redemption endpoint within 15 minutes
4. **Done:** Receive your full API key

### Quick Code Properties

| Property    | Description                       |
| ----------- | --------------------------------- |
| Format      | 6-digit number (e.g., `003721`)   |
| Expiration  | 15 minutes from generation        |
| Single Use  | Code is cleared after redemption  |
| Regenerates | Redeeming generates a new API key |

### Generating a Quick Code (In-Game)

Use the chatbox command:

```
\krawlet api
```

You'll receive a 6-digit quick code to redeem via the API.

### Generating a Quick Code (API)

If you already have an API key and need a new one:

```bash
curl -X POST \
  -H "Authorization: Bearer kraw_your_key" \
  https://api.krawlet.cc/v1/apikey/quickcode/generate
```

**Response:**

```json
{
  "success": true,
  "data": {
    "quickCode": "003721",
    "expiresAt": "2026-01-27T12:15:00.000Z",
    "expiresIn": "15 minutes",
    "message": "Use this code to retrieve your full API key. Redeeming will regenerate your key."
  }
}
```

### Redeeming a Quick Code

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"code": "003721"}' \
  https://api.krawlet.cc/v1/apikey/quickcode/redeem
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Quick code redeemed successfully",
    "apiKey": "kraw_abc123def456...",
    "name": "PlayerName's API Key",
    "tier": "free",
    "rateLimit": 1000,
    "warning": "Save this API key securely - it will not be shown again!"
  }
}
```

### Quick Code Errors

| Error             | Cause                     |
| ----------------- | ------------------------- |
| `INVALID_REQUEST` | Missing or malformed code |
| `NOT_FOUND`       | Invalid or expired code   |

---

## Generating API Keys

### Basic Generation

Generate a free tier API key:

```bash
pnpm gen-apikey -- --name "My Application"
```

### With Email

Include contact information:

```bash
pnpm gen-apikey -- --name "My App" --email "user@example.com"
```

### Premium Tier

Create a premium tier key with higher limits:

```bash
pnpm gen-apikey -- --name "Production App" --tier premium
```

### Custom Rate Limit

Set a custom rate limit (useful for specific needs):

```bash
pnpm gen-apikey -- --name "Custom App" --tier premium --limit 10000
```

### View Help

```bash
pnpm gen-apikey -- --help
```

---

## Using API Keys

### In HTTP Requests

Include the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer kraw_your_api_key_here" \
  http://localhost:3000/v1/players
```

### In Postman

1. Open your request
2. Go to the **Authorization** tab
3. Select **Bearer Token**
4. Paste your API key (starting with `kraw_`)

### In JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3000/v1/players', {
  headers: {
    Authorization: 'Bearer kraw_your_api_key_here',
  },
});
```

### In Python

```python
import requests

headers = {
    'Authorization': 'Bearer kraw_your_api_key_here'
}

response = requests.get('http://localhost:3000/v1/players', headers=headers)
```

---

## Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1705046400
```

- **X-RateLimit-Limit:** Your total requests per hour
- **X-RateLimit-Remaining:** Requests remaining in current window
- **X-RateLimit-Reset:** Unix timestamp when the limit resets

---

## Rate Limit Exceeded

When you exceed your rate limit, you'll receive:

**Status:** `429 Too Many Requests`

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "details": {
      "limit": 1000,
      "resetAt": "2026-01-12T12:00:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-01-12T11:30:00.000Z",
    "elapsed": 5,
    "version": "v1",
    "requestId": "abc-123-def"
  }
}
```

**Headers:**

```http
Retry-After: 3600
```

---

## Security Best Practices

### ✅ DO

- Store API keys securely (environment variables, secrets manager)
- Use different keys for development and production
- Monitor key usage regularly
- Rotate keys periodically
- Use HTTPS in production

### ❌ DON'T

- Commit API keys to version control
- Share keys between applications
- Include keys in client-side code
- Log keys in application logs
- Use the same key across environments

---

## Key Management

### Viewing Key Information (CLI)

Use the `apikey-info` script to view API key details and usage:

```bash
# List all API keys
pnpm apikey-info -- --list

# Lookup by ID
pnpm apikey-info -- --id "a1b2c3d4-e5f6-..."

# Lookup by raw key
pnpm apikey-info -- --key "kraw_abc123..."

# Lookup by name (partial match)
pnpm apikey-info -- --name "My App"

# Skip detailed usage statistics
pnpm apikey-info -- --id "a1b2c3d4-..." --no-usage

# View help
pnpm apikey-info -- --help
```

### Viewing Key Information (API)

You can also retrieve your API key information via the API:

```bash
# Get full key info with usage statistics
curl -H "Authorization: Bearer kraw_your_key" \
  https://api.krawlet.cc/v1/apikey

# Get key info without usage stats
curl -H "Authorization: Bearer kraw_your_key" \
  "https://api.krawlet.cc/v1/apikey?usage=false"

# Get only usage statistics
curl -H "Authorization: Bearer kraw_your_key" \
  https://api.krawlet.cc/v1/apikey/usage

# Get recent request logs (default 50, max 100)
curl -H "Authorization: Bearer kraw_your_key" \
  "https://api.krawlet.cc/v1/apikey/logs?limit=25"
```

#### API Key Info Response

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "My Application",
    "email": "user@example.com",
    "tier": "free",
    "rateLimit": 1000,
    "isActive": true,
    "requestCount": 1234,
    "lastUsedAt": "2026-01-25T10:30:00.000Z",
    "createdAt": "2026-01-12T10:00:00.000Z",
    "usage": {
      "totalRequests": 1234,
      "last24h": 50,
      "last7d": 350,
      "last30d": 1200,
      "blockedRequests": 5,
      "avgResponseTimeMs": 45.23,
      "topEndpoints": [
        { "path": "/v1/players", "count": 500 },
        { "path": "/v1/shops", "count": 300 }
      ]
    }
  }
}
```

### Direct Database Queries

Keys are stored hashed in the database. You can query key information:

```sql
SELECT id, name, email, tier, rateLimit, isActive,
       requestCount, lastUsedAt, createdAt
FROM api_keys;
```

### Deactivating a Key

```sql
UPDATE api_keys SET isActive = false WHERE id = 'key-uuid';
```

### Deleting a Key

```sql
DELETE FROM api_keys WHERE id = 'key-uuid';
```

### Monitoring Usage

```sql
SELECT name, tier, requestCount, lastUsedAt
FROM api_keys
ORDER BY requestCount DESC
LIMIT 10;
```

---

## Example Output

When generating a key, you'll see:

```
✓ Database connected

✅ API Key Generated Successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 API KEY (save this - it will not be shown again):
   kraw_abc123def456...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Details:
   ID:         a1b2c3d4-e5f6-...
   Name:       My Application
   Email:      user@example.com
   Tier:       free
   Rate Limit: 1000 requests/hour
   Status:     Active
   Created:    2026-01-12T10:00:00.000Z

💡 Usage:
   curl -H "Authorization: Bearer kraw_abc123def456..." http://localhost:3000/v1/players

⚠️  IMPORTANT: Store this key securely. The raw key cannot be retrieved later.
```

---

## FAQ

### Can I retrieve a lost API key?

No. API keys are hashed before storage and cannot be retrieved. However, you can use `\krawlet api` in-game to generate a **quick code** that will regenerate your key. The quick code is easy to type and redeemable via the API.

### How do I increase my rate limit?

Contact an administrator to upgrade your key to premium tier or request a custom rate limit.

### Can I have multiple API keys?

Yes! Generate as many keys as you need for different applications or environments.

### What happens if I don't use an API key?

Anonymous requests are limited to 100 requests/hour, tracked by IP address.

### How long do API keys last?

API keys don't expire automatically. They remain active until deactivated or deleted.

### What are quick codes?

Quick codes are 6-digit temporary codes (e.g., `003721`) that make it easy to retrieve your API key, especially when using in-game commands where copy-paste isn't available. They expire after 15 minutes.

### Does redeeming a quick code invalidate my old key?

Yes! Redeeming a quick code generates a new API key, which invalidates your previous key. Any applications using the old key will need to be updated.
