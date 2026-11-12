import { tracks, lessons, getLesson, getTrack } from "./data.js";
import {
  ACTIVITY_NAMES, FLOW, STORE_KEY, allActivitiesComplete, compareRecognizedWords,
  emptyProgress, isLessonComplete, makeSession, matchesKnownAnswer, normalizedAnswer, speechErrorState,
  restoreProgress,
} from "./logic.js";

const app = document.getElementById("app");
const announcer = document.getElementById("announcer");
const initial = restoreProgress();
let progress = initial.progress;
let storageWarning = initial.warning;
let speechRecognition = null;
let speechToken = 0;
const svgNS = "http://www.w3.org/2000/svg";

const iconPaths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  book: "M12 7v14M3 18V5a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v13h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
  chart: "M3 3v18h18M7 16v-4m5 4V7m5 9V4",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 18 6-6-6-6",
  check: "m5 12 4 4L19 6",
  message: "M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  headset: "M3 14v-3a9 9 0 0 1 18 0v3m-2 5h-2v-7h4v5a2 2 0 0 1-2 2Zm-14 0h2v-7H3v5a2 2 0 0 0 2 2Zm14 0a4 4 0 0 1-4 3h-2",
  mail: "M3 5h18v14H3zM3 7l9 7 9-7",
  puzzle: "M8 3H5a2 2 0 0 0-2 2v3h2a2 2 0 0 1 0 4H3v7a2 2 0 0 0 2 2h5v-2a2 2 0 0 1 4 0v2h5a2 2 0 0 0 2-2v-5h-2a2 2 0 0 1 0-4h2V5a2 2 0 0 0-2-2h-7v2a2 2 0 0 1-4 0Z",
  briefcase: "M3 7h18v14H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0m-9 0v3",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Zm-4 6a7 7 0 0 0 14 0m-7 7v4m-4 0h8",
  volume: "M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12",
  target: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-4 0h.01",
};

function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  if (tag === "h1" && attrs.tabindex === undefined) element.tabIndex = -1;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "className") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "value") element.value = value;
    else if (key === "disabled" || key === "hidden" || key === "checked") element[key] = Boolean(value);
    else if (key === "htmlFor") element.htmlFor = value;
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

function icon(name, size = 18) {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", iconPaths[name] ?? iconPaths.message);
  svg.append(path);
  return svg;
}

function button(label, action, style = "", attrs = {}, trailingIcon = null) {
  const children = [document.createTextNode(label)];
  if (trailingIcon) children.push(icon(trailingIcon, 16));
  return el("button", {
    type: "button", className: `button ${style}`.trim(), "data-action": action,
    "data-focus-key": action, ...attrs,
  }, children);
}

function link(label, href, style = "") {
  return el("a", { href, className: style }, label);
}

function english(value, className = "english") {
  return el("span", { lang: "en", dir: "ltr", className, text: value });
}

function pageHeading(eyebrow, title, description = "") {
  const heading = el("div", { className: "page-heading" }, [
    el("div", { className: "eyebrow", text: eyebrow }),
    el("h1", { tabindex: "-1", text: title }),
  ]);
  if (description) heading.append(el("p", { text: description }));
  return heading;
}

function announce(message) {
  announcer.textContent = "";
  window.requestAnimationFrame(() => { announcer.textContent = message; });
}

function saveProgress() {
  try {
    progress.version = 2;
    localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    storageWarning = null;
  } catch {
    storageWarning = "unavailable";
  }
}

function currentRoute() {
  const parts = location.hash.slice(1).split("/");
  const name = parts[0];
  const id = parts[1] ?? "";
  if (name === "track" && getTrack(id)) return { name, id };
  if (name === "lesson" && getLesson(id)) return { name, id };
  if (name === "practice" && getLesson(id)) return { name, id };
  if (["home", "tracks", "review", "progress"].includes(name)) return { name };
  return { name: "home" };
}

function updateNavigation(route) {
  const active = route.name === "track" || route.name === "lesson" || route.name === "practice" ? "tracks" : route.name;
  document.querySelectorAll("[data-nav]").forEach((item) => {
    if (item.dataset.nav === active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-error-count]").forEach((badge) => {
    badge.hidden = progress.mistakes.length === 0;
    badge.textContent = String(Math.min(progress.mistakes.length, 99));
  });
}

function warningBanner() {
  if (!storageWarning) return null;
  const copy = storageWarning === "corrupt"
    ? "تعذر قراءة التقدم السابق. احتُفظ بنسخة محلية للاستعادة؛ يمكنك متابعة الدروس من الآن."
    : "التخزين المحلي غير متاح الآن. يمكنك متابعة الدرس، لكن التقدم قد لا يبقى بعد إغلاق الصفحة.";
  return el("aside", { className: "storage-notice", role: "status", text: copy });
}

function appendBanner(fragment) {
  const banner = warningBanner();
  if (banner) fragment.append(banner);
  return fragment;
}

function completedCount(trackId = null) {
  return lessons.filter((lesson) => (!trackId || lesson.track === trackId) && isLessonComplete(progress, lesson.id)).length;
}

function nextLesson() {
  const resumable = progress.lastLesson && progress.sessions[progress.lastLesson];
  if (resumable && progress.sessions[progress.lastLesson].stage !== "result") return getLesson(progress.lastLesson);
  return lessons.find((lesson) => !isLessonComplete(progress, lesson.id))
    ?? (progress.lastLesson ? getLesson(progress.lastLesson) : lessons[0]);
}

function progressRing(count, total) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const percent = total ? Math.round((count / total) * 100) : 0;
  const ring = el("div", { className: "progress-ring", role: "img", "aria-label": `أكملت ${count} من ${total} درسًا، ${percent} بالمئة` });
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  for (const [className, offset] of [["ring-back", "0"], ["ring-value", String(circumference * (1 - percent / 100))]]) {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "50"); circle.setAttribute("cy", "50"); circle.setAttribute("r", String(radius));
    circle.setAttribute("class", className); circle.setAttribute("stroke-dasharray", String(circumference));
    circle.setAttribute("stroke-dashoffset", offset); svg.append(circle);
  }
  ring.append(svg, el("span", { className: "ring-label" }, [
    el("strong", { text: String(percent) }), el("small", { text: "بالمئة" }),
  ]));
  return ring;
}

function meter(value, total) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  const bar = el("span", { "aria-hidden": "true" });
  bar.style.width = `${percent}%`;
  return el("div", { className: "meter", role: "img", "aria-label": `التقدم ${value} من ${total}` }, bar);
}

function pathRow(track) {
  const total = lessons.filter((lesson) => lesson.track === track.id).length;
  const done = completedCount(track.id);
  return el("a", { href: `#track/${track.id}`, className: "path-row" }, [
    el("span", { className: "path-index", dir: "ltr", text: track.number }),
    el("span", {}, [
      el("span", { className: "path-title", text: track.title }),
      el("span", { className: "path-title-en", lang: "en", dir: "ltr", text: track.en }),
      el("span", { className: "path-description", text: track.desc }),
    ]),
    el("span", { className: "path-progress" }, [
      el("span", { text: `${done} من ${total} دروس` }), meter(done, total),
    ]),
    icon("chevron", 17),
  ]);
}

