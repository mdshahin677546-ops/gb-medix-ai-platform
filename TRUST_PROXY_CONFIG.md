# GB Medix AI Trusted Proxy Configuration

Sprint 1B removes direct trust in user-supplied `X-Forwarded-For` by default.

## Runtime Behavior

- `TRUST_PROXY_HEADERS` must be set to `true` before the app reads proxy headers.
- If `TRUST_PROXY_HEADERS` is not `true`, AI usage records IP as `direct`.
- `direct` and `unknown` are never used for IP-level rate limiting, because that would put all users into one shared bucket.
- User-level daily call limits and token limits still apply when IP-level limiting is skipped.
- When enabled, the app reads `TRUST_PROXY_IP_HEADER`, then falls back to `cf-connecting-ip` and `x-vercel-forwarded-for`.
- Do not enable this setting unless the deployment platform overwrites these headers at the edge.

## Recommended Production Settings

For Cloudflare:

```env
TRUST_PROXY_HEADERS=true
TRUST_PROXY_IP_HEADER=cf-connecting-ip
```

For Vercel:

```env
TRUST_PROXY_HEADERS=true
TRUST_PROXY_IP_HEADER=x-vercel-forwarded-for
```

For direct Node/self-hosted deployments:

```env
TRUST_PROXY_HEADERS=false
```

## Operational Requirements

- The edge proxy must strip incoming client-provided forwarding headers.
- Only the edge proxy should set the trusted IP header.
- Production monitoring should alert on high `AIUsage.ip = direct` or `AIUsage.ip = unknown` volume, because that means trusted proxy headers are disabled or unavailable.
- IP rate limits are defense in depth. Authenticated user daily limits and token budgets remain authoritative per account.
