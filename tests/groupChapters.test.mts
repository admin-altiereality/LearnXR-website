/**
 * Regression tests for the content table's chapter grouping.
 *
 * A logical chapter is often stored as several Firestore documents sharing a
 * curriculum, class, subject and chapter number — most commonly one per
 * language — and each of those documents carries the same list of topics.
 *
 * The table grouped the documents together, which is right, then concatenated
 * all of their topic arrays, which is not: a chapter held as two documents
 * listed every topic twice and reported "10 topics" where there were five. It
 * looked exactly as though the list had been fetched twice.
 *
 * Run: npx tsx --test tests/groupChapters.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { groupChapters } from '../server/client/src/lib/studio/groupChapters.ts';

const topic = (id: string, name: string, priority = 1) => ({
  topic_id: id,
  topic_name: name,
  topic_priority: priority,
});

/** One document of a logical chapter, in a given language. */
const chapterDoc = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  curriculum: 'CBSE',
  class: 2,
  subject: 'English',
  chapter_number: 7,
  chapter_name: 'My Town',
  updated_at: '2026-03-21T00:00:00.000Z',
  topics: [
    topic('t1', 'Introduction to My Town', 1),
    topic('t2', 'Understanding Streets', 2),
    topic('t3', 'Exploring Houses', 3),
  ],
  ...overrides,
});

test('the same chapter in two languages lists each topic once', () => {
  // The reported bug: two documents, three topics each, ten rows on screen.
  const groups = groupChapters([chapterDoc('en_doc'), chapterDoc('hi_doc')]);

  assert.equal(groups.length, 1, 'both documents are one logical chapter');
  assert.equal(groups[0].topics.length, 3, 'three topics, not six');
  assert.deepEqual(
    groups[0].topics.map((t) => t.topic.topic_id),
    ['t1', 't2', 't3']
  );
});

test('a topic present in only one document is not lost', () => {
  // Deduplicating must not become "take the first document and ignore the rest".
  const groups = groupChapters([
    chapterDoc('en_doc'),
    chapterDoc('hi_doc', { topics: [topic('t4', 'Objects in a Room', 4)] }),
  ]);

  assert.deepEqual(
    groups[0].topics.map((t) => t.topic.topic_id),
    ['t1', 't2', 't3', 't4']
  );
});

test('different chapters stay apart', () => {
  const groups = groupChapters([
    chapterDoc('a'),
    chapterDoc('b', { chapter_number: 8, chapter_name: 'My School' }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.chapterNumber), [7, 8]);
});

test('topics come back in priority order', () => {
  const groups = groupChapters([
    chapterDoc('a', {
      topics: [topic('t3', 'Third', 3), topic('t1', 'First', 1), topic('t2', 'Second', 2)],
    }),
  ]);
  assert.deepEqual(groups[0].topics.map((t) => t.topic.topic_name), ['First', 'Second', 'Third']);
});

test('a topic identified only by name is still deduplicated', () => {
  // Older documents predate topic_id. Without a fallback key these reverted to
  // one row per document, which is the bug being fixed.
  const legacy = { topic_name: 'Untitled', topic_priority: 1 };
  const groups = groupChapters([
    chapterDoc('a', { topics: [legacy] }),
    chapterDoc('b', { topics: [{ ...legacy }] }),
  ]);
  assert.equal(groups[0].topics.length, 1);
});

test('a chapter with no topics is still a row', () => {
  // Predates topics entirely, and some chapters still rely on it.
  const groups = groupChapters([chapterDoc('solo', { topics: [] })]);
  assert.equal(groups[0].topics.length, 1);
  assert.equal(groups[0].topics[0].topic, null);
});

test('two topicless documents of one chapter both appear', () => {
  // They carry no topic to compare, so they are distinguished by document id;
  // collapsing them would hide a real document.
  const groups = groupChapters([
    chapterDoc('a', { topics: [] }),
    chapterDoc('b', { topics: [] }),
  ]);
  assert.equal(groups[0].topics.length, 2);
});

test('groups come back in curriculum, class, subject, chapter order', () => {
  const groups = groupChapters([
    chapterDoc('c', { class: 3, chapter_number: 1 }),
    chapterDoc('a', { class: 2, chapter_number: 2 }),
    chapterDoc('b', { class: 2, chapter_number: 1 }),
  ]);
  assert.deepEqual(
    groups.map((g) => `${g.class}.${g.chapterNumber}`),
    ['2.1', '2.2', '3.1']
  );
});

test('no chapters gives no groups', () => {
  assert.deepEqual(groupChapters([]), []);
});
