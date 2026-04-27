import { useCallback, useState } from 'react';
import { Wand2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { PaperBlueprint } from '../../types/questionPaper';
import { BOARD_OPTIONS, PAPER_LANGUAGES } from '../../types/questionPaper';
import {
  getQuestionPaperAutofill,
  type AutofillOptions,
} from '../../services/questionPaperAutofill';
import { toast } from 'react-toastify';

interface HeaderFormProps {
  blueprint: PaperBlueprint;
  onChange: (updater: (prev: PaperBlueprint) => PaperBlueprint) => void;
  /** Hints passed to autofill (typically from the current chapter in the Studio tab) */
  autofillHints?: AutofillOptions;
  disabled?: boolean;
}

export const HeaderForm = ({ blueprint, onChange, autofillHints, disabled }: HeaderFormProps) => {
  const [autofilling, setAutofilling] = useState(false);

  const update = useCallback(
    <K extends keyof PaperBlueprint>(key: K, value: PaperBlueprint[K]) => {
      onChange((prev) => ({ ...prev, [key]: value }));
    },
    [onChange]
  );

  const updateSchool = useCallback(
    <K extends keyof PaperBlueprint['school']>(key: K, value: PaperBlueprint['school'][K]) => {
      onChange((prev) => ({ ...prev, school: { ...prev.school, [key]: value } }));
    },
    [onChange]
  );

  const handleAutofill = useCallback(async () => {
    setAutofilling(true);
    try {
      const data = await getQuestionPaperAutofill(autofillHints);
      onChange((prev) => ({
        ...prev,
        teacher_name: data.teacher_name ?? prev.teacher_name,
        class: data.class_name ?? prev.class,
        subject: data.subject ?? prev.subject,
        curriculum: data.curriculum ?? prev.curriculum,
        school: {
          ...prev.school,
          name: data.school.name || prev.school.name,
          address: data.school.address || prev.school.address,
          board: data.school.board || prev.school.board,
          logo_url: prev.school.logo_url,
        },
      }));
      toast.success('Header autofilled from your profile.');
    } catch (err) {
      console.error('[HeaderForm] autofill failed', err);
      toast.error(err instanceof Error ? err.message : 'Could not autofill header');
    } finally {
      setAutofilling(false);
    }
  }, [autofillHints, onChange]);

  const addInstruction = () => {
    onChange((prev) => ({ ...prev, instructions: [...prev.instructions, ''] }));
  };

  const removeInstruction = (idx: number) => {
    onChange((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== idx),
    }));
  };

  const updateInstruction = (idx: number, value: string) => {
    onChange((prev) => ({
      ...prev,
      instructions: prev.instructions.map((item, i) => (i === idx ? value : item)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Header & Metadata</h3>
          <p className="text-sm text-muted-foreground">
            School information, session, duration and language settings. These appear on every page.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAutofill}
          disabled={disabled || autofilling}
          className="gap-2"
        >
          {autofilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Autofill from profile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>School name *</Label>
          <Input
            value={blueprint.school.name}
            onChange={(e) => updateSchool('name', e.target.value)}
            placeholder="e.g. Sarva Shiksha Vidyalaya"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>School address</Label>
          <Input
            value={blueprint.school.address ?? ''}
            onChange={(e) => updateSchool('address', e.target.value)}
            placeholder="City, State"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Board / Affiliation</Label>
          <Select
            value={blueprint.school.board ?? blueprint.curriculum ?? ''}
            onValueChange={(v) => updateSchool('board', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select board" />
            </SelectTrigger>
            <SelectContent>
              {BOARD_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>School logo URL (optional)</Label>
          <Input
            value={blueprint.school.logo_url ?? ''}
            onChange={(e) => updateSchool('logo_url', e.target.value)}
            placeholder="https://..."
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Paper title *</Label>
          <Input
            value={blueprint.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Annual Examination Practice Paper"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Session</Label>
          <Input
            value={blueprint.session}
            onChange={(e) => update('session', e.target.value)}
            placeholder="2025-26"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Class *</Label>
          <Input
            value={blueprint.class}
            onChange={(e) => update('class', e.target.value)}
            placeholder="e.g. III, 8A"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Subject *</Label>
          <Input
            value={blueprint.subject}
            onChange={(e) => update('subject', e.target.value)}
            placeholder="e.g. Mathematics"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Curriculum</Label>
          <Select
            value={blueprint.curriculum ?? ''}
            onValueChange={(v) => update('curriculum', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select curriculum" />
            </SelectTrigger>
            <SelectContent>
              {BOARD_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Duration (minutes) *</Label>
          <Input
            type="number"
            min={15}
            max={240}
            value={blueprint.duration_mins}
            onChange={(e) => update('duration_mins', Number(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Maximum marks *</Label>
          <Input
            type="number"
            min={5}
            max={200}
            value={blueprint.max_marks}
            onChange={(e) => update('max_marks', Number(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Teacher name (optional)</Label>
          <Input
            value={blueprint.teacher_name ?? ''}
            onChange={(e) => update('teacher_name', e.target.value)}
            placeholder="Paper setter"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Primary language *</Label>
          <Select
            value={blueprint.language}
            onValueChange={(v) => update('language', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {PAPER_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bilingual (secondary language)</Label>
          <Select
            value={blueprint.secondary_language ?? 'none'}
            onValueChange={(v) => update('secondary_language', v === 'none' ? undefined : v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {PAPER_LANGUAGES.filter((l) => l.code !== blueprint.language).map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex items-end">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border accent-primary"
              checked={blueprint.include_answer_key}
              onChange={(e) => update('include_answer_key', e.target.checked)}
              disabled={disabled}
            />
            <span className="text-sm font-medium text-foreground">Include answer key</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>General instructions</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addInstruction}
            disabled={disabled}
            className="gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add instruction
          </Button>
        </div>
        <div className="space-y-2">
          {blueprint.instructions.map((inst, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground pt-3 w-6 shrink-0">{idx + 1}.</span>
              <Textarea
                value={inst}
                onChange={(e) => updateInstruction(idx, e.target.value)}
                placeholder="Instruction text"
                rows={1}
                disabled={disabled}
                className="flex-1 resize-y min-h-[38px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(idx)}
                disabled={disabled}
                aria-label="Remove instruction"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {blueprint.instructions.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No instructions added.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeaderForm;