function renderHome() {
  const fragment = el("div", { className: "home-page" });
  appendBanner(fragment);
  const done = completedCount();
  const recommended = nextLesson();
  const draft = progress.sessions[recommended.id];
  fragment.append(el("section", { className: "home-intro" }, [
    el("div", { className: "eyebrow", text: "SIYAQ  /  ENGLISH FOR WORK" }),
    el("h1", {}, ["إنجليزية تواكب ", el("em", { text: "يومك في العمل." })]),
    el("p", { text: "تعلّم كيف تتحدث بوضوح في الاجتماعات، تكتب رسائل مهنية، وتتعامل مع المواقف اليومية بثقة." }),
    el("div", { className: "home-meta" }, [
      el("span", { text: "مستوى متوسط B1–B2" }), el("span", { className: "meta-divider" }),
      el("span", { text: "دروس قصيرة ومكتملة" }),
    ]),
  ]));

  const overview = el("section", { className: "home-overview", "aria-label": "تقدمك ودرسك التالي" });
  overview.append(el("div", { className: "progress-overview" }, [
    el("div", {}, [
      el("div", { className: "eyebrow", text: "تقدمك" }),
      el("h2", { text: `${done} من ${lessons.length} درسًا` }),
      el("p", { text: done === lessons.length ? "أكملت كل الدروس؛ يمكنك مراجعتها في أي وقت." : "كل درس ينقلك إلى موقف عملي جديد." }),
    ]),
    progressRing(done, lessons.length),
  ]));
  const pick = el("section", { className: "lesson-pick" }, [
    el("div", {}, [
      el("div", { className: "eyebrow", text: draft ? "استكمل من حيث توقفت" : "اقتراحك التالي" }),
      el("h2", { text: recommended.title }),
      english(recommended.en, "lesson-title-en"),
      el("p", { className: "lesson-context", text: recommended.situation }),
    ]),
    button(draft ? "استكمل الدرس" : isLessonComplete(progress, recommended.id) ? "أعد الدرس" : "ابدأ الدرس", "open-recommended", "button-light pick-action", {}, "arrow"),
  ]);
  overview.append(pick);
  fragment.append(overview);

  fragment.append(el("a", { href: "#review", className: "review-shortcut" }, [
    el("span", { className: "review-shortcut-copy" }, [
      el("span", { className: "review-mark" }, icon("repeat", 15)),
      el("span", {}, [
        el("strong", { text: "مراجعة الأخطاء السابقة" }),
        el("p", { text: progress.mistakes.length ? `${progress.mistakes.length} نقطة تنتظر المراجعة` : "ارجع إلى إجاباتك الصعبة في أي وقت" }),
      ]),
    ]),
    el("span", { className: "text-action" }, [progress.mistakes.length ? String(progress.mistakes.length) : "افتح المراجعة", icon("chevron", 16)]),
  ]));

  const section = el("section", { id: "tracks-preview" });
  section.append(el("div", { className: "section-heading" }, [
    el("div", {}, [el("h2", { text: "اختر موقفًا وابدأ" }), el("p", { text: "ستة مسارات عملية، بثلاثة دروس في كل مسار." })]),
    link("كل المسارات", "#tracks", "section-link"),
  ]));
  const list = el("div", { className: "path-list" });
  tracks.forEach((track) => list.append(pathRow(track)));
  section.append(list);
  fragment.append(section);
  fragment.append(el("aside", { className: "home-bottom-note" }, [
    icon("target", 18), el("span", {}, [el("strong", { text: "تعلّم في سياق." }), " كل درس يجمع محادثة، وبناء جمل، وكتابة، واستماعًا، وتحدثًا."]),
  ]));
  return fragment;
}

function renderTracks() {
  const fragment = el("div");
  appendBanner(fragment);
  fragment.append(pageHeading("مسارات التعلّم", "إنجليزية العمل، خطوة بخطوة", "اختر موقفًا يتكرر في يومك. في كل مسار ثلاثة دروس أصلية وتدريبات متدرجة."));
  const list = el("div", { className: "path-list" });
  tracks.forEach((track) => list.append(pathRow(track)));
  fragment.append(list);
  return fragment;
}

function renderTrack(id) {
  const track = getTrack(id);
  const fragment = el("div");
  fragment.append(link("كل المسارات", "#tracks", "back-link"));
  fragment.append(pageHeading(`${track.number}  /  06`, track.title, track.desc));
  const lessonsInTrack = lessons.filter((lesson) => lesson.track === track.id);
  fragment.append(el("section", { className: "track-overview" }, [
    el("div", {}, [el("div", { className: "eyebrow", text: track.en }), el("h2", { text: `${completedCount(track.id)} من ${lessonsInTrack.length} دروس` }),
      el("p", { text: "اقرأ قاعدة قصيرة، اتبع حوارًا متصلًا، ثم جرّب المهارات الخمس على الموقف نفسه." })]),
    el("span", { className: "track-index", dir: "ltr", text: track.number }),
  ]));
  const list = el("div", { className: "lesson-list" });
  lessonsInTrack.forEach((lesson, index) => {
    const saved = progress.sessions[lesson.id];
    const row = el("div", { className: "lesson-row" }, [
      el("span", { className: "lesson-number", dir: "ltr", text: String(index + 1).padStart(2, "0") }),
      el("div", {}, [
        el("h2", { className: "lesson-name", text: lesson.title }),
        el("span", { className: "lesson-name-en", lang: "en", dir: "ltr", text: lesson.en }),
        el("p", { className: "lesson-scene", text: lesson.situation }),
      ]),
    ]);
    if (isLessonComplete(progress, lesson.id) && !saved) {
      row.append(el("span", { className: "lesson-completion" }, [icon("check", 15), "مكتمل"]));
    }
    row.append(button(saved ? "استكمل الدرس" : isLessonComplete(progress, lesson.id) ? "أعد الدرس" : "افتح الدرس", "open-lesson", "button-outline button-small", { "data-id": lesson.id }));
    list.append(row);
  });
  fragment.append(list);
  return fragment;
}

function startLesson(id) {
  if (!progress.sessions[id]) progress.sessions[id] = makeSession(id);
  progress.lastLesson = id;
  saveProgress();
  location.hash = `#practice/${id}`;
}

