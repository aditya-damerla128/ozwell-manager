import { StrictMode, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentConfigGenerator } from '@mieweb/q';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
  SpinnerWithLabel,
  ThemeProvider,
  ThemeToggle,
} from '@mieweb/ui';
import { ArrowLeft, ChevronRight, Copy, Eye, KeyRound, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import {
  AgentDetail,
  AgentListItem,
  ApiError,
  KeyResponse,
  MeResponse,
  ParentKeyResponse,
  claimParentKey,
  createAgent,
  deleteAgent,
  getAgent,
  getMe,
  listAgents,
  listModels,
  revealParentKey,
  revealAgentKey,
  rotateAgentKey,
  updateAgent,
} from './api';
import { BrandInitializer, useBrand } from './brand';
import '@mieweb/q/style.css';
import './styles.css';

type LoadState = 'loading' | 'ready' | 'error';
type Page = 'agents' | 'editor';
type EditorMode = 'create' | 'edit';
type KeyMode = 'reveal' | 'rotate' | 'created' | 'saved';
type ParentKeyDialogMode = 'reveal' | 'claim';

const SCHEMA_MODEL_SECTION_ID = 'sec-model';
const SCHEMA_MODEL_FIELD_ID = 'model';

const baseOzwellSchema = {
  schemaType: 'mieforms-v1.0',
  title: 'Ozwell Agent Configuration',
  fields: [
    {
      id: 'sec-basic',
      fieldType: 'section',
      title: 'Basic Info',
      fields: [
        { id: 'name', fieldType: 'text', question: 'Agent Name', answer: 'My Agent', required: true },
        {
          id: 'instructions',
          fieldType: 'longtext',
          question: 'Instructions',
          answer: 'You are a helpful assistant.',
          required: true,
        },
      ],
    },
    {
      id: SCHEMA_MODEL_SECTION_ID,
      fieldType: 'section',
      title: 'Model Settings',
      fields: [
        {
          id: SCHEMA_MODEL_FIELD_ID,
          fieldType: 'dropdown',
          question: 'Model',
          answer: 'qwen2.5-coder:3b',
          required: false,
          options: [
            { id: 'm-gptoss', label: 'gpt-oss:latest', value: 'gpt-oss:latest' },
            { id: 'm-qwen3b', label: 'qwen2.5-coder:3b', value: 'qwen2.5-coder:3b' },
            { id: 'm-qwen7b', label: 'qwen2.5-coder:7b', value: 'qwen2.5-coder:7b' },
            { id: 'm-llama3', label: 'llama3', value: 'llama3' },
            { id: 'm-llama31', label: 'llama3.1', value: 'llama3.1' },
          ],
        },
        {
          id: 'temperature',
          fieldType: 'text',
          question: 'Temperature (0.0 - 1.0)',
          answer: '0.7',
          required: false,
          configType: 'number',
        },
      ],
    },
  ],
};

function cloneSchema() {
  return structuredClone(baseOzwellSchema);
}

function schemaWithModelOption(schema: Record<string, unknown>, model?: string) {
  if (!model) return schema;
  const nextSchema = structuredClone(schema) as typeof baseOzwellSchema;
  const modelSection = nextSchema.fields.find((field) => field.id === SCHEMA_MODEL_SECTION_ID);
  const modelField = modelSection?.fields.find((field) => field.id === SCHEMA_MODEL_FIELD_ID);
  if (!modelField) return schema;

  const mutableModelField = modelField as typeof modelField & {
    options?: Array<{ id: string; label: string; value: string }>;
  };
  const options = mutableModelField.options || [];
  if (!options.some((option) => option.value === model)) {
    mutableModelField.options = [{ id: `m-current-${model}`, label: model, value: model }, ...options];
  }
  return nextSchema;
}

function getDisplayName(me?: MeResponse) {
  if (!me) return 'Manager';
  const firstLast = [me.identity.first_name, me.identity.last_name].filter(Boolean).join(' ');
  return firstLast || me.identity.username || me.identity.email || 'Manager';
}

function formatDate(timestamp?: number) {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000));
}

function countTools(tools: unknown) {
  return Array.isArray(tools) ? tools.length : 0;
}

