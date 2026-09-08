-- ══════════════════════════════════════════════════════════════════════════
-- Módulo NUBE — Resúmenes rápidos y consistentes (RPC nativos).
-- Reemplaza el escaneo de hasta 20.000 filas en la Edge Function por
-- agregación SQL (GROUP BY) → 1 resultado pequeño por productora.
-- Ejecutar una vez en Supabase (SQL Editor).
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Resumen de EXTENSIONES por productora.
--    Para cada productora: total de registros, fecha más reciente,
--    última modificación y usuario de esa última modificación.
create or replace function public.nube_resumen_extensiones(id_prod text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(row), '[]'::jsonb) into result
  from (
    select e.id_productora,
           max(coalesce(pr.productora, e.productora, '')) as productora,
           count(*)::int                                  as registros,
           max(e.fecha)                                   as fecha,
           max(e.updated_at)                              as ultima_modificacion,
           (array_agg(e.usuario order by e.updated_at desc nulls last))[1] as usuario
    from public.extensiones e
    left join public.productoras pr on pr.id_productora = e.id_productora
    where (id_prod is null or e.id_productora = id_prod)
    group by e.id_productora
  ) row;
  return result;
end $$;

-- 2) Resumen de MASTER por productora.
--    tipo: 'CONFECCION' | 'PROCESOS' | null (todos).
--    PROCESOS = todo lo que NO es 'CONFECCION' (igual que LISTAR_MASTER).
create or replace function public.nube_resumen_master(tipo text default null, id_prod text default null)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(row), '[]'::jsonb) into result
  from (
    select m.id_productora,
           max(coalesce(m.productora, ''))                as productora,
           count(*)::int                                  as registros,
           max(m.updated_at)                              as ultima_modificacion,
           (array_agg(m.usuario order by m.updated_at desc nulls last))[1] as usuario
    from public.master m
    where (tipo is null
           or (tipo = 'CONFECCION' and m.proceso = 'CONFECCION')
           or (tipo = 'PROCESOS'   and m.proceso is distinct from 'CONFECCION'))
      and (id_prod is null or m.id_productora = id_prod)
    group by m.id_productora
  ) row;
  return result;
end $$;

-- 3) Filas recientes de MASTER (para poblar la vista de edición
--    sin hacer escaneos completos desde la Edge Function).
create or replace function public.nube_listar_master(
  tipo   text default null,
  id_prod text default null,
  lim    int  default 1000
)
returns setof public.master
language plpgsql
stable
as $$
begin
  return query
  select m.*
  from public.master m
  where (tipo is null
         or (tipo = 'CONFECCION' and m.proceso = 'CONFECCION')
         or (tipo = 'PROCESOS'   and m.proceso is distinct from 'CONFECCION'))
    and (id_prod is null or m.id_productora = id_prod)
  order by m.updated_at desc nulls last
  limit greatest(coalesce(lim, 1000), 1);
end $$;