function renderLesson(id) {
  const lesson = getLesson(id);
  const track = getTrack(lesson.track);
  const fragment = el("div");
  fragment.append(link(track.title, `#track/${track.id}`, "back-link"));
  const heading = el("section", { className: "lesson-heading" }, [
    el("div", { className: "eyebrow", text: `${track.number}  /  ${track.en}` }),
    el("h1", { tabindex: "-1", text: lesson.title }),
    english(lesson.en, "lesson-heading-en"),
    el("p", { className: "lesson-objective", text: lesson.objective }),
    el("div", { className: "lesson-facts" }, [
      el("span", { className: "lesson-fact" }, [icon("clock", 15), "٨ جولات قصيرة"]),
      el("span", { className: "lesson-fact" }, [icon("message", 15), "محادثة متعددة الأدوار"]),
      ...(isLessonComplete(progress, id) ? [el("span", { className: "lesson-fact" }, [icon("check", 15), "أكملت هذا الدرس من قبل"])] : []),
    ]),
  ]);
  fragment.append(heading);

  const body = el("div", { className: "lesson-body" });
  body.append(el("section", { className: "teaching-note" }, [
    el("div", { className: "eyebrow", text: "عبارة مفيدة" }),
    el("h2", { text: "الفكرة اللغوية" }),
    el("p", { text: lesson.rule }),
    el("div", { className: "examples" }, [
      el("div", { className: "example example-bad" }, [el("small", { text: "صياغة شائعة تحتاج إلى تصحيح" }), english(lesson.bad)]),
      el("div", { className: "example example-good" }, [el("small", { text: "صياغة طبيعية" }), english(lesson.good)]),
    ]),
  ]));
  body.append(el("aside", { className: "situation-note" }, [
    el("div", { className: "eyebrow", text: "الموقف" }),
    el("h2", { text: lesson.situation }),
    el("p", { text: "ستتدرّب على هذا الموقف نفسه في المحادثة، ثم تطبق التعبير في بقية الأنشطة." }),
    button(progress.sessions[id] ? "استكمل الدرس" : isLessonComplete(progress, id) ? "أعد الدرس" : "ابدأ الدرس", "open-lesson", "button-light", { "data-id": id }, "arrow"),
  ]));
  fragment.append(body);
  const activityMap = el("div", { className: "activity-map" }, [
    el("span", { className: "activity-map-label", text: "المهارات التي ستتمرّن عليها" }),
  ]);
  const tags = el("div", { className: "activity-map-list" });
  [["message", "محادثة"], ["book", "ترتيب الجمل"], ["book", "كتابة"], ["volume", "استماع"], ["mic", "تحدث"]]
    .forEach(([name, label]) => tags.append(el("span", { className: "activity-tag" }, [icon(name, 14), label])));
  activityMap.append(tags);
  fragment.append(activityMap);
  return fragment;
}

function sessionFor(id) {
  if (!progress.sessions[id]) progress.sessions[id] = makeSession(id);
  return progress.sessions[id];
}

function activityKey(session) {
  const step = session.stage === "dialogue" ? `dialogue-${session.dialogueIndex}`
    : session.stage === "order" ? `order-${session.orderIndex}`
      : `${session.stage}-0`;
  return step;
}

function getActivityIndex(key) {
  const found = FLOW.indexOf(key);
  return found < 0 ? 0 : found;
}

function saveSession(session) {
  progress.sessions[session.lessonId] = session;
  progress.lastLesson = session.lessonId;
  saveProgress();
}

function addMistake(session, type, index, attempted, correction, reason) {
  const key = `${session.lessonId}:${type}:${index}:${normalizedAnswer(attempted)}`;
  if (progress.mistakes.some((item) => item.key === key)) return;
  progress.mistakes.unshift({
    id: `${Date.now().toString(36)}-${progress.mistakes.length.toString(36)}`,
    key, lessonId: session.lessonId, type, index,
    attempted: String(attempted ?? "").slice(0, 500),
    correction: String(correction ?? "").slice(0, 500),
    reason: String(reason ?? "").slice(0, 500),
    date: new Date().toISOString().slice(0, 10),
  });
  progress.mistakes.length = Math.min(progress.mistakes.length, 100);
}

function countFirstAttempt(session, step, correct, scored = true) {
  if (!scored) return;
  if (!Array.isArray(session.checkedSteps)) session.checkedSteps = [];
  if (session.checkedSteps.includes(step)) return;
  session.checkedSteps.push(step);
  session.score.assessed += 1;
  if (correct) session.score.correct += 1;
}

function completeActivity(session) {
  const lesson = getLesson(session.lessonId);
  const current = activityKey(session);
  if (!session.completedSteps.includes(current)) session.completedSteps.push(current);
  if (!allActivitiesComplete(session, lesson)) {
    const next = FLOW.find((key) => !session.completedSteps.includes(key));
    const [stage, indexText] = next.split("-");
    session.stage = stage;
    if (stage === "dialogue") session.dialogueIndex = Number(indexText);
    if (stage === "order") session.orderIndex = Number(indexText);
    session.choice = null;
    session.wordOrder = [];
    session.feedback = null;
    session.dialogueWrong = false;
    session.writingFeedback = null;
    session.writingReviewed = false;
    session.listeningAnswer = null;
    session.listeningFeedback = null;
    session.listeningRevealed = false;
    session.audioError = "";
    session.speakingStatus = "idle";
    session.speakingTranscript = "";
  } else {
    session.stage = "result";
  }
  saveSession(session);
  announce(session.stage === "result" ? "أنهيت الأنشطة الخمسة. راجع النتيجة ثم احفظ إكمال الدرس." : `انتقلت إلى ${ACTIVITY_NAMES[session.stage]}.`);
  render(false, session.stage === "result" ? "finish-lesson" : null);
}

function repairFeedback(session, correct, reason, model, attempt) {
  return el("div", { className: `feedback${correct ? "" : " incorrect"}`, role: "status" }, [
    el("h2", { text: correct ? "رد مناسب للموقف" : "هذه فرصة لتوضيح ردك" }),
    el("p", { text: reason }),
    ...(model ? [english(model)] : []),
    ...(attempt ? [el("p", { className: "small-copy", text: "المقارنة هنا مع صيغ نموذجية محددة؛ لا يوجد تصحيح مفتوح أو بالذكاء الاصطناعي." })] : []),
  ]);
}

function conversationTurn(label, content, variant = "") {
  return el("div", { className: `conversation-turn ${variant}`.trim() }, [
    el("span", { className: "speaker-label", text: label }),
    english(content),
  ]);
}

function renderDialogue(session, lesson) {
  const exercise = lesson.dialogue[session.dialogueIndex];
  const fragment = el("div");
  fragment.append(el("h1", { text: "محادثة تتقدم بردودك" }));
  fragment.append(el("p", { className: "practice-hint", text: `الجولة ${session.dialogueIndex + 1} من ${lesson.dialogue.length} · ${exercise.prompt}` }));
  const transcript = el("div", { className: "conversation", role: "log", "aria-label": "تسلسل المحادثة" });
  session.dialogueHistory.forEach((turn) => {
    transcript.append(conversationTurn("الطرف الآخر", turn.prompt, "partner"));
    transcript.append(conversationTurn(turn.rehearsed ? "راجعْتَ هذا الرد" : "أنت", turn.user, "mine"));
    transcript.append(conversationTurn("الطرف الآخر", turn.partner, "partner-reply"));
  });
  transcript.append(conversationTurn("الطرف الآخر", exercise.other, "partner"));
  if (session.feedback) {
    const chosen = exercise.options[session.feedback.choice];
    transcript.append(conversationTurn("أنت", chosen, "mine"));
    if (session.feedback.kind === "incorrect") {
      transcript.append(conversationTurn("الطرف الآخر", "I’m not sure I understand. Could you clarify that?", "partner-reply"));
    } else {
      transcript.append(conversationTurn("الطرف الآخر", exercise.reply, "partner-reply"));
    }
  }
  fragment.append(transcript);
  if (!session.feedback) {
    fragment.append(el("div", { className: "conversation-now" }, [
      el("span", { text: "كيف سترد؟" }), english(exercise.other, "english"),
    ]));
    const choices = el("div", { className: "choice-list", role: "group", "aria-label": "اختر ردك في المحادثة" });
    exercise.options.forEach((option, index) => choices.append(el("button", {
      type: "button", className: "choice", "data-action": "choose-dialogue", "data-index": index,
      "data-focus-key": `choice-${index}`, "aria-pressed": "false",
    }, [el("span", { className: "choice-marker", text: String(index + 1) }), english(option, "choice-english")])));
    fragment.append(choices);
  } else {
    const isCorrect = session.feedback.kind === "correct";
    fragment.append(repairFeedback(session, isCorrect, exercise.note, isCorrect ? "" : exercise.options[exercise.correct], false));
    fragment.append(el("div", { className: "action-row" }, isCorrect ? [
      button("أكمل الحوار", "continue-dialogue", "", {}, "arrow"),
    ] : [
      button("جرّب ردًا أوضح", "retry-dialogue", "button-outline"),
      button("أكمل بعد مراجعة التصحيح", "continue-dialogue", "", {}, "arrow"),
    ]));
  }
  return fragment;
}

