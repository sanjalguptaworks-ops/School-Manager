import { db, usersTable, studentsTable, parentStudentsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendBulkNotificationEmail } from "./mailer";
import { sendBulkSms } from "./sms";
import { isEmailEnabledForSchool, isSmsEnabledForSchool } from "./school-settings";

const APP_NAME = "EduCore";

interface Contact {
  userId: number;
  email: string;
  phone: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getRecipientsByRole(role: "student" | "parent" | "teacher" | "admin", schoolId: number): Promise<Contact[]> {
  return db
    .select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(usersTable)
    .where(and(eq(usersTable.role, role), eq(usersTable.schoolId, schoolId)));
}

async function getAllRecipients(schoolId: number): Promise<Contact[]> {
  return db.select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.schoolId, schoolId));
}

// Every student + every parent linked to a student, in one class.
async function getClassRecipients(classId: number): Promise<Contact[]> {
  const byUserId = new Map<number, Contact>();

  const studentRows = await db
    .select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  studentRows.forEach((r) => byUserId.set(r.userId, r));

  const parentRows = await db
    .select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
  parentRows.forEach((r) => byUserId.set(r.userId, r));

  return Array.from(byUserId.values());
}

async function getClassStudentRecipients(classId: number): Promise<Contact[]> {
  return db
    .select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
}

async function getClassParentRecipients(classId: number): Promise<Contact[]> {
  return db
    .select({ userId: usersTable.id, email: usersTable.email, phone: usersTable.phone })
    .from(parentStudentsTable)
    .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
    .where(eq(studentsTable.classId, classId));
}

async function resolveNoticeRecipients(targetRole: string, classId: number | null, schoolId: number): Promise<Contact[]> {
  if (classId) {
    if (targetRole === "students") return getClassStudentRecipients(classId);
    if (targetRole === "parents") return getClassParentRecipients(classId);
    // "all" (or teachers/admin combined with a class, which isn't really
    // meaningful since they aren't tied to a class) — just notify the class.
    return getClassRecipients(classId);
  }

  switch (targetRole) {
    case "students":
      return getRecipientsByRole("student", schoolId);
    case "parents":
      return getRecipientsByRole("parent", schoolId);
    case "teachers":
      return getRecipientsByRole("teacher", schoolId);
    case "admin":
      return getRecipientsByRole("admin", schoolId);
    default:
      return getAllRecipients(schoolId);
  }
}

// Sends email (if the school has it enabled), SMS (if the school has opted
// in and a provider is configured -- see lib/sms.ts), and always writes an
// in-app notification row (the bell-icon feed isn't gated by either toggle,
// since it costs nothing and isn't an external channel).
async function dispatch(
  schoolId: number,
  contacts: Contact[],
  subject: string,
  text: string,
  html: string,
  smsBody: string,
  inApp: { title: string; body: string; link?: string },
): Promise<void> {
  const [emailEnabled, smsEnabled] = await Promise.all([isEmailEnabledForSchool(schoolId), isSmsEnabledForSchool(schoolId)]);

  if (emailEnabled) {
    const emails = contacts.map((c) => c.email);
    if (emails.length > 0) await sendBulkNotificationEmail(emails, subject, text, html);
  }

  if (smsEnabled) {
    const phones = contacts.filter((c): c is Contact & { phone: string } => !!c.phone).map((c) => c.phone);
    if (phones.length > 0) await sendBulkSms(phones, smsBody);
  }

  if (contacts.length > 0) {
    await db.insert(notificationsTable).values(
      contacts.map((c) => ({
        userId: c.userId,
        title: inApp.title,
        body: inApp.body,
        link: inApp.link ?? null,
        schoolId,
      })),
    );
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
    const contacts = await resolveNoticeRecipients(notice.targetRole, notice.classId, schoolId);
    if (contacts.length === 0) return;

    const text = `${notice.title}\n\n${notice.body}\n\n— ${APP_NAME}`;
    const html = `<p><strong>${escapeHtml(notice.title)}</strong></p><p>${escapeHtml(notice.body).replace(
      /\n/g,
      "<br/>",
    )}</p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: ${notice.title} - ${notice.body}`.slice(0, 300);

    await dispatch(schoolId, contacts, `New notice: ${notice.title}`, text, html, smsBody, {
      title: notice.title,
      body: notice.body,
      link: "/notices",
    });
  } catch (err) {
    console.error("Failed to send notice notifications", err);
  }
}

