# Supabase Setup for User Progress

To enable user progress saving and profile statistics, you need to create a table in your Supabase project.

## Table: `user_progress`

Run the following SQL in your Supabase SQL Editor:

```sql
create table public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id)
);

-- Set up Row Level Security (RLS)
alter table public.user_progress enable row level security;

create policy "Users can view their own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);
```

This table keys the progress data by `user_id`, storing the entire progress state as a JSON blob in the `data` column.
