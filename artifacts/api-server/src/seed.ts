/**
 * Seed script — run once with: npx tsx src/seed.ts
 * Safe to run multiple times (skips if data exists).
 * All seeded accounts share the password printed at the end.
 */
import { db, usersTable, classesTable, studentsTable, teachersTable, noticesTable, examsTable, marksTable, feeStructuresTable, feePaymentsTable } from "@workspace/db";
import { hashPassword } from "./lib/password";

const SEED_PASSWORD = "Password123!";

async function seed() {
  console.log("Seeding...");

  // Classes
  const existingClasses = await db.select().from(classesTable).limit(1);
  if (existingClasses.length > 0) {
    console.log("Data already exists, skipping seed.");
    process.exit(0);
  }

  const [cls10A, cls10B, cls9A] = await db.insert(classesTable).values([
    { name: "Class 10", section: "A" },
    { name: "Class 10", section: "B" },
    { name: "Class 9", section: "A" },
  ]).returning();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  // Admin user
  const [adminUser] = await db.insert(usersTable).values({
    name: "Principal Anita Sharma",
    email: "admin@educore.school",
    role: "admin",
    passwordHash,
  }).returning();

  // Teacher users
  const [t1User, t2User, t3User] = await db.insert(usersTable).values([
    { name: "Rajesh Kumar", email: "rajesh@educore.school", role: "teacher", passwordHash },
    { name: "Priya Mehta", email: "priya@educore.school", role: "teacher", passwordHash },
    { name: "Suresh Patel", email: "suresh@educore.school", role: "teacher", passwordHash },
  ]).returning();

  // Teachers
  await db.insert(teachersTable).values([
    { userId: t1User.id, subjects: ["Mathematics", "Physics"] },
    { userId: t2User.id, subjects: ["English", "History"] },
    { userId: t3User.id, subjects: ["Biology", "Chemistry"] },
  ]);

  // Student users
  const studentUserData = [
    { name: "Amit Verma", email: "amit@student.educore.school", role: "student" as const, passwordHash },
    { name: "Sneha Rao", email: "sneha@student.educore.school", role: "student" as const, passwordHash },
    { name: "Ravi Gupta", email: "ravi@student.educore.school", role: "student" as const, passwordHash },
    { name: "Kavya Nair", email: "kavya@student.educore.school", role: "student" as const, passwordHash },
    { name: "Arjun Singh", email: "arjun@student.educore.school", role: "student" as const, passwordHash },
    { name: "Pooja Reddy", email: "pooja@student.educore.school", role: "student" as const, passwordHash },
  ];
  const studentUsers = await db.insert(usersTable).values(studentUserData).returning();

  // Students
  const [s1, s2, s3, s4, s5, s6] = await db.insert(studentsTable).values([
    { userId: studentUsers[0].id, classId: cls10A.id, rollNo: "10A-001", dob: "2009-03-15", guardianName: "Mohan Verma", guardianContact: "9876543210" },
    { userId: studentUsers[1].id, classId: cls10A.id, rollNo: "10A-002", dob: "2009-07-22", guardianName: "Suresh Rao", guardianContact: "9876543211" },
    { userId: studentUsers[2].id, classId: cls10B.id, rollNo: "10B-001", dob: "2009-01-10", guardianName: "Ramesh Gupta", guardianContact: "9876543212" },
    { userId: studentUsers[3].id, classId: cls10B.id, rollNo: "10B-002", dob: "2009-11-05", guardianName: "Krishna Nair", guardianContact: "9876543213" },
    { userId: studentUsers[4].id, classId: cls9A.id, rollNo: "9A-001", dob: "2010-06-30", guardianName: "Baldev Singh", guardianContact: "9876543214" },
    { userId: studentUsers[5].id, classId: cls9A.id, rollNo: "9A-002", dob: "2010-09-18", guardianName: "Venkat Reddy", guardianContact: "9876543215" },
  ]).returning();

  // Notices
  await db.insert(noticesTable).values([
    { title: "Annual Sports Day", body: "Annual Sports Day will be held on August 10th. All students must participate. Venue: School Ground. Time: 9:00 AM onwards.", targetRole: "all", createdBy: adminUser.id },
    { title: "Parent-Teacher Meeting", body: "PTM scheduled for July 25th from 10 AM to 1 PM. All parents are requested to attend without fail to discuss academic progress.", targetRole: "parents", createdBy: adminUser.id },
    { title: "Math Olympiad Registration", body: "Students interested in participating in the State Math Olympiad must submit their forms to the office by July 20th.", targetRole: "students", classId: cls10A.id, createdBy: t1User.id },
    { title: "Fee Payment Reminder", body: "Term 1 fees are due by July 31st. Students with pending fees will not receive report cards. Contact the admin office for payment.", targetRole: "parents", createdBy: adminUser.id },
    { title: "Library Books Return", body: "All library books must be returned by July 22nd for stock-taking. Students with overdue books will be fined Rs 5 per day.", targetRole: "students", createdBy: t2User.id },
  ]);

  // Exams
  const [examMath, examEng, examSci] = await db.insert(examsTable).values([
    { name: "Unit Test 1", classId: cls10A.id, subject: "Mathematics", date: "2026-07-20", maxMarks: 50 },
    { name: "Unit Test 1", classId: cls10A.id, subject: "English", date: "2026-07-21", maxMarks: 50 },
    { name: "Unit Test 1", classId: cls10B.id, subject: "Science", date: "2026-07-22", maxMarks: 50 },
  ]).returning();

  // Marks
  await db.insert(marksTable).values([
    { examId: examMath.id, studentId: s1.id, marksObtained: "42" },
    { examId: examMath.id, studentId: s2.id, marksObtained: "38" },
    { examId: examEng.id, studentId: s1.id, marksObtained: "45" },
    { examId: examEng.id, studentId: s2.id, marksObtained: "41" },
    { examId: examSci.id, studentId: s3.id, marksObtained: "35" },
    { examId: examSci.id, studentId: s4.id, marksObtained: "48" },
  ]);

  // Fee structures
  const [fs10A, fs10B, fs9A] = await db.insert(feeStructuresTable).values([
    { classId: cls10A.id, amount: "12000", dueDate: "2026-07-31", term: "Term 1 2026" },
    { classId: cls10B.id, amount: "12000", dueDate: "2026-07-31", term: "Term 1 2026" },
    { classId: cls9A.id, amount: "11000", dueDate: "2026-07-31", term: "Term 1 2026" },
  ]).returning();

  // Fee payments
  await db.insert(feePaymentsTable).values([
    { studentId: s1.id, feeStructureId: fs10A.id, status: "paid", paidOn: "2026-07-10" },
    { studentId: s2.id, feeStructureId: fs10A.id, status: "pending" },
    { studentId: s3.id, feeStructureId: fs10B.id, status: "paid", paidOn: "2026-07-08" },
    { studentId: s4.id, feeStructureId: fs10B.id, status: "pending" },
    { studentId: s5.id, feeStructureId: fs9A.id, status: "pending" },
    { studentId: s6.id, feeStructureId: fs9A.id, status: "paid", paidOn: "2026-07-12" },
  ]);

  console.log("Seed complete.");
  console.log("");
  console.log("All seeded accounts share this password:", SEED_PASSWORD);
  console.log("Admin login: admin@educore.school");
  console.log("Teacher login: rajesh@educore.school");
  console.log("Student login: amit@student.educore.school");
  console.log("");
  console.log("Change these passwords after first login in a real deployment.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
