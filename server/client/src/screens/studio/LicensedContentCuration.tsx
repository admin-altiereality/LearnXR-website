import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileJson, Link2, Loader2, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import {
  importLicensedManifest,
  importLicensedManifestBatch,
  importLessonContentLinkBatch,
  listLicensedContent,
  updateLicensedContentStatus,
  upsertContentEntitlement,
  upsertLessonContentLink,
} from '../../services/licensedContentService';
import type { LicensedContentSummary, LicensedManifestImport } from '../../types/licensedContent';
import { ProviderLicensePanel } from '../../Components/studio/ProviderLicensePanel';
import { Badge } from '../../Components/ui/badge';
import { Button } from '../../Components/ui/button';

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
  delivery_mode: 'external_link',
  collection_ids: ['pilot-biology'],
  capabilities: ['provider_interactive'],
  attribution: 'Licensed from Corinth',
  external_link: {
    approved_origins: ['https://app.corinth3d.com'],
    launch_url: 'https://app.corinth3d.com/content/provider-slug',
    link_type: 'permanent',
    last_verified_at: new Date().toISOString(),
  },
}, null, 2);

type WorkspaceTab = 'catalog' | 'import' | 'mapping' | 'provider' | 'entitlements';

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
      const parsed = JSON.parse(manifestJson) as LicensedManifestImport | LicensedManifestImport[];
      if (Array.isArray(parsed)) {
        const result = await importLicensedManifestBatch(parsed);
        toast.success(`Validated ${result.imported} Corinth revisions.`);
      } else {
        const result = await importLicensedManifest(parsed);
        toast.success(`Validated revision ${result.import_key}.`);
      }
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
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Immersive STEM Curation</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage licensed revisions, curriculum mappings, provider terms, and school access.</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </header>

        <section className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card [&>div:nth-child(5)]:col-span-2 sm:grid-cols-3 sm:[&>div:nth-child(5)]:col-span-1 lg:grid-cols-5">
          <Metric label="Total revisions" value={items.length} />
          <Metric label="Draft" value={counts.draft || 0} />
          <Metric label="In review" value={counts.review || 0} />
          <Metric label="Published" value={counts.published || 0} />
          <Metric label="Suspended" value={counts.suspended || 0} />
        </section>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1" aria-label="Curation workspace">
          <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')} label="Catalog" />
          <TabButton active={tab === 'import'} onClick={() => setTab('import')} label="Import manifest" />
          <TabButton active={tab === 'mapping'} onClick={() => setTab('mapping')} label="Curriculum mapping" />
          {isAdmin && <TabButton active={tab === 'provider'} onClick={() => setTab('provider')} label="Provider license" />}
          {isAdmin && <TabButton active={tab === 'entitlements'} onClick={() => setTab('entitlements')} label="Entitlements" />}
        </nav>

        {tab === 'catalog' && (
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading revisions</div>
            ) : items.length === 0 ? (
              <div className="grid min-h-[360px] gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-8">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><UploadCloud className="h-6 w-6" /></div>
                  <h2 className="mt-5 text-xl font-semibold">No licensed revisions are staged</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The service is healthy. Content appears here only after an official provider manifest and its approved private artifact have been supplied.</p>
                  <Button type="button" onClick={() => setTab('import')} className="mt-5"><FileJson className="h-4 w-4" /> Import approved manifest</Button>
                </div>
                <ol className="space-y-4 border-l border-border pl-6 text-sm leading-6 text-muted-foreground">
                  <li><strong className="block text-foreground">1. Vendor delivery</strong>Receive the official API/feed or approved GLB bundle, revision IDs, metadata, and licensing reference.</li>
                  <li><strong className="block text-foreground">2. Private staging</strong>Store approved artifacts under the protected licensed-content path and import the matching manifest.</li>
                  <li><strong className="block text-foreground">3. Review and release</strong>Validate, publish, map curriculum topics, and enable the relevant school collections.</li>
                </ol>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr><th className="p-4">Content</th><th className="p-4">Provider revision</th><th className="p-4">Delivery</th><th className="p-4">Status</th><th className="p-4">Workflow</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border align-top hover:bg-muted/30">
                        <td className="p-4"><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.subject} · {item.grade_bands.join(', ')}</div></td>
                        <td className="p-4"><div>{item.provider_content_id}</div><div className="mt-1 text-xs text-muted-foreground">{item.provider} · {item.revision}</div></td>
                        <td className="p-4">{item.delivery_mode === 'krpano_native' ? 'Native KRPano' : item.delivery_mode === 'external_link' ? `External ${item.external_link?.link_type || 'link'}` : 'Hosted SSO'}</td>
                        <td className="p-4"><Badge variant="secondary" className="uppercase">{item.status}</Badge></td>
                        <td className="p-4">
                          <select
                            aria-label={`Change status for ${item.title}`}
                            value=""
                            disabled={busy}
                            onChange={(event) => { if (event.target.value) void changeStatus(item.id, event.target.value); }}
                            className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
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
          <section className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileJson className="h-4 w-4 text-primary" /> Approved provider manifest</label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  file.text().then(setManifestJson).catch(() => toast.error('Could not read the manifest file.'));
                  event.target.value = '';
                }}
                className="mb-3 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:font-semibold file:text-secondary-foreground"
              />
              <textarea value={manifestJson} onChange={(event) => setManifestJson(event.target.value)} spellCheck={false} className="h-[560px] w-full resize-y rounded-lg border border-input bg-background p-4 font-mono text-xs leading-5 text-foreground outline-none focus:ring-2 focus:ring-ring" />
              <Button type="button" onClick={() => void submitImport()} disabled={busy} className="mt-4">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validate and stage revision
              </Button>
            </div>
            <aside className="p-5 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="h-7 w-7 text-primary" />
              <h2 className="mt-4 font-semibold text-foreground">Import gate</h2>
              <p className="mt-2">The importer accepts approved Corinth content links or metadata with private Storage paths. Provider usernames, passwords, API keys, and tokenized URLs are rejected.</p>
              <p className="mt-3">A revision stays in draft until an administrator confirms provider licensing and the approved delivery mode.</p>
            </aside>
          </section>
        )}

        {tab === 'mapping' && <MappingForm items={items} selectedContentId={selectedContentId} setSelectedContentId={setSelectedContentId} isAdmin={isAdmin} />}
        {tab === 'provider' && isAdmin && <ProviderLicensePanel />}
        {tab === 'entitlements' && isAdmin && <EntitlementForm />}
      </div>
    </main>
  );
}

