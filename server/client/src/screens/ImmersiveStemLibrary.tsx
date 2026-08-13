import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  CircleAlert,
  ChevronRight,
  FlaskConical,
  Globe2,
  Loader2,
  LockKeyhole,
  Play,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Badge } from '../Components/ui/badge';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import { Input } from '../Components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import { useLesson } from '../contexts/LessonContext';
import { buildNativeLicensedLesson } from '../lib/licensedContent';
import { normalizeUserRole } from '../utils/rbac';
import {
  getLicensedContentManifest,
  listLicensedContent,
} from '../services/licensedContentService';
import type { LicensedContentSummary } from '../types/licensedContent';
import type { LaunchedLesson } from '../types/lms';

const deliveryLabels = {
  krpano_native: 'Native XR',
  hosted_embed: 'Hosted experience',
  external_link: 'Corinth 3D link',
} as const;

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default function ImmersiveStemLibrary() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { startLesson } = useLesson();
  const { activeSessionId, launchLesson } = useClassSession();
  const [items, setItems] = useState<LicensedContentSummary[]>([]);
  const [entitled, setEntitled] = useState(true);
  const [availability, setAvailability] = useState<'ready' | 'staging_only' | 'catalog_empty' | 'not_entitled' | 'no_accessible_content'>('ready');
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');

  const normalizedRole = normalizeUserRole(profile?.role);
  const canCurate = ['associate', 'admin', 'superadmin'].includes(normalizedRole);
  const canLaunchToClass = ['teacher', 'partner', 'admin', 'superadmin'].includes(normalizedRole);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLicensedContent({ includeDrafts: canCurate })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setEntitled(result.entitled || canCurate);
        setAvailability(result.catalog_state?.availability || (result.items.length > 0 ? 'ready' : 'no_accessible_content'));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not load the STEM library.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [canCurate]);

  const subjects = useMemo(() => unique(items.map((item) => item.subject)), [items]);
  const grades = useMemo(() => unique(items.flatMap((item) => item.grade_bands)), [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || [item.title, item.description, item.subject, ...item.curriculum_tags]
        .join(' ')
        .toLowerCase()
        .includes(query);
      return matchesSearch &&
        (!subject || item.subject === subject) &&
        (!grade || item.grade_bands.includes(grade)) &&
        (!deliveryMode || item.delivery_mode === deliveryMode);
    });
  }, [items, search, subject, grade, deliveryMode]);

  const openContent = async (item: LicensedContentSummary) => {
    setLaunchingId(item.id);
    try {
      if (item.status !== 'published' && item.provider_preview_url) {
        window.open(item.provider_preview_url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (item.delivery_mode === 'hosted_embed' || item.delivery_mode === 'external_link') {
        navigate(`/immersive-stem/${item.id}`);
        return;
      }
      const manifest = await getLicensedContentManifest(item.id);
      const lesson = buildNativeLicensedLesson(manifest);
      sessionStorage.setItem('activeLesson', JSON.stringify(lesson));
      sessionStorage.setItem('learnxr_licensed_content_id', item.id);
      startLesson(lesson.chapter, lesson.topic);
      navigate('/vrlessonplayer-krpano');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not launch this content.');
    } finally {
      setLaunchingId(null);
    }
  };

  const launchToClass = async (item: LicensedContentSummary) => {
    if (!activeSessionId) {
      toast.info('Start or resume a live class session before launching content to students.');
      return;
    }
    setLaunchingId(item.id);
    const payload: LaunchedLesson = {
      chapter_id: '__licensed_3d__',
      topic_id: item.id,
      subject: item.subject,
      class_name: item.grade_bands.join(', '),
      lesson_type: item.delivery_mode === 'krpano_native'
        ? 'licensed_3d'
        : item.delivery_mode === 'external_link'
          ? 'licensed_link'
          : 'licensed_embed',
      licensed_content_id: item.id,
      title: item.title,
      launch_id: `${Date.now()}`,
    };
    try {
      const ok = await launchLesson(payload);
      if (!ok) throw new Error('The active class session could not be updated.');
      toast.success(`${item.title} launched to the class.`);
      await openContent(item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not launch content to the class.');
      setLaunchingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Immersive STEM Library</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Licensed interactive STEM content for your school.</p>
            </div>
          </div>
          {canCurate && (
            <Button type="button" variant="secondary" onClick={() => navigate('/studio/licensed-content')} className="shrink-0">
              Curate library <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </header>

        {items.length > 0 && <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(150px,220px))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models and topics"
              className="pl-10"
            />
          </label>
          <FilterSelect value={subject} onChange={setSubject} label="All subjects" options={subjects} />
          <FilterSelect value={grade} onChange={setGrade} label="All grades" options={grades} />
          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={deliveryMode}
              onChange={(event) => setDeliveryMode(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All delivery types</option>
              <option value="krpano_native">Native XR</option>
              <option value="hosted_embed">Hosted experience</option>
              <option value="external_link">Corinth 3D link</option>
            </select>
          </label>
        </section>}

        {items.length > 0 && !loading && (
          <div className="mb-4 flex min-h-10 items-center justify-between text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">
              {filteredItems.length} {filteredItems.length === 1 ? 'lesson' : 'lessons'}
            </span>
            {filteredItems.length !== items.length && <span>of {items.length} licensed lessons</span>}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading licensed catalog
          </div>
        ) : availability === 'catalog_empty' && items.length === 0 ? (
          <EmptyState
            icon={<CircleAlert className="h-7 w-7" />}
            title="Licensed catalog is not populated"
            detail="The integration is online, but no approved provider revision has been published. Corinth account links are intentionally not imported because they require vendor authentication and do not grant hosting rights."
            action={canCurate ? { label: 'Stage approved manifest', onClick: () => navigate('/studio/licensed-content') } : undefined}
          />
        ) : (!entitled || availability === 'not_entitled') && items.length === 0 ? (
          <EmptyState
            icon={<LockKeyhole className="h-7 w-7" />}
            title="Library access is not enabled"
            detail="Your school or partner account needs an active content entitlement before licensed items can be opened."
          />
        ) : availability === 'no_accessible_content' && items.length === 0 ? (
          <EmptyState
            icon={<LockKeyhole className="h-7 w-7" />}
            title="No licensed collections are available"
            detail="An entitlement exists for this account, but it does not cover any currently published provider collection. Ask an administrator to review the provider and collection IDs."
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Box className="h-7 w-7" />}
            title="No content matches these filters"
            detail={items.length === 0 ? 'The licensed pilot catalog has not been published yet.' : 'Clear or adjust the current search and filters.'}
          />
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="flex min-h-[360px] flex-col overflow-hidden rounded-lg">
                <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-muted/50">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Box className="h-12 w-12 text-muted-foreground/60" /></div>
                  )}
                  <Badge variant="secondary" className="absolute left-3 top-3">
                    {deliveryLabels[item.delivery_mode]}
                  </Badge>
                </div>
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                    <span>{item.subject}</span>
                    <span>{canCurate && item.status !== 'published' ? item.status : item.provider}</span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.grade_bands.slice(0, 3).map((value) => (
                      <Badge key={value} variant="outline" className="font-medium">Grade {value}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-2 pt-5">
                    <Button
                      type="button"
                      onClick={() => void openContent(item)}
                      disabled={launchingId === item.id}
                      className="h-10 flex-1"
                    >
                      {launchingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.delivery_mode === 'krpano_native' ? <Play className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                      {item.delivery_mode === 'external_link' ? 'Open in Corinth' : item.status !== 'published' && item.provider_preview_url ? 'Preview in Corinth' : 'Open'}
                    </Button>
                    {canLaunchToClass && item.status === 'published' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => void launchToClass(item)}
                        aria-label="Launch to active class"
                        title={activeSessionId ? 'Launch to active class' : 'Start a class session first'}
                        className="h-10 w-10"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function EmptyState({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex min-h-[380px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{detail}</p>
        {action && <Button type="button" onClick={action.onClick} className="mt-5">{action.label}</Button>}
      </CardContent>
    </Card>
  );
}
