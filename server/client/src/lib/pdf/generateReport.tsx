import { pdf } from '@react-pdf/renderer';
import ReportDocument from './ReportDocument';
import { REPORTS } from './reportContent';

export type ReportId = 'india' | 'global' | 'future';

/**
 * Generates a branded LearnXR report entirely client-side and triggers a
 * browser download. No server round-trip is required, which keeps the workflow
 * air-gap friendly and zero-cost to operate.
 */
export async function downloadReport(reportId: ReportId): Promise<void> {
  const report = REPORTS[reportId];
  if (!report) {
    throw new Error(`Unknown report: ${reportId}`);
  }

  const blob = await pdf(<ReportDocument report={report} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = report.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke on next tick to ensure the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
