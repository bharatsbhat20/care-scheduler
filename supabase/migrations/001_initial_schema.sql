-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('elder', 'caregiver', 'family', 'admin')),
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ELDER PROFILES
-- ============================================================
create table public.elder_profiles (
  id uuid primary key default uuid_generate_v4(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  room_unit text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(elder_id)
);

-- ============================================================
-- MEDICATIONS
-- ============================================================
create table public.medications (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  dosage text not null,
  unit text not null default 'mg',
  instructions text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MEDICATION SCHEDULES
-- ============================================================
create table public.medication_schedules (
  id uuid primary key default uuid_generate_v4(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  times text[] not null default '{}',
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}',
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MEDICATION LOGS
-- ============================================================
create table public.medication_logs (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_time timestamptz not null,
  taken_at timestamptz,
  status text not null check (status in ('taken', 'missed', 'skipped')),
  notes text,
  logged_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
create table public.appointments (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('medical', 'therapy', 'family_visit', 'activity', 'other')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  due_date timestamptz,
  priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
  status text not null check (status in ('todo', 'in_progress', 'done')) default 'todo',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TASK ASSIGNMENTS
-- ============================================================
create table public.task_assignments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(task_id, caregiver_id)
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
create table public.notification_prefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  medication_reminders boolean not null default true,
  appointment_reminders boolean not null default true,
  task_updates boolean not null default true,
  family_updates boolean not null default true,
  reminder_minutes_before integer not null default 30,
  push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CAREGIVER → ELDER ASSIGNMENTS
-- ============================================================
create table public.caregiver_elder_assignments (
  id uuid primary key default uuid_generate_v4(),
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(caregiver_id, elder_id)
);

create table public.family_elder_links (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  elder_id uuid not null references public.profiles(id) on delete cascade,
  relationship text,
  linked_at timestamptz not null default now(),
  unique(family_id, elder_id)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profiles_updated before update on public.profiles
  for each row execute procedure public.handle_updated_at();
create trigger on_elder_profiles_updated before update on public.elder_profiles
  for each row execute procedure public.handle_updated_at();
create trigger on_medications_updated before update on public.medications
  for each row execute procedure public.handle_updated_at();
create trigger on_medication_schedules_updated before update on public.medication_schedules
  for each row execute procedure public.handle_updated_at();
create trigger on_appointments_updated before update on public.appointments
  for each row execute procedure public.handle_updated_at();
create trigger on_tasks_updated before update on public.tasks
  for each row execute procedure public.handle_updated_at();
create trigger on_notification_prefs_updated before update on public.notification_prefs
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'elder')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.elder_profiles enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_logs enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.caregiver_elder_assignments enable row level security;
alter table public.family_elder_links enable row level security;

-- Helper: get current user role
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: check if caregiver assigned to elder
create or replace function public.caregiver_assigned_to(p_elder_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.caregiver_elder_assignments
    where caregiver_id = auth.uid() and elder_id = p_elder_id
  );
$$;

-- Helper: check if family linked to elder
create or replace function public.family_linked_to(p_elder_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.family_elder_links
    where family_id = auth.uid() and elder_id = p_elder_id
  );
$$;

-- PROFILES policies
create policy "Users can read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Admins read all profiles" on public.profiles
  for select using (public.get_my_role() = 'admin');
create policy "Caregivers read elder profiles they serve" on public.profiles
  for select using (public.caregiver_assigned_to(id));
create policy "Family reads linked elder profiles" on public.profiles
  for select using (public.family_linked_to(id));
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid());
create policy "Admins update all profiles" on public.profiles
  for all using (public.get_my_role() = 'admin');

-- ELDER_PROFILES policies
create policy "Elders read own elder_profile" on public.elder_profiles
  for select using (elder_id = auth.uid());
create policy "Caregivers read assigned elder_profiles" on public.elder_profiles
  for select using (public.caregiver_assigned_to(elder_id));
create policy "Family reads linked elder_profiles" on public.elder_profiles
  for select using (public.family_linked_to(elder_id));
create policy "Admins manage all elder_profiles" on public.elder_profiles
  for all using (public.get_my_role() = 'admin');
create policy "Caregivers update assigned elder_profiles" on public.elder_profiles
  for update using (public.caregiver_assigned_to(elder_id));

-- MEDICATIONS policies
create policy "Elders read own medications" on public.medications
  for select using (
    exists (select 1 from public.medication_schedules ms where ms.medication_id = id and ms.elder_id = auth.uid())
  );
create policy "Caregivers manage medications" on public.medications
  for all using (public.get_my_role() in ('caregiver', 'admin'));
create policy "Family reads medications" on public.medications
  for select using (public.get_my_role() = 'family');

-- MEDICATION_SCHEDULES policies
create policy "Elders read own schedules" on public.medication_schedules
  for select using (elder_id = auth.uid());
create policy "Caregivers manage assigned elder schedules" on public.medication_schedules
  for all using (public.caregiver_assigned_to(elder_id) or public.get_my_role() = 'admin');
create policy "Family reads linked elder schedules" on public.medication_schedules
  for select using (public.family_linked_to(elder_id));

-- MEDICATION_LOGS policies
create policy "Elders read own logs" on public.medication_logs
  for select using (elder_id = auth.uid());
create policy "Elders insert own logs" on public.medication_logs
  for insert with check (elder_id = auth.uid());
create policy "Caregivers manage assigned elder logs" on public.medication_logs
  for all using (public.caregiver_assigned_to(elder_id) or public.get_my_role() = 'admin');
create policy "Family reads linked elder logs" on public.medication_logs
  for select using (public.family_linked_to(elder_id));

-- APPOINTMENTS policies
create policy "Elders read own appointments" on public.appointments
  for select using (elder_id = auth.uid());
create policy "Caregivers manage assigned elder appointments" on public.appointments
  for all using (public.caregiver_assigned_to(elder_id) or public.get_my_role() = 'admin');
create policy "Family reads linked elder appointments" on public.appointments
  for select using (public.family_linked_to(elder_id));

-- TASKS policies
create policy "Caregivers manage tasks for assigned elders" on public.tasks
  for all using (public.caregiver_assigned_to(elder_id) or public.get_my_role() = 'admin');
create policy "Elders read own tasks" on public.tasks
  for select using (elder_id = auth.uid());
create policy "Family reads linked elder tasks" on public.tasks
  for select using (public.family_linked_to(elder_id));

-- TASK_ASSIGNMENTS policies
create policy "Caregivers read own assignments" on public.task_assignments
  for select using (caregiver_id = auth.uid());
create policy "Admins manage all task_assignments" on public.task_assignments
  for all using (public.get_my_role() = 'admin');

-- NOTIFICATION_PREFS policies
create policy "Users manage own notification prefs" on public.notification_prefs
  for all using (user_id = auth.uid());

-- CAREGIVER_ELDER_ASSIGNMENTS policies
create policy "Admins manage caregiver_elder_assignments" on public.caregiver_elder_assignments
  for all using (public.get_my_role() = 'admin');
create policy "Caregivers read own assignments" on public.caregiver_elder_assignments
  for select using (caregiver_id = auth.uid());

-- FAMILY_ELDER_LINKS policies
create policy "Admins manage family_elder_links" on public.family_elder_links
  for all using (public.get_my_role() = 'admin');
create policy "Family reads own links" on public.family_elder_links
  for select using (family_id = auth.uid());
