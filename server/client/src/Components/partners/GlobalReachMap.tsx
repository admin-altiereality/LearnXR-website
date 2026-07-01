import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { PARTNER_MARKETS } from '../../data/partners';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export const GlobalReachMap = () => {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-3 backdrop-blur-xl">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155 }}
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

        {PARTNER_MARKETS.map((market) => {
          const isCurrent = market.type === 'current';
          return (
            <Marker key={market.id} coordinates={market.coordinates}>
              <circle
                r={isCurrent ? 7 : 5}
                fill={isCurrent ? 'var(--primary)' : 'var(--background)'}
                stroke="var(--primary)"
                strokeWidth={isCurrent ? 1.5 : 2}
                fillOpacity={isCurrent ? 0.9 : 1}
              />
              <title>{`${market.name} — ${isCurrent ? 'Active market' : 'Expansion market'}`}</title>
            </Marker>
          );
        })}
      </ComposableMap>

      <div className="flex flex-wrap items-center gap-5 px-3 pb-1 pt-2">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-full bg-primary" /> Active market
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-primary bg-background" />
          Expansion market — partners wanted
        </span>
      </div>
    </div>
  );
};

export default GlobalReachMap;
