import { useEffect } from 'react';
import type {
  AnswerKeyEntry,
  GeneratedQuestion,
  PaperBlueprint,
} from '../../types/questionPaper';
import { QuestionRenderer } from './QuestionRenderer';
import { AnswerKey } from './AnswerKey';
import '../../styles/questionPaperPrint.css';

interface PaperPreviewProps {
  blueprint: PaperBlueprint;
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
  /** If true, show a DRAFT watermark on every page */
  draft?: boolean;
  /** When true, wraps in a `.qp-printable` container for window.print(). */
  printable?: boolean;
  className?: string;
}

function groupQuestionsBySection(
  blueprint: PaperBlueprint,
  questions: GeneratedQuestion[]
): Array<{ sectionId: string; questions: GeneratedQuestion[] }> {
  const bySection = new Map<string, GeneratedQuestion[]>();
  for (const s of blueprint.sections) bySection.set(s.id, []);
  for (const q of questions) {
    const arr = bySection.get(q.section_id) ?? bySection.get(blueprint.sections[0]?.id ?? '');
    if (arr) arr.push(q);
  }
  return blueprint.sections.map((s) => ({
    sectionId: s.id,
    questions: bySection.get(s.id) ?? [],
  }));
}

export const PaperPreview = ({
  blueprint,
  questions,
  answer_key,
  draft = false,
  printable = true,
  className = '',
}: PaperPreviewProps) => {
  // When rendered on screen, make sure we scroll to the top on mount.
  useEffect(() => {
    const container = document.querySelector('.qp-preview');
    if (container) container.scrollTop = 0;
  }, [blueprint.title]);

  const grouped = groupQuestionsBySection(blueprint, questions);

  return (
    <div className={`qp-root ${printable ? 'qp-printable' : ''} ${className}`}>
      <div className="qp-preview">
        <div className="qp-page">
          {draft && <div className="qp-watermark">DRAFT</div>}
          <header className="qp-header">
            {blueprint.school.logo_url && (
              <img
                src={blueprint.school.logo_url}
                alt="School logo"
                style={{ height: 48, margin: '0 auto 4px', display: 'block' }}
              />
            )}
            <div className="qp-school">{blueprint.school.name || 'School Name'}</div>
            {blueprint.school.address && (
              <div className="qp-address">{blueprint.school.address}</div>
            )}
            <div className="qp-title">
              {blueprint.title} {blueprint.school.board ? `(${blueprint.school.board})` : ''}
            </div>
            <div className="qp-session">Session: {blueprint.session}</div>
          </header>
          <div className="qp-meta">
            <div>
              Class: <strong>{blueprint.class}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              Subject: <strong>{blueprint.subject}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              Max Marks: <strong>{blueprint.max_marks}</strong>
            </div>
            <div>
              Time Allowed: <strong>{blueprint.duration_mins} minutes</strong>
            </div>
            {blueprint.teacher_name && (
              <div style={{ textAlign: 'right' }}>
                Setter: <em>{blueprint.teacher_name}</em>
              </div>
            )}
          </div>

          {blueprint.instructions.length > 0 && (
            <ol className="qp-instructions">
              <li className="qp-instructions-title">General Instructions:</li>
              {blueprint.instructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ol>
          )}

          {grouped.map(({ sectionId, questions: qs }) => {
            const section = blueprint.sections.find((s) => s.id === sectionId);
            if (!section) return null;
            // Organize questions so OR alternatives render right after their base.
            const ordered: GeneratedQuestion[] = [];
            const alternativesByBase = new Map<string, GeneratedQuestion[]>();
            for (const q of qs) {
              if (q.is_or_alternative && q.alternative_of) {
                const arr = alternativesByBase.get(q.alternative_of) ?? [];
                arr.push(q);
                alternativesByBase.set(q.alternative_of, arr);
              } else {
                ordered.push(q);
              }
            }
            return (
              <section key={sectionId}>
                <div className="qp-section-heading">
                  Section {section.name}
                  {section.label ? `: ${section.label}` : ''}
                  <span className="qp-section-total">({section.max_marks} marks)</span>
                </div>
                {ordered.map((q) => {
                  const alts = alternativesByBase.get(q.id) ?? [];
                  return (
                    <div key={q.id} className="qp-q">
                      <QuestionRenderer question={q} />
                      {alts.map((alt) => (
                        <div key={alt.id} className="qp-q" style={{ marginTop: 6 }}>
                          <div className="qp-or">— OR —</div>
                          <QuestionRenderer question={alt} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
            );
          })}

          <div className="qp-print-footer">— End of paper —</div>
        </div>

        {blueprint.include_answer_key && answer_key.length > 0 && (
          <div className="qp-page">
            <AnswerKey questions={questions} answer_key={answer_key} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperPreview;
