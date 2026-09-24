-- ScolaPilot · schéma initial Supabase
-- Burkina Faso / Afrique de l'Ouest
-- À exécuter dans Supabase > SQL Editor.
-- Ne jamais exposer la clé service_role dans le navigateur.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  phone text,
  logo_url text,
  currency text not null default 'XOF',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('owner','director','accountant','secretary','teacher')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  category text not null check (category in ('preschool','primary','postprimary','secondary')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name text not null,
  section text,
  room text,
  capacity integer,
  created_at timestamptz not null default now(),
  unique (school_id, academic_year_id, name)
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  phone text,
  whatsapp text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_number text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('female','male','other')),
  photo_url text,
  status text not null default 'active' check (status in ('active','transferred','left','alumni')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_number)
);

create table if not exists public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  primary key (student_id, guardian_id)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  enrolled_on date not null default current_date,
  status text not null default 'active' check (status in ('active','completed','transferred','cancelled')),
  created_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);

create table if not exists public.fee_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  label text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  fee_assignment_id uuid references public.fee_assignments(id) on delete set null,
  receipt_number text not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','orange_money','moov_money','telecel_money','bank_transfer','cheque','other')),
  reference text,
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, receipt_number)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','excused')),
  note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Index utiles
create index if not exists idx_school_members_user on public.school_members(user_id);
create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_students_name on public.students(school_id, last_name, first_name);
create index if not exists idx_enrollments_class on public.enrollments(school_id, class_id, academic_year_id);
create index if not exists idx_payments_school_date on public.payments(school_id, paid_at desc);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_attendance_class_date on public.attendance_records(school_id, class_id, attendance_date);
create index if not exists idx_assessments_class_term on public.assessments(school_id, class_id, term);
create index if not exists idx_grades_student on public.grades(school_id, student_id);

-- Fonctions de sécurité RLS
create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_members sm
    where sm.school_id = target_school_id and sm.user_id = auth.uid()
  );
$$;

create or replace function public.is_school_owner(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_members sm
    where sm.school_id = target_school_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner','director')
  );
$$;

-- Création d'une école et de ses niveaux par défaut.
-- La fonction évite de laisser l'utilisateur créer une école sans membre propriétaire.
create or replace function public.create_school_with_defaults(
  p_name text,
  p_city text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
  declare
    new_school_id uuid;
    current_year text := extract(year from current_date)::text || ' — ' || (extract(year from current_date)::integer + 1)::text;
  begin
    if auth.uid() is null then
      raise exception 'Authentification requise';
    end if;

    insert into public.schools(name, city, phone, created_by)
    values (trim(p_name), nullif(trim(p_city), ''), nullif(trim(p_phone), ''), auth.uid())
    returning id into new_school_id;

    insert into public.school_members(school_id, user_id, role)
    values (new_school_id, auth.uid(), 'owner');

    insert into public.academic_years(school_id, name, is_current)
    values (new_school_id, current_year, true);

    insert into public.levels(school_id, name, category, sort_order) values
      (new_school_id, 'Petite section', 'preschool', 10),
      (new_school_id, 'Moyenne section', 'preschool', 20),
      (new_school_id, 'Grande section', 'preschool', 30),
      (new_school_id, 'CP1', 'primary', 40),
      (new_school_id, 'CP2', 'primary', 50),
      (new_school_id, 'CE1', 'primary', 60),
      (new_school_id, 'CE2', 'primary', 70),
      (new_school_id, 'CM1', 'primary', 80),
      (new_school_id, 'CM2', 'primary', 90),
      (new_school_id, '6e', 'postprimary', 100),
      (new_school_id, '5e', 'postprimary', 110),
      (new_school_id, '4e', 'postprimary', 120),
      (new_school_id, '3e', 'postprimary', 130),
      (new_school_id, '2nde', 'secondary', 140),
      (new_school_id, '1ère', 'secondary', 150),
      (new_school_id, 'Tle', 'secondary', 160);

    return new_school_id;
  end;
$$;

grant execute on function public.create_school_with_defaults(text, text, text) to authenticated;

-- RLS
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_members enable row level security;
alter table public.academic_years enable row level security;
alter table public.levels enable row level security;
alter table public.classes enable row level security;
alter table public.guardians enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.enrollments enable row level security;
alter table public.fee_assignments enable row level security;
alter table public.payments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.subjects enable row level security;
alter table public.assessments enable row level security;
alter table public.grades enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles : chaque utilisateur ne lit et ne modifie que son profil.
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Écoles
create policy schools_select_member on public.schools for select using (created_by = auth.uid() or public.is_school_member(id));
create policy schools_update_owner on public.schools for update using (public.is_school_owner(id)) with check (public.is_school_owner(id));

-- Membres : lecture par membre, invitation par propriétaire/directeur.
create policy school_members_select on public.school_members for select using (public.is_school_member(school_id));
create policy school_members_insert_owner on public.school_members for insert with check (public.is_school_owner(school_id));
create policy school_members_update_owner on public.school_members for update using (public.is_school_owner(school_id));
create policy school_members_delete_owner on public.school_members for delete using (public.is_school_owner(school_id));

-- Tables liées à une école.
create policy academic_years_member on public.academic_years for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy levels_member on public.levels for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy classes_member on public.classes for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy guardians_member on public.guardians for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy students_member on public.students for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy student_guardians_member on public.student_guardians for all using (
  exists (select 1 from public.students s where s.id = student_id and public.is_school_member(s.school_id))
) with check (
  exists (select 1 from public.students s where s.id = student_id and public.is_school_member(s.school_id))
);
create policy enrollments_member on public.enrollments for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy fee_assignments_member on public.fee_assignments for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy payments_member on public.payments for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy attendance_member on public.attendance_records for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy subjects_member on public.subjects for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy assessments_member on public.assessments for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy grades_member on public.grades for all using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy audit_logs_member on public.audit_logs for select using (public.is_school_member(school_id));
create policy audit_logs_insert_member on public.audit_logs for insert with check (public.is_school_member(school_id));

-- Création/mise à jour automatique du profil Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.phone, new.raw_user_meta_data->>'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Vue de synthèse des paiements par élève.
-- security_invoker force la vue à respecter les RLS des tables sous-jacentes.
create or replace view public.student_balance_summary
with (security_invoker = true)
as
select
  s.id as student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  coalesce(sum(fa.amount - fa.discount), 0)::numeric as assigned_amount,
  coalesce((select sum(p.amount) from public.payments p where p.student_id = s.id), 0)::numeric as paid_amount,
  coalesce(sum(fa.amount - fa.discount), 0)::numeric - coalesce((select sum(p.amount) from public.payments p where p.student_id = s.id), 0)::numeric as balance_amount
from public.students s
left join public.fee_assignments fa on fa.student_id = s.id
group by s.id, s.school_id, s.first_name, s.last_name;
