# Development Notes

## Required Local Services

Run the backend from the `ozwellai-api` repository on branch `codex/manager-auth-backend`.

Backend API:

```bash
cd /Users/adityadamerla/GitHub/ozwellai-api
npm run dev
```

Local manager auth proxy:

```bash
cd /Users/adityadamerla/GitHub/ozwellai-api
node scripts/dev/manager-auth-proxy.js
```

Frontend:

```bash
cd /Users/adityadamerla/GitHub/ozwell-manager
npm run dev -- --port 5174
```

Open:

```text
http://localhost:5174/
```

## Environment

For Vite local development, use:

```env
VITE_OZWELL_API_BASE_URL=http://localhost:3100
```

Do not commit local environment files. `.env.local` is intentionally ignored.

For the production server, do not use the local auth proxy default. Set one of:

```env
OZWELL_API_TARGET=https://your-ozwell-backend.example.com
OZWELL_BACKEND_URL=https://your-ozwell-backend.example.com
```

The production server listens on `PORT=3000` by default and fails loudly if no backend target is configured.

## Manager Flow

1. App loads and calls `GET /v1/manager/me`.
2. If the account is not provisioned, the app shows a non-destructive provisioning state.
3. If provisioned, the app loads agents and model metadata.
4. Agent create/edit happens through `@mieweb/q`.
5. Auth headers are never created or modified by React.

## Production Proxy Flow

1. Build with `npm run build`.
2. Start with `OZWELL_API_TARGET=... npm start`.
3. The server serves `dist/` on port `3000`.
4. Browser requests to `/v1/*` are proxied to the configured backend target.
5. Incoming request headers, including `x-user-*`, are forwarded to the backend.

## Parent Key Flow

New users are auto-provisioned with a temporary parent `ozw_` key by the backend.

The manager UI supports:

- Reveal/copy current parent key with `POST /v1/manager/parent-key/reveal`
- Claim an existing parent key with `POST /v1/manager/claim-key`

When a key claim succeeds, refresh:

- `GET /v1/manager/me`
- `GET /v1/manager/agents`

Handle `409 parent_key_already_claimed` with a clear user-facing message.

## Private Local Notes

The local `docs/` folder can contain private working notes. Do not stage those files unless they are intentionally rewritten as public project documentation.
