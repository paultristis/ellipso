create table profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique not null references auth.users(id) on delete cascade
    username text unique,
    display_name text,
    avatar_url text,
    created_at timestamptz default now()
);

create table workspaces (
    id uuid primary key default gen_random_uuid(),
    owner_profile_id uuid references profiles(id) not null,
    title text default 'Untitled',
    created_at timestamptz default now()
);

create table assets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) not null,
    owner_profile_id uuid references profiles(id) not null,
    title text,
    description text,
    source text not null,
    file_path text not null,
    original_file_path text,
    px_w integer,
    px_h integer,
    original_px_w integer,
    original_px_h integer,
    in_per_px double precision,
    base_in_per_px double precision,
    scale_raw text,
    w_in double precision,
    h_in double precision,
    x double precision,
    y double precision,
    rotation_deg double precision,
    crop_px jsonb,
    bg_removed boolean default false,
    tint_color text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);