function shuffleIndexes(length, seedText) {
  const indexes = Array.from({ length }, (_, index) => index);
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  if (indexes.every((value, index) => value === index) && indexes.length > 1) [indexes[0], indexes[1]] = [indexes[1], indexes[0]];
  return indexes;
}

function orderSentence(session, lesson) {
  const exercise = lesson.order[session.orderIndex];
  const ids = shuffleIndexes(exercise.words.length, `${lesson.id}:${session.orderIndex}`);
  return el("div", {}, [
    el("h1", { text: "ابنِ الجملة من كلماتها" }),
    el("p", { className: "practice-hint", text: exercise.prompt }),
    el("div", { className: "answer-line", "aria-label": "الكلمات المختارة بالترتيب" }, session.wordOrder.length
      ? session.wordOrder.map((index, position) => el("button", {
        type: "button", className: "word-chip selected", "data-action": "remove-word", "data-index": position,
        "data-focus-key": `remove-word-${position}`, "aria-label": `أزل ${exercise.words[index]}`,
      }, exercise.words[index]))
      : [el("span", { className: "word-bank-empty", text: "اضغط الكلمات لبناء الجملة هنا" })]),
    el("div", { className: "word-bank", role: "group", "aria-label": "كلمات الجملة غير المرتبة" }, ids.map((index) => {
      const used = session.wordOrder.includes(index);
      return el("button", {
        type: "button", className: "word-chip", disabled: used, "data-action": "add-word", "data-index": index,
        "data-focus-key": `word-${index}`, "aria-pressed": String(used),
      }, exercise.words[index]);
    })),
    ...(session.feedback ? [repairFeedback(session, session.feedback.kind === "correct", session.feedback.message, session.feedback.kind === "incorrect" ? exercise.answer : "", false)] : []),
    el("div", { className: "action-row" }, session.feedback ? [
      ...(session.feedback.kind === "incorrect" ? [button("أعد ترتيب الكلمات", "retry-order", "button-outline")] : []),
      button("المتابعة", "continue-order", "", {}, "arrow"),
    ] : [
      button("تحقق من الجملة", "check-order", "", { disabled: session.wordOrder.length === 0 }, "check"),
      button("مسح الاختيار", "clear-order", "button-outline"),
    ]),
  ]);
}

function writingExercise(session, lesson) {
  const exercise = lesson.writing;
  const field = el("textarea", {
    id: "writing-answer", className: "writing-input", maxlength: "500", rows: "3",
    placeholder: "Write your sentence here…", "aria-describedby": "writing-helper",
    "aria-label": "اكتب إجابتك باللغة الإنجليزية",
  });
  field.value = session.writingDraft;
  field.disabled = Boolean(session.writingFeedback);
  const fragment = el("div", {}, [
    el("h1", { text: "اكتب جملة كاملة" }),
    el("p", { className: "practice-hint", text: exercise.prompt }),
    field,
    el("p", { id: "writing-helper", className: "writing-helper", text: "يفحص الموقع صيغًا معروفة ومحددة محليًا؛ لا يقدّم تصحيحًا مفتوحًا." }),
  ]);
  if (session.writingFeedback) {
    const valid = session.writingFeedback.kind === "correct";
    fragment.append(repairFeedback(session, valid, valid ? exercise.note : "لم تطابق الجملة صيغة معروفة لهذا التدريب. راجع النموذج والقاعدة ثم اختر إعادة المحاولة أو الإكمال دون تقييم.", valid ? "" : exercise.model, true));
    if (!valid && normalizedAnswer(session.writingDraft) === normalizedAnswer(lesson.bad)) {
      fragment.append(el("div", { className: "notice" }, [
        "النمط الذي يشرحه الدرس: ", english(lesson.bad), " ← ", english(lesson.good),
        el("br"), lesson.rule,
      ]));
    }
    fragment.append(el("div", { className: "action-row" }, [
      ...(valid ? [] : [button("أعد الكتابة", "retry-writing", "button-outline")]),
      button(valid ? "المتابعة" : "أكمل دون تقييم الصياغة", valid ? "continue-writing" : "continue-writing-manual", "", {}, "arrow"),
    ]));
  } else {
    fragment.append(button("راجع إجابتي", "check-writing", "", {}, "check"));
  }
  return fragment;
}

