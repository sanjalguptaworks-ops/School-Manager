// Integration tests for this session's highest-value access-control
// patterns -- the kind of bug this app has actually shipped (role
// escalation, teacher class-scope bypass) rather than exhaustive route
// coverage. Run against a disposable database via DATABASE_URL (see
// package.json's "test" script) -- never point this at production.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../app";
import { startTestServer, loginAs } from "./helpers";

// From src/seed.ts -- admin@educore.school (id 1), rajesh@educore.school
// teacher (id 2, teachers.id 1), amit@student.educore.school (class 1),
// ravi@student.educore.school (class 2, student id 3).
const ADMIN_EMAIL = "admin@educore.school";
const TEACHER_EMAIL = "rajesh@educore.school";
const TEACHER_ID = 1; // teachers.id, not users.id
const CLASS_1_STUDENT_ID = 1; // amit, in class 1
const CLASS_2_STUDENT_ID = 3; // ravi, in class 2
const CLASS_1_ID = 1;

describe("access control", () => {
  let baseUrl: string;
  let close: () => Promise<void>;
  let adminCookie: string;
  let teacherCookie: string;

  before(async () => {
    ({ baseUrl, close } = await startTestServer(app));
    adminCookie = await loginAs(baseUrl, ADMIN_EMAIL);
    teacherCookie = await loginAs(baseUrl, TEACHER_EMAIL);
  });

  after(async () => {
    await close();
  });

  test("unauthenticated requests are rejected", async () => {
    const res = await fetch(`${baseUrl}/api/discipline-incidents`);
    assert.equal(res.status, 401);
  });

  test("admin cannot escalate a user's role to creator", async () => {
    const res = await fetch(`${baseUrl}/api/users/${CLASS_1_STUDENT_ID + 100}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ role: "creator" }),
    });
    // Rejected for being an invalid role before the (likely-nonexistent)
    // target id is even looked up.
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid role");
  });

  describe("teacher scoped to one class", () => {
    before(async () => {
      const res = await fetch(`${baseUrl}/api/teachers/${TEACHER_ID}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ classId: CLASS_1_ID }),
      });
      assert.ok(res.status === 201 || res.status === 409, `unexpected assign status ${res.status}`);
    });

    after(async () => {
      await fetch(`${baseUrl}/api/teachers/${TEACHER_ID}/classes/${CLASS_1_ID}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });
    });

    test("can access a student in their own class", async () => {
      const res = await fetch(`${baseUrl}/api/students/${CLASS_1_STUDENT_ID}`, { headers: { Cookie: teacherCookie } });
      assert.equal(res.status, 200);
    });

    test("cannot access a student outside their class", async () => {
      const res = await fetch(`${baseUrl}/api/students/${CLASS_2_STUDENT_ID}`, { headers: { Cookie: teacherCookie } });
      assert.equal(res.status, 403);
    });
  });

  test("students cannot view the discipline log", async () => {
    const studentCookie = await loginAs(baseUrl, "amit@student.educore.school");
    const res = await fetch(`${baseUrl}/api/discipline-incidents`, { headers: { Cookie: studentCookie } });
    assert.equal(res.status, 403);
  });
});
