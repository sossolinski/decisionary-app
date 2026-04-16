This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Product Architecture

- Session engine direction: [docs/session-engine-architecture.md](docs/session-engine-architecture.md)
- Billing local setup: [docs/billing-local-setup.md](docs/billing-local-setup.md)

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local Supabase + Billing

If you are working on billing, Stripe invoices, or live-session entitlements, use:

```bash
npm run billing:doctor
npm run supabase:start
npm run supabase:reset
```

For the full local Stripe/Supabase flow, follow [docs/billing-local-setup.md](docs/billing-local-setup.md).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Notes

- App shell: Next.js App Router
- Data/auth: Supabase
- Billing: Stripe invoices + webhook provisioning
