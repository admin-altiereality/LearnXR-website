import { ArrowRight, Box, FlaskConical, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLicensedContent } from '../../services/licensedContentService';
import type { LicensedContentSummary } from '../../types/licensedContent';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

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

  return (
    <Card className="mb-6 overflow-hidden border border-border">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Immersive STEM Library</h2>
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
          <div className="grid sm:grid-cols-[repeat(3,minmax(120px,180px))_minmax(0,1fr)]">
            <Metric label="Published" value={counts.published} />
            <Metric label="Staged" value={counts.staged} />
            <Metric label="Total revisions" value={items.length} />
            <div className="flex min-h-28 items-center border-t border-border p-5 sm:border-l sm:border-t-0">
              {items.length === 0 ? (
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Box className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>No approved provider manifest has been imported. Stage the official Corinth feed or licensed asset bundle in Content Curation.</span>
                </div>
              ) : (
                <div className="min-w-0 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Latest:</span>{' '}
                  {items.slice(0, 3).map((item) => `${item.title} (${item.status})`).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
