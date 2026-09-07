create extension if not exists "pgcrypto";

create table if not exists public.extensiones (
    op                bigint not null,
    referencia        text    not null default '',
    extensiones       jsonb   not null default '[]'::jsonb,
    fecha             timestamptz not null default now(),
    id_productora     text    not null default '',
    productora        text    not null default '',
    usuario           text    not null default '',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    primary key (op, id_productora)
);

alter table public.extensiones add column if not exists id_productora text not null default '';
alter table public.extensiones add column if not exists productora    text not null default '';
alter table public.extensiones add column if not exists usuario       text not null default '';
alter table public.extensiones add column if not exists fecha         timestamptz not null default now();

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'productora'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'id_productora'
    ) then
        alter table public.extensiones rename column productora to id_productora;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'productora_nombre'
    ) then
        alter table public.extensiones rename column productora_nombre to productora;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'fecha_programa'
    ) then
        alter table public.extensiones rename column fecha_programa to fecha;
        alter table public.extensiones alter column fecha type timestamptz using fecha::timestamptz;
        alter table public.extensiones alter column fecha set default now();
        alter table public.extensiones alter column fecha set not null;
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'proveedor'
    ) then
        update public.extensiones set id_productora = proveedor where id_productora = '';
        alter table public.extensiones drop column proveedor;
    end if;
end $$;

alter table public.extensiones drop column if exists observacion;
alter table public.extensiones drop column if exists creado_por;
alter table public.extensiones drop column if exists actualizado_por;
alter table public.extensiones drop column if exists autorizado_por;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'extensiones' and column_name = 'color'
    ) then
        with agrupadas as (
            select referencia, op, id_productora, productora, fecha,
                   jsonb_agg(
                       jsonb_build_object('color', color, 'talla', talla, 'cantidad', cantidad)
                       order by color, talla
                   ) as ext
            from public.extensiones
            group by referencia, op, id_productora, productora, fecha
        )
        update public.extensiones e
        set extensiones = a.ext
        from agrupadas a
        where e.referencia = a.referencia and e.op = a.op;

        alter table public.extensiones drop column if exists color;
        alter table public.extensiones drop column if exists talla;
        alter table public.extensiones drop column if exists cantidad;
    end if;
end $$;

delete from public.extensiones e
using (
    select ctid,
           row_number() over (partition by op, id_productora order by created_at) as rn
    from public.extensiones
) d
where e.ctid = d.ctid and d.rn > 1;

drop index if exists idx_extensiones_op;
drop index if exists idx_extensiones_fecha_prog;
alter table public.extensiones drop constraint if exists uq_extensiones_lote;
alter table public.extensiones drop column if exists id;

do $$
declare
    cons text;
begin
    select conname into cons
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where t.relname = 'extensiones' and n.nspname = 'public' and c.contype = 'p';
    if cons is not null then
        execute format('alter table public.extensiones drop constraint %I', cons);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where t.relname = 'extensiones' and n.nspname = 'public' and c.contype = 'p'
    ) then
        alter table public.extensiones add constraint extensiones_pkey primary key (op, id_productora);
    end if;
end $$;

create index if not exists idx_extensiones_referencia on public.extensiones (referencia);
create index if not exists idx_extensiones_productora on public.extensiones (id_productora);
create index if not exists idx_extensiones_fecha      on public.extensiones (fecha);
create index if not exists idx_extensiones_json       on public.extensiones using gin (extensiones);

alter table public.extensiones enable row level security;

drop policy if exists "extensiones_select_autenticado" on public.extensiones;
create policy "extensiones_select_autenticado" on public.extensiones
    for select to authenticated
    using (true);

revoke all on table public.extensiones from anon;
revoke all on table public.extensiones from public;
grant select on table public.extensiones to authenticated;

create or replace function public.extensiones_touch() returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists tr_extensiones_touch on public.extensiones;
create trigger tr_extensiones_touch
    before insert or update on public.extensiones
    for each row execute function public.extensiones_touch();
