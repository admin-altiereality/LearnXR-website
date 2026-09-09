/**
 * groupChapters – one row per logical chapter, one row per topic.
 *
 * A logical chapter is frequently stored as SEVERAL Firestore documents that
 * share a curriculum, class, subject and chapter number — most often one per
 * language. Each of those documents carries the same list of topics.
 *
 * The content table grouped those documents together, which is right, and then
 * concatenated all of their topic arrays, which is not: a chapter held as two
 * documents listed every topic twice and reported "10 topics" where there were
 * five. It read as though the list had been fetched twice.
 *
 * The launch modal on the teacher dashboard already deduplicates the same way
 * for the same reason; this applies that rule where the content table needs it,
 * and puts it somewhere it can be tested.
 */

export interface GroupTopicEntry<TChapter> {
  chapter: TChapter;
  topic: any;
  topicPriority: number;
}

export interface ChapterGroup<TChapter> {
  curriculum: string;
  class: number;
  subject: string;
  chapterNumber: number;
  chapterName: string;
  topics: Array<GroupTopicEntry<TChapter>>;
}

/** Identity of a logical chapter, across however many documents hold it. */
export function chapterGroupKey(chapter: any): string {
  return [
    chapter?.curriculum || '',
    chapter?.class || '',
    chapter?.subject || '',
    chapter?.chapter_number || '',
  ].join('_');
}

/**
 * Group chapter documents, listing each topic once.
 *
 * The first document to mention a topic wins, which keeps the ordering stable
 * and matches what the launch modal does. A document with no topics array is
 * still shown as a row of its own, keyed by its id — that path predates topics
 * and some older chapters still rely on it.
 */
export function groupChapters<TChapter extends Record<string, any>>(
  chapters: TChapter[]
): Array<ChapterGroup<TChapter>> {
  const groups = new Map<string, ChapterGroup<TChapter>>();
  /** Topics already listed, per group, so duplicate documents add nothing. */
  const seenTopics = new Map<string, Set<string>>();

  for (const chapter of chapters) {
    const key = chapterGroupKey(chapter);

    if (!groups.has(key)) {
      groups.set(key, {
        curriculum: chapter.curriculum || '',
        class: chapter.class || 0,
        subject: chapter.subject || '',
        chapterNumber: chapter.chapter_number || 0,
        chapterName: chapter.chapter_name || '',
        topics: [],
      });
      seenTopics.set(key, new Set());
    }

    const group = groups.get(key)!;
    const seen = seenTopics.get(key)!;

    if (Array.isArray(chapter.topics) && chapter.topics.length > 0) {
      for (const topic of chapter.topics) {
        // A topic with no id of any kind cannot be recognised across documents,
        // so it is keyed by name to avoid listing it once per document. Falling
        // back to "always include" would reintroduce the duplication.
        const topicId = String(topic?.topic_id ?? topic?.id ?? topic?.topic_name ?? '');
        if (!topicId || seen.has(topicId)) continue;
        seen.add(topicId);
        group.topics.push({
          chapter,
          topic,
          topicPriority: topic?.topic_priority || 999,
        });
      }
    } else {
      // No topics array: the chapter itself is the row. Keyed by document id, so
      // two genuinely different documents both appear.
      const selfKey = `__chapter__${chapter.id ?? ''}`;
      if (seen.has(selfKey)) continue;
      seen.add(selfKey);
      group.topics.push({ chapter, topic: null, topicPriority: 1 });
    }
  }

  const sorted = Array.from(groups.values()).map((group) => ({
    ...group,
    topics: [...group.topics].sort((a, b) => {
      if (a.topicPriority !== b.topicPriority) return a.topicPriority - b.topicPriority;
      const aDate = a.chapter.updated_at ? new Date(a.chapter.updated_at).getTime() : 0;
      const bDate = b.chapter.updated_at ? new Date(b.chapter.updated_at).getTime() : 0;
      return bDate - aDate;
    }),
  }));

  return sorted.sort((a, b) => {
    if (a.curriculum !== b.curriculum) return a.curriculum.localeCompare(b.curriculum);
    if (a.class !== b.class) return a.class - b.class;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    return a.chapterNumber - b.chapterNumber;
  });
}
