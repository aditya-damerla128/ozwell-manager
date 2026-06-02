# Ozwell Manager

Standalone React frontend for managing Ozwell agents.

Ozwell Manager is an operational console, not a login surface. Auth is handled by the manager container or local auth proxy. The React app calls the Ozwell API and never creates, edits, or asks users for auth headers during normal agent workflows.

## App Features

- View manager identity and provisioning state
- List agents
- Create agents with the MIEWeb Q builder
- Edit existing agents with Q
- Reveal/copy agent keys
- Rotate agent keys
- Delete agents
- Reveal/copy the manager Ozwell parent key
- Claim an existing `ozw_` parent key


## Stack

- Vite
- React
- TypeScript
- `@mieweb/ui`
- `@mieweb/q`
- `lucide-react`

## Local Development

The frontend expects the Ozwell API through the local auth proxy:

```env
VITE_OZWELL_API_BASE_URL=http://localhost:3100
```

Start the frontend:

```bash
npm install
npm run dev -- --port 5174
```

Open:

```text
http://localhost:5174/
```

The backend and auth proxy must be running separately from `ozwellai-api`.

## API Contract

Manager identity:

```text
GET /v1/manager/me
```

Models for Q dropdown:

```text
GET /v1/manager/models
```

Agent operations:

```text
GET    /v1/manager/agents
POST   /v1/manager/agents
GET    /v1/manager/agents/:agent_id
PUT    /v1/manager/agents/:agent_id
POST   /v1/manager/agents/:agent_id/reveal-key
POST   /v1/manager/agents/:agent_id/rotate-key
DELETE /v1/manager/agents/:agent_id
```

Manager parent key operations:

```text
POST /v1/manager/parent-key/reveal
POST /v1/manager/claim-key
```

## Auth Model

- No login UI in this app
- No parent key input for normal create/edit
- The manager container or proxy injects trusted manager auth
- Local development uses the auth proxy on `localhost:3100`

## Build

```bash
npm run build
```
