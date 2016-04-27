import _ from 'lodash'
import Adapter from './adapter'
import CriteriaParser from 'waterline-sequel/sequel/lib/criteriaProcessor'
import SpatialUtil from './spatial'
import Procedures from './procedures'
import knex from 'knex'

const Util = {

  PG_MAX_INT: 2147483647,

  initializeConnection (cxn) {
    return Adapter.getVersion(cxn)
      .then(version => {
        cxn.version = Util.validateVersion(version)

        return Procedures.describeAll(cxn)
      })
      .then(procedures => {
        cxn.storedProcedures = procedures
      })
  },

  getTransaction (txn, query) {
    if (Util.isTransaction(txn)) {
      return txn
    }
    else {
      return query
    }
  },

  isTransaction (txn) {
    return txn && _.isFunction(txn.commit)
  },


  /**
   * Apply a primary key constraint to a table
   *
   * @param table - a knex table object
   * @param definition - a waterline attribute definition
   */
  applyPrimaryKeyConstraints (table, definition) {
    let primaryKeys = _.keys(_.pickBy(definition, attribute => {
      return attribute.primaryKey
    }))

    if (!primaryKeys.length) return

    return table.primary(primaryKeys)
  },

  applyCompositeUniqueConstraints (table, definition) {
    _.each(definition, (attribute, name) => {
      let uniqueDef = attribute.unique || { }
      if (attribute.primaryKey) return
      if (_.isEmpty(uniqueDef)) return
      if (!_.isArray(uniqueDef.composite)) return

      let uniqueKeys = _.uniq([ name, ...uniqueDef.composite ])

      table.unique(uniqueKeys)
    })
  },

  applyEnumConstraints (table, definition) {
    _.each(definition, (attribute, name) => {
      if (_.isArray(attribute.enum)) {
        table.enu(name, attribute.enum)
      }
    })
  },

  applyTableConstraints (table, definition) {
    return Promise.all([
      Util.applyPrimaryKeyConstraints(table, definition),
      Util.applyCompositeUniqueConstraints(table, definition),
      //Util.applyEnumConstraints(table, definition)
    ])
  },

  applyColumnConstraints (column, definition) {
    if (_.isString(definition)) {
      return
    }
    return _.map(definition, (value, key) => {
      if (key == 'defaultsTo' && definition.autoIncrement && value == 'AUTO_INCREMENT') {
        return
      }

      return Util.applyParticularColumnConstraint(column, key, value, definition)
    })
  },

  /**
   * Apply value constraints to a particular column
   */
  applyParticularColumnConstraint (column, constraintName, value, definition) {
    if (!value) return

    switch (constraintName) {

      case 'index':
        return column.index(_.get(value, 'indexName'), _.get(value, 'indexType'))

      /**
       * Acceptable forms:
       * attr: { unique: true }
       * attr: {
       *   unique: {
       *     unique: true, // or false
       *     composite: [ 'otherAttr' ]
       *   }
       * }
       */
      case 'unique':
        if ((value === true || _.get(value, 'unique') === true) && !definition.primaryKey) {
          column.unique()
        }
        return

      case 'notNull':
        return column.notNullable()

      case 'defaultsTo':
        if (_.isArray(value) && definition.type == 'array') {
          return column.defaultTo('{' + value.join(',') + '}')
        }
        if (!_.isFunction(value)) {
          return column.defaultTo(value)
        }

          /*
           * TODO
      case 'comment':
        return table.comment(attr.comment || attr.description)
        */

      case 'primaryKey':
      case 'autoIncrement':
        if (definition.dbType == 'uuid') {
          return column.defaultTo(knex.raw('uuid_generate_v4()'))
        }
    }
  },



  /**
   * Create a column for Knex from a Waterline attribute definition
   */
  toKnexColumn (table, _name, attrDefinition, wlModel, schema) {
    let attr = _.isObject(attrDefinition) ? attrDefinition : { type: attrDefinition }
    let type = attr.autoIncrement ? 'serial' : attr.type
    let name = attr.columnName || _name

    if (_.includes(wlModel.meta.uuids, _name) && !wlModel.meta.junctionTable) {
      wlModel._attributes[_name].type = 'uuid'
      wlModel.definition[_name].type = 'uuid'
      wlModel._cast._types[_name] = 'uuid'

      type = 'uuid'
    }

    if (attrDefinition.foreignKey && attrDefinition.model) {
      const refModel = schema[attrDefinition.model]
      try {
        const fpk = Adapter.getPrimaryKey({ collections: schema }, attrDefinition.model)
        if (_.includes(refModel.meta.uuids, fpk) && !refModel.meta.junctionTable) {
          type = 'uuid'
        }
      }
      catch (e) { }
    }

    // set key types for m2m
    if (attrDefinition.foreignKey && attrDefinition.references && attrDefinition.on) {
      try {
        type = schema[attrDefinition.references].attributes[attrDefinition.on].type
      }
      catch (e) { }
    }

    /**
     * Perform a special check for ENUM. ENUM is both a type and a constraint.
     *
     * table.enu(col, values)
     * Adds a enum column, (aliased to enu, as enum is a reserved word in javascript).
     */
    if (_.isArray(attr.enum)) {
      return table.enu(name, attr.enum)
    }

    switch (attr.dbType || type.toLowerCase()) {
      /**
       * table.text(name, [textType])
       * Adds a text column, with optional textType for MySql text datatype preference.
       * textType may be mediumtext or longtext, otherwise defaults to text.
       */
      case 'string':
      case 'text':
      case 'mediumtext':
      case 'longtext':
        return table.text(name, type)

      /**
       * table.string(name, [length])
       * Adds a string column, with optional length defaulting to 255.
       */
      case 'character varying':
        return table.string(name, attr.length)

      case 'serial':
      case 'smallserial':
        return table.specificType(name, 'serial')
      case 'bigserial':
        return table.specificType(name, 'bigserial')

      /**
       * table.boolean(name)
       * Adds a boolean column.
       */
      case 'boolean':
        return table.boolean(name)

      /**
       * table.integer(name)
       * Adds an integer column.
       */
      case 'int':
      case 'integer':
      case 'smallint':
        return table.integer(name)

      /**
       * table.bigInteger(name)
       * In MySQL or PostgreSQL, adds a bigint column, otherwise adds a normal integer.
       * Note that bigint data is returned as a string in queries because JavaScript may
       * be unable to parse them without loss of precision.
       */
      case 'bigint':
      case 'biginteger':
        return table.bigInteger(name)

      /**
       * table.float(column, [precision], [scale])
       * Adds a float column, with optional precision and scale.
       */
      case 'real':
      case 'float':
        return table.float(name, attr.precision, attr.scale)

      case 'double':
        return table.float(name, 15, attr.scale)

      /**
       * table.decimal(column, [precision], [scale])
       * Adds a decimal column, with optional precision and scale.
       */
      case 'decimal':
        return table.decimal(name, attr.precision, attr.scale)

      /**
       * table.time(name)
       * Adds a time column.
       */
      case 'time':
        return table.time(name)

      /**
       * table.date(name)
       * Adds a date column.
       */
      case 'date':
        return table.date(name)

      /**
       * table.timestamp(name, [standard])
       * Adds a timestamp column, defaults to timestamptz in PostgreSQL,
       * unless true is passed as the second argument.
       *
       * Note that the method for defaulting to the current datetime varies from one
       * database to another. For example: PostreSQL requires .defaultTo(knex.raw('now()')),
       * but SQLite3 requires .defaultTo(knex.raw("date('now')")).
       */
      case 'datestamp':
      case 'datetime':
        return table.timestamp(name, attr.standard)

      case 'array':
        return table.specificType(name, 'text ARRAY')

      /**
       * table.json(name, [jsonb])
       * Adds a json column, using the built-in json type in postgresql,
       * defaulting to a text column in older versions of postgresql or in unsupported databases.
       * jsonb can be used by passing true as the second argument.
       */
      case 'json':
      case 'jsonb':
        return table.jsonb(name)

      case 'binary':
        return table.binary(name)

      /**
       * table.uuid(name)
       * Adds a uuid column - this uses the built-in uuid type in postgresql,
       * and falling back to a char(36) in other databases.
       */
      case 'uuid':
        return table.uuid(name)

      default:
        return table.specificType(name, attr.dbType || type)
    }
  },

  /**
   * Convert a parameterized waterline query into a knex-compatible query string
   */
  toKnexRawQuery (sql) {
    const wlSqlOptions = Adapter.wlSqlOptions

    sql = (sql || '').replace(/\$\d+/g, '?')
    if (_.get(wlSqlOptions, 'wlNext.caseSensitive')) {
      sql = sql.replace(/LOWER\(("\w+"."\w+")\)/ig, '$1')
    }

    return sql
  },

  /**
   * Cast values to the correct type
   */
  castValues (values) {
    return _.map(values, value => {
      if (_.isString(value) && value[0] === '[') {
        let arr = JSON.parse(value)
        if (_.isArray(arr)) {
          return arr
        }
      }

      return value
    })
  },

  castResultRows (rows, schema) {
    if (_.isPlainObject(rows)) {
      return Util.castResultValues(rows, schema)
    }
    else {
      return _.map(rows, row => {
        return Util.castResultValues(row, schema)
      })
    }
  },

  castResultValues (values, schema) {
    return _.mapValues(values, (value, attr) => {
      let definition = schema.definition[attr]
      if (!definition) return value

      if (SpatialUtil.isSpatialColumn(definition)) {
        try {
          return JSON.parse(value)
        }
        catch (e) {
          return null
        }
      }

      if (_.isArray(value)) {
        return _.map(value, (item) => {
          try {
            return JSON.parse(item)
          }
          catch (e) {
            return item
          }
        })
      }

      return value
    })
  },

  sanitize (data, schema, cxn) {
    if (_.isArray(data)) {
      return _.map(data, record => {
        return Util.sanitizeRecord(record, schema, cxn)
      })
    }
    else {
      return Util.sanitizeRecord(data, schema, cxn)
    }
  },

  sanitizeRecord (data, schema, cxn) {
    _.each(data, (value, attr) => {
      let definition = schema.definition[attr]

      // remove unrecognized fields (according to schema) from data
      if (!definition) {
        delete data[attr]
        return
      }

      // remove any autoIncrement fields from data
      if (!definition || definition.autoIncrement) {
        delete data[attr]
      }
      if (SpatialUtil.isSpatialColumn(definition)) {
        data[attr] = SpatialUtil.fromGeojson(data[attr], definition, cxn)
      }
    })

    return data
  },

  /**
   * Construct a knex query that joins one or more tables for populate()
   */
  buildKnexJoinQuery (cxn, tableName, options) {
    let schema = cxn.collections[tableName]
    let pk = Adapter.getPrimaryKey(cxn, tableName)

    let query = cxn.knex
      .select(`${tableName}.*`)
      .select(SpatialUtil.buildSpatialSelect(schema.definition, tableName, cxn))
      .select(cxn.knex.raw(Util.buildSelectAggregationColumns(cxn, options)))
      .from(tableName)
      .where(Util.buildWhereClause(cxn, tableName, options))
      .groupBy(`${tableName}.${pk}`)
      .orderByRaw(Util.buildOrderByClause(tableName, options))
      .limit(options.limit || Util.PG_MAX_INT)
      .offset(options.skip || 0)

    Util.buildKnexJoins(cxn, options, query)

    return query
  },

  addSelectColumns (columns, query) {
    let [ oldSelectClause, fromClause ] = query.split('FROM')
    let newSelectClause = [ oldSelectClause.split(','), ...columns ].join(',')

    return `${newSelectClause} FROM ${fromClause}`
  },

  buildKnexJoins (cxn, { joins }, query) {
    _.each(joins, join => {
      let parentAlias = Util.getParentAlias(join)
      let alias = Util.getSubqueryAlias(join)
      let subquery = Util.buildKnexJoinSubquery(cxn, join)

      query.leftJoin(
        cxn.knex.raw(`(${subquery}) as "${alias}"`),
        `${alias}.${join.childKey}`,
        `${parentAlias}.${join.parentKey}`
      )
    })
  },

  buildKnexJoinSubquery (cxn, { criteria, child }) {
    let schema = cxn.collections[child]

    return cxn.knex
      .select('*')
      .select(SpatialUtil.buildSpatialSelect(schema.definition, child, cxn))
      .from(child)
      .where(Util.buildWhereClause(cxn, child, criteria))
  },

  buildOrderByClause (tableName, { sort }) {
    if (_.isEmpty(sort)) {
      return '1'
    }

    let queryTokens = _.map(sort, (_direction, field) => {
      let direction = _direction === 1 ? '' : 'desc'
      return `"${tableName}"."${field}" ${direction}`
    })
    return queryTokens.join(', ')
  },

  buildWhereClause (cxn, tableName, options) {
    let parser = new CriteriaParser(tableName, cxn.schema, Adapter.wlSqlOptions)
    let { query, values } = parser.read(_.omit(options, [
      'sort', 'limit', 'groupBy', 'skip'
    ]))

    return cxn.knex.raw(Util.toKnexRawQuery(query), Util.castValues(values))
  },

  getJoinAlias ({ alias, parentKey, removeParentKey }) {
    if (alias != parentKey && removeParentKey === true) {
      return parentKey
    }
    else {
      return alias
    }
  },

  getParentAlias (join) {
    if (join.junctionTable) {
      return Util.getJoinAlias(join) + join.parent
    }
    else {
      return join.parent
    }
  },

  getSubqueryAlias (join) {
    return Util.getJoinAlias(join) + join.child
  },

  buildSelectAggregationColumns (cxn, { joins }) {
    return _.map(_.reject(joins, { select: false }), join => {

      let criteria = join.criteria || { }
      let subqueryAlias = Util.getSubqueryAlias(join)
      let asColumn = Util.getJoinAlias(join)
      let orderBy = Util.buildOrderByClause(subqueryAlias, criteria)
      let start = (criteria.skip || 0) + 1
      let end = (criteria.limit || (Util.PG_MAX_INT - start)) + start - 1

      if (!criteria.skip && !criteria.limit) {
        return `json_agg("${subqueryAlias}".* order by ${orderBy}) as "${asColumn}"`
      }

      return `array_to_json((array_agg("${subqueryAlias}".* order by ${orderBy}))[${start}:${end}]) as "${asColumn}"`
    })
  },

  /**
   * Parse and validate a Postgres "select version()" result
   */
  validateVersion ([ major, minor, patch ]) {
    if (major < 9 || (major === 9 && minor < 4)) {
      throw new Error(`
        PostgreSQL ${major}.${minor}.${patch} detected. This adapter requires PostgreSQL 9.4 or higher.
        Please either:
        1. Upgrade your Postgres server to at least 9.4.0 -or-
        2. Use the sails-postgresql adapter instead: https://www.npmjs.com/package/sails-postgresql
      `)
    }

    return parseFloat(`${major}.${minor}`)
  }
}

export default Util