function listeningExercise(session, lesson) {
  const exercise = lesson.listening;
  const synthAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const manual = session.listeningManual || !synthAvailable || Boolean(session.audioError);
  const fragment = el("div", {}, [
    el("h1", { text: "استمع ثم اختر المعنى" }),
    el("p", { className: "practice-hint", text: "استمع إلى الجملة أو الحوار بالإنجليزية ثم أجب عن سؤال الفهم بالعربية." }),
    el("div", { className: "audio-controls" }, [
      icon("volume", 24),
      el("p", { text: synthAvailable ? "شغّل المقطع مرة أخرى متى احتجت." : "الصوت غير متاح في هذا المتصفح. اعرض النص وأكمل النشاط يدويًا." }),
      ...(synthAvailable ? [button("شغّل الصوت", "play-listening", "button-outline", {}, "volume")] : []),
      button(session.listeningRevealed ? "إخفاء النص" : "اعرض النص بدل الصوت", "toggle-listening-text", "button-outline button-small"),
    ]),
    ...(session.audioError ? [el("div", { className: "notice error", role: "status", text: session.audioError })] : []),
    ...(session.listeningRevealed ? [el("div", { className: "audio-script", lang: "en", dir: "ltr", text: exercise.spoken }),
      el("p", { className: "writing-helper", text: "قراءة النص بديل للاختيار، لذلك لا تُحتسب إجابة الاستماع ضمن النتيجة المقيمة." })] : []),
    el("div", { className: "conversation-now" }, [el("span", { text: "سؤال الفهم" }), el("p", { text: exercise.prompt })]),
  ]);
  const choices = el("div", { className: "choice-list", role: "group", "aria-label": "اختر معنى الحوار" });
  exercise.options.forEach((option, index) => choices.append(el("button", {
    type: "button", className: "choice", "data-action": "choose-listening", "data-index": index,
    "data-focus-key": `listen-${index}`, "aria-pressed": String(session.listeningAnswer === index),
  }, [el("span", { className: "choice-marker", text: String(index + 1) }), el("span", { text: option })])));
  fragment.append(choices);
  if (session.listeningFeedback) {
    const correct = session.listeningFeedback.choice === exercise.correct;
    const unassessed = session.listeningFeedback.kind === "manual";
    const feedbackText = unassessed
      ? `الإجابة ${correct ? "تطابق" : "لا تطابق"} المعنى المتوقع، لكنها لم تُقيّم كتدريب استماع لأن النص كان ظاهرًا.`
      : correct ? exercise.note : "راجع ما سمعت ثم حاول مرة أخرى.";
    fragment.append(repairFeedback(session, correct || unassessed, feedbackText, correct ? "" : exercise.options[exercise.correct], false));
    fragment.append(el("div", { className: "action-row" }, [
      ...(!correct && !unassessed ? [button("أعد الاستماع والإجابة", "retry-listening", "button-outline")] : []),
      button(unassessed ? "أكمل دون تقييم" : correct ? "المتابعة" : "أكمل بعد مراجعة الإجابة", "continue-listening", "", {}, "arrow"),
    ]));
  } else {
    fragment.append(button("تحقق من الفهم", "check-listening", "", { disabled: session.listeningAnswer === null }, "check"));
  }
  if (manual) fragment.append(el("p", { className: "writing-helper", text: "الإكمال النصي يتيح مواصلة الدرس، لكنه لا يقيس فهم المسموع." }));
  return fragment;
}

function speechButton(label, action, style = "button-outline") {
  return button(label, action, style, {}, "mic");
}

function speakingExercise(session, lesson) {
  const exercise = lesson.speaking;
  const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const fragment = el("div", {}, [
    el("h1", { text: "قل العبارة بصوتك" }),
    el("p", { className: "practice-hint", text: "تدرّب على قول الجملة في الموقف نفسه. إن لم يدعم المتصفح الميكروفون، يمكنك الإكمال دون تقييم." }),
    el("div", { className: "conversation-now" }, [
      el("span", { text: "العبارة المستهدفة" }), english(exercise.phrase),
    ]),
    el("div", { className: "action-row" }, [
      ...(supported ? [speechButton(speechRecognition ? "جارٍ الاستماع…" : session.speakingStatus === "recognized" ? "أعد التسجيل" : "ابدأ التحدث", "start-speech", "")] : []),
      button("استمع إلى المثال", "play-speaking", "button-outline", {}, "volume"),
    ]),
    ...(!supported ? [el("div", { className: "notice", role: "status", text: "ميزة تحويل الكلام إلى نص غير مدعومة هنا. يمكنك قول الجملة لنفسك وإكمال النشاط دون تقييم." })] : []),
    ...(speechRecognition ? [button("أوقف التسجيل وأكمل دون تقييم", "skip-speech", "button-outline")] : []),
    ...(session.speakingStatus === "denied" ? [el("div", { className: "notice error", role: "alert", text: "لم يُسمح بالميكروفون. افتح إعدادات الموقع إن رغبت، أو أكمل النشاط دون تقييم." })] : []),
    ...(session.speakingStatus === "error" ? [el("div", { className: "notice error", role: "status", text: "تعذر تحويل كلامك إلى نص الآن. يمكنك المحاولة مجددًا أو الإكمال دون تقييم." })] : []),
  ]);
  if (session.speakingStatus === "recognized") {
    const comparison = compareRecognizedWords(exercise.phrase, session.speakingTranscript);
    const wordList = el("div", { className: "word-comparison", "aria-label": "مقارنة الكلمات التي تعرف عليها المتصفح" });
    comparison.matched.forEach((word) => wordList.append(el("span", { text: word })));
    comparison.missing.forEach((word) => wordList.append(el("span", { className: "missing", text: `${word} — لم تظهر` })));
    comparison.extra.forEach((word) => wordList.append(el("span", { className: "extra", text: `${word} — كلمة إضافية` })));
    fragment.append(el("div", { className: "speech-result" }, [
      el("h2", { text: "ما تعرّف عليه المتصفح" }), english(session.speakingTranscript),
      el("p", { className: "writing-helper", text: "هذه مقارنة نصية للكلمات فقط؛ لا تقيس جودة النطق أو مخارج الحروف." }),
      wordList,
    ]));
  }
  fragment.append(el("div", { className: "privacy-note", text: "قد يستخدم المتصفح خدمة خارجية لتحويل الصوت إلى نص وفق إعداداته. لا يحفظ سياق تسجيلًا صوتيًا؛ وقد يُحتفظ بالنص المتعرّف عليه محليًا ضمن تقدمك. لا يقدم النشاط درجة دقة احترافية للنطق." }));
  if (session.speakingStatus !== "manual") {
    fragment.append(el("div", { className: "action-row" }, [
      ...(!supported ? [button("أكمل دون تقييم الكلام", "skip-speech", "button-outline")] : []),
      ...(session.speakingStatus === "recognized" ? [button("أنهِ النشاط النصي", "finish-speech", "", {}, "arrow")] : []),
      ...(session.speakingStatus === "denied" || session.speakingStatus === "error" ? [button("أكمل دون تقييم", "skip-speech", "button-outline")] : []),
    ]));
  } else {
    fragment.append(el("div", { className: "notice", text: "اكتمل النشاط يدويًا. لم يُقيّم الكلام أو النطق." }));
    fragment.append(button("المتابعة", "continue-speech", "", {}, "arrow"));
  }
  return fragment;
}