function initialConfigFromAgent(agent: AgentDetail) {
  return {
    name: agent.name,
    instructions: agent.instructions,
    model: agent.model,
    temperature: agent.temperature,
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    behavior: agent.behavior,
  } as Record<string, unknown>;
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="empty-state" variant="outlined" padding="xl">
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'danger' | 'success'; children: React.ReactNode }) {
  const variant = tone === 'neutral' ? 'info' : tone;
  return (
    <Alert className="notice" variant={variant}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function AgentsPage({
  me,
  agents,
  loading,
  onNew,
  onOpen,
  onRefresh,
  onRevealParentKey,
  onClaimParentKey,
  onReveal,
  onRotate,
  onDelete,
}: {
  me: MeResponse;
  agents: AgentListItem[];
  loading: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onRevealParentKey: () => void;
  onClaimParentKey: () => void;
  onReveal: (agent: AgentListItem) => void;
  onRotate: (agent: AgentListItem) => void;
  onDelete: (agent: AgentListItem) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgents = normalizedQuery
    ? agents.filter((agent) =>
        [agent.name, agent.id, agent.model, agent.key_hint]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
      )
    : agents;

  return (
    <Card className="agents-page" variant="outlined" padding="none">
      <CardHeader className="panel-head">
        <div>
          <p className="eyebrow">Agents</p>
          <CardTitle as="h2">Your agents</CardTitle>
          <CardDescription>Manage agent configuration, keys, and Q editor access.</CardDescription>
        </div>
        <div className="button-row">
          <Button
            variant="secondary"
            type="button"
            onClick={onRefresh}
            leftIcon={<RefreshCw aria-hidden="true" size={16} />}
          >
            Refresh
          </Button>
          <Button variant="primary" type="button" onClick={onNew} leftIcon={<Plus aria-hidden="true" size={16} />}>
            New agent
          </Button>
        </div>
      </CardHeader>

      {loading ? (
        <CardContent className="loading-content">
          <SpinnerWithLabel label="Fetching your Ozwell agents" />
        </CardContent>
      ) : agents.length === 0 ? (
        <EmptyState title="No agents yet">Create your first agent with the Ozwell Q builder.</EmptyState>
      ) : (
        <CardContent className="agent-list-content">
          <div className="agent-toolbar">
            <label className="agent-search">
              <Search aria-hidden="true" size={16} />
              <span className="sr-only">Search agents</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, id, model, or key"
              />
            </label>
            <div className="agent-count">
              {filteredAgents.length} of {agents.length} agents
            </div>
          </div>

          <div className="agent-grid-head" aria-hidden="true">
            <span>Name</span>
            <span>Model</span>
            <span>Tools</span>
            <span>Key</span>
            <span>Created</span>
            <span>Actions</span>
          </div>

          {filteredAgents.length === 0 ? (
            <div className="agent-filter-empty">No agents match the current search.</div>
          ) : (
            <div className="agent-grid">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="agent-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(agent.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpen(agent.id);
                    }
                  }}
                  aria-label={`Open ${agent.name || 'untitled agent'} in Q`}
                >
                  <div className="agent-name-cell">
                    <strong>{agent.name || 'Untitled agent'}</strong>
                    <span>{agent.id}</span>
                  </div>
                  <span className="agent-model-chip">{agent.model || 'Not set'}</span>
                  <span className="agent-tools-cell">{countTools(agent.tools)}</span>
                  <span className="agent-key-cell">{agent.key_hint || '-'}</span>
                  <span className="agent-created-cell">{formatDate(agent.created_at)}</span>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => onReveal(agent)}
                      leftIcon={<Eye aria-hidden="true" size={15} />}
                      aria-label={`Reveal key for ${agent.name || agent.id}`}
                    >
                      Show
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => onRotate(agent)}
                      leftIcon={<RotateCcw aria-hidden="true" size={15} />}
                      aria-label={`Rotate key for ${agent.name || agent.id}`}
                    >
                      Rotate
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      type="button"
                      onClick={() => onDelete(agent)}
                      leftIcon={<Trash2 aria-hidden="true" size={15} />}
                      aria-label={`Delete ${agent.name || agent.id}`}
                    >
                      Delete
                    </Button>
                    <ChevronRight className="agent-row-chevron" aria-hidden="true" size={17} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
      <CardContent className="manager-key-panel">
        <div>
          <p className="manager-key-label">Ozwell account key</p>
          <p className="manager-key-copy">
            {me.parent_key_hint || (me.has_parent_key ? 'Available for this manager account' : 'No account key found')}
          </p>
        </div>
        <div className="button-row">
          <Button
            variant="secondary"
            type="button"
            onClick={onRevealParentKey}
            leftIcon={<KeyRound aria-hidden="true" size={16} />}
            disabled={!me.has_parent_key}
          >
            Reveal / Copy Ozwell key
          </Button>
          <Button variant="secondary" type="button" onClick={onClaimParentKey}>
            Claim existing Ozwell key
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentEditorPage({
  mode,
  agent,
  schema,
  onBack,
  onSubmitted,
  onReveal,
  onRotate,
  onDelete,
}: {
  mode: EditorMode;
  agent: AgentDetail | null;
  schema: Record<string, unknown>;
  onBack: () => void;
  onSubmitted: (agentId: string, key?: KeyResponse) => void;
  onReveal: (agent: AgentDetail) => void;
  onRotate: (agent: AgentDetail) => void;
  onDelete: (agent: AgentDetail) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initialConfig = useMemo(() => (agent ? initialConfigFromAgent(agent) : undefined), [agent]);
  const editorSchema = useMemo(() => schemaWithModelOption(schema, agent?.model), [schema, agent?.model]);
  const title = mode === 'create' ? 'Create agent' : agent?.name || 'Edit agent';

  async function submit(yaml: string) {
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        const created = await createAgent(yaml);
        onSubmitted(created.agent_id, created);
      } else if (agent) {
        await updateAgent(agent.agent_id, yaml);
        onSubmitted(agent.agent_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="editor-page" variant="outlined" padding="none">
      <CardHeader className="panel-head">
        <div>
          <p className="eyebrow">{mode === 'create' ? 'New agent' : 'Editing agent'}</p>
          <CardTitle as="h2">{title}</CardTitle>
          {agent && <p className="subtle">{agent.agent_id}</p>}
        </div>
        <div className="button-row">
          <Button variant="secondary" type="button" onClick={onBack} leftIcon={<ArrowLeft aria-hidden="true" size={16} />}>
            Back to agents
          </Button>
          {agent && (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={() => onReveal(agent)}
                leftIcon={<Eye aria-hidden="true" size={16} />}
              >
                Reveal key
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => onRotate(agent)}
                leftIcon={<RotateCcw aria-hidden="true" size={16} />}
              >
                Rotate key
              </Button>
              <Button variant="danger" type="button" onClick={() => onDelete(agent)} leftIcon={<Trash2 aria-hidden="true" size={16} />}>
                Delete
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      {saving && <Notice>{mode === 'create' ? 'Creating agent...' : 'Saving agent...'}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="q-editor-frame">
        <AgentConfigGenerator
          key={agent?.agent_id || 'new-agent'}
          schema={editorSchema}
          initialConfig={initialConfig}
          showEditor
          onSubmit={submit}
        />
      </div>
    </Card>
  );
}

function KeyDialog({
  mode,
  agent,
  onClose,
  onRotated,
}: {
  mode: KeyMode;
  agent: Pick<AgentDetail, 'agent_id' | 'name'>;
  onClose: () => void;
  onRotated: () => void;
}) {
  const [state, setState] = useState<LoadState>(mode === 'saved' ? 'ready' : 'loading');
  const [result, setResult] = useState<KeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (mode === 'saved') return undefined;
    const action = mode === 'rotate' ? rotateAgentKey : revealAgentKey;
    action(agent.agent_id)
      .then((payload) => {
        if (!active) return;
        setResult(payload);
        setState('ready');
        if (mode === 'rotate') onRotated();
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Key operation failed.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [agent.agent_id, mode, onRotated]);

  async function copy() {
    if (!result?.agent_key) return;
    await navigator.clipboard.writeText(result.agent_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" aria-labelledby="key-dialog-title">
      <ModalHeader>
          <div>
            <p className="eyebrow">{mode === 'rotate' ? 'Rotated key' : mode === 'saved' ? 'Saved' : 'Agent key'}</p>
            <ModalTitle id="key-dialog-title">{agent.name || agent.agent_id}</ModalTitle>
          </div>
      </ModalHeader>

      <ModalBody>
        {mode === 'saved' && <Notice tone="success">Agent saved. The agent key is unchanged.</Notice>}
        {state === 'loading' && <Notice>Retrieving key...</Notice>}
        {state === 'error' && <Notice tone="danger">{error}</Notice>}
        {state === 'ready' && result && (
          <div>
            <div className="key-box">
              <code>{result.agent_key}</code>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {state === 'ready' && result && (
          <Button variant="primary" type="button" onClick={copy} leftIcon={<Copy aria-hidden="true" size={16} />}>
            {copied ? 'Copied' : 'Copy key'}
          </Button>
        )}
        <Button variant="secondary" type="button" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ParentKeyRevealDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LoadState>('loading');
  const [result, setResult] = useState<ParentKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    revealParentKey()
      .then((payload) => {
        if (!active) return;
        setResult(payload);
        setState('ready');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to reveal the Ozwell key.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const parentKey = result?.parent_key || result?.key || '';

  async function copy() {
    if (!parentKey) return;
    await navigator.clipboard.writeText(parentKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" aria-labelledby="parent-key-dialog-title">
      <ModalHeader>
        <div>
          <p className="eyebrow">Ozwell key</p>
          <ModalTitle id="parent-key-dialog-title">Reveal / Copy Ozwell key</ModalTitle>
        </div>
      </ModalHeader>
      <ModalBody>
        {state === 'loading' && <Notice>Retrieving your Ozwell key...</Notice>}
        {state === 'error' && <Notice tone="danger">{error}</Notice>}
        {state === 'ready' && parentKey && (
          <div className="key-box">
            <code>{parentKey}</code>
          </div>
        )}
        {state === 'ready' && !parentKey && <Notice tone="danger">The API response did not include an Ozwell key.</Notice>}
      </ModalBody>
      <ModalFooter>
        {state === 'ready' && parentKey && (
          <Button variant="primary" type="button" onClick={copy} leftIcon={<Copy aria-hidden="true" size={16} />}>
            {copied ? 'Copied' : 'Copy key'}
          </Button>
        )}
        <Button variant="secondary" type="button" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ClaimParentKeyDialog({ onClose, onClaimed }: { onClose: () => void; onClaimed: () => Promise<void> }) {
  const [parentKey, setParentKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = parentKey.trim();
    if (!trimmedKey) {
      setError('Enter an existing Ozwell key to claim.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await claimParentKey(trimmedKey);
      await onClaimed();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'parent_key_already_claimed') {
        setError('That Ozwell key has already been claimed by another manager account.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to claim the Ozwell key.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" aria-labelledby="claim-key-dialog-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <div>
            <p className="eyebrow">Claim key</p>
            <ModalTitle id="claim-key-dialog-title">Claim existing Ozwell key</ModalTitle>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="dialog-copy">
            Enter an existing <code>ozw_</code> key. Agents created under the temporary auto-created key will move to the
            claimed key after this succeeds.
          </p>
          <label className="claim-key-field">
            <span>Existing Ozwell key</span>
            <input
              value={parentKey}
              onChange={(event) => setParentKey(event.target.value)}
              placeholder="ozw_..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {error && <Notice tone="danger">{error}</Notice>}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Claiming...' : 'Claim key'}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function App() {
  const { brand, brandOptions: availableBrands, setBrand } = useBrand();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [page, setPage] = useState<Page>('agents');
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [schema, setSchema] = useState<Record<string, unknown>>(() => cloneSchema());
  const [error, setError] = useState('');
  const [keyDialog, setKeyDialog] = useState<{ mode: KeyMode; agent: Pick<AgentDetail, 'agent_id' | 'name'> } | null>(null);
  const [parentKeyDialog, setParentKeyDialog] = useState<ParentKeyDialogMode | null>(null);

  async function refreshAgents() {
    setAgentsLoading(true);
    try {
      setAgents(await listAgents());
    } finally {
      setAgentsLoading(false);
    }
  }

  async function refreshManagerState() {
    const identity = await getMe();
    setMe(identity);
    if (identity.provisioned) {
      await refreshAgents();
    }
  }

  async function refreshSchemaModels() {
    try {
      const models = await listModels();
      if (!models.length) return;
      const nextSchema = cloneSchema();
      const modelSection = nextSchema.fields.find((field) => field.id === SCHEMA_MODEL_SECTION_ID);
      const modelField = modelSection?.fields.find((field) => field.id === SCHEMA_MODEL_FIELD_ID);
      if (modelField) {
        const mutableModelField = modelField as typeof modelField & {
          options: Array<{ id: string; label: string; value: string }>;
        };
        mutableModelField.options = models.map((model, index) => ({ id: `m-${index}`, label: model.id, value: model.id }));
        modelField.answer = models[0].id;
        setSchema(nextSchema);
      }
    } catch {
      setSchema(cloneSchema());
    }
  }

  async function load() {
    setState('loading');
    setError('');
    try {
      const identity = await getMe();
      setMe(identity);
      if (identity.provisioned) {
        await Promise.all([refreshAgents(), refreshSchemaModels()]);
      }
      setState('ready');
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === 'trusted_headers_disabled'
          ? 'Trusted manager auth is not enabled on the API. Use the local auth proxy on port 3100.'
          : err instanceof Error
            ? err.message
            : 'Unable to reach Ozwell.';
      setError(message);
      setState('error');
    }
  }

  async function openAgent(agentId: string) {
    setState('loading');
    setError('');
    try {
      const detail = await getAgent(agentId);
      setSelectedAgent(detail);
      setEditorMode('edit');
      setPage('editor');
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent.');
      setState('error');
    }
  }

  function newAgent() {
    setSelectedAgent(null);
    setEditorMode('create');
    setPage('editor');
  }

  async function removeAgent(agent: Pick<AgentDetail, 'agent_id' | 'name'>) {
    const confirmed = window.confirm(`Delete "${agent.name || agent.agent_id}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteAgent(agent.agent_id);
      await refreshAgents();
      setSelectedAgent(null);
      setPage('agents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setState('error');
    }
  }

  function requestRotate(agent: Pick<AgentDetail, 'agent_id' | 'name'>) {
    const confirmed = window.confirm(
      `Rotate key for "${agent.name || agent.agent_id}"? The current key will stop working immediately.`,
    );
    if (!confirmed) return;
    setKeyDialog({ mode: 'rotate', agent });
  }

  async function onSubmitted(agentId: string, key?: KeyResponse) {
    await refreshAgents();
    const detail = await getAgent(agentId);
    setSelectedAgent(detail);
    setEditorMode('edit');
    setPage('editor');
    setKeyDialog({
      mode: key ? 'created' : 'saved',
      agent: { agent_id: agentId, name: detail.name || 'New agent' },
    });
  }

  useEffect(() => {
    load();
  }, []);

  const displayName = getDisplayName(me || undefined);

  return (
    <main className="app-shell">
      <BrandInitializer brand={brand} />
      <header className="topbar">
        <div>
          <p className="eyebrow">Ozwell Manager</p>
          <h1>{page === 'editor' ? 'Agent editor' : 'Agent management'}</h1>
        </div>
        <div className="topbar-meta">
          <span>{displayName}</span>
          <div className="topbar-controls">
            <Select
              className="brand-select"
              hideLabel
              label="Brand"
              aria-label="Brand"
              size="sm"
              value={brand}
              options={availableBrands}
              onValueChange={(value) => setBrand(value as typeof brand)}
            />
            <ThemeToggle aria-label="Toggle color theme" size="sm" />
          </div>
        </div>
      </header>

      {state === 'loading' && <EmptyState title="Connecting to Ozwell">Checking the current manager session.</EmptyState>}

      {state === 'error' && (
        <Card className="state-card" variant="outlined" padding="lg">
          <Notice tone="danger">{error}</Notice>
          <div className="panel-actions state-actions">
            <Button variant="secondary" type="button" onClick={load}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {state === 'ready' && me && !me.provisioned && (
        <Card className="state-card" variant="outlined" padding="lg">
          <EmptyState title="Account not provisioned yet">
            This Ozwell account is signed in, but agent management has not been enabled for it yet. Once provisioning is complete,
            this console will show your agents automatically.
          </EmptyState>
        </Card>
      )}

      {state === 'ready' && me?.provisioned && page === 'agents' && (
        <AgentsPage
          me={me}
          agents={agents}
          loading={agentsLoading}
          onNew={newAgent}
          onOpen={openAgent}
          onRefresh={() => refreshAgents().catch((err) => setError(err instanceof Error ? err.message : 'Refresh failed.'))}
          onRevealParentKey={() => setParentKeyDialog('reveal')}
          onClaimParentKey={() => setParentKeyDialog('claim')}
          onReveal={(agent) => setKeyDialog({ mode: 'reveal', agent: { agent_id: agent.id, name: agent.name } })}
          onRotate={(agent) => requestRotate({ agent_id: agent.id, name: agent.name })}
          onDelete={(agent) => removeAgent({ agent_id: agent.id, name: agent.name })}
        />
      )}

      {state === 'ready' && me?.provisioned && page === 'editor' && (
        <AgentEditorPage
          mode={editorMode}
          agent={selectedAgent}
          schema={schema}
          onBack={() => {
            setPage('agents');
            setSelectedAgent(null);
          }}
          onSubmitted={onSubmitted}
          onReveal={(agent) => setKeyDialog({ mode: 'reveal', agent })}
          onRotate={requestRotate}
          onDelete={removeAgent}
        />
      )}

      {keyDialog && (
        <KeyDialog
          mode={keyDialog.mode}
          agent={keyDialog.agent}
          onClose={() => setKeyDialog(null)}
          onRotated={() => refreshAgents().catch((err) => setError(err instanceof Error ? err.message : 'Refresh failed.'))}
        />
      )}

      {parentKeyDialog === 'reveal' && <ParentKeyRevealDialog onClose={() => setParentKeyDialog(null)} />}

      {parentKeyDialog === 'claim' && (
        <ClaimParentKeyDialog
          onClose={() => setParentKeyDialog(null)}
          onClaimed={() => refreshManagerState().catch((err) => setError(err instanceof Error ? err.message : 'Refresh failed.'))}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
