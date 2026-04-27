import { useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type {
  Difficulty,
  PaperBlueprint,
  PaperSection,
  QuestionGroup,
  QuestionType,
} from '../../types/questionPaper';
import {
  BLUEPRINT_PRESETS,
  QUESTION_TYPE_DEFAULT_MARKS,
  QUESTION_TYPE_LABELS,
  expectedSectionMarks,
  totalMarksFromSections,
  validateBlueprint,
} from '../../types/questionPaper';

interface BlueprintBuilderProps {
  blueprint: PaperBlueprint;
  onChange: (updater: (prev: PaperBlueprint) => PaperBlueprint) => void;
  disabled?: boolean;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const BlueprintBuilder = ({ blueprint, onChange, disabled }: BlueprintBuilderProps) => {
  const errors = useMemo(() => validateBlueprint(blueprint), [blueprint]);
  const currentSectionsSum = totalMarksFromSections(blueprint.sections);

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = BLUEPRINT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const newBp = preset.build();
      onChange((prev) => ({
        ...newBp,
        // Preserve header details the user may have already filled out.
        school: prev.school,
        teacher_name: prev.teacher_name,
        class: prev.class || newBp.class,
        subject: prev.subject || newBp.subject,
        curriculum: prev.curriculum || newBp.curriculum,
      }));
    },
    [onChange]
  );

  const mutateSection = (sectionId: string, fn: (s: PaperSection) => PaperSection) => {
    onChange((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
    }));
  };

  const addSection = () => {
    onChange((prev) => {
      const nextLetter = String.fromCharCode(65 + prev.sections.length);
      const newSec: PaperSection = {
        id: randomId('sec'),
        name: nextLetter,
        label: '',
        max_marks: 10,
        groups: [
          {
            id: randomId('grp'),
            type: 'short_answer',
            count: 5,
            marks_per_q: 2,
            difficulty: 'medium',
            internal_choice: false,
          },
        ],
      };
      return { ...prev, sections: [...prev.sections, newSec] };
    });
  };

  const removeSection = (sectionId: string) => {
    onChange((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
  };

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    onChange((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return prev;
      const next = [...prev.sections];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, sections: next };
    });
  };

  const addGroup = (sectionId: string) => {
    mutateSection(sectionId, (s) => ({
      ...s,
      groups: [
        ...s.groups,
        {
          id: randomId('grp'),
          type: 'short_answer',
          count: 1,
          marks_per_q: 2,
          difficulty: 'medium',
          internal_choice: false,
        },
      ],
    }));
  };

  const updateGroup = (sectionId: string, groupId: string, patch: Partial<QuestionGroup>) => {
    mutateSection(sectionId, (s) => ({
      ...s,
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    }));
  };

  const removeGroup = (sectionId: string, groupId: string) => {
    mutateSection(sectionId, (s) => ({
      ...s,
      groups: s.groups.filter((g) => g.id !== groupId),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Blueprint</h3>
          <p className="text-sm text-muted-foreground">
            Configure sections, question groups, and per-group settings. The AI will produce exactly this structure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Preset</Label>
          <Select onValueChange={(v) => applyPreset(v)} disabled={disabled}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Start from a preset…" />
            </SelectTrigger>
            <SelectContent>
              {BLUEPRINT_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <Info className="w-4 h-4 text-primary" />
          <div>
            <span className="text-muted-foreground">Section marks: </span>
            <span className="font-semibold text-foreground">{currentSectionsSum}</span>
            <span className="text-muted-foreground"> / target </span>
            <span className="font-semibold text-foreground">{blueprint.max_marks}</span>
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addSection} disabled={disabled} className="gap-1">
          <Plus className="w-4 h-4" />
          Add section
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Blueprint has {errors.length} issue{errors.length > 1 ? 's' : ''} to fix:
          </div>
          <ul className="list-disc ml-6 text-amber-600/90">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {blueprint.sections.map((section, secIdx) => {
          const sectionSum = expectedSectionMarks(section);
          const sectionMismatch = sectionSum !== section.max_marks;
          return (
            <div
              key={section.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-muted-foreground">Section</span>
                  <Input
                    value={section.name}
                    onChange={(e) =>
                      mutateSection(section.id, (s) => ({ ...s, name: e.target.value.slice(0, 4) }))
                    }
                    className="w-16 h-8"
                    disabled={disabled}
                  />
                  <Input
                    value={section.label ?? ''}
                    onChange={(e) =>
                      mutateSection(section.id, (s) => ({ ...s, label: e.target.value }))
                    }
                    placeholder="Label (e.g. Reading)"
                    className="w-52 h-8"
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={sectionMismatch ? 'text-amber-500' : 'text-muted-foreground'}>
                    Groups: <span className="font-medium">{sectionSum}m</span> / Max
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={section.max_marks}
                    onChange={(e) =>
                      mutateSection(section.id, (s) => ({
                        ...s,
                        max_marks: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-20 h-8"
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(section.id, -1)}
                    disabled={disabled || secIdx === 0}
                    aria-label="Move section up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(section.id, 1)}
                    disabled={disabled || secIdx === blueprint.sections.length - 1}
                    aria-label="Move section down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(section.id)}
                    disabled={disabled || blueprint.sections.length <= 1}
                    aria-label="Remove section"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {section.groups.map((group) => (
                  <div
                    key={group.id}
                    className="grid grid-cols-1 md:grid-cols-[1.4fr_0.6fr_0.6fr_0.8fr_auto_auto] gap-2 items-end bg-background rounded-lg border border-border p-3"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={group.type}
                        onValueChange={(v) => {
                          const type = v as QuestionType;
                          updateGroup(section.id, group.id, {
                            type,
                            marks_per_q:
                              group.marks_per_q === QUESTION_TYPE_DEFAULT_MARKS[group.type]
                                ? QUESTION_TYPE_DEFAULT_MARKS[type]
                                : group.marks_per_q,
                          });
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {QUESTION_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Count</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={group.count}
                        onChange={(e) =>
                          updateGroup(section.id, group.id, {
                            count: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Marks/Q</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={group.marks_per_q}
                        onChange={(e) =>
                          updateGroup(section.id, group.id, {
                            marks_per_q: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Difficulty</Label>
                      <Select
                        value={group.difficulty}
                        onValueChange={(v) =>
                          updateGroup(section.id, group.id, { difficulty: v as Difficulty })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIFFICULTIES.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 pb-1.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-border accent-primary"
                          checked={group.internal_choice}
                          onChange={(e) =>
                            updateGroup(section.id, group.id, { internal_choice: e.target.checked })
                          }
                          disabled={disabled}
                        />
                        <span className="text-xs font-medium">OR</span>
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGroup(section.id, group.id)}
                      disabled={disabled || section.groups.length <= 1}
                      aria-label="Remove group"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>

                    <div className="md:col-span-6">
                      <Label className="text-xs">Topic hint (optional)</Label>
                      <Input
                        value={group.topic_hint ?? ''}
                        onChange={(e) =>
                          updateGroup(section.id, group.id, { topic_hint: e.target.value })
                        }
                        placeholder="e.g. Fractions — equivalent and simplification"
                        disabled={disabled}
                        className="h-9"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {group.count} × {group.marks_per_q} ={' '}
                        <span className="font-medium text-foreground">{group.count * group.marks_per_q} marks</span>
                        {group.internal_choice && (
                          <span className="ml-2 text-primary">(also generates OR alternatives)</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addGroup(section.id)}
                  disabled={disabled}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add question group
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BlueprintBuilder;