function renderPractice(id) {
  const lesson = getLesson(id);
  const session = sessionFor(id);
  if (session.stage === "result") return renderResult(lesson, session);
  if (session.stage === "intro") {
    const fragment = el("div", { className: "practice-frame" });
    appendBanner(fragment);
    fragment.append(el("div", { className: "lesson-topline" }, [link("احفظ وارجع إلى الدرس", `#lesson/${id}`, "back-link")]));
    const index = session.completedSteps.length;
    fragment.append(el("div", { className: "practice-progress", role: "img", "aria-label": `أنهيت ${index} من ${FLOW.length} أنشطة` }, (() => { const span = el("span"); span.style.width = `${Math.round((index / FLOW.length) * 100)}%`; return span; })()));
    fragment.append(el("section", { className: "practice-card" }, [
      el("div", { className: "eyebrow", text: "الموقف" }),
      el("h1", { tabindex: "-1", text: lesson.situation }),
      el("p", { className: "practice-hint", text: lesson.objective }),
      el("div", { className: "teaching-note" }, [el("h2", { text: "قاعدة سريعة" }), el("p", { text: lesson.rule }),
        el("div", { className: "examples" }, [
          el("div", { className: "example example-bad" }, [el("small", { text: "صياغة شائعة تحتاج إلى تصحيح" }), english(lesson.bad)]),
          el("div", { className: "example example-good" }, [el("small", { text: "صياغة طبيعية" }), english(lesson.good)]),
        ])]),
      el("div", { className: "activity-map" }, [
        el("span", { className: "activity-map-label", text: "محادثة قصيرة ثم خمس مهارات عملية" }),
        el("div", { className: "activity-map-list" }, [["message", "حوار"], ["book", "جمل"], ["book", "كتابة"], ["volume", "استماع"], ["mic", "تحدث"]].map(([name, text]) => el("span", { className: "activity-tag" }, [icon(name, 14), text]))),
      ]),
      button("ابدأ المحادثة", "begin-practice", "", {}, "arrow"),
    ]));
    return fragment;
  }

  const stepIndex = getActivityIndex(activityKey(session));
  const fraction = Math.round((session.completedSteps.length / FLOW.length) * 100);
  const frame = el("div", { className: "practice-frame" });
  appendBanner(frame);
  frame.append(el("div", { className: "practice-top" }, [
    link("احفظ وارجع إلى الدرس", `#lesson/${id}`, "back-link"),
    el("span", { className: "lesson-progress-label", text: `النشاط ${stepIndex + 1} من ${FLOW.length}` }),
  ]));
  const bar = el("span"); bar.style.width = `${fraction}%`;
  frame.append(el("div", { className: "practice-progress", role: "img", "aria-label": `تقدم الدرس ${fraction} بالمئة` }, bar));
  const currentType = session.stage;
  const card = el("section", { className: "practice-card" }, [
    el("div", { className: "practice-step-label" }, [icon(currentType === "dialogue" ? "message" : currentType === "listening" ? "volume" : currentType === "speaking" ? "mic" : "book", 15),
      el("span", { text: `${ACTIVITY_NAMES[currentType]} · ${lesson.title}` })]),
  ]);
  if (session.stage === "dialogue") card.append(renderDialogue(session, lesson));
  else if (session.stage === "order") card.append(orderSentence(session, lesson));
  else if (session.stage === "writing") card.append(writingExercise(session, lesson));
  else if (session.stage === "listening") card.append(listeningExercise(session, lesson));
  else if (session.stage === "speaking") card.append(speakingExercise(session, lesson));
  frame.append(card);
  return frame;
}

function renderResult(lesson, session) {
  const result = el("section", { className: "result-page" });
  result.append(el("div", { className: "result-mark" }, icon("check", 27)));
  result.append(el("div", { className: "eyebrow", text: "النتيجة" }));
  result.append(el("h1", { tabindex: "-1", text: "أنهيت التمارين الخمسة" }));
  result.append(el("p", { className: "result-copy", text: "راجع نتيجة المحاولات التي أمكن التحقق منها، ثم احفظ إكمال الدرس. الأنشطة التي أكملتها يدويًا مستثناة من التقييم." }));
  result.append(el("div", { className: "result-stats" }, [
    el("div", { className: "result-stat" }, [el("strong", { text: `${session.score.correct} / ${session.score.assessed}` }), el("span", { text: "مطابق في أول محاولة" })]),
    el("div", { className: "result-stat" }, [el("strong", { text: String(session.score.manual) }), el("span", { text: "نشاط يدوي غير مقيم" })]),
    el("div", { className: "result-stat" }, [el("strong", { text: String(session.completedSteps.length) }), el("span", { text: "أنشطة أُنجزت" })]),
  ]));
  result.append(el("div", { className: "result-actions" }, [
    button(isLessonComplete(progress, lesson.id) ? "احفظ نتيجة الإعادة" : "أنهِ الدرس واحفظ تقدمي", "finish-lesson", "", {}, "check"),
    button("أعد هذا الدرس", "retake-lesson", "button-outline"),
    link("مراجعة الأخطاء", "#review", "button button-outline"),
  ]));
  return result;
}

function finishLesson(session) {
  const lesson = getLesson(session.lessonId);
  if (!allActivitiesComplete(session, lesson)) {
    announce("أكمل الأنشطة الثمانية قبل إنهاء الدرس.");
    return;
  }
  if (!progress.completed.includes(lesson.id)) progress.completed.push(lesson.id);
  progress.results.unshift({
    lessonId: lesson.id, correct: session.score.correct, assessed: session.score.assessed,
    manual: session.score.manual, date: new Date().toISOString().slice(0, 10),
  });
  progress.results.length = Math.min(progress.results.length, 100);
  delete progress.sessions[lesson.id];
  progress.lastLesson = lesson.id;
  saveProgress();
  announce("حُفظ إكمال الدرس وتقدمك على هذا الجهاز.");
  location.hash = "#home";
}

function renderReview() {
  const fragment = el("div");
  appendBanner(fragment);
  fragment.append(pageHeading("المراجعة", "أخطاء تستحقّ الرجوع إليها", "سترى إجابتك، والصيغة المرجعية، وسبب التصحيح. افتح الدرس لإعادة المحاولة كاملة."));
  if (!progress.mistakes.length) {
    fragment.append(el("section", { className: "empty-state" }, [
      el("h2", { text: "لا توجد أخطاء محفوظة للمراجعة" }),
      el("p", { text: "عندما تحتاج إجابة إلى تصحيح، ستجدها هنا مع التفسير." }),
      link("ابدأ درسًا", "#tracks", "button"),
    ]));
    return fragment;
  }
  const list = el("div", { className: "review-list" });
  progress.mistakes.forEach((mistake, index) => {
    const lesson = getLesson(mistake.lessonId);
    const article = el("article", { className: "review-entry" }, [
      el("span", { className: "review-number", dir: "ltr", text: String(index + 1).padStart(2, "0") }),
      el("div", {}, [
        el("h2", { text: lesson.title }),
        el("div", { className: "review-kind", text: `${ACTIVITY_NAMES[mistake.type]} · ${lesson.situation}` }),
        el("div", { className: "review-answer" }, [
          ...(mistake.attempted ? [el("span", { text: "إجابتك" }), english(mistake.attempted)] : []),
          el("span", { text: "صيغة للمراجعة" }), english(mistake.correction),
        ]),
        el("p", { className: "review-reason", text: mistake.reason }),
      ]),
      el("div", {}, [
        button("افتح الدرس", "revisit-lesson", "button-outline button-small", { "data-id": lesson.id }),
        button("أزل من القائمة", "dismiss-error", "text-action button-small", { "data-error-id": mistake.id }),
      ]),
    ]);
    list.append(article);
  });
  fragment.append(list);
  return fragment;
}

