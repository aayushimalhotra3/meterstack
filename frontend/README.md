# MeterStack Frontend

React + Vite dashboard for the MeterStack backend.

## Local Run

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` if your backend is not running on `http://localhost:8000`.

## Main Screens

- Login / signup
- Dashboard overview
- Usage analytics
- Billing plans and subscription state
- Entitlements
- API key management

## Verification

```bash
npm run lint --silent
npm run build
```
