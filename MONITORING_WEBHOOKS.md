# Monitoring & Webhooks Guide

## Overview
TripWire now has comprehensive monitoring and real-time notifications to track system health and notify users when their rules trigger.

## 🔔 Webhook Notifications

### Supported Channels
1. **HTTP** - POST to any URL
2. **Slack** - Slack incoming webhooks
3. **Discord** - Discord webhooks
4. **Email** - Email notifications (integration required)

### Event Types
- `RULE_TRIGGERED` - When a rule's condition is met
- `EXECUTION_STARTED` - When swap execution begins
- `EXECUTION_SUCCEEDED` - When swap completes successfully
- `EXECUTION_FAILED` - When swap fails
- `RULE_PAUSED` - When rule paused due to failures
- `WALLET_LOW_BALANCE` - Wallet balance warning

## 📡 User-Facing API

### Create Webhook

**HTTP Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "HTTP",
    "url": "https://your-server.com/webhook",
    "events": ["RULE_TRIGGERED", "EXECUTION_SUCCEEDED", "EXECUTION_FAILED"],
    "enabled": true
  }'
```

**Slack Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SLACK",
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "events": ["RULE_TRIGGERED", "EXECUTION_SUCCEEDED"],
    "enabled": true
  }'
```

**Discord Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DISCORD",
    "url": "https://discord.com/api/webhooks/YOUR/WEBHOOK/URL",
    "events": ["EXECUTION_SUCCEEDED", "EXECUTION_FAILED"],
    "enabled": true
  }'
```

### List Webhooks
```bash
curl http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Update Webhook
```bash
curl -X PUT http://localhost:3000/api/webhooks/1 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

### Test Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/1/test \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Delete Webhook
```bash
curl -X DELETE http://localhost:3000/api/webhooks/1 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 📊 Admin Monitoring API

### System Health
```bash
curl http://localhost:3000/api/admin/health
```

Response:
```json
{
  "success": true,
  "healthy": true,
  "checks": {
    "database": true,
    "dlqSize": true,
    "executionRate": true
  }
}
```

### System Metrics
```bash
curl http://localhost:3000/api/admin/metrics
```

Response:
```json
{
  "success": true,
  "metrics": {
    "executions": {
      "total": 42,
      "succeeded": 38,
      "failed": 4,
      "pending": 0,
      "successRate": 90.48
    },
    "rules": {
      "total": 15,
      "active": 12,
      "paused": 2,
      "failed": 1
    },
    "users": {
      "total": 8,
      "withActiveRules": 6
    },
    "dlq": {
      "pending": 2,
      "resolved": 10
    },
    "uptime": 3600000,
    "timestamp": "2026-02-08T23:45:00.000Z"
  }
}
```

### Execution History
```bash
# All executions (last 100)
curl http://localhost:3000/api/admin/executions

# Filter by status
curl "http://localhost:3000/api/admin/executions?status=EXECUTED&limit=50"

# Filter by user
curl "http://localhost:3000/api/admin/executions?userId=1"

# Filter by rule
curl "http://localhost:3000/api/admin/executions?ruleId=5"
```

### Dead Letter Queue
```bash
# Get pending DLQ items
curl "http://localhost:3000/api/admin/dlq?status=PENDING"

# Get resolved items
curl "http://localhost:3000/api/admin/dlq?status=RESOLVED"

# Retry a DLQ item
curl -X POST http://localhost:3000/api/admin/dlq/1/retry
```

### All Rules
```bash
curl http://localhost:3000/api/admin/rules
```

### All Users
```bash
curl http://localhost:3000/api/admin/users
```

### System Logs
```bash
# Recent logs
curl "http://localhost:3000/api/admin/logs?limit=100"

# Filter by event type
curl "http://localhost:3000/api/admin/logs?eventType=AUTH"
```

## 🎯 Webhook Payload Examples

