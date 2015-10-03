const SQL = {

  indexes: `
    select
      attname as column_name,
      indisprimary as primary_key,
      indisunique as unique,
      true as indexed

    from
      pg_index

    inner join pg_attribute
      on (pg_attribute.attnum = any (pg_index.indkey) and pg_attribute.attrelid = pg_index.indrelid)
    inner join pg_class
      on (pg_class.oid = pg_index.indrelid)

    where
      pg_class.relname = ?
  `,

  storedProcedures: `
    select n.nspname as schema,
      p.proname as name,
      pg_catalog.pg_get_function_result(p.oid) as returntype,
      pg_catalog.pg_get_function_arguments(p.oid) as signature

    from pg_catalog.pg_proc p

    left join pg_catalog.pg_namespace n on n.oid = p.pronamespace

    where
      pg_catalog.pg_function_is_visible(p.oid)
      and n.nspname not in ('pg_catalog', 'information_schema')
      and p.proname not like '\\_%'
    order by schema, name
  `
}

export default SQL
