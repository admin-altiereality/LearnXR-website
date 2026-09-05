/**
 * drawLessonPanel - the immersive lesson panel, drawn on a 2048x1280 canvas.
 *
 * Lifted from `public/krpano/plugins/immersive_ui.xml` so that BOTH players can
 * render the same UI: the krpano player (which maps it onto a krpano/three.js
 * hotspot) and XRLessonPlayerV3 (which maps it onto a THREE.CanvasTexture).
 * Before this existed the polished version only lived inside the krpano XML and
 * V3 had its own, much plainer, set of panels.
 *
 * Deliberately pure: it takes a 2D context and a state object, draws, and
 * returns the clickable regions in canvas coordinates. It knows nothing about
 * krpano, three.js, or the DOM beyond the context it is handed — which is what
 * lets two very different renderers share it. Uploading the texture and
 * hit-testing the regions belong to the caller.
 *
 * The drawing code is a near-verbatim lift. Keep it that way: the palette,
 * spacing and easing are the polish, and re-deriving them loses detail.
 */

import type { ButtonRegion, LessonUiState } from './types';
import { PANEL_H, PANEL_W } from './types';

export interface DrawLessonPanelOptions {
  /** Seconds since the panel appeared; drives the pulse and dot animations. */
  animTime?: number;
  /** Action string currently hovered/gazed at, so it can be ringed. */
  hoverAction?: string | null;
  /** Font stack. Callers that have loaded Inter should pass it through. */
  font?: string;
}

const DEFAULT_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Phase palette. Shared with the stepper and every accent on the panel. */
const COLORS: Record<string, { accent: string; accentBg: string; accentBorder: string; text: string; light: string }> = {
  intro:       { accent: '#10b981', accentBg: 'rgba(16,185,129,0.25)', accentBorder: 'rgba(16,185,129,0.5)', text: '#34d399', light: '#d1fae5' },
  explanation: { accent: '#06b6d4', accentBg: 'rgba(6,182,212,0.25)',  accentBorder: 'rgba(6,182,212,0.5)',  text: '#22d3ee', light: '#cffafe' },
  outro:       { accent: '#a855f7', accentBg: 'rgba(168,85,247,0.25)', accentBorder: 'rgba(168,85,247,0.5)', text: '#c084fc', light: '#f3e8ff' },
  quiz:        { accent: '#f59e0b', accentBg: 'rgba(245,158,11,0.25)', accentBorder: 'rgba(245,158,11,0.5)', text: '#fbbf24', light: '#fef3c7' },
  completed:   { accent: '#10b981', accentBg: 'rgba(16,185,129,0.25)', accentBorder: 'rgba(16,185,129,0.5)', text: '#34d399', light: '#d1fae5' },
};

const STEPS = [
  { num: 1, label: 'Intro',   key: 'intro' },
  { num: 2, label: 'Learn',   key: 'explanation' },
  { num: 3, label: 'Summary', key: 'outro' },
  { num: 4, label: 'Quiz',    key: 'quiz' },
];

const PHASE_ORDER = ['intro', 'explanation', 'outro', 'quiz', 'completed'];

/** Load Inter once per document; callers pass the result back in as `font`. */
let interLoaded = false;
export function ensureLessonPanelFont(): string {
  const fallback = DEFAULT_FONT;
  if (typeof document === 'undefined' || interLoaded) return interLoaded ? "'Inter', system-ui, sans-serif" : fallback;
  interLoaded = true;
  try {
    const base = 'https://fonts.gstatic.com/s/inter/v18/';
    const regular = new FontFace('Inter', `url(${base}UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf)`, { weight: '400' });
    const bold = new FontFace('Inter', `url(${base}UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf)`, { weight: '700' });
    void regular.load().then((f) => document.fonts.add(f));
    void bold.load().then((f) => document.fonts.add(f));
  } catch {
    /* fonts are a nicety; the fallback stack is fine */
  }
  return fallback;
}

/**
 * Draw the whole panel and return its clickable regions, in canvas space.
 * Regions are ordered so later entries win a hit test (the stepper is added last).
 */
