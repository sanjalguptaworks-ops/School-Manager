import { db, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendBulkNotificationEmail } from "./mailer";
import { sendBulkSms } from "./sms";
import { isEmailEnabledForSchool, isSmsEnabledForSchool } from "./school-settings";

const APP_NAME = "EduCore";

interface Contact {
  email: string;
  phone: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getRecipientsByRole(role: "student" | "parent" | "teacher" | "admin"): Promise<Contact[]> {
  return db.select({ email: usersTable.email, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.role, role));
}

async function getAllRecipients(): Promise<Contact[]> {
  return db.select({ email: usersTable.email, phone: usersTable.phone }).from(usersTable);
}

// Every student + every parent linked to a student, in one class.
async function getClassRecipients(classId: number): Promise<Contact[]> {
  const byEmail = new Map<string, Contact>();

  const studentRows = await db
    .select({ email: usersTable.email, phone: usersTable.phone })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  studentRows.forEach((r) => byEmail.set(r.email, r));

  const parentRows = await db
    .select({ email: usersTable.email, phone: usersTable.phone })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  parentRows.forEach((r) => byEmail.set(r.email, r));

  return Array.from(byEmail.values());
}

async function getClassStudentRecipients(classId: number): Promise<Contact[]> {
  return db
    .select({ email: usersTable.email, phone: usersTable.phone })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
}

async function getClassParentRecipients(classId: number): Promise<Contact[]> {
  return db
    .select({ email: usersTable.email, phone: usersTable.phone })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
}

async function resolveNoticeRecipients(targetRole: string, classId: number | null): Promise<Contact[]> {
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

// Sends email (if the school has it enabled) and SMS (if the school has
// opted in and a provider is configured -- see lib/sms.ts) to the same
// contact list.
async function dispatch(schoolId: number, contacts: Contact[], subject: string, text: string, html: string, smsBody: string): Promise<void> {
  const [emailEnabled, smsEnabled] = await Promise.all([isEmailEnabledForSchool(schoolId), isSmsEnabledForSchool(schoolId)]);

  if (emailEnabled) {
    const emails = contacts.map((c) => c.email);
    if (emails.length > 0) await sendBulkNotificationEmail(emails, subject, text, html);
  }

  if (smsEnabled) {
    const phones = contacts.filter((c): c is Contact & { phone: string } => !!c.phone).map((c) => c.phone);
    if (phones.length > 0) await sendBulkSms(phones, smsBody);
  }
}

// ── Public trigger functions — call these right after creating the record.
// These never throw: a failed/slow send should never break the
// notice/exam/fee action itself.

export async function notifyNewNotice(
  notice: {
    title: string;
    body: string;
    targetRole: string;
    classId: number | null;
  },
  schoolId: number,
): Promise<void> {
  try {
    const contacts = await resolveNoticeRecipients(notice.targetRole, notice.classId);
    if (contacts.length === 0) return;

    const text = `${notice.title}\n\n${notice.body}\n\n— ${APP_NAME}`;
    const html = `<p><strong>${escapeHtml(notice.title)}</strong></p><p>${escapeHtml(notice.body).replace(
      /\n/g,
      "<br/>",
    )}</p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: ${notice.title} - ${notice.body}`.slice(0, 300);

    await dispatch(schoolId, contacts, `New notice: ${notice.title}`, text, html, smsBody);
  } catch (err) {
    console.error("Failed to send notice notifications", err);
  }
}

export async function notifyNewExam(
  exam: {
    name: string;
    subject: string;
    date: string;
    maxMarks: number;
    classId: number;
  },
  schoolId: number,
): Promise<void> {
  try {
    const contacts = await getClassRecipients(exam.classId);
    if (contacts.length === 0) return;

    const subjectLine = `New exam scheduled: ${exam.subject} (${exam.name})`;
    const text = `A new exam has been scheduled.\n\nExam: ${exam.name}\nSubject: ${exam.subject}\nDate: ${exam.date}\nMax marks: ${exam.maxMarks}\n\n— ${APP_NAME}`;
    const html = `<p>A new exam has been scheduled.</p><ul><li><b>Exam:</b> ${escapeHtml(
      exam.name,
    )}</li><li><b>Subject:</b> ${escapeHtml(exam.subject)}</li><li><b>Date:</b> ${exam.date}</li><li><b>Max marks:</b> ${
      exam.maxMarks
    }</li></ul><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: New exam - ${exam.subject} (${exam.name}) on ${exam.date}.`;

    await dispatch(schoolId, contacts, subjectLine, text, html, smsBody);
  } catch (err) {
    console.error("Failed to send exam notifications", err);
  }
}

export async function notifyFeeDue(
  fs: {
    term: string;
    amount: string;
    dueDate: string;
    classId: number;
  },
  schoolId: number,
): Promise<void> {
  try {
    const contacts = await getClassRecipients(fs.classId);
    if (contacts.length === 0) return;

    const subjectLine = `Fee due: ${fs.term} — ₹${fs.amount}`;
    const text = `A new fee has been assigned.\n\nTerm: ${fs.term}\nAmount: ₹${fs.amount}\nDue date: ${fs.dueDate}\n\nPlease log in to EduCore to view details.\n\n— ${APP_NAME}`;
    const html = `<p>A new fee has been assigned.</p><ul><li><b>Term:</b> ${escapeHtml(
      fs.term,
    )}</li><li><b>Amount:</b> ₹${fs.amount}</li><li><b>Due date:</b> ${
      fs.dueDate
    }</li></ul><p>Please log in to EduCore to view details.</p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: Fee due - ${fs.term} ₹${fs.amount}, due ${fs.dueDate}.`;

    await dispatch(schoolId, contacts, subjectLine, text, html, smsBody);
  } catch (err) {
    console.error("Failed to send fee notifications", err);
  }
}
