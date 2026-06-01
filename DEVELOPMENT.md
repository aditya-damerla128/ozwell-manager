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
node scripts/local-auth-proxy.js
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

Use:

```env
VITE_OZWELL_API_BASE_URL=http://localhost:3100
```

Do not commit local environment files. `.env.local` is intentionally ignored.

## Manager Flow

1. App loads and calls `GET /v1/manager/me`.
2. If the account is not provisioned, the app shows a non-destructive provisioning state.
3. If provisioned, the app loads agents and model metadata.
4. Agent create/edit happens through `@mieweb/q`.
5. Auth headers are never created or modified by React.

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
