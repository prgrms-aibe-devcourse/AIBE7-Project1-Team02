begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'profile_completed'
  ) then
    alter table public.users
      add column profile_completed boolean not null default false;

    update public.users
    set profile_completed = true;
  end if;
end;
$$;

comment on column public.users.profile_completed is
  '소셜 로그인 최초 프로필 설정 완료 여부';

commit;
