/**
 * SourceTab – Displays the chapter PDF (source document) used to create the lesson.
 *
 * Uses curriculum_chapters schema:
 * 1. pdf_storage_url (string) – direct URL to the PDF in Firebase Storage (e.g. chapter_pdf/CBSE_1_Science_ch2_topic1.pdf).
 * 2. Fallback: pdf_id → "pdfs" collection doc, or convention-based path chapter_pdf/{filename}.
 *
 * When PDF is unavailable, allows uploading a PDF to chapter_pdf/ and updates the chapter with pdf_storage_url.
 */

import { useState, useEffect, useCallback } from 'react';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../../../config/firebase';
import { invalidateLessonBundleCache } from '../../../services/firestore/getLessonBundle';
import { FileText, ExternalLink, Loader2, AlertCircle, Upload } from 'lucide-react';

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
  /** Called after PDF is uploaded successfully (for parent to refetch bundle) */
  onPdfUploaded?: () => void;
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
  chapterId: string,
  chapter: NonNullable<SourceTabProps['bundle']>['chapter'],
  topicId: string
): string[] {
  const paths: string[] = [];

  // 1) Topic-specific doc ID as path (e.g. CBSE_6_Science_ch2_topic1)
  if (chapterId && /_topic\d+$/.test(chapterId)) {
    paths.push(`${CHAPTER_PDF_STORAGE_PREFIX}/${chapterId}.pdf`);
  }

  if (!chapter) return paths;
  const curriculum = (chapter.curriculum ?? '').toString().trim().replace(/\s+/g, '_');
  const classNum = chapter.class;
  const subject = (chapter.subject ?? '').toString().trim().replace(/\s+/g, '_');
  const chNum = chapter.chapter_number;
  if (curriculum === '' || subject === '' || classNum == null || chNum == null) return paths;

  const topics = chapter.topics ?? [];
  const topicIndex = topics.findIndex((t: { topic_id?: string }) => t.topic_id === topicId);
  const topicNum = topicIndex >= 0 ? topicIndex + 1 : 1;

  const baseName = `${curriculum}_${classNum}_${subject}_ch${chNum}_topic${topicNum}.pdf`;
  const chapterOnlyName = `${curriculum}_${classNum}_${subject}_ch${chNum}.pdf`;

  paths.push(`${CHAPTER_PDF_STORAGE_PREFIX}/${baseName}`);
  paths.push(`${CHAPTER_PDF_STORAGE_PREFIX}/${chapterOnlyName}`);

  return paths;
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

/** Get the storage path to use when uploading a new PDF */
function getUploadStoragePath(
  chapterId: string,
  chapter: NonNullable<SourceTabProps['bundle']>['chapter'],
  topicId: string
): string | null {
  const paths = getConventionPdfPaths(chapterId, chapter ?? undefined, topicId);
  return paths.length > 0 ? paths[0] : null;
}

export const SourceTab = ({ bundle, chapterId, topicId, onPdfUploaded }: SourceTabProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>('Source PDF');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const chapter = bundle?.chapter ?? null;

  const handleUploadPdf = useCallback(
    async (file: File) => {
      if (!storage || !db) {
        setUploadError('Storage or database not available');
        return;
      }
      const storagePath = getUploadStoragePath(chapterId, chapter ?? undefined, topicId);
      if (!storagePath) {
        setUploadError('Cannot determine storage path for this chapter');
        return;
      }
      if (file.type !== 'application/pdf') {
        setUploadError('Please select a PDF file');
        return;
      }

      setUploading(true);
      setUploadError(null);

      try {
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
        const downloadUrl = await getDownloadURL(storageRef);

        const chapterRef = doc(db, 'curriculum_chapters', chapterId);
        await updateDoc(chapterRef, {
          pdf_storage_url: downloadUrl,
          pdf_stored_at: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        invalidateLessonBundleCache(chapterId);

        setPdfUrl(downloadUrl);
        setPdfName(chapter?.chapter_name || file.name || 'Source PDF');
        setError(null);
        onPdfUploaded?.();
      } catch (err: unknown) {
        console.error('[SourceTab] PDF upload failed:', err);
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [chapterId, topicId, chapter, onPdfUploaded]
  );

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
    const uploadPath = getUploadStoragePath(chapterId, chapter ?? undefined, topicId);
    return (
      <div className="p-6 max-w-lg space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Source PDF unavailable</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadPdf}
                className="text-sm text-primary hover:text-primary"
              >
                Try again
              </button>
            </div>
          </div>
        </div>

        {uploadPath && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Upload source PDF</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Upload a PDF to display it here. It will be stored at chapter_pdf/
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadPdf(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Choose PDF'}
              </span>
            </label>
            {uploadError && (
              <p className="mt-2 text-sm text-destructive">{uploadError}</p>
            )}
          </div>
        )}
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
