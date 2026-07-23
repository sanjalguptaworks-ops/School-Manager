import { Router } from "express";
import { db, schoolsTable, feePaymentsTable, feeStructuresTable, studentsTable, classesTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, sql, gt } from "drizzle-orm";
import { notifyFeeReminder, notifyBirthday } from "../lib/notify";
import { isSchoolSuspended, isBillingLapsed } from "../lib/school-settings";

const router = Router();

// A cron double-firing (or a manual re-run during testing) shouldn't spam
// the same reminder twice -- skip if that student already got this exact
// notification within the last 20 hours (see notifications.title/userId).
async function alreadyNotifiedRecently(userId: number, title: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const [existing] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.title, title), gt(notificationsTable.createdAt, cutoff)))
    .limit(1);
  return !!existing;
}

async function runFeeReminders(schoolId: number): Promise<number> {
  const dueSoon = await db
    .select({
      id: feePaymentsTable.id,
      studentId: feePaymentsTable.studentId,
      studentUserId: studentsTable.userId,
      term: feeStructuresTable.term,
      amount: sql<string>`coalesce(${feePaymentsTable.amount}, ${feeStructuresTable.amount})`,
      dueDate: sql<string>`coalesce(${feePaymentsTable.dueDate}, ${feeStructuresTable.dueDate})`,
    })
    .from(feePaymentsTable)
    .innerJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id))
    .innerJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(
      and(
        eq(classesTable.schoolId, schoolId),
        eq(feePaymentsTable.status, "pending"),
        sql`coalesce(${feePaymentsTable.dueDate}, ${feeStructuresTable.dueDate})::date between current_date and current_date + 3`,
      ),
    );

  let sent = 0;
  for (const fp of dueSoon) {
    const title = `Fee due soon: ${fp.term}`;
    if (await alreadyNotifiedRecently(fp.studentUserId, title)) continue;
    await notifyFeeReminder({ studentId: fp.studentId, term: fp.term, amount: fp.amount, dueDate: fp.dueDate }, schoolId);
    sent++;
  }
  return sent;
}

async function runBirthdayShoutouts(schoolId: number): Promise<number> {
  const birthdays = await db
    .select({
      userId: studentsTable.userId,
      classId: studentsTable.classId,
      name: usersTable.name,
    })
    .from(studentsTable)
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(
      and(
        eq(classesTable.schoolId, schoolId),
        sql`${studentsTable.dob} is not null`,
        sql`extract(month from ${studentsTable.dob}::date) = extract(month from current_date)`,
        sql`extract(day from ${studentsTable.dob}::date) = extract(day from current_date)`,
      ),
    );

  let sent = 0;
  for (const s of birthdays) {
    const title = "Happy Birthday!";
    if (await alreadyNotifiedRecently(s.userId, title)) continue;
    await notifyBirthday({ name: s.name, classId: s.classId }, schoolId);
    sent++;
  }
  return sent;
}

// POST /internal/daily-tasks — not user-facing. Triggered once a day by a
// GitHub Actions cron (see .github/workflows/daily-tasks.yml), gated by a
// shared secret since there's no real auth for a machine-to-machine call.
router.post("/internal/daily-tasks", async (req, res): Promise<void> => {
  const expected = process.env["INTERNAL_TASKS_SECRET"];
  const provided = req.header("X-Internal-Secret");
  if (!expected || provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const schools = await db
      .select({
        id: schoolsTable.id,
        suspendedFrom: schoolsTable.suspendedFrom,
        suspendedUntil: schoolsTable.suspendedUntil,
        billingMode: schoolsTable.billingMode,
        paidUntil: schoolsTable.paidUntil,
      })
      .from(schoolsTable)
      .where(eq(schoolsTable.status, "approved"));

    let feeRemindersSent = 0;
    let birthdaysSent = 0;

    for (const school of schools) {
      if (isSchoolSuspended(school) || isBillingLapsed({ billingMode: school.billingMode ?? "trial", paidUntil: school.paidUntil })) {
        continue;
      }
      feeRemindersSent += await runFeeReminders(school.id);
      birthdaysSent += await runBirthdayShoutouts(school.id);
    }

    res.json({ schoolsProcessed: schools.length, feeRemindersSent, birthdaysSent });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
