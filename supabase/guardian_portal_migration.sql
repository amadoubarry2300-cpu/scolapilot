-- ScolaPilot · migration Portail parent
-- À exécuter après communication_migration.sql.

alter table public.guardians add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists idx_guardians_user_unique on public.guardians(user_id) where user_id is not null;
create index if not exists idx_guardians_email on public.guardians(lower(email));

create or replace function public.claim_guardian_account()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  guardian_id uuid;
  current_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null or current_email = '' then
    return null;
  end if;

  select id into guardian_id from public.guardians where user_id = auth.uid() limit 1;
  if guardian_id is not null then
    return guardian_id;
  end if;

  update public.guardians
  set user_id = auth.uid()
  where lower(email) = current_email
    and user_id is null
  returning id into guardian_id;

  return guardian_id;
end;
$$;

grant execute on function public.claim_guardian_account() to authenticated;

-- Un parent lié peut consulter uniquement les informations de ses propres enfants.
drop policy if exists guardians_parent_select on public.guardians;
create policy guardians_parent_select on public.guardians for select using (user_id = auth.uid());

drop policy if exists student_guardians_parent_select on public.student_guardians;
create policy student_guardians_parent_select on public.student_guardians for select using (exists (select 1 from public.guardians g where g.id = guardian_id and g.user_id = auth.uid()));

drop policy if exists students_parent_select on public.students;
create policy students_parent_select on public.students for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = students.id and g.user_id = auth.uid()));

drop policy if exists enrollments_parent_select on public.enrollments;
create policy enrollments_parent_select on public.enrollments for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = enrollments.student_id and g.user_id = auth.uid()));

drop policy if exists fees_parent_select on public.fee_assignments;
create policy fees_parent_select on public.fee_assignments for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = fee_assignments.student_id and g.user_id = auth.uid()));

drop policy if exists payments_parent_select on public.payments;
create policy payments_parent_select on public.payments for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = payments.student_id and g.user_id = auth.uid()));

drop policy if exists attendance_parent_select on public.attendance_records;
create policy attendance_parent_select on public.attendance_records for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = attendance_records.student_id and g.user_id = auth.uid()));

drop policy if exists grades_parent_select on public.grades;
create policy grades_parent_select on public.grades for select using (exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = grades.student_id and g.user_id = auth.uid()));

drop policy if exists assessments_parent_select on public.assessments;
create policy assessments_parent_select on public.assessments for select using (exists (select 1 from public.guardians g where g.user_id = auth.uid() and g.school_id = assessments.school_id));

drop policy if exists subjects_parent_select on public.subjects;
create policy subjects_parent_select on public.subjects for select using (exists (select 1 from public.guardians g where g.user_id = auth.uid() and g.school_id = subjects.school_id));
