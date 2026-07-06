create table if not exists public.guest_invites (
  id uuid primary key,
  code text not null unique,
  name text not null,
  email text not null default '',
  plus_ones integer not null default 0,
  bringing_dish text not null default '',
  favorite_thing text not null default '',
  icebreaker_answer text not null default '',
  trivia_answer_one text not null default '',
  trivia_answer_two text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_entries (
  id uuid primary key,
  src text not null,
  caption text not null,
  created_at timestamptz not null default now()
);

alter table public.guest_invites enable row level security;
alter table public.gallery_entries enable row level security;

drop policy if exists "public read guest invites" on public.guest_invites;
drop policy if exists "public insert guest invites" on public.guest_invites;
drop policy if exists "public update guest invites" on public.guest_invites;
drop policy if exists "public read gallery entries" on public.gallery_entries;
drop policy if exists "public insert gallery entries" on public.gallery_entries;

create policy "public read guest invites"
  on public.guest_invites
  for select
  using (true);

create policy "public insert guest invites"
  on public.guest_invites
  for insert
  with check (true);

create policy "public update guest invites"
  on public.guest_invites
  for update
  using (true)
  with check (true);

create policy "public read gallery entries"
  on public.gallery_entries
  for select
  using (true);

create policy "public insert gallery entries"
  on public.gallery_entries
  for insert
  with check (true);
