# Telegram Bot Live Testing Guide

**Last Updated:** March 20, 2026

---

## Prerequisites

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow prompts:
   - Choose a name (e.g., "Indyfren")
   - Choose a username (must end in "bot", e.g., "indyfren_test_bot")
4. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Set Environment Variable

Add to your `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Configure Bot Commands

Send to @BotFather:

```
/setcommands
```

Select your bot, then paste:

```
start - Welcome message
help - Show available commands
scan - Find brand deals
deals - Show deal pipeline
wallet - Check wallet balance
calendar - View upcoming deadlines
finances - Financial snapshot
content - Content strategy
brief - Morning brief
```

### 4. Set Bot Description

```
/setdescription
```

Paste:

```
I'm Indyfren, your AI business manager. I help content creators find brand deals, negotiate rates, and manage their creator business.
```

### 5. Set Bot About Text

```
/setabouttext
```

Paste:

```
AI business manager for content creators. Powered by a configurable AI provider.
```

---

## Starting the Bot

### Local Development (Long Polling)

```bash
npm run dev
```

The bot starts long polling only when `ENABLE_TELEGRAM_BOT=true`,
`TELEGRAM_MODE=polling`, and `TELEGRAM_BOT_TOKEN` is configured.

**Look for this in logs:**

```
{"name":"indyfren","mode":"polling","msg":"Telegram bot configured"}
```

### Production (Webhook Mode)

Set `TELEGRAM_MODE=webhook` and configure `TELEGRAM_WEBHOOK_SECRET` in the
deployment environment. Then set the webhook after deploying to Railway:

```bash
curl --request POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  --form-string "url=https://your-api.railway.app/webhooks/telegram" \
  --form-string "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Keep `TELEGRAM_WEBHOOK_SECRET` out of the URL and logs. Telegram uses the
`secret_token` field to generate the `X-Telegram-Bot-Api-Secret-Token` header
that Indyfren verifies on every update.

Verify webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Testing Flows

### Flow 1: New User Onboarding

1. **Start the conversation**
   - Find your bot in Telegram (search for username)
   - Send `/start` or just say "Hello"

2. **Expected Response:**

   ```
   👋 Hey [Your Name]! I'm *Indyfren* — your AI business manager.

   🔐 I'm setting up your wallet on Tempo Network in the background so you can get started right away.

   *Tell me about yourself:*
   📱 What platforms are you on?
   👥 What's your follower count?
   🎯 What's your niche? (e.g., tech, fitness, finance)

   *Or just say:*
   💼 "scan for deals" — I'll find brand opportunities
   📊 "my rates" — See your rate card
   💰 "wallet" — Check your balance

   Type /help anytime to see all commands!
   ```

3. **Verify:**
   - ✅ Bot responds within 2 seconds
   - ✅ Message uses Markdown formatting
   - ✅ No error messages in backend logs
   - ✅ Creator profile created in database
   - ✅ Wallet provisioning triggered

### Flow 2: Quick Commands

#### Test: Calendar

Send: `calendar` or `/calendar`

**Expected:**

```
Upcoming Deadlines

⚠️ 2 overdue:
• Invoice #123 - OldBrand (2026-03-15)
• Content deadline - TechCorp (2026-03-18)

📅 3 upcoming:
• Follow-up call - FitnessBrand (2026-03-25)
• Contract review - BrandX (2026-03-28)
• Content deadline - SponsorY (2026-04-01)
```

or if no deadlines:

```
Upcoming Deadlines

No upcoming deadlines. Your calendar is clear!
```

#### Test: Finances

Send: `finances` or `/finances`

**Expected:**

```
💰 Financial Snapshot

Income (Last 30 Days): $5,000.00
• Brand deals: $4,500
• Sponsorships: $500

Expenses: $50.00
• Agent spend: $25

Net: $4,950.00

Pipeline: 5 active deals worth $10,000.00
```

#### Test: Content Plan

Send: `content plan` or `/content`

**Expected:**

```
📅 Content Strategy

This Week's Focus:
• Tech review video (YouTube)
• Instagram Reel on productivity
• Blog post: "10 Creator Tools"

Next Week:
• Podcast episode with guest
• TikTok series (3 posts)
```

#### Test: Help

Send: `/help` or `help`

**Expected:**

