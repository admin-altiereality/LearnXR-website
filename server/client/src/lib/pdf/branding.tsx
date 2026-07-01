import { StyleSheet } from '@react-pdf/renderer';

/**
 * Shared branding tokens and styles for all LearnXR PDF reports.
 * Colors are fixed hex values (print-safe) approximating the LearnXR theme.
 */
export const BRAND = {
  primary: '#6C4BF4',
  primaryDark: '#4B2FC2',
  ink: '#0B1020',
  body: '#2A2E3A',
  muted: '#6B7280',
  line: '#E3E6EF',
  surface: '#F7F8FC',
  white: '#FFFFFF',
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    lineHeight: 1.5,
    color: BRAND.body,
    fontFamily: 'Helvetica',
  },
  // Cover
  cover: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
  },
  coverKicker: {
    fontSize: 11,
    letterSpacing: 2,
    color: BRAND.primary,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 30,
    color: BRAND.ink,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.2,
    marginBottom: 14,
  },
  coverSubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    maxWidth: 380,
    marginBottom: 28,
  },
  coverMeta: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  coverBar: {
    width: 64,
    height: 5,
    backgroundColor: BRAND.primary,
    borderRadius: 3,
    marginBottom: 28,
  },
  // Running header / footer
  header: {
    position: 'absolute',
    top: 28,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  headerBrand: { fontSize: 10, color: BRAND.primary, fontFamily: 'Helvetica-Bold' },
  headerLabel: { fontSize: 8, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 1 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    fontSize: 8,
    color: BRAND.muted,
  },
  watermark: {
    position: 'absolute',
    bottom: 120,
    right: 40,
    fontSize: 60,
    color: BRAND.surface,
    fontFamily: 'Helvetica-Bold',
    opacity: 0.6,
    transform: 'rotate(-20deg)',
  },
  // Content
  sectionTitle: {
    fontSize: 16,
    color: BRAND.ink,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  sectionRule: {
    width: 40,
    height: 3,
    backgroundColor: BRAND.primary,
    borderRadius: 2,
    marginBottom: 12,
  },
  paragraph: { marginBottom: 8, color: BRAND.body },
  h3: { fontSize: 12, color: BRAND.ink, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 4 },
  // Stat grid
  statRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 8 },
  statCard: {
    width: '46%',
    margin: 6,
    padding: 12,
    backgroundColor: BRAND.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
  },
  statValue: { fontSize: 18, color: BRAND.primaryDark, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 9, color: BRAND.muted, marginTop: 3 },
  // List
  bullet: { flexDirection: 'row', marginBottom: 5 },
  bulletDot: { width: 10, color: BRAND.primary, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1, color: BRAND.body },
  // TOC
  tocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  tocLabel: { fontSize: 11, color: BRAND.ink },
  tocNum: { fontSize: 11, color: BRAND.muted },
  // Sources
  sourceItem: { marginBottom: 8 },
  sourceTitle: { fontSize: 9.5, color: BRAND.ink, fontFamily: 'Helvetica-Bold' },
  sourceMeta: { fontSize: 8.5, color: BRAND.muted },
  sourceUrl: { fontSize: 8, color: BRAND.primary },
  citation: { fontSize: 8, color: BRAND.muted, marginTop: 3, fontFamily: 'Helvetica-Oblique' },
  // Inline citation marker
  cite: { fontSize: 7, color: BRAND.primary, fontFamily: 'Helvetica-Bold' },
  // Lead paragraph (section intro emphasis)
  lead: { fontSize: 11, color: BRAND.ink, marginBottom: 10, lineHeight: 1.5 },
  // Sub-heading inside a section
  h4: { fontSize: 10.5, color: BRAND.primaryDark, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 4 },
  // Callout / key-takeaways box
  callout: {
    backgroundColor: BRAND.surface,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  calloutTitle: {
    fontSize: 9,
    color: BRAND.primaryDark,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  calloutItem: { flexDirection: 'row', marginBottom: 4 },
  calloutDot: { width: 10, color: BRAND.primary, fontFamily: 'Helvetica-Bold' },
  calloutText: { flex: 1, color: BRAND.body, fontSize: 9.5 },
  // Data table
  table: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  tableHeadRow: { flexDirection: 'row', backgroundColor: BRAND.primary },
  tableHeadCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8.5,
    color: BRAND.white,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BRAND.line },
  tableRowAlt: { backgroundColor: BRAND.surface },
  tableCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, fontSize: 8.5, color: BRAND.body },
  tableNote: { fontSize: 7.5, color: BRAND.muted, fontFamily: 'Helvetica-Oblique', marginBottom: 12 },
  // Figure (horizontal bars)
  figure: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  figureTitle: { fontSize: 10, color: BRAND.ink, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  figureUnit: { fontSize: 8, color: BRAND.muted, marginBottom: 8 },
  figureRow: { marginBottom: 7 },
  figureRowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  figureLabel: { fontSize: 8.5, color: BRAND.body },
  figureValue: { fontSize: 8.5, color: BRAND.primaryDark, fontFamily: 'Helvetica-Bold' },
  figureTrack: { height: 7, backgroundColor: BRAND.line, borderRadius: 4 },
  figureFill: { height: 7, backgroundColor: BRAND.primary, borderRadius: 4 },
  figureCaption: { fontSize: 7.5, color: BRAND.muted, marginTop: 4, fontFamily: 'Helvetica-Oblique' },
});
