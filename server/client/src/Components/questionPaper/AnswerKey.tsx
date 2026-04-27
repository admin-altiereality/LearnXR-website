import type { AnswerKeyEntry, GeneratedQuestion } from '../../types/questionPaper';

interface AnswerKeyProps {
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
}

export const AnswerKey = ({ questions, answer_key }: AnswerKeyProps) => {
  if (!answer_key || answer_key.length === 0) return null;
  const byId = new Map(answer_key.map((a) => [a.question_id, a] as const));
  return (
    <section className="qp-answer-key">
      <h2>Answer Key &amp; Marking Scheme</h2>
      <ol>
        {questions.map((q) => {
          const entry = byId.get(q.id);
          if (!entry) return null;
          return (
            <li key={q.id}>
              <div>
                <span style={{ fontWeight: 700 }}>
                  Q{q.number}
                  {q.sub_number ? ` (${q.sub_number})` : ''}
                  {q.is_or_alternative ? ' (OR)' : ''}:
                </span>{' '}
                <span>{entry.answer}</span>
                <span className="qp-answer-tags">
                  {q.bloom_tag && <span className="qp-answer-tag">Bloom: {q.bloom_tag}</span>}
                  {q.difficulty && <span className="qp-answer-tag">{q.difficulty}</span>}
                </span>
              </div>
              {entry.marking_scheme && (
                <div className="qp-marking-scheme">Marking: {entry.marking_scheme}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default AnswerKey;