```
👋 Welcome back, [Name]! What can I help with?

*Quick Commands:*
💼 /scan — Find brand deals
📊 /deals — View deal pipeline
📅 /calendar — Upcoming deadlines
💰 /finances — Financial snapshot
👛 /wallet — Check balance
📝 /content — Content strategy
☀️ /brief — Morning brief

*Or just chat with me:*
"What's my rate for a sponsored post?"
"Draft a pitch for TechCorp"
"Show me my analytics"

Type /help anytime to see this menu.
```

### Flow 3: Agent Conversation

#### Test: Natural Language Query

Send: `What brand deals are available for a tech YouTuber with 50k subscribers?`

**Expected:**

1. Bot shows typing indicator
2. Agent processes the request
3. Response with brand suggestions:

   ```
   I found 5 brand opportunities for tech creators:

   1. TechCorp (Fit: 85/100)
      Est. value: $3,000
      Why: Great match for tech reviews

   2. GadgetBrand (Fit: 80/100)
      Est. value: $2,500
      Why: Looking for tech influencers

   ...
   ```

**Verify:**

- ✅ Agent responds (not just canned message)
- ✅ Response is relevant to query
- ✅ No AI provider API errors
- ✅ Response time < 5 seconds

#### Test: Follow-up Questions

Send: `Tell me more about TechCorp`

**Expected:**

```
TechCorp is a hardware manufacturer looking for tech reviewers.

Contact: partnerships@techcorp.com
Estimated budget: $2,000-$5,000
Best fit for: Product reviews, unboxing videos

Want me to draft a pitch?
```

**Verify:**

- ✅ Agent maintains context from previous message
- ✅ Response is personalized
- ✅ Conversation history persists

### Flow 4: Approval Flow (Hybrid Tools)

#### Test: Send Email Approval

Send: `Draft a pitch email for TechCorp`

**Expected:**

1. Agent generates pitch
2. Requests approval with buttons:

   ```
   I've drafted this pitch to TechCorp:

   Subject: Partnership Opportunity - Tech Reviews

   Hi TechCorp team,

   I'm a tech YouTuber with 50k subscribers...
   [pitch content]

   ⚡ _This action needs your approval._
   ```

   **[✅ Send] [❌ Skip]**

3. Click **✅ Send** button

**Expected After Approval:**

```
⚡ *Approved.* Executing now...

[processing...]

✅ *Done!* Email sent to partnerships@techcorp.com _(cost: $0.10)_
```

4. Click **❌ Skip** button

**Expected:**

```
✅ Got it. I skipped that action.
```

**Verify:**

- ✅ Buttons appear
- ✅ Button clicks register
- ✅ Action executes on approval
- ✅ Cost shown if applicable
- ✅ Skip works correctly

### Flow 5: Error Handling

#### Test: Invalid Command

Send: `randomnonexistentcommand123`

**Expected:**

```
I'm not sure what you mean. Try one of these:

- "scan for deals"
- "calendar"
- "finances"
- "wallet"

Or just ask me a question!
```

#### Test: Service Unavailable

Disconnect internet → Send message

**Expected:**

```
Something went wrong on my end. Please try again in a moment.
```

#### Test: Markdown Parse Error

If bot response has invalid Markdown, should fall back to plain text automatically.

**Verify:**

- ✅ No crash
- ✅ Message still delivered
- ✅ Error logged but user sees friendly message

---

## Common Issues & Solutions

### Bot doesn't respond

**Check:**

1. Bot token is correct: `echo $TELEGRAM_BOT_TOKEN`
2. Backend is running: `curl http://localhost:3000/health`
3. No error in logs: Check terminal output
4. Network connectivity: Can you reach api.telegram.org?

**Fix:**

```bash
# Restart backend
npm run dev

# Verify bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

### Webhook not working (production)

**Check webhook status:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

**Should return:**

```json
{
  "url": "https://your-api.railway.app/webhooks/telegram",
  "has_custom_certificate": false,
  "pending_update_count": 0,
  "last_error_date": 0
}
```

**If webhook fails:**

```bash
# Delete old webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Set new webhook
curl --request POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  --form-string "url=https://your-api.railway.app/webhooks/telegram" \
  --form-string "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

### Long polling conflicts

If you switch between local (long-polling) and production (webhook), clear webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

Then restart local server.

### Message splitting issues

Long messages (>4096 chars) should auto-split.

**Verify:**

- Multiple messages delivered
- Buttons only on last message
- No content lost

### Buttons not working

**Check:**

1. Callback data format: `approve:creatorId:actionId` or `skip:creatorId:actionId`
2. Action exists in database
3. Callback query handler registered

**Debug:**