function renderProgress() {
  const fragment = el("div");
  appendBanner(fragment);
  const done = completedCount();
  fragment.append(pageHeading("تقدمك", "مسارك حتى الآن", "يُحفظ التقدم على هذا الجهاز فقط. لا يوجد حساب أو إرسال لبياناتك إلى خادم."));
  fragment.append(el("section", { className: "progress-summary" }, [
    progressRing(done, lessons.length),
    el("div", {}, [el("h2", { text: `${done} من ${lessons.length} درسًا مكتملًا` }),
      el("p", { text: `${progress.mistakes.length} نقطة للمراجعة · ${progress.results.length} نتيجة محفوظة` })]),
  ]));
  tracks.forEach((track) => {
    const count = completedCount(track.id);
    fragment.append(el("section", { className: "progress-path" }, [
      el("h2", { text: track.title }),
      el("div", { className: "progress-row" }, [
        el("span", { className: "progress-row-title", lang: "en", dir: "ltr", text: track.en }),
        meter(count, 3), el("span", { className: "small-copy", text: `${count} / 3` }),
      ]),
    ]));
  });
  if (progress.results.length) {
    fragment.append(el("section", { className: "recent-results" }, [el("h2", { text: "نتائجك الأخيرة" })]));
    progress.results.slice(0, 8).forEach((result) => {
      const lesson = getLesson(result.lessonId);
      fragment.lastElementChild.append(el("div", { className: "recent-result" }, [
        el("span", { text: lesson.title }),
        el("span", { text: `${result.correct} من ${result.assessed} في أول محاولة · ${result.date}` }),
      ]));
    });
  }
  return fragment;
}

function render(route = currentRoute(), focusKey = null) {
  if (!route || typeof route !== "object") route = currentRoute();
  updateNavigation(route);
  let page;
  if (route.name === "tracks") page = renderTracks();
  else if (route.name === "track") page = renderTrack(route.id);
  else if (route.name === "lesson") page = renderLesson(route.id);
  else if (route.name === "practice") page = renderPractice(route.id);
  else if (route.name === "review") page = renderReview();
  else if (route.name === "progress") page = renderProgress();
  else page = renderHome();
  app.replaceChildren(page);
  document.title = route.name === "lesson" ? `${getLesson(route.id).title} | سياق` : "سياق — الإنجليزية في العمل";
  if (focusKey) {
    const target = [...app.querySelectorAll("[data-focus-key]")].find((candidate) => candidate.dataset.focusKey === focusKey);
    (target ?? app.querySelector(".feedback + .action-row button, .action-row button, h1"))?.focus({ preventScroll: true });
  }
}

function recordActivityCheck(session, step, correct) {
  countFirstAttempt(session, step, correct, true);
}

function checkOrder(session) {
  const lesson = getLesson(session.lessonId);
  const exercise = lesson.order[session.orderIndex];
  if (!session.wordOrder.length) return announce("اختر الكلمات أولًا.");
  const answer = session.wordOrder.map((index) => exercise.words[index]).join(" ");
  const accepted = [exercise.answer, ...(exercise.variants ?? [])].some((value) => normalizedAnswer(value) === normalizedAnswer(answer));
  const step = `order-${session.orderIndex}`;
  if (!session.checkedSteps?.includes(step)) recordActivityCheck(session, step, accepted);
  if (accepted) {
    session.feedback = { kind: "correct", message: exercise.note };
  } else {
    session.feedback = { kind: "incorrect", message: `ترتيب الكلمات يحتاج إلى مراجعة. ${exercise.note}` };
    addMistake(session, "order", session.orderIndex, answer, exercise.answer, exercise.note);
  }
  saveSession(session);
  render(false, accepted ? "continue-order" : "retry-order");
}

function chooseDialogue(session, choice) {
  const lesson = getLesson(session.lessonId);
  const exercise = lesson.dialogue[session.dialogueIndex];
  const step = `dialogue-${session.dialogueIndex}`;
  const correct = choice === exercise.correct;
  if (!session.checkedSteps?.includes(step)) recordActivityCheck(session, step, correct);
  session.choice = choice;
  session.feedback = { kind: correct ? "correct" : "incorrect", choice, message: exercise.note };
  session.dialogueWrong = !correct;
  if (!correct) addMistake(session, "dialogue", session.dialogueIndex, exercise.options[choice], exercise.options[exercise.correct], exercise.note);
  saveSession(session);
  render(false, correct ? "continue-dialogue" : "retry-dialogue");
}

function checkWriting(session) {
  const lesson = getLesson(session.lessonId);
  const exercise = lesson.writing;
  const value = session.writingDraft.trim();
  if (!value) return announce("اكتب جملة قبل مراجعتها.");
  const correct = matchesKnownAnswer(value, exercise);
  const step = "writing-0";
  if (!session.checkedSteps?.includes(step)) recordActivityCheck(session, step, correct);
  session.writingFeedback = { kind: correct ? "correct" : "incorrect", attempted: value };
  if (!correct) addMistake(session, "writing", 0, value, exercise.model, exercise.note);
  saveSession(session);
  render(false, correct ? "continue-writing" : "retry-writing");
}

function chooseListening(session, choice) {
  session.listeningAnswer = choice;
  saveSession(session);
  render(false, `listen-${choice}`);
}

function checkListening(session) {
  const lesson = getLesson(session.lessonId);
  const exercise = lesson.listening;
  if (session.listeningAnswer === null) return announce("اختر إجابة أولًا.");
  const manual = session.listeningManual || !("speechSynthesis" in window) || Boolean(session.audioError);
  const correct = session.listeningAnswer === exercise.correct;
  if (!manual && !session.checkedSteps?.includes("listening-0")) recordActivityCheck(session, "listening-0", correct);
  session.listeningFeedback = { kind: manual ? "manual" : correct ? "correct" : "incorrect", choice: session.listeningAnswer };
  if (!correct) addMistake(session, "listening", 0, exercise.options[session.listeningAnswer], exercise.options[exercise.correct], exercise.note);
  saveSession(session);
  render(false, correct ? "continue-listening" : "retry-listening");
}

function playSpeech(text, session, type) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    if (session && type === "listening") {
      session.audioError = "تشغيل الصوت غير متاح هنا. اعرض النص، ثم أكمل النشاط يدويًا.";
      session.listeningRevealed = true;
      saveSession(session); render(false, "toggle-listening-text");
    } else announce("تشغيل الصوت غير متاح في هذا المتصفح.");
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = type === "listening" ? 0.9 : 0.85;
    utterance.onerror = () => {
      if (session && type === "listening") {
        session.audioError = "لم يعمل الصوت على هذا الجهاز. اعرض النص لإكمال النشاط يدويًا.";
        saveSession(session); render(false, "toggle-listening-text");
      } else announce("تعذر تشغيل صوت المثال. يمكنك متابعة النشاط يدويًا.");
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    if (session && type === "listening") {
      session.audioError = "تعذر تشغيل الصوت. اعرض النص ثم أجب يدويًا.";
      session.listeningRevealed = true;
      saveSession(session); render(false, "toggle-listening-text");
    } else announce("تعذر تشغيل صوت المثال.");
  }
}