export async function notifyNewGalleryAlbum(
  album: { title: string; classId: number | null },
  schoolId: number,
): Promise<void> {
  try {
    const contacts = album.classId ? await getClassRecipients(album.classId) : await getAllRecipients(schoolId);
    if (contacts.length === 0) return;

    const text = `New photos have been added to the gallery: ${album.title}\n\n— ${APP_NAME}`;
    const html = `<p>New photos have been added to the gallery: <strong>${escapeHtml(album.title)}</strong></p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: New gallery album - ${album.title}`.slice(0, 300);

    await dispatch(schoolId, contacts, `New gallery album: ${album.title}`, text, html, smsBody, {
      title: "New gallery album",
      body: album.title,
      link: "/gallery",
    });
  } catch (err) {
    console.error("Failed to send gallery notifications", err);
  }
}

export async function notifyNewPoll(
  poll: { question: string; classId: number | null },
  schoolId: number,
): Promise<void> {
  try {
    const contacts = poll.classId ? await getClassRecipients(poll.classId) : await getAllRecipients(schoolId);
    if (contacts.length === 0) return;

    const text = `A new poll is open: ${poll.question}\n\n— ${APP_NAME}`;
    const html = `<p>A new poll is open: <strong>${escapeHtml(poll.question)}</strong></p><p style="color:#888;font-size:12px">Sent via ${APP_NAME}</p>`;
    const smsBody = `${APP_NAME}: New poll - ${poll.question}`.slice(0, 300);

    await dispatch(schoolId, contacts, `New poll: ${poll.question}`, text, html, smsBody, {
      title: "New poll",
      body: poll.question,
      link: "/polls",
    });
  } catch (err) {
    console.error("Failed to send poll notifications", err);
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

    await dispatch(schoolId, contacts, subjectLine, text, html, smsBody, {
      title: `New exam: ${exam.subject}`,
      body: `${exam.name} on ${exam.date}`,
      link: "/exams",
    });
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

    await dispatch(schoolId, contacts, subjectLine, text, html, smsBody, {
      title: `Fee due: ${fs.term}`,
      body: `₹${fs.amount}, due ${fs.dueDate}`,
      link: "/fees",
    });
  } catch (err) {
    console.error("Failed to send fee notifications", err);
  }
}

// In-app-only (no email/SMS) — the requester already sees the outcome the
// moment they reload the page, but a bell-icon ping is a nice-to-have for
// something they were actively waiting on.
export async function notifyLeaveRequestReviewed(
  leaveRequest: { requestedBy: number; status: "approved" | "rejected"; startDate: string; endDate: string },
  schoolId: number,
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: leaveRequest.requestedBy,
      title: `Leave request ${leaveRequest.status}`,
      body: `Your leave request for ${leaveRequest.startDate} to ${leaveRequest.endDate} was ${leaveRequest.status}.`,
      link: "/leave-requests",
      schoolId,
    });
  } catch (err) {
    console.error("Failed to write leave-request-reviewed notification", err);
  }
}

// In-app-only, same reasoning as notifyLeaveRequestReviewed -- a real-time
// chat message doesn't need an email/SMS blast, just a bell-icon ping for
// the other participant.
export async function notifyNewMessage(
  message: { conversationId: number; recipientUserId: number; senderName: string; body: string },
  schoolId: number,
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: message.recipientUserId,
      title: `New message from ${message.senderName}`,
      body: message.body.slice(0, 140),
      link: `/messages/${message.conversationId}`,
      schoolId,
    });
  } catch (err) {
    console.error("Failed to write new-message notification", err);
  }
}
