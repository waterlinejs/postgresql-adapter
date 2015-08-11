import Knex from 'knex'
import _ from 'lodash'
import Util from './util'
import WaterlineSequel from 'waterline-sequel'
import SQL from './sql'
import camelize from 'camelize'

const Adapter = {

  identity: 'waterline-postgresql',

  wlSqlOptions: {
    parameterized: true,
    caseSensitive: true,
    escapeCharacter: '"',
    wlNext: false,
    casting: true,
    canReturnValues: true,
    escapeInserts: true,
    declareDeleteAlias: false
  },

  /**
   * Local connections store
   */
  connections: new Map(),

  pkFormat: 'integer',
  syncable: true,

  /**
   * Adapter default configuration
   */
  defaults: {
    schema: true,
    enableTransactions: true,

    connection: {
      host: 'localhost',
      user: 'postgres',
      password: 'postgres',
      database: 'postgres'
    },
    pool: {
      min: 10,
      max: 30
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
    if (!connection.identity) return cb(new Error('Connection is missing an identity.'))
    if (this.connections.get(connection.identity)) return cb(new Error(`Connection ${connection.identity} is already registered.`))

    _.defaults(connection, this.defaults)
    let cxn = {
      identity: connection.identity,
      schema: this.buildSchema(connection, collections),
      collections: collections,
      knex: Knex({
        client: 'pg',
        connection: connection.connection,
        pool: connection.pool
      }),
      enableTransactions: connection.enableTransactions
    }
    this.connections.set(connection.identity, cxn)

    this.getVersion(cxn)
      .then(version => {
        cxn.version = Util.validateVersion(version)
        cb()
      })
      .catch(this.getErrorHandler(cb))
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
        return _.defaults(definition, {
          attributes: { },
          tableName: modelName
        })
      })
      .indexBy('tableName')
      .value()
  },

  /**
   * Return the version of the PostgreSQL server as an array
   * e.g. for Postgres 9.3.9, return [ '9', '3', '9' ]
   */
  getVersion (cxn) {
    return cxn.knex
      .raw('select version() as version')
      .then(result => {
        return result.rows[0].version.split(' ')[1].split('.')
      })
  },

  /**
   * Describe a table. List all columns and their properties.
   *
   * @param connectionName
   * @param tableName
   */
  describe (connectionName, tableName, cb) {
    let cxn = this.connections.get(connectionName)

    return cxn.knex(tableName).columnInfo()
      .then(columnInfo => {
        if (_.isEmpty(columnInfo)) {
          return cb()
        }

        return this.query(connectionName, tableName, SQL.indexes, [ tableName ])
          .then(indexes => {
            _.merge(columnInfo, _.indexBy(camelize(indexes.rows), 'columnName'))

            cb(null, columnInfo)
          })
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Perform a direct SQL query on the database
   *
   * @param connectionName
   * @param tableName
   * @param query
   * @param data
   */
  query (connectionName, tableName, query, _args, _cb) {
    let cxn = this.connections.get(connectionName)
    let args = null
    let cb = _cb

    if (_.isFunction(_args)) {
      cb = _args
    }
    else {
      args = _args
    }

    return cxn.knex.raw(Util.toKnexRawQuery(query), Util.castValues(args))
      .then(result => {
        cb && cb(null, result)

        return result
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Create a new table
   *
   * @param connectionName
   * @param tableName
   * @param definition - the waterline schema definition for this model
   * @param cb
   */
  define (connectionName, tableName, definition, cb) {
    let cxn = this.connections.get(connectionName)

    return cxn.knex.schema.createTable(tableName, table => {
      _.each(definition, (definition, attributeName) => {
        let newColumn = Util.toKnexColumn(table, attributeName, definition)
        Util.applyColumnConstraints(newColumn, definition)
      })
      Util.applyTableConstraints(table, definition)
    })
    .then(() => {
      cb()
    })
    .catch(this.getErrorHandler(cb))
  },

  /**
   * Drop a table
   */
  drop (connectionName, tableName, _relations, _cb) {
    let cxn = this.connections.get(connectionName)
    let relations = [ ]
    let cb = _cb

    if (_.isFunction(_relations)) {
      cb = _relations
    }
    else {
      relations = _relations
    }

    cxn.knex.schema.dropTableIfExists(tableName)
      .then(result => {
        return Promise.all(_.map(relations, relation => {
          return cxn.knex.schema.dropTable(relation)
        }))
      })
      .then(() => {
        _.isFunction(cb) && cb()
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Add a column to a table
   */
  addAttribute (connectionName, tableName, attributeName, definition, cb) {
    let cxn = this.connections.get(connectionName)

    return cxn.knex.schema
      .table(tableName, table => {
        let newColumn = Util.toKnexColumn(table, attributeName, definition)
        return Util.applyColumnConstraints(newColumn, definition)
      })
      .then(result => {
        _.isFunction(cb) && cb()
        return result
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Remove a column from a table
   */
  removeAttribute (connectionName, tableName, attributeName, cb) {
    let cxn = this.connections.get(connectionName)

    return cxn.knex.schema
      .table(tableName, table => {
        table.dropColumn(attributeName)
      })
      .then(result => {
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Create a new record
   */
  create (connectionName, tableName, data, cb, _txn) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))
    let txn

    return Util.getTransaction(cxn, _txn)
      .then(transaction => {
        txn = transaction
        return wlsql.create(tableName, Util.sanitize(data, cxn.collections[tableName]))
      })
      .then(sql => {
        return txn.raw(Util.toKnexRawQuery(sql.query), Util.castValues(sql.values))
      })
      .then(result => {
        return Util.commitTransaction(_txn, txn, result.rows[0], cb)
      })
      .catch(this.getErrorHandler(cb, txn))
  },

  /**
   * Create a list of records
   */
  createEach (connectionName, tableName, records, cb, _txn) {
    let cxn = this.connections.get(connectionName)
    let txn

    return Util.getTransaction(cxn, _txn)
      .then(transaction => {
        txn = transaction

        return Promise.all(
          _.map(records, record => {
            return this.create(connectionName, tableName, record, null, txn)
          }))
      })
      .then(result => {
        return Util.commitTransaction(_txn, txn, result, cb)
      })
      .catch(this.getErrorHandler(cb, txn))
  },

  /**
   * Update a record
   */
  update (connectionName, tableName, options, data, cb, _txn) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))
    let txn

    return Util.getTransaction(cxn, _txn)
      .then(transaction => {
        txn = transaction
        return wlsql.update(tableName, options, data)
      })
      .then(sql => {
        return txn.raw(Util.toKnexRawQuery(sql.query), Util.castValues(sql.values))
      })
      .then(result => {
        return Util.commitTransaction(_txn, txn, result.rows, cb)
      })
      .catch(this.getErrorHandler(cb, txn))
  },

  /**
   * Destroy a record
   */
  destroy (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.destroy(tableName, options))
      })
      .then(sql => {
        return cxn.knex.raw(Util.toKnexRawQuery(sql.query), sql.values)
      })
      .then(result => {
        cb(null, result.rows)
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Populate record associations
   */
  join (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)

    return Util.buildKnexJoin (cxn, tableName, _.clone(options))
      .then(result => {
        // return unique records only.
        // TODO move to SQL
        _.each(_.reject(options.joins, { select: false }), join => {
          let alias = Util.getJoinAlias(join)
          let pk = this.getPrimaryKey(connectionName, join.child)

          _.each(result, row => {
            row[alias] = _.unique(row[alias], pk)
          })
        })

        return result
      })
      .then(result => {
        _.isFunction(cb) && cb(null, result)
        return result
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Get the primary key column of a table
   */
  getPrimaryKey (connectionName, tableName) {
    let cxn = this.connections.get(connectionName)
    let definition = cxn.collections[tableName].definition

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
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.find(tableName, options))
      })
      .then(sql => {
        return this.query(connectionName, tableName, sql.query[0], sql.values[0])
      })
      .then(result => {
        _.isFunction(cb) && cb(null, result.rows)
        return result.rows
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Count the number of records
   */
  count (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.count(tableName, options))
      })
      .then(sql => {
        return this.query(connectionName, tableName, sql.query[0], sql.values[0])
      })
      .then(result => {
        let count = Number(result.rows[0].count)
        _.isFunction(cb) && cb(null, count)
        return count
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Stream query results
   */
  stream (connectionName, tableName, options, outputStream) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.find(tableName, options))
      })
      .then(sql => {
        let resultStream = cxn.knex.raw(sql.query[0], sql.values[0])
        resultStream.pipe(outputStream)

        return new Promise((resolve, reject) => {
          resultStream.on('end', resolve)
        })
      })
      .catch(this.getErrorHandler(cb))
  },

  /**
   * Fired when a model is unregistered, typically when the server
   * is killed. Useful for tearing-down remaining open connections,
   * etc.
   *
   * @param  {Function} cb [description]
   * @return {[type]}      [description]
   */
  teardown (conn, cb) {
    if (_.isFunction(conn)) {
      cb = conn
      conn = null
    }

    let connections = conn ? [ this.connections.get(conn) ] : this.connections.values()

    for (let cxn of connections) {
      if (!cxn) continue

      cxn.knex.destroy()
      this.connections.delete(cxn.identity)
    }
    cb()
  },

  /**
   * Wrap the callback in a more robust error handling function
   */
  getErrorHandler (callback, txn) {
    return error => {
      if (txn && _.isFunction(txn.rollback)) {
        txn.rollback()
      }
      if (_.isFunction(callback)) {
        callback(error)
      }
      else {
        throw error
      }
    }
  }
}

_.bindAll(Adapter)

export default Adapter
