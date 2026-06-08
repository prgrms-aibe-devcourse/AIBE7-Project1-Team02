begin;

alter table public.destinations
  drop column if exists average_budget;

alter table public.trips
  drop column if exists budget;

commit;