```bash
# Check pending approvals
psql $DATABASE_URL -c "SELECT * FROM agent_actions WHERE status = 'pending';"
```

---

## Recent Improvements ✨

### March 20, 2026

The following UX improvements have been shipped:

1. **Slash Command Support**
   - All commands now support slash format: `/help`, `/scan`, `/calendar`, `/finances`, `/content`, `/wallet`, `/brief`, `/deals`
   - Commands auto-register in Telegram's command menu
   - Both `/calendar` and `calendar` work interchangeably

2. **Visual Enhancements**
   - Emojis in all messages for better scannability
   - Improved button labels: ✅ Send, ❌ Skip
   - Enhanced welcome and onboarding messages
   - Clearer command formatting with emoji indicators

3. **Better Feedback**
   - Typing indicator shows before agent responses
   - More specific error messages with guidance
   - Success/failure messages with emojis (✅/❌)
   - Cost displayed with currency formatting

4. **Test Coverage**
   - Added 12 new tests for slash commands and UX improvements
   - All 198 tests passing (100% pass rate)

## Performance Benchmarks

| Operation                           | Target | Acceptable |
| ----------------------------------- | ------ | ---------- |
| Simple command (calendar, finances) | <1s    | <2s        |
| Agent query (with LLM)              | <3s    | <5s        |
| Tool execution (web search)         | <2s    | <4s        |
| Message delivery                    | <500ms | <1s        |

---

## Testing Checklist

### Basic Functionality

- [ ] Bot responds to /start
- [ ] Bot responds to /help
- [ ] Onboarding flow works for new users
- [ ] Wallet provisioning triggered
- [ ] Messages use Markdown formatting
- [ ] Long messages split correctly

### Commands

- [ ] `/calendar` shows deadlines
- [ ] `/finances` shows financial snapshot
- [ ] `/content` shows content strategy
- [ ] `/wallet` shows balance
- [ ] `/scan` or "scan for deals" works
- [ ] `/deals` shows deal pipeline

### Agent Interaction

- [ ] Natural language queries work
- [ ] Agent maintains context
- [ ] Conversation history persists
- [ ] Agent responses are relevant
- [ ] No AI provider API errors

### Approval Flow

- [ ] Hybrid tools request approval
- [ ] Buttons appear correctly
- [ ] "Send" button executes action
- [ ] "Skip" button cancels action
- [ ] Cost shown after execution
- [ ] Action logged in database

### Error Handling

- [ ] Invalid commands handled gracefully
- [ ] Network errors don't crash bot
- [ ] Markdown parse errors fall back
- [ ] Friendly error messages shown
- [ ] Errors logged but not exposed to user

### Performance

- [ ] Response time < 2s for quick commands
- [ ] Response time < 5s for agent queries
- [ ] No memory leaks on long conversations
- [ ] Bot handles concurrent users

---

## Advanced Testing

### Load Testing

Send 10 messages rapidly:

```bash
for i in {1..10}; do echo "Test message $i"; sleep 0.5; done
```

**Verify:**

- All messages processed
- Responses in correct order
- No errors or timeouts

### Multi-User Testing

1. Create second bot conversation from different account
2. Send messages from both accounts simultaneously
3. Verify responses go to correct users

### Long Conversation

Send 20+ messages in single conversation.

**Verify:**

- Context maintained
- Memory doesn't grow unbounded
- Old messages summarized

---

## Monitoring

### Log Levels

**Info (30):** Normal operation

```json
{ "level": 30, "name": "bot:telegram", "msg": "Incoming message" }
```

**Error (50):** Action failed

```json
{ "level": 50, "name": "bot:telegram", "msg": "Failed to send message" }
```

### Key Metrics to Watch

- Messages received per minute
- Average response time
- Error rate
- Approval conversion rate
- Tool execution success rate

---

## Production Checklist

Before going live:

- [ ] Bot token configured
- [ ] Webhook set correctly
- [ ] Health checks passing
- [ ] Database connected
- [ ] Redis connected
- [ ] Configured AI provider working
- [ ] Bot commands set in @BotFather
- [ ] Bot description set
- [ ] Error monitoring enabled
- [ ] All test flows passing

---

## Support

If you encounter issues:

1. Check logs: `railway logs` or local terminal
2. Test health endpoint: `curl https://your-api/health`
3. Verify webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
4. Check database connectivity
5. Review [Telegram Bot API docs](https://core.telegram.org/bots/api)

---

**Happy Testing!** 🤖
