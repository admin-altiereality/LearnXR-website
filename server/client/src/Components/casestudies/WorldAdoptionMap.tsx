import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { X } from 'lucide-react';
import { COUNTRY_ADOPTION, type CountryAdoption } from '../../data/caseStudies/global';
import CitationChip from './CitationChip';

// Lightweight, well-known world topology (countries, 110m resolution).
const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldAdoptionMapProps {
  className?: string;
}

/**
 * Interactive choropleth-style world map with clickable markers for verified
 * country-level XR adoption stories. Selecting a marker reveals an outcome
 * card with before/after metrics and source attribution.
 */
export const WorldAdoptionMap = ({ className = '' }: WorldAdoptionMapProps) => {
  const [selected, setSelected] = useState<CountryAdoption | null>(null);

  return (
    <div className={`grid gap-5 lg:grid-cols-[1.6fr_1fr] ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-2 backdrop-blur-xl">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 150 }}
          width={800}
          height={400}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: {
                      fill: 'var(--muted)',
                      stroke: 'var(--border)',
                      strokeWidth: 0.4,
                      outline: 'none',
                    },
                    hover: { fill: 'var(--muted)', outline: 'none' },
                    pressed: { fill: 'var(--muted)', outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {COUNTRY_ADOPTION.map((country) => {
            const isActive = selected?.id === country.id;
            return (
              <Marker
                key={country.id}
                coordinates={country.coordinates}
                onClick={() => setSelected(country)}
                style={{ default: { cursor: 'pointer' } }}
              >
                <circle
                  r={isActive ? 8 : 5}
                  fill="var(--primary)"
                  fillOpacity={0.85}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                />
                <circle
                  r={isActive ? 8 : 5}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={1}
                  className="animate-ping"
                  style={{ transformOrigin: 'center' }}
                />
                <title>{`${country.country} — ${country.headline}`}</title>
              </Marker>
            );
          })}
        </ComposableMap>
        <p className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground">
          Tap a marker to view verified outcomes. Map shows a selection of documented deployments,
          not an exhaustive list.
        </p>
      </div>

      <div className="min-h-[220px]">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="relative flex h-full flex-col gap-3 rounded-2xl border border-primary/40 bg-card/80 p-5 shadow-card backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {selected.country}
              </span>
              <h3 className="text-base font-semibold text-foreground">{selected.headline}</h3>
              <p className="text-sm font-medium text-foreground/90">{selected.organization}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{selected.outcome}</p>
              {selected.metricBefore && selected.metricAfter && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                  <span className="flex-1 text-muted-foreground">{selected.metricBefore}</span>
                  <span className="text-primary">→</span>
                  <span className="flex-1 font-semibold text-foreground">{selected.metricAfter}</span>
                </div>
              )}
              <CitationChip sourceIds={selected.sourceIds} className="mt-auto pt-1" />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center"
            >
              <p className="text-sm font-medium text-foreground">Select a country</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Explore verified XR-in-education outcomes from around the world.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorldAdoptionMap;
