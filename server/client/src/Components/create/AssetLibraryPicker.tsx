import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Loader2, Search } from 'lucide-react';
import { db } from '../../config/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface LibraryAsset {
  id: string;
  name?: string;
  thumbnail_url?: string;
  render_url?: string;
  glb_url?: string;
}

export interface AssetLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assetId: string) => void;
}

export const AssetLibraryPicker = ({ open, onOpenChange, onSelect }: AssetLibraryPickerProps) => {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !db) return;
    setLoading(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'meshy_assets'),
          where('status', '==', 'complete'),
          orderBy('created_at', 'desc'),
          limit(60)
        );
        const snap = await getDocs(q);
        setAssets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LibraryAsset, 'id'>) })));
      } catch (err) {
        console.warn('[AssetLibraryPicker] Failed to load assets', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = assets.filter((a) => (a.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Pick a 3D asset from the library</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search assets by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">No assets found.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset.id);
                    onOpenChange(false);
                  }}
                  className="rounded-lg border border-border hover:border-primary transition p-2 text-left"
                >
                  <div className="aspect-square rounded-md bg-muted overflow-hidden mb-1">
                    {asset.thumbnail_url ? (
                      <img src={asset.thumbnail_url} alt={asset.name || 'Asset'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">3D</div>
                    )}
                  </div>
                  <div className="text-xs truncate">{asset.name || 'Untitled asset'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
