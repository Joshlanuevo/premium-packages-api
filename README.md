# premium-packages-api

Express + TypeScript backend for the standalone Premium Packages product.

## Setup

```
npm install
cp .env.example .env   # fill in Firebase service account values
npm run dev
```

Visit `http://localhost:4000/api/health`.

## Structure

- `src/config/firebase.ts` — Firestore + Firebase Auth admin client (shared Firestore project with core POTB)
- `src/middleware/auth.ts` — verifies bearer tokens issued by core POTB. Currently assumes Firebase Auth ID tokens; swap the verification strategy here if POTB uses a custom JWT instead.
- `src/services/` — business logic, one file per domain (packages, installments). Controllers stay thin; this is where ported legacy logic (`write_package`, `update_payment`, etc.) belongs.
- `src/controllers/` — HTTP glue only: pull params off `req`, call a service, shape the response.
- `src/routes/` — route definitions, grouped by domain, aggregated in `routes/index.ts`.

## Still to port from the legacy PHP controller

- Availability blocking reconciliation (anti-doubling logic) into `package.service.ts`
- Full `update_payment` behavior: partial payment shortfall/excess redistribution, addons sync, full-payment supersession, submission `payment_status` recomputation
- `createFullPayment`, `updatePaymentDueDate`, `deletePaymentTerm`, `addAdditionalPaymentTerm` endpoints
- Confirm decision on the agent-balance check before dropping it — see `installment.service.ts` comment
