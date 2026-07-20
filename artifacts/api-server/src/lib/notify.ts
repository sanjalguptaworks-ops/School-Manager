import { db, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendBulkNotificationEmail } from "./mailer";

const APP_NAME = "EduCore";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getRecipientsByRole(role: "student" | "parent" | "teacher" | "admin"): Promise<string[]> {
  const rows = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.role, role));
  return rows.map((r) => r.email);
}

async function getAllRecipients(): Promise<string[]> {
  const rows = await db.select({ email: usersTable.email }).from(usersTable);
  return rows.map((r) => r.email);
}

// Every student + every parent linked to a student, in one class.
async function getClassRecipients(classId: number): Promise<string[]> {
  const emails = new Set<string>();

  const studentRows = await db
    .select({ email: usersTable.email })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  studentRows.forEach((r) => emails.add(r.email));

  const parentRows = await db
    .select({ email: usersTable.email })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  parentRows.forEach((r) => emails.add(r.email));

  return Array.from(emails);
}

async function getClassStudentRecipients(classId: number): Promise<string[]> {
  const rows = await db
    .select({ email: usersTable.email })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  return rows.map((r) => r.email);
}

async function getClassParentRecipients(classId: number): Promise<string[]> {
  const rows = await db
    .select({ email: usersTable.email })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  return rows.map((r) => r.email);
}

async function resolveNoticeRecipients(targetRole: string, classId: number | null): Promise<string[]> {
  if (classId) {
    if (targetRole === "students") return getClassStudentRecipients(classId);
    if (targetRole === "parents") return getClassParentRecipients(classId);
    // "all" (or teachers/admin combined with a class, which isn't really
    // meaningful since they aren't tied to a class) — just notify the class.
    return getClassRecipients(classId);
  }

  switch (targetRole) {
    case "students":
      return getRecipientsByRole("student");
    case "parents":
      return getRecipientsByRole("parent");
    case "teachers":
      return getRecipientsByRole("teacher");
    case "admin":
      return getRecipientsByRole("admin");
    default:
      return getAllRecipients();
  }
}

// ── Public trigger functions — call these right after creating the record.
// These never throw: a failed/slow email send should never break the
// notice/exam/fee action itself.

export async function notifyNewNotice(notice: {
  title: string;
  body: string;
  targetRole: string;
  classId: number | null;
}): Promise<void> {
  try {
    const recipients = await resolveNoticeRecipients(notice.targetRole, notice.classId);
    if (recipients.length === 0) return;

    const text = `${notice.title}\n\n${notice.body}\n\n— ${APP_NAME}`;
    const html = `<p><strong>${escapeHtml(notice.title)}</strong></p><p>${escapeHtml(notice.body).replace(
      /\n/g,
      "<br/>",
    )}</p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;

    await sendBulkNotificationEmail(recipients, `New notice: ${notice.title}`, text, html);
  } catch (err) {
    console.error("Failed to send notice notification emails", err);
  }
}

export async function notifyNewExam(exam: {
  name: string;
  subject: string;
  date: string;
  maxMarks: number;
  classId: number;
}): Promise<void> {
  try {
    const recipients = await getClassRecipients(exam.classId);
    if (recipients.length === 0) return;

    const subjectLine = `New exam scheduled: ${exam.subject} (${exam.name})`;
    const text = `A new exam has been scheduled.\n\nExam: ${exam.name}\nSubject: ${exam.subject}\nDate: ${exam.date}\nMax marks: ${exam.maxMarks}\n\n— ${APP_NAME}`;
    const html = `<p>A new exam has been scheduled.</p><ul><li><b>Exam:</b> ${escapeHtml(
      exam.name,
    )}</li><li><b>Subject:</b> ${escapeHtml(exam.subject)}</li><li><b>Date:</b> ${exam.date}</li><li><b>Max marks:</b> ${
      exam.maxMarks
    }</li></ul><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;

    await sendBulkNotificationEmail(recipients, subjectLine, text, html);
  } catch (err) {
    console.error("Failed to send exam notification emails", err);
  }
}

export async function notifyFeeDue(fs: {
  term: string;
  amount: string;
  dueDate: string;
  classId: number;
}): Promise<void> {
  try {
    const recipients = await getClassRecipients(fs.classId);
    if (recipients.length === 0) return;

    const subjectLine = `Fee due: ${fs.term} — ₹${fs.amount}`;
    const text = `A new fee has been assigned.\n\nTerm: ${fs.term}\nAmount: ₹${fs.amount}\nDue date: ${fs.dueDate}\n\nPlease log in to EduCore to view details.\n\n— ${APP_NAME}`;
    const html = `<p>A new fee has been assigned.</p><ul><li><b>Term:</b> ${escapeHtml(
      fs.term,
    )}</li><li><b>Amount:</b> ₹${fs.amount}</li><li><b>Due date:</b> ${
      fs.dueDate
    }</li></ul><p>Please log in to EduCore to view details.</p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;

    await sendBulkNotificationEmail(recipients, subjectLine, text, html);
  } catch (err) {
    console.error("Failed to send fee notification emails", err);
  }
}