### Rule Triggered
```json
{
  "event": "RULE_TRIGGERED",
  "timestamp": "2026-02-08T23:45:00.000Z",
  "title": "🎯 Rule Triggered",
  "description": "Rule \"Recession Hedge\" triggered! Market USRECESSION-2026 probability is now 67.5% (threshold: 65.0%)",
  "data": {
    "ruleId": 1,
    "ruleName": "Recession Hedge",
    "marketId": "USRECESSION-2026",
    "probability": 0.675,
    "threshold": 0.65
  }
}
```

### Execution Succeeded
```json
{
  "event": "EXECUTION_SUCCEEDED",
  "timestamp": "2026-02-08T23:46:00.000Z",
  "title": "✅ Execution Succeeded",
  "description": "Successfully executed rule \"Recession Hedge\". Transaction: 5Kd7Q3...",
  "data": {
    "ruleId": 1,
    "ruleName": "Recession Hedge",
    "executionId": 123,
    "marketId": "USRECESSION-2026",
    "txSignature": "5Kd7Q3X4Hn8LmP9..."
  }
}
```

### Execution Failed
```json
{
  "event": "EXECUTION_FAILED",
  "timestamp": "2026-02-08T23:47:00.000Z",
  "title": "❌ Execution Failed",
  "description": "Failed to execute rule \"Recession Hedge\". Error: Insufficient balance",
  "data": {
    "ruleId": 1,
    "ruleName": "Recession Hedge",
    "executionId": 124,
    "marketId": "USRECESSION-2026",
    "errorMessage": "Insufficient balance"
  }
}
```

## 🚀 Integration Examples

### Discord Bot
```javascript
// Your Discord webhook will automatically receive formatted embeds
// with color coding:
// - Green (0x10b981) for success
// - Red (0xef4444) for failures
// - Purple (0x8b5cf6) for triggers
// - Orange (0xf59e0b) for warnings
```

### Slack Integration
```javascript
// Slack receives formatted messages with blocks
// Example: "🎯 Rule Triggered"
// "Rule 'Recession Hedge' triggered! Market USRECESSION-2026..."
```

### Custom HTTP Endpoint
```javascript
// Receive webhook POST requests at your endpoint
app.post('/tripwire-webhook', (req, res) => {
  const { event, data, timestamp } = req.body;

  if (event === 'EXECUTION_SUCCEEDED') {
    console.log(`✅ Swap completed: ${data.txSignature}`);
    // Send notification to your users
    // Update your dashboard
    // Log to analytics
  }

  res.status(200).send('OK');
});
```

## 📈 Monitoring Dashboard (Future)

For internal monitoring, you can build a dashboard that polls:
- `/api/admin/health` every 30 seconds
- `/api/admin/metrics` every 5 minutes
- `/api/admin/dlq?status=PENDING` every minute

Example stack:
- **Frontend**: Next.js dashboard with auto-refresh
- **Visualization**: Recharts for metrics graphs
- **Alerting**: Integrate with PagerDuty/Opsgenie for health alerts

## 🔒 Security Notes

1. **Admin endpoints** (`/api/admin/*`) are currently open for prototype testing
   - In production, protect with admin authentication
   - Consider IP whitelisting

2. **Webhook secrets** (future enhancement)
   - Add HMAC signatures to webhook payloads
   - Verify webhook sources

3. **Rate limiting** (future enhancement)
   - Limit webhook calls per user
   - Prevent webhook spam

## 🎬 Quick Test

1. **Create a test webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "HTTP",
    "url": "https://webhook.site/YOUR-UNIQUE-ID",
    "events": ["RULE_TRIGGERED"],
    "enabled": true
  }'
```

2. **Test it:**
```bash
curl -X POST http://localhost:3000/api/webhooks/1/test \
  -H "Authorization: Bearer YOUR_API_KEY"
```

3. **Check webhook.site** to see the test payload!

## 📝 Next Steps

With monitoring & webhooks complete, you now have:
- ✅ Real-time user notifications
- ✅ System health monitoring
- ✅ Execution tracking and analytics
- ✅ Dead letter queue management

**Final step:** Adjust for real DeFi users (performance optimization, security hardening, cost analysis)

---

**Need help?** Check server logs for webhook delivery status and monitoring events.