export function drawLessonPanel(
  ctx: CanvasRenderingContext2D,
  state: LessonUiState,
  opts: DrawLessonPanelOptions = {}
): ButtonRegion[] {
  const CW = PANEL_W;
  const CH = PANEL_H;
  const FONT = opts.font || DEFAULT_FONT;
  const ANIM_TIME = opts.animTime ?? 0;
  const regions: ButtonRegion[] = [];
  const S = state;

  function phaseKey(p: string): string {
    if (!p) return "intro";
    var lp = p.toLowerCase();
    if (lp.indexOf("quiz") >= 0) return "quiz";
    if (lp.indexOf("learn") >= 0 || lp.indexOf("explan") >= 0) return "explanation";
    if (lp.indexOf("summ") >= 0 || lp.indexOf("outro") >= 0) return "outro";
    if (lp.indexOf("complet") >= 0) return "completed";
    return "intro";
  }

  function isPastPhase(current: string, check: string): boolean {
    var ci = PHASE_ORDER.indexOf(current);
    var si = PHASE_ORDER.indexOf(check);
    return si >= 0 && ci >= 0 && si < ci;
  }

  function getPhaseColors(pk: string) { return COLORS[pk] || COLORS.intro; }

  // Utility: rounded rect with fill and optional stroke
  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Utility: word-wrap text, returns array of lines
  function wrapText(text: string, maxW: number, font: string): string[] {
    ctx.font = font;
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Utility: draw gradient-filled rounded rect
  function drawGradientButton(x: number, y: number, w: number, h: number, r: number, c1: string, c2: string, alpha?: number): void {
    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    roundRect(x, y, w, h, r);
    var grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function drawHoverRing() {
    var hoverAction = opts.hoverAction;
    if (!hoverAction) return;
    
    for (var i = regions.length - 1; i >= 0; i--) {
      var r = regions[i];
      if (!r || r.action !== hoverAction) continue;
      ctx.save();
      ctx.shadowColor = "rgba(45, 212, 191, 0.65)";
      ctx.shadowBlur = 18;
      roundRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 18);
      ctx.strokeStyle = "rgba(94, 234, 212, 0.95)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
      break;
    }
  }


  // ===== DRAW ROUTINES =====

  function drawBackground(pk: string): void {
    var pc = getPhaseColors(pk);
    ctx.clearRect(0, 0, CW, CH);

    // Outer rounded rect
    roundRect(0, 0, CW, CH, 40);
    var bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
    bgGrad.addColorStop(0, "rgba(5, 8, 22, 0.92)");
    bgGrad.addColorStop(1, "rgba(2, 4, 14, 0.95)");
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Subtle border
    roundRect(0, 0, CW, CH, 40);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top accent line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(40, 2);
    ctx.lineTo(CW - 40, 2);
    ctx.strokeStyle = pc.accent;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPhaseStepper(pk: string): void {
    var stepW = 200, gap = 36, stepH = 48;
    var totalW = STEPS.length * stepW + (STEPS.length - 1) * gap;
    var startX = (CW - totalW) / 2;
    var Y = 50;

    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      var sx = startX + i * (stepW + gap);
      var isActive = pk === s.key;
      var past = isPastPhase(pk, s.key);
      var sc = COLORS[s.key] || COLORS.intro;

      // Pill background
      roundRect(sx, Y, stepW, stepH, stepH / 2);
      if (isActive) {
        ctx.fillStyle = sc.accentBg;
        ctx.fill();
        roundRect(sx, Y, stepW, stepH, stepH / 2);
        ctx.strokeStyle = sc.accentBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (past) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(51, 65, 85, 0.2)";
        ctx.fill();
      }

      // Number circle
      var cx = sx + 30;
      var cy = Y + stepH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? sc.accent : past ? "rgba(16,185,129,0.4)" : "#475569";
      ctx.fill();

      // Number text
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.num), cx, cy + 1);

      // Label
      ctx.textAlign = "left";
      ctx.fillStyle = isActive ? "#e2e8f0" : past ? "rgba(148,163,184,0.7)" : "#64748b";
      ctx.font = (isActive ? "700" : "600") + " 22px " + FONT;
      ctx.fillText(s.label, sx + 56, cy + 1);

      // Chevron separator
      if (i < STEPS.length - 1) {
        ctx.fillStyle = "#475569";
        ctx.font = "bold 22px " + FONT;
        ctx.textAlign = "center";
        ctx.fillText("\u203A", sx + stepW + gap / 2, cy + 1);
      }
    }
  }

  function drawPhaseIcon(pk: string, x: number, y: number, size: number): void {
    var pc = getPhaseColors(pk);
    // Icon background
    roundRect(x, y, size, size, size * 0.22);
    ctx.fillStyle = pc.accentBg;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = pc.text;
    ctx.fillStyle = pc.text;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var cx = x + size / 2;
    var cy = y + size / 2;
    var s = size * 0.28;

    if (pk === "intro") {
      // Play triangle
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.4, cy - s);
      ctx.lineTo(cx + s * 0.8, cy);
      ctx.lineTo(cx - s * 0.4, cy + s);
      ctx.closePath();
      ctx.fill();
    } else if (pk === "explanation") {
      // Sparkle / star
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = Math.PI * 2 * i / 5 - Math.PI / 2;
        var r1 = s;
        var r2 = s * 0.4;
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        var a2 = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
      }
      ctx.closePath();
      ctx.fill();
    } else if (pk === "outro") {
      // Checkmark
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.7, cy);
      ctx.lineTo(cx - s * 0.15, cy + s * 0.6);
      ctx.lineTo(cx + s * 0.7, cy - s * 0.5);
      ctx.stroke();
    } else if (pk === "quiz") {
      // Question mark
      ctx.font = "bold " + (size * 0.5) + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx, cy + 2);
    } else if (pk === "completed") {
      // Trophy
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.6, cy - s * 0.6);
      ctx.lineTo(cx + s * 0.6, cy - s * 0.6);
      ctx.lineTo(cx + s * 0.4, cy + s * 0.1);
      ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.4, cy + s * 0.1);
      ctx.closePath();
      ctx.fill();
      // Base
      ctx.fillRect(cx - s * 0.3, cy + s * 0.3, s * 0.6, s * 0.15);
      ctx.fillRect(cx - s * 0.15, cy + s * 0.1, s * 0.3, s * 0.25);
    }
    ctx.restore();
  }

  function drawHeader(pk: string): void {
    const TITLES: Record<string, string> = { intro: "Introduction", explanation: "Explanation", outro: "Summary", quiz: "Quiz", completed: "Lesson Complete!" };
    const SUBS: Record<string, string> = { intro: "Welcome to the lesson", explanation: "Main learning content", outro: "Recap and key points", quiz: "Answer the question", completed: "Well done!" };

    var iconSize = 56;
    var hx = 60, hy = 126;

    drawPhaseIcon(pk, hx, hy, iconSize);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px " + FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(TITLES[pk] || "Lesson", hx + iconSize + 20, hy + 2);

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "400 24px " + FONT;
    ctx.fillText(SUBS[pk] || "", hx + iconSize + 20, hy + 42);

    // Speaking indicator (animated)
    if (S.ttsStatus === "playing") {
      var spX = CW - 280, spY = hy + 10;
      // Pill bg
      roundRect(spX, spY, 200, 40, 20);
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.fill();
      roundRect(spX, spY, 200, 40, 20);
      ctx.strokeStyle = "rgba(16,185,129,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Animated bars
      var barX = spX + 20;
      var barY = spY + 20;
      for (var b = 0; b < 3; b++) {
        var bh = 6 + 10 * Math.abs(Math.sin(ANIM_TIME * 8 + b * 1.2));
        roundRect(barX + b * 10, barY - bh / 2, 4, bh, 2);
        ctx.fillStyle = "#34d399";
        ctx.fill();
      }

      // "Speaking" text
      ctx.fillStyle = "#34d399";
      ctx.font = "600 20px " + FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Speaking", spX + 56, spY + 20);
    } else if (S.ttsStatus === "paused") {
      var ppX = CW - 220, ppY = hy + 14;
      roundRect(ppX, ppY, 150, 36, 18);
      ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "600 20px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paused", ppX + 75, ppY + 18);
    }
  }

  /** Phase-neutral: the script card takes no accent colour. */
  function drawScriptBox(): void {
    var bx = 52, by = 216, bw = CW - 104, bh = CH - 460;

    // Box background
    roundRect(bx, by, bw, bh, 20);
    ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
    ctx.fill();
    roundRect(bx, by, bw, bh, 20);
    ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Script text
    var textFont = "400 28px " + FONT;
    var lineH = 42;
    var px = bx + 36, py = by + 40;
    var maxW = bw - 72;
    var maxLines = Math.floor((bh - 80) / lineH);
    var scriptText = S.script || "No script available for this section.";
    var lines = wrapText(scriptText, maxW, textFont);

    ctx.font = textFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (var i = 0; i < lines.length && i < maxLines; i++) {
      var alpha = 1;
      if (i >= maxLines - 2) {
        alpha = 1 - (i - (maxLines - 2)) * 0.5;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(lines[i], px, py + i * lineH);
      ctx.restore();
    }

    // Fade-out gradient at bottom if text is truncated
    if (lines.length > maxLines) {
      var fadeH = 60;
      var fadeY = by + bh - fadeH;
      var grad = ctx.createLinearGradient(0, fadeY, 0, fadeY + fadeH);
      grad.addColorStop(0, "rgba(30, 41, 59, 0)");
      grad.addColorStop(1, "rgba(30, 41, 59, 0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(bx + 1, fadeY, bw - 2, fadeH);
    }
  }

  function drawButtonBar(pk: string): void {
    regions.length = 0;
    var btnY = CH - 190;
    var btnH = 72;
    var btnR = 16;
    var gap = 24;

    if (S.isStudent && S.controlStudentsEnabled) {
      // Draw locked banner
      roundRect(60, btnY, CW - 120, btnH, btnR);
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
      ctx.fill();
      roundRect(60, btnY, CW - 120, btnH, btnR);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      var pulse = 0.8 + 0.2 * Math.sin(ANIM_TIME * 4);
      ctx.fillStyle = "rgba(251, 113, 133, " + pulse + ")";
      ctx.font = "600 24px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒 Teacher is controlling class progression. Please pay attention.", CW / 2, btnY + btnH / 2);
      return;
    }

    // Replay button (left)
    var replayW = 220;
    var replayX = 60;
    roundRect(replayX, btnY, replayW, btnH, btnR);
    ctx.fillStyle = S.isPlayingAudio ? "rgba(51, 65, 85, 0.3)" : "rgba(51, 65, 85, 0.5)";
    ctx.fill();
    roundRect(replayX, btnY, replayW, btnH, btnR);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Replay icon (circular arrow)
    var riX = replayX + 36, riY = btnY + btnH / 2;
    ctx.save();
    ctx.strokeStyle = S.isPlayingAudio ? "#64748b" : "#cbd5e1";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(riX, riY, 10, -Math.PI * 0.8, Math.PI * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(riX + 7, riY + 6);
    ctx.lineTo(riX + 12, riY + 10);
    ctx.lineTo(riX + 7, riY + 14);
    ctx.fillStyle = S.isPlayingAudio ? "#64748b" : "#cbd5e1";
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = S.isPlayingAudio ? "#64748b" : "#cbd5e1";
    ctx.font = "600 24px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Replay", replayX + replayW / 2 + 12, btnY + btnH / 2);
    regions.push({ x: replayX, y: btnY, w: replayW, h: btnH, action: "replay" });

    // Play/Pause TTS button (next to Replay)
    var playPauseW = 160;
    var playPauseX = replayX + replayW + gap;
    roundRect(playPauseX, btnY, playPauseW, btnH, btnR);
    ctx.fillStyle = (S.ttsStatus === "playing" ? "rgba(245, 158, 11, 0.25)" : "rgba(51, 65, 85, 0.5)");
    ctx.fill();
    roundRect(playPauseX, btnY, playPauseW, btnH, btnR);
    ctx.strokeStyle = S.ttsStatus === "playing" ? "rgba(245, 158, 11, 0.4)" : "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = S.ttsStatus === "playing" ? "#fbbf24" : "#cbd5e1";
    ctx.font = "600 22px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(S.ttsStatus === "playing" ? "Pause" : "Play", playPauseX + playPauseW / 2, btnY + btnH / 2);
    regions.push({ x: playPauseX, y: btnY, w: playPauseW, h: btnH, action: S.ttsStatus === "playing" ? "ttsPause" : "ttsPlay" });

    // Skip to Quiz button (center, only if mcqs exist)
    if (S.totalMcqs > 0) {
      var skipW = 280;
      var skipX = (CW - skipW) / 2;
      drawGradientButton(skipX, btnY, skipW, btnH, btnR, "#d97706", "#ea580c", S.isPlayingAudio ? 0.4 : 0.9);
      ctx.fillStyle = "#fef3c7";
      ctx.font = "700 24px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Skip to Quiz", skipX + skipW / 2, btnY + btnH / 2);
      regions.push({ x: skipX, y: btnY, w: skipW, h: btnH, action: "skipToQuiz" });
    }

    // Next stage button (always enabled, left of Continue)
    var nextStageW = 200;
    var contW = 380;
    var contX = CW - contW - 60;
    var nextStageX = contX - nextStageW - gap;
    drawGradientButton(nextStageX, btnY, nextStageW, btnH, btnR, "#334155", "#1e293b", 0.9);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 22px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Next stage", nextStageX + nextStageW / 2, btnY + btnH / 2);
    regions.push({ x: nextStageX, y: btnY, w: nextStageW, h: btnH, action: "continue" });

    // Continue button (right, prominent)
    var contAlpha = S.isPlayingAudio && !S.waitingForUser ? 0.4 : 1;
    var pulseAlpha = S.waitingForUser ? 0.8 + 0.2 * Math.sin(ANIM_TIME * 4) : contAlpha;

    if (S.waitingForUser) {
      drawGradientButton(contX, btnY, contW, btnH, btnR, "#10b981", "#14b8a6", pulseAlpha);
      // Glow ring
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(ANIM_TIME * 4);
      roundRect(contX - 3, btnY - 3, contW + 6, btnH + 6, btnR + 3);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    } else if (S.isPlayingAudio) {
      roundRect(contX, btnY, contW, btnH, btnR);
      ctx.fillStyle = "rgba(51, 65, 85, 0.4)";
      ctx.fill();
    } else {
      drawGradientButton(contX, btnY, contW, btnH, btnR, "#475569", "#334155", 0.8);
    }

    // Continue label
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var contCx = contX + contW / 2;
    var contCy = btnY + btnH / 2;

    if (S.waitingForUser) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 26px " + FONT;
      var contLabel = pk === "outro" && S.totalMcqs > 0 ? "Start Quiz" : pk === "outro" ? "Complete Lesson" : "Continue";
      ctx.fillText(contLabel, contCx - 12, contCy);
      // Chevron
      ctx.beginPath();
      ctx.moveTo(contCx + ctx.measureText(contLabel).width / 2 + 4, contCy - 8);
      ctx.lineTo(contCx + ctx.measureText(contLabel).width / 2 + 14, contCy);
      ctx.lineTo(contCx + ctx.measureText(contLabel).width / 2 + 4, contCy + 8);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (S.isPlayingAudio) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 24px " + FONT;
      // Spinner dots
      for (var d = 0; d < 3; d++) {
        var da = ANIM_TIME * 6 + d * 2.1;
        var dotA = 0.3 + 0.7 * Math.abs(Math.sin(da));
        ctx.save();
        ctx.globalAlpha = dotA;
        ctx.beginPath();
        ctx.arc(contCx - 60 + d * 14, contCy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#94a3b8";
        ctx.fill();
        ctx.restore();
      }
      ctx.fillText("Listening...", contCx + 10, contCy);
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 26px " + FONT;
      var defLabel = pk === "outro" && S.totalMcqs > 0 ? "Quiz" : pk === "outro" ? "Done" : "Continue";
      ctx.fillText(defLabel, contCx, contCy);
    }

    regions.push({ x: contX, y: btnY, w: contW, h: btnH, action: "continue" });
  }

  function drawQuizView(pk: string): void {
    regions.length = 0;
    var pc = getPhaseColors(pk);

    // Q header
    var qhY = 216;
    ctx.fillStyle = pc.text;
    ctx.font = "700 28px " + FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Q" + (S.currentMcqIndex + 1) + " / " + S.totalMcqs, 72, qhY);

    // Question text
    var qFont = "600 30px " + FONT;
    var qLines = wrapText(S.question || "", CW - 160, qFont);
    ctx.fillStyle = "#ffffff";
    ctx.font = qFont;
    var qy = qhY + 52;
    for (var qi = 0; qi < qLines.length && qi < 3; qi++) {
      ctx.fillText(qLines[qi], 72, qy + qi * 42);
    }

    // Options
    var optY = qy + Math.min(qLines.length, 3) * 42 + 30;
    var optW = CW - 144;
    var optH = 72;
    var optGap = 16;
    var optX = 72;
    var letters = ["A", "B", "C", "D"];

    for (var oi = 0; oi < S.options.length && oi < 4; oi++) {
      var oy = optY + oi * (optH + optGap);
      var isSel = S.selectedAnswer === oi;
      var isCorrect = S.showResult && oi === S.correctAnswer;
      var isWrong = S.showResult && isSel && oi !== S.correctAnswer;

      // Option background
      roundRect(optX, oy, optW, optH, 14);
      if (isCorrect) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
        ctx.fill();
        roundRect(optX, oy, optW, optH, 14);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isWrong) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
        ctx.fill();
        roundRect(optX, oy, optW, optH, 14);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isSel) {
        ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
        ctx.fill();
        roundRect(optX, oy, optW, optH, 14);
        ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(30, 41, 59, 0.4)";
        ctx.fill();
        roundRect(optX, oy, optW, optH, 14);
        ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Letter badge
      var badgeX = optX + 16;
      var badgeY = oy + (optH - 42) / 2;
      roundRect(badgeX, badgeY, 42, 42, 10);
      ctx.fillStyle = isCorrect ? "rgba(16,185,129,0.3)" : isWrong ? "rgba(239,68,68,0.3)" : isSel ? "rgba(6,182,212,0.3)" : "rgba(71,85,105,0.3)";
      ctx.fill();

      ctx.fillStyle = isCorrect ? "#34d399" : isWrong ? "#f87171" : isSel ? "#22d3ee" : "#94a3b8";
      ctx.font = "bold 22px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letters[oi], badgeX + 21, badgeY + 22);

      // Option text
      ctx.textAlign = "left";
      ctx.fillStyle = isCorrect ? "#d1fae5" : isWrong ? "#fecaca" : isSel ? "#cffafe" : "#e2e8f0";
      ctx.font = "500 24px " + FONT;
      var optText = String(S.options[oi] || "");
      if (ctx.measureText(optText).width > optW - 130) {
        while (ctx.measureText(optText + "...").width > optW - 130 && optText.length > 0) {
          optText = optText.slice(0, -1);
        }
        optText += "...";
      }
      ctx.fillText(optText, optX + 74, oy + optH / 2 + 1);

      // Result icon
      if (isCorrect) {
        ctx.save();
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(optX + optW - 48, oy + optH / 2 - 4);
        ctx.lineTo(optX + optW - 38, oy + optH / 2 + 6);
        ctx.lineTo(optX + optW - 24, oy + optH / 2 - 8);
        ctx.stroke();
        ctx.restore();
      } else if (isWrong) {
        ctx.save();
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 3;
        var xc = optX + optW - 36;
        var yc = oy + optH / 2;
        ctx.beginPath();
        ctx.moveTo(xc - 8, yc - 8); ctx.lineTo(xc + 8, yc + 8);
        ctx.moveTo(xc + 8, yc - 8); ctx.lineTo(xc - 8, yc + 8);
        ctx.stroke();
        ctx.restore();
      }

      regions.push({ x: optX, y: oy, w: optW, h: optH, action: "mcqSelect:" + oi });
    }

    // Explanation (after result)
    var afterOptsY = optY + Math.min(S.options.length, 4) * (optH + optGap) + 10;
    if (S.showResult && S.explanation) {
      var expX = 72, expW = CW - 144, expH = 90;
      roundRect(expX, afterOptsY, expW, expH, 14);
      ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
      ctx.fill();
      roundRect(expX, afterOptsY, expW, expH, 14);
      ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#22d3ee";
      ctx.font = "600 20px " + FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Explanation:", expX + 20, afterOptsY + 14);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "400 20px " + FONT;
      var expLines = wrapText(S.explanation, expW - 40, "400 20px " + FONT);
      for (var ei = 0; ei < expLines.length && ei < 2; ei++) {
        ctx.fillText(expLines[ei], expX + 20, afterOptsY + 40 + ei * 26);
      }
      afterOptsY += expH + 16;
    }

    // Submit / Next button
    var sbtnW = 360, sbtnH = 72, sbtnR = 16;
    var sbtnX = (CW - sbtnW) / 2;
    var sbtnY = Math.max(afterOptsY, CH - 160);

    if (!S.showResult) {
      // Submit
      var submitDisabled = S.selectedAnswer < 0;
      drawGradientButton(sbtnX, sbtnY, sbtnW, sbtnH, sbtnR, "#d97706", "#ea580c", submitDisabled ? 0.4 : 0.95);
      ctx.fillStyle = submitDisabled ? "rgba(255,255,255,0.4)" : "#fef3c7";
      ctx.font = "700 26px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Submit Answer", sbtnX + sbtnW / 2, sbtnY + sbtnH / 2);
      if (!submitDisabled) {
        regions.push({ x: sbtnX, y: sbtnY, w: sbtnW, h: sbtnH, action: "mcqSubmit" });
      }
    } else {
      // Next
      var nextLabel = S.currentMcqIndex < S.totalMcqs - 1 ? "Next Question" : "See Results";
      drawGradientButton(sbtnX, sbtnY, sbtnW, sbtnH, sbtnR, "#10b981", "#0d9488", 0.95);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 26px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(nextLabel, sbtnX + sbtnW / 2, sbtnY + sbtnH / 2);
      regions.push({ x: sbtnX, y: sbtnY, w: sbtnW, h: sbtnH, action: "mcqNext" });
    }
  }

  function drawCompletedView() {
    regions.length = 0;
    var cy = CH / 2 - 120;

    // Trophy icon (large centered)
    var tSize = 120;
    var tx = (CW - tSize) / 2;
    drawPhaseIcon("completed", tx, cy - 80, tSize);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Lesson Complete!", CW / 2, cy + 80);

    // Score
    if (S.scoreLabel) {
      var scoreY = cy + 150;
      var scoreW = 380, scoreH = 120;
      var scoreX = (CW - scoreW) / 2;
      roundRect(scoreX, scoreY, scoreW, scoreH, 24);
      ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
      ctx.fill();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 24px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Score", CW / 2, scoreY + 18);

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 52px " + FONT;
      ctx.fillText(S.scoreLabel, CW / 2, scoreY + 52);
    }

    // Done button
    var doneW = 320, doneH = 72, doneR = 16;
    var doneX = (CW - doneW) / 2;
    var doneY = CH - 180;
    drawGradientButton(doneX, doneY, doneW, doneH, doneR, "#10b981", "#0d9488", 0.95);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Done", doneX + doneW / 2, doneY + doneH / 2);
    regions.push({ x: doneX, y: doneY, w: doneW, h: doneH, action: "continue" });
  }

  function drawHostDirectButton() {
    if (!S.isHost) return;
    var x = 520, y = CH - 190, w = 300, h = 72, r = 16;
    drawGradientButton(x, y, w, h, r, "#0f766e", "#0891b2", 0.95);
    ctx.fillStyle = "#ecfeff";
    ctx.font = "700 22px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Direct class view", x + w / 2, y + h / 2);
    regions.push({ x: x, y: y, w: w, h: h, action: "directClassView" });
  }

  function drawHostModelButtons() {
    // In-headset mirrors of the bottom-bar model controls, so a teacher wearing a headset
    // is not forced back to a screen to take a model apart. Host-only, and only when the
    // scene actually has separable geometry — React reports that via S.modelPartCount.
    if (!S.isHost) return;
    if (!S.modelPartCount || S.modelPartCount < 2) return;

    var defs = [
      { label: "Apart",   action: "model:explodeUp" },
      { label: "Together",action: "model:explodeDown" },
      { label: "Isolate", action: "model:isolate" },
      { label: "Section", action: "model:section" },
      { label: "Reset",   action: "model:reset" }
    ];
    var w = 168, h = 64, gap = 10, r = 14;
    var totalW = defs.length * w + (defs.length - 1) * gap;
    var x0 = (CW - totalW) / 2;
    var y = CH - 275;

    for (var i = 0; i < defs.length; i++) {
      var bx = x0 + i * (w + gap);
      roundRect(bx, y, w, h, r);
      ctx.fillStyle = "rgba(15, 118, 110, 0.30)";
      ctx.fill();
      roundRect(bx, y, w, h, r);
      ctx.strokeStyle = "rgba(45, 212, 191, 0.40)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ecfeff";
      ctx.font = "700 22px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(defs[i].label, bx + w / 2, y + h / 2);

      regions.push({ x: bx, y: y, w: w, h: h, action: defs[i].action });
    }
  }

  function drawPanelHandles() {
    // A grab handle and a resize corner, replacing six 66x34 nudge buttons that were
    // labelled with raw Unicode text glyphs. Direct manipulation instead of discrete
    // steps: the handle drags the panel, the corner scales it.
    var GRAB_W = 190, GRAB_H = 26;
    var gx = (CW - GRAB_W) / 2, gy = 18;

    // Grab bar — centred on the top edge, where a window title bar would be.
    roundRect(gx, gy, GRAB_W, GRAB_H, GRAB_H / 2);
    ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
    ctx.fill();
    roundRect(gx, gy, GRAB_W, GRAB_H, GRAB_H / 2);
    ctx.strokeStyle = "rgba(203, 213, 225, 0.30)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Two short gripper rules, the conventional "draggable" cue.
    ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (var g = 0; g < 2; g++) {
      var lineY = gy + GRAB_H / 2 - 3 + g * 6;
      ctx.beginPath();
      ctx.moveTo(gx + 62, lineY);
      ctx.lineTo(gx + GRAB_W - 62, lineY);
      ctx.stroke();
    }
    regions.push({ x: gx, y: gy, w: GRAB_W, h: GRAB_H, action: "panelGrab" });

    // Resize corner — bottom-right, drawn as stacked diagonals.
    var RS = 46, rx = CW - RS - 26, ry = CH - RS - 26;
    ctx.strokeStyle = "rgba(203, 213, 225, 0.45)";
    ctx.lineWidth = 2.5;
    for (var d = 0; d < 3; d++) {
      var off = d * 11;
      ctx.beginPath();
      ctx.moveTo(rx + RS - off, ry + RS);
      ctx.lineTo(rx + RS, ry + RS - off);
      ctx.stroke();
    }
    regions.push({ x: rx, y: ry, w: RS, h: RS, action: "panelResize" });
  }

  // ===== MAIN DRAW =====
  function drawPanel() {
    var pk = phaseKey(S.phase);
    drawBackground(pk);
    drawPhaseStepper(pk);

    if (pk === "completed") {
      drawHeader(pk);
      drawCompletedView();
    } else if (S.showQuiz) {
      drawHeader(pk);
      drawQuizView(pk);
    } else {
      drawHeader(pk);
      drawScriptBox();
      if (pk !== "completed") {
        drawButtonBar(pk);
      }
    }

    drawHostDirectButton();
    drawHostModelButtons();
    drawPanelHandles();

    // Phase stepper pills: add click regions (after other regions so they are not cleared)
    var stepW = 200, gap = 36, stepH = 48, Y = 50;
    var totalW = STEPS.length * stepW + (STEPS.length - 1) * gap;
    var startX = (CW - totalW) / 2;
    for (var i = 0; i < STEPS.length; i++) {
      var sx = startX + i * (stepW + gap);
      regions.push({ x: sx, y: Y, w: stepW, h: stepH, action: "phaseGo:" + STEPS[i].key });
    }

    drawHoverRing();
  }

  drawPanel();
  return regions;
}
