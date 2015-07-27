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
  `
}

export default SQL
