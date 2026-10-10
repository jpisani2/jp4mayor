-- Dinner Decider — personal data only. Restaurant data lives in data/restaurants.json in the repo.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  restaurant_id text not null,                          -- id from data/restaurants.json
  visited_on    date not null default current_date,
  mode          text not null default 'dine_in' check (mode in ('dine_in','carry_out','delivery')),
  rating        smallint check (rating between 1 and 5),
  notes         text,
  would_return  boolean,
  created_at    timestamptz not null default now()
);
create index if not exists visits_user_restaurant on public.visits (user_id, restaurant_id, visited_on desc);

create table if not exists public.dishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  visit_id    uuid not null references public.visits on delete cascade,
  name        text not null,
  rating      smallint check (rating between 1 and 5),
  notes       text,
  order_again boolean,
  created_at  timestamptz not null default now()
);
create index if not exists dishes_visit on public.dishes (visit_id);

create table if not exists public.prefs (
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  restaurant_id text not null,
  favorite      boolean not null default false,
  hidden        boolean not null default false,
  my_tags       text[] not null default '{}',
  notes         text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data    jsonb not null default '{}'
);

-- Row Level Security: every row belongs to the signed-in user, nobody else can see or touch it.
alter table public.visits   enable row level security;
alter table public.dishes   enable row level security;
alter table public.prefs    enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['visits','dishes','prefs','settings'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- A dish may only hang off one of your own visits.
create or replace function public.dish_visit_owner() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.visits v where v.id = new.visit_id and v.user_id = new.user_id) then
    raise exception 'visit not found';
  end if;
  return new;
end $$;
drop trigger if exists dish_visit_owner on public.dishes;
create trigger dish_visit_owner before insert or update on public.dishes
  for each row execute function public.dish_visit_owner();
