-- ScolaPilot · migration permissions par rôle
-- À exécuter après team_migration.sql dans Supabase > SQL Editor.

create or replace function public.has_school_role(target_school_id uuid, allowed_roles text[])
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
      and sm.role = any(allowed_roles)
  );
$$;

grant execute on function public.has_school_role(uuid, text[]) to authenticated;

-- Annule les politiques larges et les remplace par des règles de lecture/écriture.
drop policy if exists academic_years_member on public.academic_years;
drop policy if exists levels_member on public.levels;
drop policy if exists classes_member on public.classes;
drop policy if exists guardians_member on public.guardians;
drop policy if exists students_member on public.students;
drop policy if exists student_guardians_member on public.student_guardians;
drop policy if exists enrollments_member on public.enrollments;
drop policy if exists fee_assignments_member on public.fee_assignments;
drop policy if exists payments_member on public.payments;
drop policy if exists attendance_member on public.attendance_records;
drop policy if exists subjects_member on public.subjects;
drop policy if exists assessments_member on public.assessments;
drop policy if exists grades_member on public.grades;
drop policy if exists audit_logs_member on public.audit_logs;
drop policy if exists audit_logs_insert_member on public.audit_logs;
drop policy if exists school_invitations_select_member on public.school_invitations;
drop policy if exists school_invitations_insert_owner on public.school_invitations;

-- Années, niveaux et classes : consultation par l'équipe, configuration par la direction/secrétariat.
create policy academic_years_select on public.academic_years for select using (public.is_school_member(school_id));
create policy academic_years_write on public.academic_years for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));
create policy levels_select on public.levels for select using (public.is_school_member(school_id));
create policy levels_write on public.levels for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));
create policy classes_select on public.classes for select using (public.is_school_member(school_id));
create policy classes_write on public.classes for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));

-- Élèves et familles : écriture par direction/secrétariat, lecture pour l'équipe pédagogique.
create policy guardians_select on public.guardians for select using (public.is_school_member(school_id));
create policy guardians_write on public.guardians for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));
create policy students_select on public.students for select using (public.is_school_member(school_id));
create policy students_write on public.students for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));
create policy student_guardians_select on public.student_guardians for select using (exists (select 1 from public.students s where s.id = student_id and public.is_school_member(s.school_id)));
create policy student_guardians_write on public.student_guardians for all using (exists (select 1 from public.students s where s.id = student_id and public.has_school_role(s.school_id, array['owner','director','secretary']))) with check (exists (select 1 from public.students s where s.id = student_id and public.has_school_role(s.school_id, array['owner','director','secretary'])));
create policy enrollments_select on public.enrollments for select using (public.is_school_member(school_id));
create policy enrollments_write on public.enrollments for all using (public.has_school_role(school_id, array['owner','director','secretary'])) with check (public.has_school_role(school_id, array['owner','director','secretary']));

-- Finance : direction et comptabilité uniquement.
create policy fee_assignments_finance_select on public.fee_assignments for select using (public.has_school_role(school_id, array['owner','director','accountant']));
create policy fee_assignments_finance_write on public.fee_assignments for all using (public.has_school_role(school_id, array['owner','director','accountant'])) with check (public.has_school_role(school_id, array['owner','director','accountant']));
create policy payments_finance_select on public.payments for select using (public.has_school_role(school_id, array['owner','director','accountant']));
create policy payments_finance_write on public.payments for all using (public.has_school_role(school_id, array['owner','director','accountant'])) with check (public.has_school_role(school_id, array['owner','director','accountant']));

-- Vie scolaire : consultation par l'équipe, saisie par enseignants/secrétariat/direction.
create policy attendance_select on public.attendance_records for select using (public.is_school_member(school_id));
create policy attendance_write on public.attendance_records for all using (public.has_school_role(school_id, array['owner','director','secretary','teacher'])) with check (public.has_school_role(school_id, array['owner','director','secretary','teacher']));

-- Notes : consultation et saisie par direction et enseignants.
create policy subjects_select on public.subjects for select using (public.is_school_member(school_id));
create policy subjects_write on public.subjects for all using (public.has_school_role(school_id, array['owner','director','teacher'])) with check (public.has_school_role(school_id, array['owner','director','teacher']));
create policy assessments_select on public.assessments for select using (public.is_school_member(school_id));
create policy assessments_write on public.assessments for all using (public.has_school_role(school_id, array['owner','director','teacher'])) with check (public.has_school_role(school_id, array['owner','director','teacher']));
create policy grades_select on public.grades for select using (public.is_school_member(school_id));
create policy grades_write on public.grades for all using (public.has_school_role(school_id, array['owner','director','teacher'])) with check (public.has_school_role(school_id, array['owner','director','teacher']));

-- Journal : lecture direction, écriture pour tout membre authentifié.
create policy audit_logs_select_director on public.audit_logs for select using (public.has_school_role(school_id, array['owner','director']));
create policy audit_logs_insert_member on public.audit_logs for insert with check (public.is_school_member(school_id) and user_id = auth.uid());

-- Équipe et invitations : gestion par propriétaire/directeur.
create policy school_invitations_select_director on public.school_invitations for select using (public.has_school_role(school_id, array['owner','director']));
create policy school_invitations_insert_director on public.school_invitations for insert with check (public.has_school_role(school_id, array['owner','director']) and invited_by = auth.uid());
