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
import { useAuth } from '../contexts/AuthContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import { useLesson } from '../contexts/LessonContext';
import { buildNativeLicensedLesson } from '../lib/licensedContent';
import {
  getLicensedContentManifest,
  listLicensedContent,
} from '../services/licensedContentService';
import type { LicensedContentSummary } from '../types/licensedContent';
import type { LaunchedLesson } from '../types/lms';

const deliveryLabels = {
  krpano_native: 'Native XR',
  hosted_embed: 'Hosted experience',
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
  const [availability, setAvailability] = useState<'ready' | 'catalog_empty' | 'not_entitled' | 'no_accessible_content'>('ready');
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');

  const canCurate = ['associate', 'admin', 'superadmin'].includes(String(profile?.role));
  const canLaunchToClass = ['teacher', 'partner', 'admin', 'superadmin'].includes(String(profile?.role));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLicensedContent()
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
      if (item.delivery_mode === 'hosted_embed') {
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
      lesson_type: item.delivery_mode === 'krpano_native' ? 'licensed_3d' : 'licensed_embed',
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
    <main className="min-h-screen bg-[#f5f7f8] px-4 py-6 text-[#172126] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 border-b border-[#dce3e5] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#087f73]">
              <FlaskConical className="h-4 w-4" />
              Licensed learning content
            </div>
            <h1 className="text-3xl font-semibold text-[#142126] sm:text-4xl">Immersive STEM Library</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d6a70] sm:text-base">
              Explore entitlement-approved interactive models and hosted STEM experiences.
            </p>
          </div>
          {canCurate && (
            <button
              type="button"
              onClick={() => navigate('/studio/licensed-content')}
              className="inline-flex h-10 items-center justify-center gap-2 bg-[#172126] px-4 text-sm font-semibold text-white hover:bg-black"
            >
              Curate library <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </header>

        {items.length > 0 && <section className="grid gap-3 border-b border-[#dce3e5] py-5 md:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(150px,220px))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65757b]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models and topics"
              className="h-11 w-full border border-[#ccd6d9] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#087f73] focus:ring-2 focus:ring-[#087f73]/15"
            />
          </label>
          <FilterSelect value={subject} onChange={setSubject} label="All subjects" options={subjects} />
          <FilterSelect value={grade} onChange={setGrade} label="All grades" options={grades} />
          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65757b]" />
            <select
              value={deliveryMode}
              onChange={(event) => setDeliveryMode(event.target.value)}
              className="h-11 w-full appearance-none border border-[#ccd6d9] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#087f73]"
            >
              <option value="">All delivery types</option>
              <option value="krpano_native">Native XR</option>
              <option value="hosted_embed">Hosted experience</option>
            </select>
          </label>
        </section>}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-[#526269]">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading licensed catalog
          </div>
        ) : availability === 'catalog_empty' ? (
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
          <section className="grid gap-px bg-[#dce3e5] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map((item) => (
              <article key={item.id} className="flex min-h-[360px] flex-col bg-white">
                <div className="relative aspect-[16/9] overflow-hidden bg-[#e8edef]">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Box className="h-12 w-12 text-[#8da0a7]" /></div>
                  )}
                  <span className="absolute left-3 top-3 bg-black/75 px-2 py-1 text-xs font-semibold text-white">
                    {deliveryLabels[item.delivery_mode]}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-[#65757b]">
                    <span>{item.subject}</span>
                    <span>{item.provider}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#172126]">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#607078]">{item.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.grade_bands.slice(0, 3).map((value) => (
                      <span key={value} className="bg-[#edf4f3] px-2 py-1 text-xs font-medium text-[#24675f]">Grade {value}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => void openContent(item)}
                      disabled={launchingId === item.id}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-[#087f73] px-3 text-sm font-semibold text-white hover:bg-[#066d63] disabled:opacity-60"
                    >
                      {launchingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.delivery_mode === 'krpano_native' ? <Play className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                      Open
                    </button>
                    {canLaunchToClass && (
                      <button
                        type="button"
                        onClick={() => void launchToClass(item)}
                        aria-label="Launch to active class"
                        title={activeSessionId ? 'Launch to active class' : 'Start a class session first'}
                        className="inline-flex h-10 w-10 items-center justify-center border border-[#b9c7ca] bg-white text-[#26383e] hover:border-[#087f73] hover:text-[#087f73] disabled:opacity-45"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
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
      className="h-11 w-full border border-[#ccd6d9] bg-white px-3 text-sm outline-none focus:border-[#087f73]"
    >
      <option value="">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function EmptyState({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center border-b border-[#dce3e5] text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center bg-[#e5efed] text-[#087f73]">{icon}</div>
      <h2 className="text-xl font-semibold text-[#172126]">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#64747a]">{detail}</p>
      {action && <button type="button" onClick={action.onClick} className="mt-5 inline-flex h-10 items-center justify-center bg-[#172126] px-4 text-sm font-semibold text-white hover:bg-black">{action.label}</button>}
    </div>
  );
}
