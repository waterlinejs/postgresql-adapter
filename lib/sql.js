const SQL = {

  constraints: `
    select
      pg_attribute.attname as column_name,

      case pg_constraint.contype
        when 'p' then true
        else false
      end as primary_key,

      case pg_constraint.contype
        when 'u' then true
        when 'p' then true
        else false
      end as unique

    from
      pg_constraint

    inner join pg_attribute on (pg_attribute.attnum = any (pg_constraint.conkey))
    inner join pg_class on (pg_class.oid = pg_attribute.attrelid)

    where pg_class.relname = ?
  `,

  indexes: `
    select
      pg_attribute.attname as column_name,
      true as indexed

    from
      pg_index

    inner join pg_attribute on (pg_attribute.attnum = any (pg_index.indkey) and pg_attribute.attrelid = pg_index.indrelid)
    inner join pg_class on (pg_class.oid = pg_index.indrelid)

    where pg_class.relname = ?
  `
}

export default SQL
