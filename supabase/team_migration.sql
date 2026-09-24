-- ScolaPilot · migration Équipe & invitations
-- À exécuter dans Supabase > SQL Editor.

create table if not exists public.school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  role text not null default 'teacher' check (role in ('director','accountant','secretary','teacher')),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_invitations_school on public.school_invitations(school_id, created_at desc);
create index if not exists idx_school_invitations_token on public.school_invitations(token);

alter table public.school_invitations enable row level security;

drop policy if exists school_invitations_select_member on public.school_invitations;
create policy school_invitations_select_member on public.school_invitations
for select using (public.is_school_member(school_id));

drop policy if exists school_invitations_insert_owner on public.school_invitations;
create policy school_invitations_insert_owner on public.school_invitations
for insert with check (public.is_school_owner(school_id) and invited_by = auth.uid());

create or replace function public.accept_school_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.school_invitations;
  current_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select * into invitation
  from public.school_invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = current_email
  for update;

  if not found then
    raise exception 'Invitation invalide, expirée ou adresse différente';
  end if;

  insert into public.school_members(school_id, user_id, role)
  values (invitation.school_id, auth.uid(), invitation.role)
  on conflict (school_id, user_id) do update set role = excluded.role;

  update public.school_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.school_id;
end;
$$;

grant execute on function public.accept_school_invitation(uuid) to authenticated;
