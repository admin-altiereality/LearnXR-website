import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../Components/ui/dialog';
import { Button } from '../../Components/ui/button';

// Lazy-load react-leaflet / leaflet via dynamic import (no CommonJS require)
type LeafletComponents = {
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  useMapEvents: any;
} | null;

export interface StreetViewMapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCenter?: { lat: number; lng: number };
  onSelectLocation: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India

export const StreetViewMapPicker: React.FC<StreetViewMapPickerProps> = ({
  open,
  onOpenChange,
  initialCenter,
  onSelectLocation,
}) => {
  const [leaflet, setLeaflet] = useState<LeafletComponents>(null);
  const [lat, setLat] = useState<number>(initialCenter?.lat ?? DEFAULT_CENTER.lat);
  const [lng, setLng] = useState<number>(initialCenter?.lng ?? DEFAULT_CENTER.lng);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === 'undefined') return;

    // Dynamically import react-leaflet and leaflet CSS only in the browser
    (async () => {
      try {
        const reactLeaflet = await import('react-leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!cancelled) {
          setLeaflet({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            Marker: reactLeaflet.Marker,
            useMapEvents: reactLeaflet.useMapEvents,
          });
        }
      } catch (e) {
        // Swallow import errors; component will render fallback text
        // rather than breaking the whole app.
        // eslint-disable-next-line no-console
        console.error('Failed to load map libraries', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialCenter) {
      setLat(initialCenter.lat);
      setLng(initialCenter.lng);
    }
  }, [initialCenter?.lat, initialCenter?.lng]);

  const handleUseLocation = () => {
    onSelectLocation(lat, lng);
    onOpenChange(false);
  };

  const MapClickHandler = () => {
    if (!leaflet?.useMapEvents) return null;
    leaflet.useMapEvents({
      click(e: any) {
        setLat(e.latlng.lat);
        setLng(e.latlng.lng);
      },
    });
    return null;
  };

  const isBrowser =
    typeof window !== 'undefined' &&
    !!leaflet?.MapContainer &&
    !!leaflet?.TileLayer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Select Street View location</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click on the map to choose the exact point for your Street View skybox. You can fine-tune heading and pitch from the main panel.
          </p>
          <div className="w-full h-[360px] rounded-xl overflow-hidden border border-border bg-muted">
            {isBrowser && leaflet ? (
              <leaflet.MapContainer
                center={[lat, lng]}
                zoom={12}
                style={{ width: '100%', height: '100%' }}
              >
                <leaflet.TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <leaflet.Marker position={[lat, lng]} />
                <MapClickHandler />
              </leaflet.MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                Map is available in the browser only.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Selected: <span className="font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
            </span>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleUseLocation}>
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

