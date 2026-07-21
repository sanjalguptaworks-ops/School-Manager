import { db, usersTable, teachersTable, teacherClassesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type TeacherClassScope = { kind: "all" } | { kind: "restricted"; classIds: number[] };

/**
 * Which classes a teacher's queries should be scoped to. Non-teachers (admin
 * and anyone else calling these staff-facing routes) are always "all" --
 * this only ever restricts the teacher role.
 *
 * A teacher who hasn't been assigned to any class yet is also "all": the
 * restriction only kicks in once an admin has actually assigned them to at
 * least one class, so existing teachers aren't suddenly locked out of
 * everything the moment this feature ships.
 */
export async function getTeacherClassScope(authUserId: number): Promise<TeacherClassScope> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
  if (user?.role !== "teacher") return { kind: "all" };

  const [teacher] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, authUserId)).limit(1);
  if (!teacher) return { kind: "restricted", classIds: [] };

  const rows = await db.select({ classId: teacherClassesTable.classId }).from(teacherClassesTable).where(eq(teacherClassesTable.teacherId, teacher.id));
  if (rows.length === 0) return { kind: "all" };
  return { kind: "restricted", classIds: rows.map((r) => r.classId) };
}

export function canAccessClass(scope: TeacherClassScope, classId: number): boolean {
  return scope.kind === "all" || scope.classIds.includes(classId);
}
