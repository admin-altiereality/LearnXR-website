import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SourcedChart } from '../../data/caseStudies/frameworks';
import CitationChip from './CitationChip';

interface SourcedBarChartProps {
  chart: SourcedChart;
  index?: number;
}

const BAR_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const SourcedBarChart = ({ chart, index = 0 }: SourcedBarChartProps) => {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.4, 0.25, 1] }}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-xl"
    >
      <figcaption className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{chart.title}</h3>
        <p className="text-xs text-muted-foreground">{chart.caption}</p>
      </figcaption>

      <div className="h-52 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval={0}
              height={48}
              angle={-12}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--foreground)',
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} ${chart.unit}`, '']}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only">
        {chart.title}: {chart.data.map((d) => `${d.label} ${d.value} ${chart.unit}`).join(', ')}
      </p>

      <CitationChip sourceIds={chart.sourceIds} className="mt-auto pt-1" />
    </motion.figure>
  );
};

export default SourcedBarChart;
