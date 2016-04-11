import Knex from 'knex'
import _ from 'lodash'
import camelize from 'camelize'
import WaterlineSequel from 'waterline-sequel'

import KnexPostgis from 'knex-postgis'
import WaterlineError from 'waterline-errors'
import AdapterError from './error'
import Util from './util'
import SpatialUtil from './spatial'
import SQL from './sql'

const Adapter = {

  identity: 'waterline-postgresql',

  wlSqlOptions: {
    parameterized: true,
    caseSensitive: false,
    escapeCharacter: '"',
    wlNext: {
      caseSensitive: true
    },
    casting: true,
    canReturnValues: true,
    escapeInserts: true,
    declareDeleteAlias: false
  },

  /**
   * Local connections store
   */
  connections: new Map(),

  //pkFormat: 'string',
  syncable: true,

  /**
   * Adapter default configuration
   */
  defaults: {
    schema: true,
    debug: process.env.WL_DEBUG || false,

    connection: {
      host: 'localhost',
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
      port: 5432
    },

    pool: {
      min: 1,
      max: 16,
      ping (knex, cb) {
        return knex.query('SELECT 1', cb)
      },
      pingTimeout: 10 * 1000,
      syncInterval: 2 * 1000,
      idleTimeout: 30 * 1000,
      acquireTimeout: 300 * 1000
    }
  },

  /**
   * This method runs when a connection is initially registered
   * at server-start-time. This is the only required method.
   *
   * @param  {[type]}   connection [description]
   * @param  {[type]}   collection [description]
   * @param  {Function} cb         [description]
   * @return {[type]}              [description]
   */
  registerConnection (connection, collections, cb) {
    if (!connection.identity) {
      return cb(WaterlineError.adapter.IdentityMissing)
    }
    if (Adapter.connections.get(connection.identity)) {
      return cb(WaterlineError.adapter.IdentityDuplicate)
    }

    _.defaultsDeep(connection, Adapter.defaults)

    let knex = Knex({
      client: 'pg',
      connection: connection.url || connection.connection,
      pool: connection.pool,
      debug: process.env.WATERLINE_DEBUG_SQL || connection.debug
    })
    let cxn = {
      identity: connection.identity,
      schema: Adapter.buildSchema(connection, collections),
      collections: collections,
      config: connection,
      knex: knex,
      st: KnexPostgis(knex)
    }

    return Util.initializeConnection(cxn)
      .then(() => {
        Adapter.connections.set(connection.identity, cxn)
        cb()
      })
      .catch(cb)
  },

  /**
   * Construct the waterline schema for the given connection.
   *
   * @param connection
   * @param collections[]
   */
  buildSchema (connection, collections) {
    return _.chain(collections)
      .map((model, modelName) => {
        let definition = _.get(model, [ 'waterline', 'schema', model.identity ])
        return _.defaultsDeep(definition, {
          attributes: { },
          tableName: modelName
        })
      })
      .keyBy('tableName')
      .value()
  },

  /**
   * Return the version of the PostgreSQL server as an array
   * e.g. for Postgres 9.3.9, return [ '9', '3', '9' ]
   */
  getVersion (cxn) {
    return cxn.knex
      .raw('select version() as version')
      .then(({ rows: [row] }) => {
        return row.version.split(' ')[1].split('.')
      })
  },

  /**
   * Describe a table. List all columns and their properties.
   *
   * @param connectionName
   * @param tableName
   */
  describe (connectionName, tableName, cb) {
    let cxn = Adapter.connections.get(connectionName)

    return cxn.knex(tableName).columnInfo()
      .then(columnInfo => {
        if (_.isEmpty(columnInfo)) {
          return cb()
        }

        return Adapter._query(cxn, SQL.indexes, [ tableName ])
          .then(({ rows }) => {
            _.merge(columnInfo, _.keyBy(camelize(rows), 'columnName'))
            _.isFunction(cb) && cb(null, columnInfo)
          })
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Perform a direct SQL query on the database
   *
   * @param connectionName
   * @param tableName
   * @param queryString
   * @param data
   */
  query (connectionName, tableName, queryString, args, cb) {
    let cxn = Adapter.connections.get(connectionName)

    return Adapter._query(cxn, queryString, args)
      .then((result = { }) => {
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb))
  },

  _query (cxn, query, values) {
    return cxn.knex.raw(Util.toKnexRawQuery(query), Util.castValues(values))
      .then((result = { }) => result)
  },

  /**
   * Create a new table
   *
   * @param connectionName
   * @param tableName
   * @param definition - the waterline schema definition for model
   * @param cb
   */
  define (connectionName, _tableName, definition, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let schema = cxn.collections[_tableName]
    let tableName = _tableName.substring(0, 63)

    return cxn.knex.schema
      .hasTable(tableName)
      .then(exists => {
        if (exists) return

        return cxn.knex.schema.createTable(tableName, table => {
          _.each(definition, (definition, attributeName) => {
            let newColumn = Util.toKnexColumn(table, attributeName, definition, schema, cxn.collections)
            Util.applyColumnConstraints(newColumn, definition)
          })
          Util.applyTableConstraints(table, definition)
        })
      })
      .then(() => {
        //console.log('created table', tableName, schema)
        _.isFunction(cb) && cb()
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Drop a table
   */
  drop (connectionName, tableName, relations = [ ], cb = relations) {
    let cxn = Adapter.connections.get(connectionName)

    return cxn.knex.schema.dropTableIfExists(tableName)
      .then(() => {
        return Promise.all(_.map(relations, relation => {
          return cxn.knex.schema.dropTableIfExists(relation)
        }))
      })
      .then(() => {
        _.isFunction(cb) && cb()
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Add a column to a table
   */
  addAttribute (connectionName, tableName, attributeName, definition, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let schema = cxn.collections[tableName]

    return cxn.knex.schema
      .table(tableName, table => {
        let newColumn = Util.toKnexColumn(table, attributeName, definition, schema, cxn.collections)
        Util.applyColumnConstraints(newColumn, definition)
      })
      .then(() => {
        _.isFunction(cb) && cb()
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Remove a column from a table
   */
  removeAttribute (connectionName, tableName, attributeName, cb) {
    let cxn = Adapter.connections.get(connectionName)

    return cxn.knex.schema
      .table(tableName, table => {
        table.dropColumn(attributeName)
      })
      .then(result => {
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Create a new record
   */
  create (connectionName, tableName, data, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let insertData = Util.sanitize(data, cxn.collections[tableName], cxn)
    let schema = cxn.collections[tableName]
    let spatialColumns = SpatialUtil.buildSpatialSelect(schema.definition, tableName, cxn)

    return cxn.knex(tableName)
      .insert(insertData)
      .returning([ '*', ...spatialColumns ])
      .then(rows => {
        let casted = Util.castResultRows(rows, schema)
        let result = _.isArray(data) ? casted : casted[0]

        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb, null, data))
  },

  /**
   * Create multiple records
   */
  createEach (connectionName, tableName, records, cb) {
    // TODO use knex.batchInsert
    return Adapter.create(connectionName, tableName, records, cb)
  },

  /**
   * Update a record
   */
  update (connectionName, tableName, options, data, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let schema = cxn.collections[tableName]
    let wlsql = new WaterlineSequel(cxn.schema, Adapter.wlSqlOptions)
    let spatialColumns = SpatialUtil.getSpatialColumns(schema.definition)
    let updateData = _.omit(data, _.keys(spatialColumns))

    return new Promise((resolve, reject) => {
        if (_.isEmpty(data)) {
          return Adapter.find(connectionName, tableName, options, cb)
        }
        resolve(wlsql.update(tableName, options, updateData))
      })
      .then(({ query, values }) => {
        return Adapter._query(cxn, query, values)
      })
      .then(({ rows }) => {
        cb && cb(null, rows)
      })
      .catch(AdapterError.wrap(cb, null, data))
  },

  /**
   * Destroy a record
   */
  destroy (connectionName, tableName, options, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, Adapter.wlSqlOptions)

    return new Promise((resolve, reject) => {
        resolve(wlsql.destroy(tableName, options))
      })
      .then(({ query, values }) => {
        return Adapter._query(cxn, query, values)
      })
      .then(({ rows }) => {
        cb(null, rows)
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Populate record associations
   */
  join (connectionName, tableName, options, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let schema = cxn.collections[tableName]

    return Util.buildKnexJoinQuery (cxn, tableName, options)
      .then(result => {
        // return unique records only.
        // TODO move to SQL
        _.each(_.reject(options.joins, { select: false }), join => {
          let alias = Util.getJoinAlias(join)
          let pk = Adapter.getPrimaryKey(cxn, join.child)
          let schema = cxn.collections[join.child]

          _.each(result, row => {
            row[alias] = Util.castResultRows(_.compact(_.uniqBy(row[alias], pk)), schema)
          })
        })

        return result
      })
      .then(result => {
        result = Util.castResultRows(result, schema)
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Get the primary key column of a table
   */
  getPrimaryKey ({ collections }, tableName) {
    let definition = collections[tableName].definition


    if (!definition._pk) {
      let pk = _.findKey(definition, (attr, name) => {
        return attr.primaryKey === true
      })
      definition._pk = pk || 'id'
    }

    return definition._pk
  },

  /**
   * Find records
   */
  find (connectionName, tableName, options, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, Adapter.wlSqlOptions)
    let schema = cxn.collections[tableName]

    //console.log('find', tableName, options)
    //console.log('schema types', schema._types)

    return new Promise((resolve, reject) => {
        resolve(wlsql.find(tableName, options))
      })
      .then(({ query: [query], values: [values] }) => {
        let spatialColumns = SpatialUtil.buildSpatialSelect(schema.definition, tableName, cxn)
        let fullQuery = Util.addSelectColumns(spatialColumns, query)

        //console.log('fullQuery', fullQuery)
        //console.log('values', values)

        return Adapter._query(cxn, fullQuery, values)
      })
      .then(({ rows }) => {
        let result = Util.castResultRows(rows, schema)
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Count the number of records
   */
  count (connectionName, tableName, options, cb) {
    let cxn = Adapter.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, Adapter.wlSqlOptions)

    return new Promise((resolve, reject) => {
        resolve(wlsql.count(tableName, options))
      })
      .then(({ query: [query], values: [values] }) => {
        return Adapter._query(cxn, query, values)
      })
      .then(({ rows: [row] }) => {
        let count = Number(row.count)
        _.isFunction(cb) && cb(null, count)
        return count
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Run queries inside of a transaction.
   *
   * Model.transaction(txn => {
   *   Model.create({ ... }, txn)
   *     .then(newModel => {
   *       return Model.update(..., txn)
   *     })
   *   })
   *   .then(txn.commit)
   *   .catch(txn.rollback)
   */
  transaction (connectionName, tableName, cb) {
    let cxn = Adapter.connections.get(connectionName)

    return new Promise(resolve => {
      cxn.knex.transaction(txn => {
        _.isFunction(cb) && cb(null, txn)
        resolve(txn)
      })
    })
  },

  /**
   * Invoke a database function, aka "stored procedure"
   *
   * @param connectionName
   * @param tableName
   * @param procedureName the name of the stored procedure to invoke
   * @param args An array of arguments to pass to the stored procedure
   */
  procedure (connectionName, procedureName, args = [ ], cb = args) {
    let cxn = Adapter.connections.get(connectionName)
    let procedure = cxn.storedProcedures[procedureName.toLowerCase()]

    if (!procedure) {
      let error = new Error(`No stored procedure found with the name ${procedureName}`)
      return (_.isFunction(cb) ? cb(error) : Promise.reject(error))
    }

    return procedure.invoke(args)
      .then(result => {
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Stream query results
   *
   * TODO not tested
   */
  stream (connectionName, tableName, options, outputStream) {
    let cxn = Adapter.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, Adapter.wlSqlOptions)

    return new Promise((resolve, reject) => {
        resolve(wlsql.find(tableName, options))
      })
      .then(({ query: [query], values: [values] }) => {
        let resultStream = cxn.knex.raw(query, values)
        resultStream.pipe(outputStream)

        return new Promise((resolve, reject) => {
          resultStream.on('end', resolve)
        })
      })
      .catch(AdapterError.wrap(cb))
  },

  /**
   * Fired when a model is unregistered, typically when the server
   * is killed. Useful for tearing-down remaining open connections,
   * etc.
   *
   * @param  {Function} cb [description]
   * @return {[type]}      [description]
   */
  teardown (conn, cb = conn) {
    let connections = conn ? [ Adapter.connections.get(conn) ] : Adapter.connections.values()
    let teardownPromises = [ ]

    for (let cxn of connections) {
      if (!cxn) continue

      teardownPromises.push(cxn.knex.destroy())
    }
    return Promise.all(teardownPromises)
      .then(() => {
        // only delete connection references after all open sessions are closed
        for (let cxn of connections) {
          if (!cxn) continue
          Adapter.connections.delete(cxn.identity)
        }
        cb()
      })
      .catch(cb)
  },

  /**
   * Return the knex object
   *
   * @param connectionName
   */
  knex (connectionName) {
    let cnx = Adapter.connections.get(connectionName)
    if (cnx) {
      return cnx.knex
    }
  }
}
export default Adapter
