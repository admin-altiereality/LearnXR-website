import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileJson, Link2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import {
  importLicensedManifest,
  listLicensedContent,
  updateLicensedContentStatus,
  upsertContentEntitlement,
  upsertLessonContentLink,
} from '../../services/licensedContentService';
import type { LicensedContentSummary, LicensedManifestImport } from '../../types/licensedContent';

const starterManifest = JSON.stringify({
  provider: 'corinth',
  provider_content_id: 'official-provider-id',
  revision: 'official-revision-id',
  title: 'Licensed model title',
  description: 'Scientifically reviewed description.',
  subject: 'Biology',
  grade_bands: ['8'],
  curriculum_tags: ['curriculum-topic'],
  languages: ['en'],
  content_type: 'interactive_model',
  delivery_mode: 'krpano_native',
  collection_ids: ['pilot-biology'],
  capabilities: ['parts', 'labels', 'layers', 'animations'],
  attribution: 'Licensed from Corinth',
  native: {
    artifact_storage_path: '_licensed_content/corinth/provider-id/revision/model.glb',
    sha256: '0'.repeat(64),
    interaction_manifest: {},
  },
}, null, 2);

type WorkspaceTab = 'catalog' | 'import' | 'mapping' | 'entitlements';

export default function LicensedContentCuration() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<WorkspaceTab>('catalog');
  const [items, setItems] = useState<LicensedContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manifestJson, setManifestJson] = useState(starterManifest);
  const [selectedContentId, setSelectedContentId] = useState('');
  const isAdmin = ['admin', 'superadmin'].includes(String(profile?.role));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listLicensedContent({ includeDrafts: true });
      setItems(result.items);
      setSelectedContentId((current) => current || result.items[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load licensed content.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => items.reduce<Record<string, number>>((result, item) => ({
    ...result,
    [item.status]: (result[item.status] || 0) + 1,
  }), {}), [items]);

  const submitImport = async () => {
    setBusy(true);
    try {
      const parsed = JSON.parse(manifestJson) as LicensedManifestImport;
      const result = await importLicensedManifest(parsed);
      toast.success(`Validated revision ${result.import_key}.`);
      await refresh();
      setTab('catalog');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Manifest import failed.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (contentId: string, status: string) => {
    setBusy(true);
    try {
      await updateLicensedContentStatus(contentId, status);
      toast.success(`Content moved to ${status}.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f7] p-4 text-[#172126] sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 border-b border-[#d7e0e2] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-sm font-semibold text-[#087f73]">Licensed content operations</div>
            <h1 className="text-3xl font-semibold">Immersive STEM Curation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d6c72]">
              Import only vendor-approved manifests. Associates prepare revisions and mappings; administrators control publication and entitlements.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center gap-2 border border-[#bac7ca] bg-white px-4 text-sm font-semibold hover:border-[#087f73]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        <section className="grid gap-px bg-[#d7e0e2] sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Total revisions" value={items.length} />
          <Metric label="Draft" value={counts.draft || 0} />
          <Metric label="In review" value={counts.review || 0} />
          <Metric label="Published" value={counts.published || 0} />
          <Metric label="Suspended" value={counts.suspended || 0} />
        </section>

        <nav className="flex gap-px overflow-x-auto border-b border-[#d7e0e2] bg-[#d7e0e2]">
          <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')} label="Catalog" />
          <TabButton active={tab === 'import'} onClick={() => setTab('import')} label="Import manifest" />
          <TabButton active={tab === 'mapping'} onClick={() => setTab('mapping')} label="Curriculum mapping" />
          {isAdmin && <TabButton active={tab === 'entitlements'} onClick={() => setTab('entitlements')} label="Entitlements" />}
        </nav>

        {tab === 'catalog' && (
          <section className="bg-white">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-[#617178]"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading revisions</div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-[#617178]">No provider manifests have been imported.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-[#d7e0e2] bg-[#eef2f3] text-xs uppercase text-[#64737a]">
                    <tr><th className="p-4">Content</th><th className="p-4">Provider revision</th><th className="p-4">Delivery</th><th className="p-4">Status</th><th className="p-4">Workflow</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-[#e2e8e9] align-top">
                        <td className="p-4"><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-[#69787e]">{item.subject} · {item.grade_bands.join(', ')}</div></td>
                        <td className="p-4"><div>{item.provider_content_id}</div><div className="mt-1 text-xs text-[#69787e]">{item.provider} · {item.revision}</div></td>
                        <td className="p-4">{item.delivery_mode === 'krpano_native' ? 'Native KRPano' : 'Hosted SSO'}</td>
                        <td className="p-4"><span className="bg-[#edf3f2] px-2 py-1 text-xs font-semibold uppercase text-[#2d665f]">{item.status}</span></td>
                        <td className="p-4">
                          <select
                            aria-label={`Change status for ${item.title}`}
                            value=""
                            disabled={busy}
                            onChange={(event) => { if (event.target.value) void changeStatus(item.id, event.target.value); }}
                            className="h-9 border border-[#bdc9cc] bg-white px-3 text-xs font-semibold"
                          >
                            <option value="">Move to…</option>
                            <option value="draft">Draft</option>
                            <option value="review">Review</option>
                            {isAdmin && <option value="published">Publish</option>}
                            {isAdmin && <option value="suspended">Suspend</option>}
                            {isAdmin && <option value="retired">Retire</option>}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'import' && (
          <section className="grid bg-white lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border-b border-[#d7e0e2] p-5 lg:border-b-0 lg:border-r">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileJson className="h-4 w-4 text-[#087f73]" /> Approved provider manifest</label>
              <textarea value={manifestJson} onChange={(event) => setManifestJson(event.target.value)} spellCheck={false} className="h-[560px] w-full resize-y border border-[#bdc9cc] bg-[#11191c] p-4 font-mono text-xs leading-5 text-[#dce8e6] outline-none focus:border-[#087f73]" />
              <button type="button" onClick={() => void submitImport()} disabled={busy} className="mt-4 inline-flex h-10 items-center gap-2 bg-[#087f73] px-4 text-sm font-semibold text-white disabled:opacity-55">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validate and stage revision
              </button>
            </div>
            <aside className="p-5 text-sm leading-6 text-[#5d6d73]">
              <ShieldCheck className="h-7 w-7 text-[#087f73]" />
              <h2 className="mt-4 font-semibold text-[#172126]">Import gate</h2>
              <p className="mt-2">The importer accepts metadata and private Storage paths only. Provider usernames, passwords, API keys, tokens, and remote artifact URLs are rejected.</p>
              <p className="mt-3">A revision stays in draft until an administrator confirms provider licensing and the approved delivery mode.</p>
            </aside>
          </section>
        )}

        {tab === 'mapping' && <MappingForm items={items} selectedContentId={selectedContentId} setSelectedContentId={setSelectedContentId} />}
        {tab === 'entitlements' && isAdmin && <EntitlementForm />}
      </div>
    </main>
  );
}

function MappingForm({ items, selectedContentId, setSelectedContentId }: { items: LicensedContentSummary[]; selectedContentId: string; setSelectedContentId: (value: string) => void }) {
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [phase, setPhase] = useState('learn');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await upsertLessonContentLink({ licensed_content_id: selectedContentId, chapter_id: chapterId, topic_id: topicId, phase, teaching_notes: notes });
      toast.success('Curriculum mapping saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Mapping failed.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="bg-white p-5 lg:p-7">
      <div className="mb-6 flex items-center gap-2"><Link2 className="h-5 w-5 text-[#087f73]" /><h2 className="text-lg font-semibold">Map a revision to a lesson topic</h2></div>
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        <Field label="Licensed revision"><select value={selectedContentId} onChange={(event) => setSelectedContentId(event.target.value)} className="field"><option value="">Select content</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.revision}</option>)}</select></Field>
        <Field label="Lesson phase"><select value={phase} onChange={(event) => setPhase(event.target.value)} className="field"><option value="intro">Intro</option><option value="learn">Learn</option><option value="summary">Summary</option><option value="quiz">Quiz</option></select></Field>
        <Field label="Chapter ID"><input value={chapterId} onChange={(event) => setChapterId(event.target.value)} className="field" /></Field>
        <Field label="Topic ID"><input value={topicId} onChange={(event) => setTopicId(event.target.value)} className="field" /></Field>
        <Field label="Teaching notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="field min-h-28 sm:col-span-2" /></Field>
      </div>
      <button type="button" onClick={() => void submit()} disabled={busy || !selectedContentId || !chapterId || !topicId} className="mt-5 inline-flex h-10 items-center gap-2 bg-[#087f73] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save mapping</button>
    </section>
  );
}

function EntitlementForm() {
  const [targetType, setTargetType] = useState<'school' | 'partner'>('school');
  const [targetId, setTargetId] = useState('');
  const [collections, setCollections] = useState('pilot-biology');
  const [status, setStatus] = useState<'active' | 'suspended' | 'expired'>('active');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await upsertContentEntitlement({ target_type: targetType, target_id: targetId, provider: 'corinth', collection_ids: collections.split(',').map((value) => value.trim()).filter(Boolean), status, starts_at: startsAt || null, ends_at: endsAt || null });
      toast.success('Entitlement saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Entitlement update failed.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="bg-white p-5 lg:p-7">
      <div className="mb-6 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#087f73]" /><h2 className="text-lg font-semibold">School and partner entitlements</h2></div>
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Target type"><select value={targetType} onChange={(event) => setTargetType(event.target.value as 'school' | 'partner')} className="field"><option value="school">School</option><option value="partner">Partner</option></select></Field>
        <Field label="Target document ID"><input value={targetId} onChange={(event) => setTargetId(event.target.value)} className="field" /></Field>
        <Field label="Provider"><input value="corinth" readOnly className="field bg-[#eef2f3]" /></Field>
        <Field label="Collections (comma separated)"><input value={collections} onChange={(event) => setCollections(event.target.value)} className="field" /></Field>
        <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="field"><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select></Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Starts"><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="field" /></Field><Field label="Ends"><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="field" /></Field></div>
      </div>
      <button type="button" onClick={() => void submit()} disabled={busy || !targetId || !collections} className="mt-5 inline-flex h-10 items-center gap-2 bg-[#172126] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save entitlement</button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="bg-white p-4"><div className="text-xs font-semibold uppercase text-[#68787e]">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>; }
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`h-12 shrink-0 px-5 text-sm font-semibold ${active ? 'bg-[#172126] text-white' : 'bg-white text-[#53646b] hover:text-[#087f73]'}`}>{label}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-[#637279] [&_.field]:h-10 [&_.field]:border [&_.field]:border-[#bcc9cc] [&_.field]:bg-white [&_.field]:px-3 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:normal-case [&_.field]:text-[#172126] [&_.field]:outline-none focus-within:[&_.field]:border-[#087f73]">{label}{children}</label>; }
