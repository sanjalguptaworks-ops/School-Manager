import { Router } from "express";
import { db, transportRoutesTable, transportStopsTable, studentTransportTable, studentsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";

const router = Router();

async function getRouteStops(routeId: number) {
  return db.select().from(transportStopsTable).where(eq(transportStopsTable.routeId, routeId)).orderBy(transportStopsTable.order);
}

// GET /transport/routes — everyone in the school can browse routes/stops.
router.get("/transport/routes", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const routes = await db.select().from(transportRoutesTable).where(eq(transportRoutesTable.schoolId, schoolId));
    const withStops = await Promise.all(routes.map(async (r) => ({ ...r, stops: await getRouteStops(r.id) })));
    res.json(withStops);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /transport/routes — admin only.
router.post("/transport/routes", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { name, description } = req.body;
      if (!name) {
        res.status(400).json({ error: "name required" });
        return;
      }
      const [route] = await db.insert(transportRoutesTable).values({ schoolId, name, description: description || null }).returning();
      res.status(201).json({ ...route, stops: [] });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /transport/routes/:id — admin only.
router.delete("/transport/routes/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      await db.delete(transportRoutesTable).where(and(eq(transportRoutesTable.id, id), eq(transportRoutesTable.schoolId, schoolId)));
      res.json({ ok: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /transport/routes/:id/stops — admin only.
router.post("/transport/routes/:id/stops", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const routeId = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [route] = await db
        .select({ id: transportRoutesTable.id })
        .from(transportRoutesTable)
        .where(and(eq(transportRoutesTable.id, routeId), eq(transportRoutesTable.schoolId, schoolId)))
        .limit(1);
      if (!route) {
        res.status(404).json({ error: "Route not found" });
        return;
      }

      const { name, order, pickupTime, dropTime } = req.body;
      if (!name) {
        res.status(400).json({ error: "name required" });
        return;
      }
      const [stop] = await db
        .insert(transportStopsTable)
        .values({ routeId, name, order: typeof order === "number" ? order : 0, pickupTime: pickupTime || null, dropTime: dropTime || null })
        .returning();
      res.status(201).json(stop);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /transport/stops/:id — admin only.
router.delete("/transport/stops/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [stop] = await db
        .select({ id: transportStopsTable.id })
        .from(transportStopsTable)
        .innerJoin(transportRoutesTable, eq(transportStopsTable.routeId, transportRoutesTable.id))
        .where(and(eq(transportStopsTable.id, id), eq(transportRoutesTable.schoolId, schoolId)))
        .limit(1);
      if (!stop) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await db.delete(transportStopsTable).where(eq(transportStopsTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /transport/assignments — admin sees every assignment (optionally
// filtered by studentId); student/parent restricted to their own/linked
// children, same scoping as everywhere else.
router.get("/transport/assignments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId } = req.query as Record<string, string>;

    const scope = await getStudentAccessScope(authUserId);
    if (studentId && !canAccessStudent(scope, parseInt(studentId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (scope.kind === "restricted" && scope.studentIds.length === 0) {
      res.json([]);
      return;
    }

    const filters: any[] = [eq(transportRoutesTable.schoolId, schoolId)];
    if (studentId) filters.push(eq(studentTransportTable.studentId, parseInt(studentId)));
    else if (scope.kind === "restricted") filters.push(inArray(studentTransportTable.studentId, scope.studentIds));

    const assignments = await db
      .select({
        id: studentTransportTable.id,
        studentId: studentTransportTable.studentId,
        routeId: studentTransportTable.routeId,
        stopId: studentTransportTable.stopId,
        route: { id: transportRoutesTable.id, name: transportRoutesTable.name },
        stop: {
          id: transportStopsTable.id,
          name: transportStopsTable.name,
          pickupTime: transportStopsTable.pickupTime,
          dropTime: transportStopsTable.dropTime,
        },
        student: {
          id: studentsTable.id,
          rollNo: studentsTable.rollNo,
          user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name})`,
        },
      })
      .from(studentTransportTable)
      .innerJoin(transportRoutesTable, eq(studentTransportTable.routeId, transportRoutesTable.id))
      .innerJoin(transportStopsTable, eq(studentTransportTable.stopId, transportStopsTable.id))
      .innerJoin(studentsTable, eq(studentTransportTable.studentId, studentsTable.id))
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(...filters));

    res.json(assignments);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /transport/assignments — admin only. Upserts on studentId, so
// re-assigning a student to a different route/stop just replaces it.
router.post("/transport/assignments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { studentId, routeId, stopId } = req.body;
      if (!studentId || !routeId || !stopId) {
        res.status(400).json({ error: "studentId, routeId, stopId required" });
        return;
      }

      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!student) {
        res.status(400).json({ error: "Invalid studentId" });
        return;
      }

      const [stop] = await db
        .select({ id: transportStopsTable.id })
        .from(transportStopsTable)
        .innerJoin(transportRoutesTable, eq(transportStopsTable.routeId, transportRoutesTable.id))
        .where(and(eq(transportStopsTable.id, stopId), eq(transportStopsTable.routeId, routeId), eq(transportRoutesTable.schoolId, schoolId)))
        .limit(1);
      if (!stop) {
        res.status(400).json({ error: "Invalid routeId/stopId" });
        return;
      }

      const [assignment] = await db
        .insert(studentTransportTable)
        .values({ studentId, routeId, stopId })
        .onConflictDoUpdate({ target: studentTransportTable.studentId, set: { routeId, stopId } })
        .returning();
      res.status(201).json(assignment);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /transport/assignments/:studentId — admin only.
router.delete("/transport/assignments/:studentId", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const studentId = parseInt(req.params["studentId"] as string);
      const schoolId = (req as any).schoolId;
      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!student) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await db.delete(studentTransportTable).where(eq(studentTransportTable.studentId, studentId));
      res.json({ ok: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
