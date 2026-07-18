# School Management App — MVP Technical Plan

## 1. Architecture

```
                ┌───────────────┐
                │   PostgreSQL  │
                └───────┬───────┘
                        │
                ┌───────┴───────┐
                │  REST API      │  (Node.js + Express/NestJS)
                │  Auth: JWT     │
                └───┬───────┬───┘
                    │       │
            ┌───────┘       └────────┐
      ┌─────┴──────┐          ┌──────┴──────┐
      │  Web (React)│          │ Mobile (RN/  │
      │  Tailwind   │          │ Expo)        │
      └────────────┘          └──────────────┘
```

One backend, two clients. Share TypeScript types between web/mobile via a shared package (`/packages/types`) if using a monorepo (Turborepo or Nx).

## 2. Repo Structure (Monorepo recommended)

```
school-app/
├── apps/
│   ├── api/            # Node/Express or NestJS
│   ├── web/             # React + Tailwind
│   └── mobile/          # React Native (Expo)
├── packages/
│   ├── types/            # Shared TS interfaces (User, Student, Attendance...)
│   └── config/           # Shared eslint/tsconfig
└── package.json
```

## 3. Database Schema (PostgreSQL)

```sql
-- Users (base auth table)
users (
  id UUID PK,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT CHECK (role IN ('admin','teacher','student','parent')),
  created_at TIMESTAMP
)

-- Classes/Sections
classes (
  id UUID PK,
  name TEXT,           -- e.g. "Grade 8"
  section TEXT          -- e.g. "A"
)

-- Students
students (
  id UUID PK,
  user_id UUID FK -> users.id,
  class_id UUID FK -> classes.id,
  roll_no TEXT,
  dob DATE,
  guardian_name TEXT,
  guardian_contact TEXT
)

-- Teachers
teachers (
  id UUID PK,
  user_id UUID FK -> users.id,
  subjects TEXT[]        -- or a join table if you want normalized
)

-- Parent-Student link
parent_student (
  parent_user_id UUID FK -> users.id,
  student_id UUID FK -> students.id
)

-- Attendance
attendance (
  id UUID PK,
  student_id UUID FK -> students.id,
  class_id UUID FK -> classes.id,
  date DATE,
  status TEXT CHECK (status IN ('present','absent','late')),
  marked_by UUID FK -> users.id,
  UNIQUE(student_id, date)
)

-- Exams
exams (
  id UUID PK,
  name TEXT,             -- e.g. "Midterm"
  class_id UUID FK -> classes.id,
  subject TEXT,
  date DATE,
  max_marks INT
)

-- Marks
marks (
  id UUID PK,
  exam_id UUID FK -> exams.id,
  student_id UUID FK -> students.id,
  marks_obtained NUMERIC
)

-- Notices
notices (
  id UUID PK,
  title TEXT,
  body TEXT,
  target_role TEXT,       -- 'all', 'students', 'parents', 'teachers'
  class_id UUID NULL,     -- optional: scope to one class
  created_by UUID FK -> users.id,
  created_at TIMESTAMP
)

-- Fees
fee_structure (
  id UUID PK,
  class_id UUID FK -> classes.id,
  amount NUMERIC,
  due_date DATE,
  term TEXT               -- e.g. "Term 1"
)

fee_payments (
  id UUID PK,
  student_id UUID FK -> students.id,
  fee_structure_id UUID FK -> fee_structure.id,
  status TEXT CHECK (status IN ('pending','paid')),
  paid_on DATE NULL
)
```

## 4. API Endpoints (MVP scope)

```
Auth
POST   /auth/login
POST   /auth/register        (admin only, creates users)
GET    /auth/me

Users / Students / Teachers
GET    /students?classId=
POST   /students
GET    /students/:id
PATCH  /students/:id
GET    /teachers
POST   /teachers
GET    /classes
POST   /classes

Attendance
POST   /attendance            body: { classId, date, records: [{studentId, status}] }
GET    /attendance?studentId=&month=
GET    /attendance?classId=&date=

Exams & Marks
POST   /exams
GET    /exams?classId=
POST   /marks                 body: { examId, records: [{studentId, marksObtained}] }
GET    /marks/report/:studentId?examId=

Notices
POST   /notices
GET    /notices?role=&classId=

Fees
POST   /fee-structure
GET    /fee-structure?classId=
POST   /fee-payments/:id/mark-paid
GET    /fee-payments?studentId=
```

Auth middleware: every route (except `/auth/login`) checks JWT + role permission (e.g. only `admin`/`teacher` can POST attendance).

## 5. Role Permission Matrix

| Feature            | Admin | Teacher | Student | Parent |
|---------------------|:---:|:---:|:---:|:---:|
| Manage students/teachers | ✅ | ❌ | ❌ | ❌ |
| Mark attendance      | ✅ | ✅ | ❌ | ❌ |
| View attendance       | ✅ | ✅ | own | own child |
| Enter marks           | ✅ | ✅ | ❌ | ❌ |
| View report card       | ✅ | ✅ | own | own child |
| Post notices          | ✅ | ✅ | ❌ | ❌ |
| View notices           | ✅ | ✅ | ✅ | ✅ |
| Mark fee paid          | ✅ | ❌ | ❌ | ❌ |
| View fee status         | ✅ | ❌ | own | own child |

## 6. Build Order (6 weeks, solo/small team)

| Week | Deliverable |
|---|---|
| 1 | DB schema + API skeleton + JWT auth |
| 2 | Admin web panel: student/teacher/class CRUD |
| 3 | Mobile app skeleton (Expo) + login + role-based navigation |
| 4 | Attendance (teacher marks on mobile, parent/student views) + Notices |
| 5 | Exams/marks entry (web) + report card view (mobile) |
| 6 | Fee status module + testing + deploy |

## 7. Deployment

- **API:** Render or Railway (auto-deploy from GitHub)
- **DB:** Neon or Supabase (managed Postgres, free tier fine for MVP)
- **Web:** Vercel
- **Mobile:** Expo EAS Build → internal testing via TestFlight/Play Console internal track before public release

## 8. Post-MVP Backlog (don't build now)
- Payment gateway (Razorpay/Stripe) integration for fees
- Auto-timetable generation
- Push notifications (can add via Expo Notifications once notices module works)
- Library/transport modules
- Multi-school/tenant support
- Analytics dashboard for admin
