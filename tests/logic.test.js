import test from "node:test";
import assert from "node:assert/strict";
import { lessons } from "../src/data.js";
import {
  allActivitiesComplete, compareRecognizedWords, emptyProgress, FLOW, LEGACY_STORE_KEY,
  makeSession, matchesKnownAnswer, normalizedAnswer, restoreProgress, speechErrorState, STORE_KEY,
} from "../src/logic.js";

test("local writing checks accept known alternatives and do not claim open-ended correction", () => {
  const answer = lessons.find((lesson) => lesson.writing.variants.length)?.writing;
  assert.ok(matchesKnownAnswer(answer.model.toUpperCase(), answer));
  assert.ok(answer.variants.some((variant) => matchesKnownAnswer(variant, answer)));
  assert.equal(matchesKnownAnswer("I could write another sentence with the same meaning.", answer), false);
  assert.equal(normalizedAnswer("We’ll follow-up at 2 p.m.!"), "we'll follow up at 2 p m");
});

test("speech feedback compares recognized words without assigning a pronunciation score", () => {
  assert.deepEqual(compareRecognizedWords("We can share the revised report today.", "We can send revised report now"), {
    matched: ["we", "can", "revised", "report"], missing: ["share", "the", "today"], extra: ["send", "now"],
  });
});

test("speech permission errors are distinguished from other recognition failures", () => {
  assert.equal(speechErrorState("not-allowed"), "denied");
  assert.equal(speechErrorState("service-not-allowed"), "denied");
  assert.equal(speechErrorState("network"), "error");
});

test("a lesson cannot finish until all eight authored exercise rounds are complete", () => {
  const lesson = lessons[0];
  const session = makeSession(lesson.id);
  assert.equal(allActivitiesComplete(session, lesson), false);
  session.completedSteps = [...FLOW.slice(0, -1)];
  assert.equal(allActivitiesComplete(session, lesson), false);
  session.completedSteps = [...FLOW];
  assert.equal(allActivitiesComplete(session, lesson), true);
});

test("version-one local progress migrates completed lessons and review items", () => {
  const storage = new Map([
    [STORE_KEY, null],
    [LEGACY_STORE_KEY, JSON.stringify({
      completed: { introductions: { score: 6, max: 8, doneAt: "2026-10-30" }, unknown: { score: 8, max: 8 } },
      mistakes: { "introductions:order:0": { date: "2026-10-29" }, "bad-id": { date: "2026-10-29" } },
    })],
  ]);
  const result = restoreProgress({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  assert.equal(result.migrated, true);
  assert.deepEqual(result.progress.completed, ["introductions"]);
  assert.equal(result.progress.results[0].correct, 6);
  assert.equal(result.progress.mistakes.length, 1);
  assert.equal(result.progress.mistakes[0].correction, lessons[0].order[0].answer);
});

test("corrupt local data is backed up and never prevents starting with a valid empty record", () => {
  const storage = new Map([[STORE_KEY, "{broken"]]);
  const result = restoreProgress({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  assert.equal(result.warning, "corrupt");
  assert.equal(result.progress.version, 2);
  assert.equal(storage.get(`${STORE_KEY}-recovery`), "{broken");
});

test("restored session fields are limited to known steps and safe text", () => {
  const lesson = lessons[0];
  const saved = { version: 2, completed: [], mistakes: [], results: [], lastLesson: lesson.id,
    sessions: { [lesson.id]: { stage: "order", wordOrder: [0, 99, -1], completedSteps: [FLOW[0], "unknown"], writingDraft: "<img src=x>" } } };
  const storage = { getItem: () => JSON.stringify(saved) };
  const restored = restoreProgress(storage).progress.sessions[lesson.id];
  assert.deepEqual(restored.completedSteps, [FLOW[0]]);
  assert.deepEqual(restored.wordOrder, [0]);
  assert.equal(restored.writingDraft, "<img src=x>");
});
