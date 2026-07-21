import { db, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type StudentAccessScope =
  | { kind: "all" } // admin/teacher -- unrestricted within their own school
  | { kind: "restricted"; studentIds: number[] }; // student/parent -- only these

/**
 * Which student records the logged-in user is allowed to see. Staff keep the
 * existing trust model (any student in their school); students and parents
 * are restricted to their own record / their linked children -- otherwise
 * any authenticated user could pass an arbitrary studentId query param and
 * read another family's attendance, marks, or fee records.
 */
export async function getStudentAccessScope(authUserId: number): Promise<StudentAccessScope> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

  if (user?.role === "admin" || user?.role === "teacher") return { kind: "all" };

  if (user?.role === "student") {
    const [s] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
    return { kind: "restricted", studentIds: s ? [s.id] : [] };
  }

  if (user?.role === "parent") {
    const rows = await db
      .select({ id: parentStudentsTable.studentId })
      .from(parentStudentsTable)
      .where(eq(parentStudentsTable.parentId, authUserId));
    return { kind: "restricted", studentIds: rows.map((r) => r.id) };
  }

  return { kind: "restricted", studentIds: [] };
}

export function canAccessStudent(scope: StudentAccessScope, studentId: number): boolean {
  return scope.kind === "all" || scope.studentIds.includes(studentId);
}