function MappingForm({ items, selectedContentId, setSelectedContentId, isAdmin }: { items: LicensedContentSummary[]; selectedContentId: string; setSelectedContentId: (value: string) => void; isAdmin: boolean }) {
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [curriculum, setCurriculum] = useState('CBSE');
  const [phase, setPhase] = useState('learn');
  const [objectiveIds, setObjectiveIds] = useState('');
  const [mappingScore, setMappingScore] = useState(80);
  const [reviewStatus, setReviewStatus] = useState<'suggested' | 'academic_review' | 'scientific_review' | 'approved' | 'rejected'>('suggested');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourcePublisher, setSourcePublisher] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const importBatch = async (file: File) => {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('Mapping file must contain a JSON array.');
      const result = await importLessonContentLinkBatch(parsed);
      toast.success(`Validated and staged ${result.imported} curriculum mappings.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mapping batch import failed.');
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const reviewed = reviewStatus !== 'suggested';
      const result = await upsertLessonContentLink({
        licensed_content_id: selectedContentId,
        chapter_id: chapterId,
        topic_id: topicId,
        class_id: classId,
        subject_id: subjectId,
        curriculum,
        phase,
        teaching_notes: notes,
        priority: 0,
        curriculum_objective_ids: objectiveIds.split(',').map((value) => value.trim()).filter(Boolean),
        mapping_score: mappingScore,
        score_breakdown: reviewed ? { semantic: 25, grade_fit: 20, learning_objective: 25, scientific_quality: 10 } : {},
        scientific_sources: sourceUrl ? [{ title: sourceTitle, publisher: sourcePublisher, url: sourceUrl }] : [],
        review_status: reviewStatus,
      });
      toast.success(`Curriculum mapping saved as ${result.review_status.replaceAll('_', ' ')}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Mapping failed.'); }
    finally { setBusy(false); }
  };
  const reviewedFieldsReady = reviewStatus === 'suggested' || Boolean(objectiveIds && sourceTitle && sourcePublisher && sourceUrl);
  return (
    <section className="rounded-lg border border-border bg-card p-5 lg:p-7">
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Map a revision to a lesson topic</h2></div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-accent">
          <FileJson className="h-4 w-4" /> Import mapping batch
          <input type="file" accept="application/json,.json" disabled={busy} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBatch(file); event.target.value = ''; }} />
        </label>
      </div>
      <p className="mb-6 max-w-4xl text-sm leading-6 text-muted-foreground">Mappings remain outside student lessons until an administrator approves the class, curriculum objective, and scientific evidence.</p>
      <div className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Licensed revision"><select value={selectedContentId} onChange={(event) => setSelectedContentId(event.target.value)} className="field"><option value="">Select content</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.revision}</option>)}</select></Field>
        <Field label="Lesson phase"><select value={phase} onChange={(event) => setPhase(event.target.value)} className="field"><option value="intro">Intro</option><option value="learn">Learn</option><option value="summary">Summary</option><option value="quiz">Quiz</option></select></Field>
        <Field label="Review status"><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as typeof reviewStatus)} className="field"><option value="suggested">Suggested</option><option value="academic_review">Academic review</option>{isAdmin && <option value="scientific_review">Scientific review</option>}{isAdmin && <option value="approved">Approved</option>}{isAdmin && <option value="rejected">Rejected</option>}</select></Field>
        <Field label="Curriculum"><input value={curriculum} onChange={(event) => setCurriculum(event.target.value)} className="field" /></Field>
        <Field label="Class / grade"><input value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="8" className="field" /></Field>
        <Field label="Subject"><input value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="science" className="field" /></Field>
        <Field label="Chapter ID"><input value={chapterId} onChange={(event) => setChapterId(event.target.value)} className="field" /></Field>
        <Field label="Topic ID"><input value={topicId} onChange={(event) => setTopicId(event.target.value)} className="field" /></Field>
        <Field label="Mapping score (0-100)"><input type="number" min="0" max="100" value={mappingScore} onChange={(event) => setMappingScore(Number(event.target.value))} className="field" /></Field>
        <Field label="Curriculum objective IDs"><input value={objectiveIds} onChange={(event) => setObjectiveIds(event.target.value)} placeholder="Comma separated" className="field" /></Field>
        <Field label="Evidence title"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} className="field" /></Field>
        <Field label="Evidence publisher"><input value={sourcePublisher} onChange={(event) => setSourcePublisher(event.target.value)} placeholder="NCERT" className="field" /></Field>
        <Field label="Evidence URL"><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." className="field" /></Field>
        <Field label="Teaching notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="field min-h-28" /></Field>
      </div>
      <Button type="button" onClick={() => void submit()} disabled={busy || !selectedContentId || !chapterId || !topicId || !classId || !subjectId || !curriculum || !reviewedFieldsReady} className="mt-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save mapping</Button>
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
    <section className="rounded-lg border border-border bg-card p-5 lg:p-7">
      <div className="mb-6 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">School and partner entitlements</h2></div>
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Target type"><select value={targetType} onChange={(event) => setTargetType(event.target.value as 'school' | 'partner')} className="field"><option value="school">School</option><option value="partner">Partner</option></select></Field>
        <Field label="Target document ID"><input value={targetId} onChange={(event) => setTargetId(event.target.value)} className="field" /></Field>
        <Field label="Provider"><input value="corinth" readOnly className="field bg-muted" /></Field>
        <Field label="Collections (comma separated)"><input value={collections} onChange={(event) => setCollections(event.target.value)} className="field" /></Field>
        <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="field"><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select></Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Starts"><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="field" /></Field><Field label="Ends"><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="field" /></Field></div>
      </div>
      <Button type="button" onClick={() => void submit()} disabled={busy || !targetId || !collections} className="mt-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save entitlement</Button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="border-b border-r border-border p-4 last:border-r-0 sm:border-b-0"><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>; }
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>{label}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground [&_.field]:h-10 [&_.field]:rounded-lg [&_.field]:border [&_.field]:border-input [&_.field]:bg-background [&_.field]:px-3 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:normal-case [&_.field]:text-foreground [&_.field]:outline-none focus-within:[&_.field]:ring-2 focus-within:[&_.field]:ring-ring">{label}{children}</label>; }
