-- ScolaPilot · migration Communication famille
-- À exécuter après le schéma principal dans Supabase > SQL Editor.

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  channel text not null check (channel in ('whatsapp','sms','email','phone')),
  message text not null,
  status text not null default 'opened' check (status in ('opened','sent','failed')),
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communication_school_date on public.communication_logs(school_id, created_at desc);
create index if not exists idx_communication_student on public.communication_logs(student_id);

alter table public.communication_logs enable row level security;

drop policy if exists communication_select_member on public.communication_logs;
create policy communication_select_member on public.communication_logs
for select using (public.is_school_member(school_id));

drop policy if exists communication_insert_member on public.communication_logs;
create policy communication_insert_member on public.communication_logs
for insert with check (public.is_school_member(school_id) and created_by = auth.uid());
