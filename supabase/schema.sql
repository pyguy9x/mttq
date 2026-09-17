-- KPI MTTQ: 3 bảng độc lập (giữ nguyên field đang dùng ở project gốc).
create table if not exists public.mttq_kpi_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text, unit text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.mttq_kpi_catalog (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.mttq_kpi_tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.mttq_kpi_people(id),
  task_name text, assigner text, deadline date,
  outcome text, product text,
  quality_errors integer default 0, level integer default 1,
  conversion_factor numeric default 1,
  quantity_score numeric, quality_score numeric, progress_score numeric,
  converted_score numeric,
  kpi_axis text, note text, report_status text,
  task_month integer, task_quarter integer, task_year integer,
  person_name text, source_sheet text, source_row integer,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.mttq_kpi_people enable row level security;
alter table public.mttq_kpi_catalog enable row level security;
alter table public.mttq_kpi_tasks enable row level security;
drop policy if exists "mttq_kpi_all" on public.mttq_kpi_people;
drop policy if exists "mttq_kpi_all" on public.mttq_kpi_catalog;
drop policy if exists "mttq_kpi_all" on public.mttq_kpi_tasks;
create policy "mttq_kpi_all" on public.mttq_kpi_people for all using (true) with check (true);
create policy "mttq_kpi_all" on public.mttq_kpi_catalog for all using (true) with check (true);
create policy "mttq_kpi_all" on public.mttq_kpi_tasks for all using (true) with check (true);
