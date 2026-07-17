import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFixture,
  findEmployee,
  findTask,
  scenarioOptions,
} from "../src/data/fixtures.ts";

test("every declared scenario builds a stable fixture", () => {
  for (const option of scenarioOptions) {
    const fixture = buildFixture(option.value);
    assert.equal(fixture.scenario, option.value);
    assert.ok(fixture.label.length > 0);
    assert.ok(Array.isArray(fixture.employees));
    assert.ok(Array.isArray(fixture.tasks));
    assert.ok(Array.isArray(fixture.connections));
  }
});

test("normal fixture covers running, waiting, and completed task states", () => {
  const fixture = buildFixture("normal");
  const statuses = new Set(fixture.tasks.map((task) => task.status));
  assert.equal(statuses.has("running"), true);
  assert.equal(statuses.has("waiting_user"), true);
  assert.equal(statuses.has("done"), true);
});

test("disconnected fixture preserves a failed task and recovery evidence", () => {
  const fixture = buildFixture("disconnected");
  const failed = fixture.tasks.find((task) => task.status === "failed");
  assert.ok(failed);
  assert.match(failed.errorMessage || "", /보존/);
  assert.equal(
    fixture.connections.some((connection) => connection.status === "attention"),
    true,
  );
});

test("empty fixture contains no employee or task history", () => {
  const fixture = buildFixture("empty");
  assert.equal(fixture.employees.length, 0);
  assert.equal(fixture.tasks.length, 0);
  assert.equal(
    fixture.connections.every((connection) => connection.status === "missing"),
    true,
  );
});

test("fixture lookup helpers do not invent missing records", () => {
  const fixture = buildFixture("normal");
  assert.equal(findEmployee(fixture, "songi")?.name, "송이");
  assert.equal(findTask(fixture, "task-research-042")?.employeeId, "songi");
  assert.equal(findEmployee(fixture, "missing"), undefined);
  assert.equal(findTask(fixture, "missing"), undefined);
});
