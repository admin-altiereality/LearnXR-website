import { ArrowRight, Atom, Box, ExternalLink, FlaskConical, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLicensedContent } from '../../services/licensedContentService';
import type { LicensedContentSummary } from '../../types/licensedContent';
import { Button } from '../ui/button';

export function LicensedStemOverview() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LicensedContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listLicensedContent({ includeDrafts: true })
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    published: items.filter((item) => item.status === 'published').length,
    staged: items.filter((item) => item.status === 'draft' || item.status === 'review').length,
  }), [items]);

  const openItem = (item: LicensedContentSummary) => {
    if (item.delivery_mode === 'external_link') {
      navigate(`/immersive-stem/${item.id}`);
      return;
    }
    if (item.provider_preview_url) {
      window.open(item.provider_preview_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.status === 'published') {
      navigate(`/immersive-stem/${item.id}`);
      return;
    }
    navigate('/studio/licensed-content');
  };

  return (
    <section className="mb-6 overflow-hidden border border-border bg-card" aria-labelledby="immersive-stem-heading">
        <div className="flex flex-col gap-4 border-b border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h2 id="immersive-stem-heading" className="font-semibold text-foreground">Immersive STEM Library</h2>
              <p className="mt-1 text-sm text-muted-foreground">Licensed 3D revisions, publication readiness, and curriculum delivery.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/studio/licensed-content')}>Manage content</Button>
            <Button size="sm" className="gap-2" onClick={() => navigate('/immersive-stem')}>Open library <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading licensed catalog</div>
        ) : failed ? (
          <div className="flex min-h-28 items-center justify-center gap-3 p-5 text-sm text-destructive"><ShieldAlert className="h-5 w-5" /> Licensed catalog status could not be loaded.</div>
        ) : (
          <>
            <div className="grid border-b border-border sm:grid-cols-3">
              <Metric label="Published" value={counts.published} />
              <Metric label="Staged" value={counts.staged} />
              <Metric label="Total revisions" value={items.length} />
            </div>
            {items.length === 0 ? (
              <div className="flex min-h-32 items-center gap-3 p-5 text-sm text-muted-foreground">
                <Box className="h-5 w-5 shrink-0" />
                <span>No approved provider manifest has been imported. Stage the official Corinth feed or licensed asset bundle in Content Curation.</span>
              </div>
            ) : (
              <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article key={item.id} className="flex min-h-40 flex-col bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
                        <Atom className="h-4 w-4" />
                      </div>
                      <span className="bg-muted px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">{item.status}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{item.subject} · Corinth 3D</p>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="mt-auto inline-flex h-9 items-center justify-center gap-2 border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                    >
                      {item.provider_preview_url || item.delivery_mode === 'external_link' ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      {item.delivery_mode === 'external_link' ? 'Open in Corinth' : item.provider_preview_url ? 'Preview in Corinth' : item.status === 'published' ? 'Open lesson' : 'Review content'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-border p-5 sm:border-t-0 sm:border-r">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
