import Knex from 'knex'
import _ from 'lodash'
import Util from './util'
import WaterlineSequel from 'waterline-sequel'
import SQL from './sql'
import CursorJoin from 'waterline-cursor'
import camelize from 'camelize'

const Adapter = {

  wlSqlOptions: {
    parameterized: true,
    caseSensitive: true,
    escapeCharacter: '"',
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
      min: 2,
      max: 30
    }
  },

  /**
   * This method runs when a model is initially registered
   * at server-start-time.  This is the only required method.
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

    let schema = this.buildSchema(connection, collections)

    this.connections.set(connection.identity, {
      identity: connection.identity,
      schema: schema,
      collections: collections,
      queries: new WeakMap(),
      knex: Knex({
        client: 'pg',
        connection: connection.connection,
        pool: connection.pool
      })
    })

    cb()
  },

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

  describe (connectionName, tableName, cb) {
    let cxn = this.connections.get(connectionName)
    let columnInfo

    return cxn.knex(tableName).columnInfo()
      .then(result => {
        columnInfo = result
        return cxn.knex.raw(SQL.indexes, [ tableName ])
      })
      .then(indexes => {
        _.merge(columnInfo, _.indexBy(camelize(indexes.rows), 'columnName'))

        cb(null, _.isEmpty(columnInfo) ? undefined : columnInfo)
      })
      .catch(this.getErrorHandler(cb))
  },

  query (connectionName, tableName, query, _data, _cb) {
    let cxn = this.connections.get(connectionName)
    let data = null
    let cb = _cb

    if (_.isFunction(data)) {
      cb = data
    }
    else {
      data = _data
    }

    return cxn.knex.raw(Util.toKnexRawQuery(query), Util.castValues(data))
      .then(result => {
        cb(null, result)
      })
  },

  /**
   * Create a new table
   */
  define (connectionName, tableName, definition, cb) {
    let connection = this.connections.get(connectionName)

    return connection.knex.schema
      .hasTable(tableName)
      .then(exists => {
        if (exists) return Promise.resolve()

        return connection.knex.schema.createTable(tableName, table => {
          _.each(definition, (definition, attributeName) => {
            let newColumn = Util.toKnexColumn(table, attributeName, definition)
            Util.applyColumnConstraints(newColumn, definition)
          })
          Util.applyTableConstraints(table, definition)
        })
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
      .then(result => {
        cb()
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
        cb && cb()
        return result
      })
      .catch(this.getErrorHandler(cb))
  },

  removeAttribute (connectionName, tableName, attributeName, cb) {
    let cxn = this.connections.get(connectionName)

    return cxn.knex.schema
      .table(tableName, table => {
        table.dropColumn(attributeName)
      })
      .then(result => {
        cb(null, result)
      })
      .catch(this.getErrorHandler(cb))
  },

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

  join (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)

    if (_.isObject(options)) {
      delete options.select;
    }

    CursorJoin({
      instructions: options,
      parentCollection: tableName,

      $find (collectionIdentity, criteria, cb) {
        return Adapter.find(connectionName, collectionIdentity, criteria, cb);
      },

      $getPK (collectionIdentity) {
        if (!collectionIdentity) return;
        var collection = cxn.collections[collectionIdentity];
        return collection.getPrimaryKey();
      }
    }, cb);
  },

  getPrimaryKey (connectionName, tableName) {
    let cxn = this.connections.get(connectionName)
    let definition = cxn.collections[tableName].definition

    let pk = _.findKey(definition, (attr, name) => {
      return attr.primaryKey === true
    })

    return pk || 'id'
  },

  find (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.find(tableName, options))
      })
      .then(sql => {
        let query = Util.toKnexRawQuery(sql.query[0])
        let values = Util.castValues(sql.values[0])
        
        return cxn.knex.raw(query, values)
      })
      .then(result => {
        cb(null, result.rows)
      })
      .catch(this.getErrorHandler(cb))
  },

  count (connectionName, tableName, options, cb) {
    let cxn = this.connections.get(connectionName)
    let wlsql = new WaterlineSequel(cxn.schema, _.clone(this.wlSqlOptions))

    return new Promise((resolve, reject) => {
        resolve(wlsql.count(tableName, options))
      })
      .then(sql => {
        let query = Util.toKnexRawQuery(sql.query[0])
        let values = Util.castValues(sql.values[0])
        
        return cxn.knex.raw(query, values)
      })
      .then(result => {
        let count = Number(result.rows[0].count)
        cb(null, count)
        return count
      })
      .catch(this.getErrorHandler(cb))
  },

  stream (connectionName, tableName, options, stream) {
    let cxn = this.connections.get(connectionName)

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
      if (!cxn) continue;

      cxn.knex.destroy()
      this.connections.delete(cxn.identity)
    }
    cb()
  },

  getErrorHandler (callback, txn) {
    return error => {
      //console.log(error)
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
  },

}

_.bindAll(Adapter)

export default Adapter