function beginSpeech(session) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    session.speakingStatus = "unsupported"; saveSession(session); render(false, "skip-speech"); return;
  }
  if (speechRecognition) return;
  if (session.speakingStatus === "recognized") {
    session.speakingStatus = "idle";
    session.speakingTranscript = "";
  }
  try {
    const recognizer = new Recognition();
    const token = ++speechToken;
    speechRecognition = recognizer;
    recognizer.lang = "en-US";
    recognizer.interimResults = false;
    recognizer.continuous = false;
    recognizer.maxAlternatives = 1;
    recognizer.onresult = (event) => {
      if (token !== speechToken) return;
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      session.speakingTranscript = String(transcript).slice(0, 500);
      session.speakingStatus = "recognized";
      saveSession(session); render(false, "finish-speech");
      announce("ظهر النص الذي تعرّف عليه المتصفح. راجع الكلمات المختلفة.");
    };
    recognizer.onerror = (event) => {
      if (token !== speechToken) return;
      speechRecognition = null;
      session.speakingStatus = speechErrorState(event.error);
      saveSession(session); render(false, "skip-speech");
      announce(session.speakingStatus === "denied" ? "رُفض إذن الميكروفون؛ يمكنك إكمال النشاط دون تقييم." : "تعذر تحويل الكلام إلى نص؛ حاول مرة أخرى أو أكمل يدويًا.");
    };
    recognizer.onend = () => {
      if (token !== speechToken) return;
      speechRecognition = null;
      if (session.speakingStatus !== "recognized") {
        session.speakingStatus = "error";
        saveSession(session); render(false, "skip-speech");
        announce("انتهى الاستماع دون نص. يمكنك إعادة المحاولة أو الإكمال دون تقييم.");
      }
    };
    recognizer.start();
    announce("يتحول كلامك إلى نص الآن.");
  } catch {
    speechRecognition = null;
    session.speakingStatus = "error";
    saveSession(session); render(false, "skip-speech");
  }
}

function stopSpeech() {
  if (!speechRecognition) return;
  speechToken += 1;
  try { speechRecognition.stop(); } catch { /* The browser may already have ended capture. */ }
  speechRecognition = null;
}

function act(action, control) {
  const id = control.dataset.id;
  const index = Number(control.dataset.index);
  const route = currentRoute();
  const session = route.name === "practice" ? sessionFor(route.id) : null;
  if (action === "open-recommended") startLesson(nextLesson().id);
  else if (action === "open-lesson") startLesson(id);
  else if (action === "revisit-lesson") location.hash = `#lesson/${id}`;
  else if (action === "begin-practice" && session) { session.stage = "dialogue"; session.dialogueIndex = 0; saveSession(session); announce("بدأت المحادثة. اختر ردًا مناسبًا، ثم تابع الحوار."); render(false, "choice-0"); }
  else if (action === "choose-dialogue" && session) chooseDialogue(session, index);
  else if (action === "retry-dialogue" && session) { session.feedback = null; session.choice = null; saveSession(session); render(false, "choice-0"); }
  else if (action === "continue-dialogue" && session) {
    const exercise = getLesson(session.lessonId).dialogue[session.dialogueIndex];
    const user = session.feedback.kind === "correct" ? exercise.options[session.feedback.choice] : exercise.options[exercise.correct];
    session.dialogueHistory.push({
      prompt: exercise.other, user, partner: exercise.reply,
      rehearsed: session.feedback.kind !== "correct",
    });
    completeActivity(session);
  }
  else if (action === "add-word" && session) {
    if (!session.wordOrder.includes(index)) session.wordOrder.push(index);
    session.feedback = null; saveSession(session); render(false, `word-${index}`);
  }
  else if (action === "remove-word" && session) {
    const removed = session.wordOrder.splice(index, 1)[0];
    session.feedback = null; saveSession(session); render(false, `word-${removed}`);
  }
  else if (action === "clear-order" && session) { session.wordOrder = []; saveSession(session); render(false, "clear-order"); }
  else if (action === "check-order" && session) checkOrder(session);
  else if (action === "retry-order" && session) { session.wordOrder = []; session.feedback = null; saveSession(session); render(false, "word-0"); }
  else if (action === "continue-order" && session) completeActivity(session);
  else if (action === "check-writing" && session) {
    session.writingDraft = app.querySelector("#writing-answer")?.value ?? session.writingDraft;
    checkWriting(session);
  }
  else if (action === "retry-writing" && session) { session.writingFeedback = null; saveSession(session); render(false, "check-writing"); }
  else if (action === "continue-writing" && session) completeActivity(session);
  else if (action === "continue-writing-manual" && session) { session.score.manual += 1; completeActivity(session); }
  else if (action === "play-listening" && session) playSpeech(getLesson(session.lessonId).listening.spoken, session, "listening");
  else if (action === "toggle-listening-text" && session) {
    session.listeningRevealed = !session.listeningRevealed;
    if (session.listeningRevealed) session.listeningManual = true;
    saveSession(session); render(false, "toggle-listening-text");
  }
  else if (action === "choose-listening" && session) chooseListening(session, index);
  else if (action === "check-listening" && session) checkListening(session);
  else if (action === "retry-listening" && session) {
    session.listeningFeedback = null; session.listeningAnswer = null; saveSession(session); render(false, session.listeningRevealed ? "listen-0" : "play-listening");
  }
  else if (action === "continue-listening" && session) {
    if (session.listeningFeedback.kind === "manual") session.score.manual += 1;
    completeActivity(session);
  }
  else if (action === "play-speaking" && session) playSpeech(getLesson(session.lessonId).speaking.phrase, session, "speaking");
  else if (action === "start-speech" && session) beginSpeech(session);
  else if (action === "finish-speech" && session) {
    const target = getLesson(session.lessonId).speaking.phrase;
    const comparison = compareRecognizedWords(target, session.speakingTranscript);
    if (comparison.missing.length || comparison.extra.length) addMistake(session, "speaking", 0, session.speakingTranscript,
      target, "قارن كلمات النص الذي تعرّف عليه المتصفح بالعبارة المستهدفة. لا تمثل المقارنة تقييمًا للنطق.");
    completeActivity(session);
  }
  else if (action === "skip-speech" && session) {
    stopSpeech(); session.speakingStatus = "manual"; session.score.manual += 1; saveSession(session); render(false, "continue-speech");
  }
  else if (action === "continue-speech" && session) completeActivity(session);
  else if (action === "finish-lesson" && session) finishLesson(session);
  else if (action === "retake-lesson" && session) {
    progress.sessions[session.lessonId] = makeSession(session.lessonId);
    saveProgress(); render(false, "begin-practice");
  }
  else if (action === "dismiss-error") {
    progress.mistakes = progress.mistakes.filter((mistake) => mistake.id !== control.dataset.errorId);
    saveProgress(); announce("أزلت النقطة من قائمة المراجعة."); render(false, "dismiss-error");
  }
}

app.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control || !app.contains(control) || control.disabled) return;
  event.preventDefault();
  const focusKey = control.dataset.focusKey ?? control.dataset.action;
  act(control.dataset.action, control);
  if (!control.dataset.action.startsWith("open-") && !["revisit-lesson"].includes(control.dataset.action)) render(false, focusKey);
});

app.addEventListener("input", (event) => {
  if (event.target.id !== "writing-answer") return;
  const route = currentRoute();
  if (route.name !== "practice") return;
  const session = sessionFor(route.id);
  session.writingDraft = event.target.value.slice(0, 500);
  saveSession(session);
});

window.addEventListener("hashchange", () => {
  stopSpeech();
  const route = currentRoute();
  render(route);
  const heading = app.querySelector("h1");
  heading?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORE_KEY || event.newValue === null) return;
  const latest = restoreProgress();
  progress = latest.progress;
  announce("تم تحديث تقدمك من نافذة أخرى.");
  render();
});

if (initial.migrated) saveProgress();
render();
