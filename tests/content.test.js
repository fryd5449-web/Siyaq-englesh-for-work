import test from "node:test";
import assert from "node:assert/strict";
import { getTrack, lessons, lessonSteps, tracks } from "../src/data.js";
import { FLOW } from "../src/logic.js";

test("the curriculum contains six named work paths and three complete lessons in each", () => {
  assert.equal(tracks.length, 6);
  assert.equal(lessons.length, 18);
  const names = tracks.map((track) => track.en);
  assert.deepEqual(names, [
    "Workplace Conversations", "Meetings & Discussions", "Customer Communication",
    "Emails & Professional Writing", "Problem Solving & Negotiation", "Presentations & Career Growth",
  ]);
  for (const track of tracks) assert.equal(lessons.filter((lesson) => lesson.track === track.id).length, 3);
});

test("every lesson contains original, situation-linked teaching and all five exercise types", () => {
  const ids = new Set();
  for (const lesson of lessons) {
    assert(!ids.has(lesson.id), `duplicate lesson ${lesson.id}`);
    ids.add(lesson.id);
    assert.ok(getTrack(lesson.track), `missing path for ${lesson.id}`);
    assert.ok(lesson.situation.length >= 12 && lesson.objective.length >= 20);
    assert.ok(lesson.rule.length >= 30 && lesson.bad.length > 5 && lesson.good.length > 5);
    assert.equal(lesson.order.length, 2);
    assert.equal(lesson.dialogue.length, 3);
    assert.equal(lessonSteps(lesson).length, 8);
    assert.deepEqual(lessonSteps(lesson).map((step) => `${step.type}-${step.index}`), FLOW);
    for (const exercise of lesson.order) {
      const sort = (value) => value.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").trim().split(/\s+/).sort().join(" ");
      assert.equal(sort(exercise.answer), sort(exercise.words.join(" ")));
      assert.ok(exercise.words.length >= 6);
      assert.ok(exercise.note.length > 10);
    }
    for (const turn of lesson.dialogue) {
      assert.ok(turn.other.length > 10 && turn.prompt.length > 8 && turn.reply.length > 8);
      assert.equal(turn.options.length, 3);
      assert.ok(Number.isInteger(turn.correct) && turn.correct >= 0 && turn.correct < 3);
      assert.notEqual(turn.options[turn.correct], turn.other);
    }
    assert.ok(lesson.writing.prompt.length > 10 && lesson.writing.model.length > 15);
    assert.ok(Array.isArray(lesson.writing.variants));
    assert.ok(lesson.listening.spoken.length > 30 && lesson.listening.prompt.length > 8);
    assert.equal(lesson.listening.options.length, 3);
    assert.ok(lesson.speaking.phrase.length > 25);
  }
});

test("lesson titles, work situations, dialogue scripts, writing models, and listening scripts are distinct", () => {
  const fields = [
    lessons.map((lesson) => lesson.title),
    lessons.map((lesson) => lesson.situation),
    lessons.map((lesson) => lesson.dialogue.map((turn) => turn.other).join("|")),
    lessons.map((lesson) => lesson.writing.model),
    lessons.map((lesson) => lesson.listening.spoken),
  ];
  for (const values of fields) assert.equal(new Set(values).size, lessons.length);
});
