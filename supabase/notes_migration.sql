-- ScolaPilot · migration Notes & bulletins
-- À exécuter dans Supabase > SQL Editor avec un compte autorisé.
-- Ne jamais utiliser ni exposer service_role dans le frontend.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  name text not null,
  code text,
  coefficient numeric(5,2) not null default 1 check (coefficient > 0),
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  term text not null default 'Trimestre 1' check (term in ('Trimestre 1','Trimestre 2','Trimestre 3','Semestre 1','Semestre 2')),
  max_score numeric(6,2) not null default 20 check (max_score > 0),
  assessment_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(6,2) check (score >= 0),
  comment text,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create index if not exists idx_assessments_class_term on public.assessments(school_id, class_id, term);
create index if not exists idx_grades_student on public.grades(school_id, student_id);

alter table public.subjects enable row level security;
alter table public.assessments enable row level security;
alter table public.grades enable row level security;

drop policy if exists subjects_member on public.subjects;
create policy subjects_member on public.subjects for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));

drop policy if exists assessments_member on public.assessments;
create policy assessments_member on public.assessments for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));

drop policy if exists grades_member on public.grades;
create policy grades_member on public.grades for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
