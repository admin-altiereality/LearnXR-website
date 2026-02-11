/**
 * SourceTab – Displays the chapter PDF (source document) used to create the lesson.
 *
 * Uses curriculum_chapters schema:
 * 1. pdf_storage_url (string) – direct URL to the PDF in Firebase Storage (e.g. chapter_pdf/CBSE_1_Science_ch2_topic1.pdf).
 * 2. Fallback: pdf_id → "pdfs" collection doc, or convention-based path chapter_pdf/{filename}.
 */

import { useState, useEffect, useCallback } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../config/firebase';
import { FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface SourceTabProps {
  /** Lesson bundle from getLessonBundle; chapter may have pdf_storage_url, pdf_id → pdfs doc */
  bundle: {
    pdf?: { id: string; name?: string; filename?: string; download_url?: string; url?: string; storage_path?: string; storagePath?: string } | null;
    chapter?: {
      id?: string;
      chapter_name?: string;
      curriculum?: string;
      class?: number;
      subject?: string;
      chapter_number?: number;
      pdf_storage_url?: string;
      topics?: Array<{ topic_id?: string; topic_priority?: number }>;
    };
  } | null;
  chapterId: string;
  topicId: string;
}

/**
 * Resolve a viewable PDF URL from bundle.pdf (Firestore pdfs doc).
 * Tries: stored URL -> storage path -> default path pdfs/{pdfId}/document.pdf
 */
async function getPdfDownloadUrlFromDoc(pdf: NonNullable<SourceTabProps['bundle']>['pdf']): Promise<string | null> {
  if (!pdf?.id) return null;

  const existingUrl = pdf.download_url || pdf.url;
  if (existingUrl && typeof existingUrl === 'string') return existingUrl;

  const path = pdf.storage_path || pdf.storagePath;
  const storagePath = path || `pdfs/${pdf.id}/${pdf.filename || 'document.pdf'}`;

  if (!storage) return null;
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (err) {
    if (!path) {
      try {
        const altRef = ref(storage, `pdfs/${pdf.id}/source.pdf`);
        return await getDownloadURL(altRef);
      } catch {
        // ignore
      }
    }
    console.warn('[SourceTab] Failed to get PDF URL from pdfs doc:', err);
    return null;
  }
}

/** Storage prefix where chapter PDFs are stored (gs://.../chapter_pdf/...) */
const CHAPTER_PDF_STORAGE_PREFIX = 'chapter_pdf';

/**
 * Build convention-based PDF paths to match Firebase Storage layout.
 * Files are at: chapter_pdf/CBSE_{class}_{subject}_ch{chapter}_topic{topic}.pdf
 * Subject uses underscores in filenames (e.g. Social Science → Social_Science).
 */
function getConventionPdfPaths(
  _chapterId: string,
  chapter: NonNullable<SourceTabProps['bundle']>['chapter'],
  topicId: string
): string[] {
  if (!chapter) return [];
  const curriculum = (chapter.curriculum ?? '').toString().trim().replace(/\s+/g, '_');
  const classNum = chapter.class;
  const subject = (chapter.subject ?? '').toString().trim().replace(/\s+/g, '_');
  const chNum = chapter.chapter_number;
  if (curriculum === '' || subject === '' || classNum == null || chNum == null) return [];

  const topics = chapter.topics ?? [];
  const topicIndex = topics.findIndex((t: { topic_id?: string }) => t.topic_id === topicId);
  const topicNum = topicIndex >= 0 ? topicIndex + 1 : 1;

  const baseName = `${curriculum}_${classNum}_${subject}_ch${chNum}_topic${topicNum}.pdf`;
  const chapterOnlyName = `${curriculum}_${classNum}_${subject}_ch${chNum}.pdf`;

  return [
    `${CHAPTER_PDF_STORAGE_PREFIX}/${baseName}`,
    `${CHAPTER_PDF_STORAGE_PREFIX}/${chapterOnlyName}`,
  ];
}

async function tryGetDownloadUrl(storagePath: string): Promise<string | null> {
  if (!storage) return null;
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

function extractPdfNameFromUrl(url: string): string | null {
  try {
    const pathname = url.split('?')[0];
    const match = pathname.match(/\/([^/]+\.pdf)$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const SourceTab = ({ bundle, chapterId, topicId }: SourceTabProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>('Source PDF');

  const loadPdf = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    const pdf = bundle?.pdf ?? null;
    const chapter = bundle?.chapter ?? null;

    // 1) Use chapter.pdf_storage_url from curriculum_chapters schema (primary source)
    const storageUrl = chapter?.pdf_storage_url;
    if (storageUrl && typeof storageUrl === 'string' && storageUrl.trim().length > 0) {
      setPdfName(chapter.chapter_name || extractPdfNameFromUrl(storageUrl) || 'Source PDF');
      setPdfUrl(storageUrl.trim());
      setLoading(false);
      return;
    }

    // 2) Try Firestore pdf doc (when chapter has pdf_id but no pdf_storage_url)
    if (pdf) {
      setPdfName(pdf.name || pdf.filename || 'Source PDF');
      const url = await getPdfDownloadUrlFromDoc(pdf);
      if (url) {
        setPdfUrl(url);
        setLoading(false);
        return;
      }
    }

    // 3) Fallback: convention-based paths (chapter_pdf/CBSE_X_Subject_chY_topicZ.pdf)
    const paths = getConventionPdfPaths(chapterId, chapter ?? undefined, topicId);
    for (const storagePath of paths) {
      const url = await tryGetDownloadUrl(storagePath);
      if (url) {
        setPdfUrl(url);
        const match = storagePath.match(/\/([^/]+\.pdf)$/);
        setPdfName(match ? match[1] : chapter?.chapter_name || 'Source PDF');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    if (!storageUrl && !pdf && paths.length === 0) {
      setError('No source PDF is linked to this lesson. Set pdf_storage_url on the chapter or store the PDF at chapter_pdf/CBSE_X_Subject_chY_topicZ.pdf');
    } else {
      setError('Could not load the source PDF. It may not be uploaded yet or the path may be incorrect.');
    }
  }, [bundle?.pdf, bundle?.chapter, chapterId, topicId]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm">Loading source PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Source PDF unavailable</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button
              type="button"
              onClick={loadPdf}
              className="mt-3 text-sm text-primary hover:text-primary"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return null;
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-foreground">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-medium">{pdfName}</span>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-border bg-muted overflow-hidden">
        <iframe
          title={pdfName}
          src={pdfUrl}
          className="w-full h-full min-h-[480px] border-0"
        />
      </div>
    </div>
  );
};
