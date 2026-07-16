# Security Policy

Please do not disclose vulnerabilities in a public issue. Report them privately
to the repository owner through GitHub's private vulnerability reporting when
available.

Never include production passwords, API keys, database URLs, session cookies,
customer data, or payment data in a report. Revoke or rotate an exposed secret
before removing it from Git history.

Security fixes are supported on the latest version of the `main` branch.

## Public online-store protection

Production checkout requires shared Redis/KV counters and Cloudflare Turnstile. The application enforces separate limits for IP address, store, email, and WhatsApp number; validates Turnstile through Siteverify; rejects a second active invoice for the same email or phone at a store; and limits checkout JSON to 16 KB.

Required production variables:

```env
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
NEXT_PUBLIC_TURNSTILE_SITE_KEY="..."
TURNSTILE_SECRET_KEY="..."
TURNSTILE_ALLOWED_HOSTNAMES="kasir-kita.com,www.kasir-kita.com"
```

`REDIS_URL` may replace the KV REST pair. Never use Cloudflare test keys in production.

## Vercel Firewall rule

Vercel Firewall configuration is project state and is not read from `vercel.json`. Publish this rule from **Project → Firewall → Configure**:

1. Name: `Online store checkout abuse`.
2. Conditions: Request Path equals `/api/store/[shopId]/checkout` and Method equals `POST` (use the framework Route selector if available).
3. Action: Rate Limit, Fixed Window, 10 requests per 10 minutes, counting key `IP`.
4. Start with `Log`, verify legitimate checkout traffic, then change the action to `429`/Rate Limit and publish.
5. Add a second custom rule that challenges suspicious traffic to `/store/*` during an attack. Do not challenge Pakasir callbacks or the private reconciliation cron.

Application-level Redis limits remain mandatory because edge WAF rules cannot enforce customer email, phone, and active-invoice constraints.
