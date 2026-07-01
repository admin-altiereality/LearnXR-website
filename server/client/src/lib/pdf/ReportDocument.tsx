import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, BRAND } from './branding';
import type {
  ReportDefinition,
  ReportSection,
  ReportBlock,
  ReportTable,
  ReportFigure,
  ReportCallout,
  ReportStat,
  CitedText,
} from './reportContent';
import { getSource } from '../../data/caseStudies/sources';

const GENERATED = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Map a source id to its 1-based number on the Sources page. */
const buildCiteMap = (sourceIds: string[]): Map<string, number> =>
  new Map(sourceIds.map((id, i) => [id, i + 1]));

const RunningHeader = ({ label }: { label: string }) => (
  <View style={styles.header} fixed>
    <Text style={styles.headerBrand}>LearnXR</Text>
    <Text style={styles.headerLabel}>{label}</Text>
  </View>
);

const RunningFooter = () => (
  <View style={styles.footer} fixed>
    <Text>{`\u00A9 ${new Date().getFullYear()} LearnXR \u00B7 altiereality.com`}</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const Cite = ({ ids, map }: { ids?: string[]; map: Map<string, number> }) => {
  if (!ids || ids.length === 0) return null;
  const nums = ids
    .map((id) => map.get(id))
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  return <Text style={styles.cite}>{` [${nums.join(', ')}]`}</Text>;
};

const renderCited = (item: CitedText, map: Map<string, number>, style: object) => {
  if (typeof item === 'string') {
    return <Text style={style}>{item}</Text>;
  }
  return (
    <Text style={style}>
      {item.text}
      <Cite ids={item.sourceIds} map={map} />
    </Text>
  );
};

const StatGrid = ({ items, map }: { items: ReportStat[]; map: Map<string, number> }) => (
  <View style={styles.statRow}>
    {items.map((s, i) => (
      <View key={i} style={styles.statCard} wrap={false}>
        <Text style={styles.statValue}>{s.value}</Text>
        <Text style={styles.statLabel}>
          {s.label}
          <Cite ids={s.sourceIds} map={map} />
        </Text>
      </View>
    ))}
  </View>
);

const DataTable = ({ table, map }: { table: ReportTable; map: Map<string, number> }) => {
  const widths = table.widths ?? table.columns.map(() => 1);
  return (
    <View>
      <View style={styles.table}>
        <View style={styles.tableHeadRow} wrap={false}>
          {table.columns.map((col, i) => (
            <Text key={i} style={[styles.tableHeadCell, { flex: widths[i] ?? 1 }]}>
              {col}
            </Text>
          ))}
        </View>
        {table.rows.map((row, r) => (
          <View
            key={r}
            style={[styles.tableRow, r % 2 === 1 ? styles.tableRowAlt : {}]}
            wrap={false}
          >
            {row.cells.map((cell, c) => (
              <Text key={c} style={[styles.tableCell, { flex: widths[c] ?? 1 }]}>
                {cell}
                {c === row.cells.length - 1 ? <Cite ids={row.sourceIds} map={map} /> : null}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {table.note && <Text style={styles.tableNote}>{table.note}</Text>}
    </View>
  );
};

const FigureBars = ({ figure, map }: { figure: ReportFigure; map: Map<string, number> }) => {
  const maxValue = Math.max(...figure.bars.map((b) => b.value), 1);
  return (
    <View style={styles.figure} wrap={false}>
      {figure.title && <Text style={styles.figureTitle}>{figure.title}</Text>}
      {figure.unit && <Text style={styles.figureUnit}>{figure.unit}</Text>}
      {figure.bars.map((bar, i) => {
        const pct = Math.max(4, Math.round((bar.value / maxValue) * 100));
        return (
          <View key={i} style={styles.figureRow}>
            <View style={styles.figureRowHead}>
              <Text style={styles.figureLabel}>
                {bar.label}
                <Cite ids={bar.sourceIds} map={map} />
              </Text>
              <Text style={styles.figureValue}>{bar.display}</Text>
            </View>
            <View style={styles.figureTrack}>
              <View style={[styles.figureFill, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
      {figure.caption && <Text style={styles.figureCaption}>{figure.caption}</Text>}
    </View>
  );
};

const Callout = ({ callout, map }: { callout: ReportCallout; map: Map<string, number> }) => (
  <View style={styles.callout} wrap={false}>
    {callout.title && <Text style={styles.calloutTitle}>{callout.title}</Text>}
    {callout.items.map((item, i) => (
      <View key={i} style={styles.calloutItem}>
        <Text style={styles.calloutDot}>{'\u2022'}</Text>
        {renderCited(item, map, styles.calloutText)}
      </View>
    ))}
  </View>
);

const Block = ({ block, map }: { block: ReportBlock; map: Map<string, number> }) => {
  switch (block.type) {
    case 'lead':
      return (
        <Text style={styles.lead}>
          {block.text}
          <Cite ids={block.sourceIds} map={map} />
        </Text>
      );
    case 'paragraph':
      return (
        <Text style={styles.paragraph}>
          {block.text}
          <Cite ids={block.sourceIds} map={map} />
        </Text>
      );
    case 'subheading':
      return <Text style={styles.h4}>{block.text}</Text>;
    case 'bullets':
      return (
        <View>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>{'\u2022'}</Text>
              {renderCited(item, map, styles.bulletText)}
            </View>
          ))}
        </View>
      );
    case 'stats':
      return <StatGrid items={block.items} map={map} />;
    case 'table':
      return <DataTable table={block.table} map={map} />;
    case 'figure':
      return <FigureBars figure={block.figure} map={map} />;
    case 'callout':
      return <Callout callout={block.callout} map={map} />;
    default:
      return null;
  }
};

const SectionBlock = ({
  section,
  idx,
  map,
}: {
  section: ReportSection;
  idx: number;
  map: Map<string, number>;
}) => (
  <View style={{ marginBottom: 20 }}>
    <View wrap={false}>
      <Text style={styles.sectionTitle}>{`${idx}. ${section.heading}`}</Text>
      <View style={styles.sectionRule} />
    </View>
    {section.blocks.map((block, i) => (
      <Block key={i} block={block} map={map} />
    ))}
  </View>
);

interface ReportDocumentProps {
  report: ReportDefinition;
}

export const ReportDocument = ({ report }: ReportDocumentProps) => {
  const citeMap = buildCiteMap(report.sourceIds);
  const sources = report.sourceIds.map(getSource).filter(Boolean);

  return (
    <Document
      title={report.title}
      author="LearnXR"
      subject={report.subtitle}
      creator="LearnXR"
    >
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>XR</Text>
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>{report.kicker}</Text>
          <View style={styles.coverBar} />
          <Text style={styles.coverTitle}>{report.title}</Text>
          <Text style={styles.coverSubtitle}>{report.subtitle}</Text>
          <Text style={styles.coverMeta}>{`Published by LearnXR \u00B7 ${GENERATED}`}</Text>
          <Text style={styles.coverMeta}>
            All figures attributed to credible, publicly available sources.
          </Text>
        </View>
        <RunningFooter />
      </Page>

      {/* TOC + intro */}
      <Page size="A4" style={styles.page}>
        <RunningHeader label={report.title} />
        <Text style={styles.sectionTitle}>Contents</Text>
        <View style={styles.sectionRule} />
        <View style={{ marginBottom: 20 }}>
          {report.toc.map((item, i) => (
            <View key={i} style={styles.tocRow}>
              <Text style={styles.tocLabel}>{item}</Text>
              <Text style={styles.tocNum}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.h3}>About this report</Text>
        <Text style={styles.paragraph}>{report.intro}</Text>
        <RunningFooter />
      </Page>

      {/* Content (flows across as many pages as needed) */}
      <Page size="A4" style={styles.page}>
        <RunningHeader label={report.title} />
        {report.sections.map((section, i) => (
          <SectionBlock key={i} section={section} idx={i + 1} map={citeMap} />
        ))}
        <RunningFooter />
      </Page>

      {/* Sources */}
      <Page size="A4" style={styles.page}>
        <RunningHeader label={report.title} />
        <Text style={styles.sectionTitle}>Sources & references</Text>
        <View style={styles.sectionRule} />
        <Text style={[styles.paragraph, { color: BRAND.muted }]}>
          Every statistic in this report is attributable to the publicly available sources listed
          below, accessed and verified as of {GENERATED}. Bracketed numbers in the report (e.g. [1])
          correspond to the entries here.
        </Text>
        <View style={{ marginTop: 8 }}>
          {sources.map((s, i) => (
            <View key={s!.id} style={styles.sourceItem} wrap={false}>
              <Text style={styles.sourceTitle}>{`[${i + 1}] ${s!.title}`}</Text>
              <Text style={styles.sourceMeta}>{`${s!.publisher} \u00B7 ${s!.year}`}</Text>
              <Text style={styles.sourceUrl}>{s!.url}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.citation}>
          Third-party institution and vendor names are the property of their respective owners and
          are referenced here for factual, educational purposes only. Commercial products are
          described generically in the body of this report.
        </Text>
        <RunningFooter />
      </Page>
    </Document>
  );
};

export default ReportDocument;
