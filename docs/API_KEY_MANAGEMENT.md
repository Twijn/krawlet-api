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

### Viewing Key Information

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

No. API keys are hashed before storage and cannot be retrieved. If you lose a key, you must generate a new one and deactivate the old one.

### How do I increase my rate limit?

Contact an administrator to upgrade your key to premium tier or request a custom rate limit.

### Can I have multiple API keys?

Yes! Generate as many keys as you need for different applications or environments.

### What happens if I don't use an API key?

Anonymous requests are limited to 100 requests/hour, tracked by IP address.

### How long do API keys last?

API keys don't expire automatically. They remain active until deactivated or deleted.
