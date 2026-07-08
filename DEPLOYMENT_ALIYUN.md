# GB Medix AI Platform Deployment

## Recommended Setup

Use Vercel for the Next.js app and Alibaba Cloud DNS for the domain.

## Required Production Environment Variables

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
ALIPAY_CHECKOUT_URL="..."
AUTH_SECRET="use-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://ai.yourdomain.com"
```

## Alibaba Cloud DNS

Recommended subdomain:

```text
ai.yourdomain.com
```

In Alibaba Cloud DNS, add the record Vercel gives you:

```text
Type: CNAME
Host: ai
Value: cname.vercel-dns.com
```

If Vercel provides a different target, use the exact target shown in Vercel.

## Vercel Steps

1. Push this repository to GitHub.
2. Import the GitHub repository into Vercel.
3. Add the environment variables above.
4. Add `ai.yourdomain.com` in Vercel Project Settings -> Domains.
5. Copy the DNS value Vercel shows.
6. Add that DNS record in Alibaba Cloud DNS.
7. Wait for DNS propagation and SSL issuance.

## Production Notes

- Use PostgreSQL in production, not local SQLite.
- Configure Stripe webhook to point to:

```text
https://ai.yourdomain.com/api/webhooks/stripe
```

- Keep doctor services marked beta until doctor verification, compliance, and operating policies are ready.
