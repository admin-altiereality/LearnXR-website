import type { GeneratedQuestion, QuestionType } from '../../types/questionPaper';

const ROMAN: Record<number, string> = {
  0: '(i)',
  1: '(ii)',
  2: '(iii)',
  3: '(iv)',
  4: '(v)',
  5: '(vi)',
};
const romanLabel = (idx: number) => ROMAN[idx] ?? `(${idx + 1})`;

function writingSpaceClass(type: QuestionType): 'short' | 'medium' | 'long' | '' {
  switch (type) {
    case 'one_word':
    case 'fill_blank':
    case 'true_false':
    case 'match_columns':
    case 'mcq':
    case 'assertion_reason':
      return '';
    case 'very_short':
    case 'short_answer':
      return 'short';
    case 'case_based':
      return 'medium';
    case 'long_answer':
    case 'diagram_label':
      return 'long';
    default:
      return 'short';
  }
}

interface QuestionRendererProps {
  question: GeneratedQuestion;
  /** Show any inline answer hints (e.g. for preview in answer key). Off by default. */
  showAnswers?: boolean;
}

export const QuestionRenderer = ({ question: q, showAnswers }: QuestionRendererProps) => {
  const body = (() => {
    switch (q.type) {
      case 'mcq':
      case 'assertion_reason': {
        const opts = q.options ?? [];
        return (
          <div className="qp-options">
            {opts.map((opt, idx) => (
              <div key={idx} className="qp-option">
                <span className="qp-option-label">{romanLabel(idx)}</span>
                <span>{opt}</span>
              </div>
            ))}
            {showAnswers && q.answer_index != null && (
              <div className="qp-option" style={{ marginTop: 4 }}>
                <span className="qp-option-label" style={{ color: '#0a7' }}>
                  Ans:
                </span>
                <span>{romanLabel(q.answer_index)} {opts[q.answer_index]}</span>
              </div>
            )}
          </div>
        );
      }
      case 'match_columns': {
        const pairs = q.pairs ?? [];
        const rights = pairs.map((p) => p.right);
        // Display lefts in order, rights shuffled deterministically by reversing.
        const shuffledRights = [...rights].reverse();
        return (
          <table className="qp-match">
            <thead>
              <tr>
                <td>Column A</td>
                <td>Column B</td>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="qp-option-label">{romanLabel(idx)}</span>
                    {p.left}
                  </td>
                  <td>
                    <span className="qp-option-label">{String.fromCharCode(97 + idx)})</span>
                    {shuffledRights[idx]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case 'case_based': {
        return (
          <div>
            {q.passage && (
              <p style={{ margin: '4px 0', fontStyle: 'italic' }}>{q.passage}</p>
            )}
            {q.passage_secondary && (
              <p style={{ margin: '4px 0', fontStyle: 'italic', color: '#333' }}>
                {q.passage_secondary}
              </p>
            )}
            <ol style={{ paddingLeft: 20, marginTop: 6 }}>
              {(q.sub_questions ?? []).map((sq, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <span>{sq.prompt}</span>{' '}
                  <span className="qp-q-marks">[{sq.marks}]</span>
                  {sq.options && sq.options.length > 0 && (
                    <div className="qp-options" style={{ marginTop: 2 }}>
                      {sq.options.map((opt, i) => (
                        <div key={i} className="qp-option">
                          <span className="qp-option-label">{romanLabel(i)}</span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      }
      case 'diagram_label': {
        return (
          <div>
            {q.diagram_prompt && (
              <div className="qp-diagram">Diagram: {q.diagram_prompt}</div>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  })();

  const space = writingSpaceClass(q.type);

  return (
    <>
      <div className="qp-q-header">
        <span className="qp-q-num">
          {q.sub_number ? `${q.number}${q.sub_number}.` : `${q.number}.`}
        </span>
        <span className="qp-q-prompt">
          <span>{q.prompt}</span>
          {q.prompt_secondary && (
            <div className="qp-q-secondary">{q.prompt_secondary}</div>
          )}
        </span>
        <span className="qp-q-marks">[{q.marks}]</span>
      </div>
      {body && <div className="qp-q-body">{body}</div>}
      {space && <div className={`qp-space ${space}`} />}
    </>
  );
};

export default QuestionRenderer;
