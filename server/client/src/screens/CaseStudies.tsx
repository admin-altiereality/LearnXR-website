import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileDown, Globe2, GraduationCap, Sparkles } from 'lucide-react';
import FuturisticBackground from '../Components/FuturisticBackground';
import AnimatedSection from '../Components/AnimatedSection';
import Seo from '../Components/seo/Seo';
import StatCard from '../Components/casestudies/StatCard';
import CaseStudyCard from '../Components/casestudies/CaseStudyCard';
import SourcedBarChart from '../Components/casestudies/SourcedBarChart';
import WorldAdoptionMap from '../Components/casestudies/WorldAdoptionMap';
import ReportDownloadCard from '../Components/casestudies/ReportDownloadCard';
import ReportLeadGateModal from '../Components/casestudies/ReportLeadGateModal';
import ImpactFramework from '../Components/casestudies/ImpactFramework';
import SectionErrorBoundary from '../Components/SectionErrorBoundary';
import { INDIA_STATS, INDIA_CASE_STUDIES } from '../data/caseStudies/india';
import { GLOBAL_STATS } from '../data/caseStudies/global';
import { SOURCED_CHARTS } from '../data/caseStudies/frameworks';
import { downloadReport, type ReportId } from '../lib/pdf/generateReport';
import { hasCapturedReportLead } from '../services/reportLeadService';

const REPORT_TITLES: Record<ReportId, string> = {
  india: 'India Report',
  global: 'Global Report',
  future: 'Future of XR Report',
};

const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) => (
  <div className="mb-8 max-w-3xl space-y-3">
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
    <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
    {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
  </div>
);

const CaseStudies = () => {
  const [gateReport, setGateReport] = useState<ReportId | null>(null);

  const requestReport = (reportId: ReportId) => {
    if (hasCapturedReportLead()) {
      void downloadReport(reportId);
    } else {
      setGateReport(reportId);
    }
  };

  const handleGateComplete = () => {
    const reportId = gateReport;
    setGateReport(null);
    if (reportId) void downloadReport(reportId);
  };

  return (
    <FuturisticBackground className="min-h-[100dvh] w-full overflow-x-hidden">
      <Seo
        title="XR Case Studies & Research Hub"
        description="Evidence-based research on XR in education across India and the world — verified statistics, interactive maps, and downloadable reports from LearnXR."
        path="/case-studies"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        {/* Hero */}
        <section className="mb-20">
          <AnimatedSection animation="fadeUp">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Research & Impact
            </span>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <h1 className="mt-5 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Transforming Education Through{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                XR Learning
              </span>
            </h1>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.2}>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A living evidence base on immersive learning — drawn from named institutions,
              government programmes, and peer-reviewed research. Every figure on this page links to
              its original, credible source.
            </p>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.3}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => requestReport('india')}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <FileDown className="h-4 w-4" /> India Report
              </button>
              <button
                type="button"
                onClick={() => requestReport('global')}
                className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Globe2 className="h-4 w-4" /> Global Report
              </button>
            </div>
          </AnimatedSection>
        </section>

        {/* Section 1 — India */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Section 01 · India"
            title="XR adoption is accelerating across India"
            description="From national tinkering-lab programmes to virtual-reality surgical rehearsal at AIIMS, immersive technology is moving into mainstream Indian education."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDIA_STATS.map((stat, i) => (
              <StatCard key={stat.id} stat={stat} index={i} />
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {SOURCED_CHARTS.slice(0, 2).map((chart, i) => (
              <SectionErrorBoundary key={chart.id} label="chart">
                <SourcedBarChart chart={chart} index={i} />
              </SectionErrorBoundary>
            ))}
          </div>

          <div className="mt-10">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <GraduationCap className="h-5 w-5 text-primary" /> Implementations across India
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {INDIA_CASE_STUDIES.map((entry, i) => (
                <CaseStudyCard key={entry.id} entry={entry} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Section 2 — World */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Section 02 · The World"
            title="XR in education around the world"
            description="Explore documented deployments and their reported outcomes. Click a marker to see verified before/after results."
          />
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GLOBAL_STATS.map((stat, i) => (
              <StatCard key={stat.id} stat={stat} index={i} />
            ))}
          </div>
          <SectionErrorBoundary label="world-map">
            <WorldAdoptionMap />
          </SectionErrorBoundary>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {SOURCED_CHARTS.slice(2).map((chart, i) => (
              <SectionErrorBoundary key={chart.id} label="chart">
                <SourcedBarChart chart={chart} index={i} />
              </SectionErrorBoundary>
            ))}
          </div>
        </section>

        {/* Section 3 — Reports */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Section 03 · Research"
            title="Download the full research reports"
            description="Branded, fully source-cited PDF reports with data tables, figures, and references. Enter your email and your report downloads instantly in your browser."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <ReportDownloadCard
              reportId="india"
              title="The India Report"
              description="A data-backed look at XR adoption across Indian policy, schools, and medical institutions."
              highlights={['NEP 2020 & innovation infrastructure', 'Medical & higher education', 'Market outlook & LearnXR opportunity', 'Every figure source-cited']}
              index={0}
            />
            <ReportDownloadCard
              reportId="global"
              title="The Global Report"
              description="Verified learning-impact evidence and market sizing from deployments worldwide."
              highlights={['Outcomes by region (tables)', 'Peer-reviewed effect sizes', 'Market outlook to 2030', 'Every figure source-cited']}
              index={1}
            />
            <ReportDownloadCard
              reportId="future"
              title="The Future of XR"
              description="Where immersive, AI-assisted learning is heading next."
              highlights={['XR + AI convergence', 'Market signals', 'LearnXR Impact Framework']}
              index={2}
            />
          </div>
        </section>

        {/* Section 4 — Framework */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Section 04 · Framework"
            title="The LearnXR Impact Framework"
            description="How LearnXR turns immersive technology into durable, measurable learning outcomes."
          />
          <ImpactFramework />
        </section>

        {/* Closing CTA */}
        <AnimatedSection animation="scale">
          <section className="overflow-hidden rounded-3xl border border-primary/40 bg-primary/10 px-6 py-8 backdrop-blur-2xl sm:px-10 sm:py-10">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-xl space-y-2">
                <h3 className="text-xl font-bold text-foreground sm:text-2xl">
                  Bring evidence-based XR learning to your institution
                </h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Partner with LearnXR to deploy immersive lessons, or explore the platform first.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/channel-partners"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95"
                >
                  Become a partner <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/web-preview"
                  className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  Explore the platform
                </Link>
              </div>
            </div>
          </section>
        </AnimatedSection>
      </div>

      <ReportLeadGateModal
        open={gateReport !== null}
        reportId={gateReport ?? 'india'}
        reportTitle={gateReport ? REPORT_TITLES[gateReport] : 'Report'}
        onClose={() => setGateReport(null)}
        onComplete={handleGateComplete}
      />
    </FuturisticBackground>
  );
};

export default CaseStudies;
