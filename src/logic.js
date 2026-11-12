import { lessons, getLesson, lessonSteps } from "./data.js";

export const STORE_KEY = "siyaq-progress-v2";
export const LEGACY_STORE_KEY = "siyaq-progress-v1";
export const FLOW = ["dialogue-0", "dialogue-1", "dialogue-2", "order-0", "order-1", "writing-0", "listening-0", "speaking-0"];
export const ACTIVITY_NAMES = {
  dialogue: "محادثة تفاعلية",
  order: "ترتيب الكلمات",
  writing: "الكتابة",
  listening: "الاستماع",
  speaking: "التحدث",
};

export function emptyProgress() {
  return { version: 2, completed: [], results: [], mistakes: [], sessions: {}, lastLesson: null };
}

export function normalizedAnswer(value) {
  return String(value ?? "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesKnownAnswer(value, exercise) {
  const answer = normalizedAnswer(value);
  return !!answer && [exercise?.model, ...(exercise?.variants ?? [])]
    .some((variant) => normalizedAnswer(variant) === answer);
}

export function compareRecognizedWords(target, recognized) {
  const expected = normalizedAnswer(target).split(" ").filter(Boolean);
  const heard = normalizedAnswer(recognized).split(" ").filter(Boolean);
  const remaining = [...heard];
  const matched = [];
  const missing = [];
  for (const word of expected) {
    const index = remaining.indexOf(word);
    if (index < 0) missing.push(word);
    else {
      matched.push(word);
      remaining.splice(index, 1);
    }
  }
  return { matched, missing, extra: remaining };
}

export function speechErrorState(error) {
  return ["not-allowed", "service-not-allowed"].includes(String(error || "")) ? "denied" : "error";
}

export function makeSession(lessonId) {
  return {
    lessonId,
    stage: "intro",
    dialogueIndex: 0,
    orderIndex: 0,
    choice: null,
    wordOrder: [],
    feedback: null,
    dialogueHistory: [],
    dialogueWrong: false,
    checkedSteps: [],
    writingDraft: "",
    writingFeedback: null,
    writingReviewed: false,
    listeningRevealed: false,
    listeningManual: false,
    listeningAnswer: null,
    listeningFeedback: null,
    audioError: "",
    speakingTranscript: "",
    speakingStatus: "idle",
    completedSteps: [],
    score: { correct: 0, assessed: 0, manual: 0 },
    startedAt: new Date().toISOString(),
  };
}

function safeText(value, max = 400) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function safeNumber(value, min, max, fallback = min) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function cleanSession(id, saved) {
  const lesson = getLesson(id);
  if (!lesson || !saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const fresh = makeSession(id);
  const allowed = new Set(lessonSteps(lesson).map((step) => `${step.type}-${step.index}`));
  fresh.stage = ["intro", "dialogue", "order", "writing", "listening", "speaking", "result"]
    .includes(saved.stage) ? saved.stage : fresh.stage;
  fresh.dialogueIndex = safeNumber(saved.dialogueIndex, 0, 2);
  fresh.orderIndex = safeNumber(saved.orderIndex, 0, 1);
  fresh.choice = saved.choice === null ? null : safeNumber(saved.choice, 0, 2, null);
  const maxWords = Math.max(...lesson.order.map((exercise) => exercise.words.length));
  fresh.wordOrder = Array.isArray(saved.wordOrder)
    ? [...new Set(saved.wordOrder.filter((index) => Number.isInteger(index) && index >= 0 && index < maxWords))]
    : [];
  fresh.completedSteps = Array.isArray(saved.completedSteps)
    ? [...new Set(saved.completedSteps.filter((step) => allowed.has(step)))] : [];
  fresh.checkedSteps = Array.isArray(saved.checkedSteps)
    ? [...new Set(saved.checkedSteps.filter((step) => allowed.has(step)))] : [];
  fresh.dialogueWrong = saved.dialogueWrong === true;
  fresh.dialogueHistory = Array.isArray(saved.dialogueHistory)
    ? saved.dialogueHistory.slice(-3).map((turn) => ({
      prompt: safeText(turn?.prompt), user: safeText(turn?.user),
      partner: safeText(turn?.partner), rehearsed: turn?.rehearsed === true,
    })) : [];
  fresh.writingDraft = safeText(saved.writingDraft, 500);
  fresh.writingReviewed = saved.writingReviewed === true;
  fresh.listeningRevealed = saved.listeningRevealed === true;
  fresh.listeningManual = saved.listeningManual === true;
  fresh.listeningAnswer = saved.listeningAnswer === null
    ? null : safeNumber(saved.listeningAnswer, 0, 2, null);
  fresh.speakingTranscript = safeText(saved.speakingTranscript, 500);
  fresh.speakingStatus = ["idle", "recognized", "manual", "unsupported", "denied", "error"]
    .includes(saved.speakingStatus) ? saved.speakingStatus : "idle";
  fresh.audioError = safeText(saved.audioError, 200);
  fresh.startedAt = typeof saved.startedAt === "string" && !Number.isNaN(Date.parse(saved.startedAt))
    ? saved.startedAt.slice(0, 32) : fresh.startedAt;
  fresh.score = {
    correct: safeNumber(saved.score?.correct, 0, 1000, 0),
    assessed: safeNumber(saved.score?.assessed, 0, 1000, 0),
    manual: safeNumber(saved.score?.manual, 0, 1000, 0),
  };
  if (saved.feedback && ["correct", "incorrect"].includes(saved.feedback.kind)) {
    fresh.feedback = {
      kind: saved.feedback.kind,
      choice: safeNumber(saved.feedback.choice, 0, 2, 0),
      message: safeText(saved.feedback.message, 300),
    };
  }
  if (saved.writingFeedback && ["correct", "incorrect", "manual"].includes(saved.writingFeedback.kind)) {
    fresh.writingFeedback = {
      kind: saved.writingFeedback.kind,
      attempted: safeText(saved.writingFeedback.attempted, 500),
    };
  }
  if (saved.listeningFeedback && ["correct", "incorrect", "manual"].includes(saved.listeningFeedback.kind)) {
    fresh.listeningFeedback = {
      kind: saved.listeningFeedback.kind,
      choice: safeNumber(saved.listeningFeedback.choice, 0, 2, 0),
    };
  }
  return fresh;
}

function migrateLegacy(saved) {
  const progress = emptyProgress();
  const oldCompleted = saved?.completed;
  if (oldCompleted && typeof oldCompleted === "object" && !Array.isArray(oldCompleted)) {
    for (const [id, result] of Object.entries(oldCompleted)) {
      if (!getLesson(id)) continue;
      progress.completed.push(id);
      progress.results.push({
        lessonId: id,
        correct: safeNumber(result?.score, 0, 100, 0),
        assessed: safeNumber(result?.max, 0, 100, 0),
        manual: 0,
        date: typeof result?.doneAt === "string" ? result.doneAt.slice(0, 10) : "",
      });
    }
  }
  if (saved?.mistakes && typeof saved.mistakes === "object" && !Array.isArray(saved.mistakes)) {
    for (const [key, detail] of Object.entries(saved.mistakes)) {
      const match = /^(.*):(order|dialogue|writing|listening|speaking):(\d+)$/.exec(key);
      if (!match || !getLesson(match[1])) continue;
      const [, lessonId, type, index] = match;
      const lesson = getLesson(lessonId);
      const exercise = lesson[type]?.[Number(index)] ?? lesson[type];
      progress.mistakes.push({
        id: `migrated-${lessonId}-${type}-${index}`,
        lessonId, type, index: Number(index), attempted: "",
        correction: type === "order" ? exercise?.answer : exercise?.model ?? exercise?.options?.[exercise?.correct] ?? "",
        reason: exercise?.note ?? lesson.rule,
        date: typeof detail?.date === "string" ? detail.date.slice(0, 10) : "",
      });
    }
  }
  return progress;
}

function cleanProgress(saved) {
  const progress = emptyProgress();
  if (Array.isArray(saved.completed)) {
    progress.completed = [...new Set(saved.completed.filter((id) => !!getLesson(id)))];
  }
  if (Array.isArray(saved.results)) {
    progress.results = saved.results.slice(-100).flatMap((entry) => {
      if (!getLesson(entry?.lessonId)) return [];
      return [{
        lessonId: entry.lessonId,
        correct: safeNumber(entry.correct, 0, 1000, 0),
        assessed: safeNumber(entry.assessed, 0, 1000, 0),
        manual: safeNumber(entry.manual, 0, 1000, 0),
        date: safeText(entry.date, 10),
      }];
    });
  }
  if (Array.isArray(saved.mistakes)) {
    progress.mistakes = saved.mistakes.slice(-100).flatMap((entry, index) => {
      const lesson = getLesson(entry?.lessonId);
      if (!lesson || !["dialogue", "order", "writing", "listening", "speaking"].includes(entry.type)) return [];
      return [{
        id: safeText(entry.id, 80) || `restored-${index}`,
        lessonId: lesson.id,
        type: entry.type,
        index: safeNumber(entry.index, 0, entry.type === "dialogue" ? 2 : entry.type === "order" ? 1 : 0),
        attempted: safeText(entry.attempted, 500),
        correction: safeText(entry.correction, 500),
        reason: safeText(entry.reason, 500),
        date: safeText(entry.date, 10),
      }];
    });
  }
  if (saved.sessions && typeof saved.sessions === "object" && !Array.isArray(saved.sessions)) {
    for (const [id, session] of Object.entries(saved.sessions)) {
      const clean = cleanSession(id, session);
      if (clean) progress.sessions[id] = clean;
    }
  }
  progress.lastLesson = getLesson(saved.lastLesson)?.id ?? null;
  return progress;
}

export function restoreProgress(storage) {
  const fresh = emptyProgress();
  if (arguments.length === 0) {
    try { storage = globalThis.localStorage; }
    catch { return { progress: fresh, warning: "unavailable", migrated: false }; }
  }
  if (!storage) return { progress: fresh, warning: "unavailable", migrated: false };

  let current;
  let legacy;
  try {
    current = storage.getItem(STORE_KEY);
    legacy = current === null ? storage.getItem(LEGACY_STORE_KEY) : null;
  } catch {
    return { progress: fresh, warning: "unavailable", migrated: false };
  }

  const corrupt = (raw) => {
    try {
      if (raw && raw.length <= 200_000 && storage.getItem(`${STORE_KEY}-recovery`) === null) {
        storage.setItem(`${STORE_KEY}-recovery`, raw);
      }
    } catch { /* Keep learning available when this browser blocks or fills local storage. */ }
    return { progress: fresh, warning: "corrupt", migrated: false };
  };
  const migrate = (raw) => {
    try {
      const saved = JSON.parse(raw);
      const oldRecord = saved && typeof saved === "object" && !Array.isArray(saved)
        && (saved.version === 1 || (saved.version === undefined && saved.completed && !Array.isArray(saved.completed)));
      return oldRecord ? { progress: migrateLegacy(saved), warning: null, migrated: true } : corrupt(raw);
    } catch { return corrupt(raw); }
  };

  if (current !== null) {
    try {
      const saved = JSON.parse(current);
      if (saved && saved.version === 2 && typeof saved === "object" && !Array.isArray(saved)) {
        return { progress: cleanProgress(saved), warning: null, migrated: false };
      }
      if (saved?.version === 1 || (saved && saved.version === undefined && saved.completed && !Array.isArray(saved.completed))) {
        return { progress: migrateLegacy(saved), warning: null, migrated: true };
      }
      return corrupt(current);
    } catch { return corrupt(current); }
  }
  if (legacy !== null) return migrate(legacy);
  return { progress: fresh, warning: null, migrated: false };
}

export function isLessonComplete(progress, id) {
  return progress.completed.includes(id);
}

export function completedActivityKeys(lesson) {
  return lessonSteps(lesson).map((step) => `${step.type}-${step.index}`);
}

export function allActivitiesComplete(session, lesson) {
  const finished = new Set(session.completedSteps);
  return completedActivityKeys(lesson).every((step) => finished.has(step));
}
