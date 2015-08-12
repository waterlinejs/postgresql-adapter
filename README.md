# <img src="http://i.imgur.com/tMBZE5W.png" height='30px'> PostgreSQL Waterline Adapter

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]
[![Code Climate][codeclimate-image]][codeclimate-url]

A [Waterline](https://github.com/balderdashy/waterline) adapter for
[PostgreSQL](http://www.postgresql.org/), with [PostGIS](http://postgis.net/)
support.  Waterline is the ORM layer used by [Sails](http://sailsjs.org)
and [Treeline](http://treeline.io).

## Features
- 100% re-write of the original
  [sails-postgresql](https://github.com/balderdashy/sails-postgresql) adapter in ES6
- Uses [knex.js](http://knexjs.org/) for query building and connection pooling
- Utilizes native array/json aggregation functions in PostgreSQL 9.2+ to
  optimize query performance
- PostGIS Support (via
  [postgis-addon](https://github.com/waterlinejs/postgis-addon))
  - spatial queries and indexes
  - utilizes new `geojson` type

## Compatibility
- [Waterline](http://sailsjs.org/) v0.10 and later
- PostgreSQL 9.2 and later
- Works with Sails v0.12 and later

## Install

```sh
$ npm install waterline-postgresql --save
```

## Configuration

#### `config/connections.js`

```js
module.exports.connections = {
  // ...
  postgresdb: {
    /**
     * This 'connection' object could also be a connection string
     * e.g. 'postgresql://user:password@localhost:5432/databaseName?ssl=false'
     */
    connection: {
      database: 'databaseName',
      host: 'localhost',
      user: 'user',
      password: 'password',
      port: 5432,
      ssl: false
    },
    /**
     * Pool configuration
     */
    pool: {
      min: 2,
      max: 20
    },

    /**
     * Set to 'true' to enable transaction support. 'false' to disable
     */
    enableTransactions: true
  }
}
```

## License
MIT

## Maintained By
##### [<img src='http://i.imgur.com/zM0ynQk.jpg' height='34px'>](http://balderdash.co)

[npm-image]: https://img.shields.io/npm/v/waterline-postgresql.svg?style=flat-square
[npm-url]: https://npmjs.org/package/waterline-postgresql
[ci-image]: https://img.shields.io/travis/waterlinejs/waterline-postgresql/master.svg?style=flat-square
[ci-url]: https://travis-ci.org/waterlinejs/postgresql-adapter
[daviddm-image]: http://img.shields.io/david/waterlinejs/waterline-postgresql.svg?style=flat-square
[daviddm-url]: https://david-dm.org/waterlinejs/waterline-postgresql
[codeclimate-image]: https://img.shields.io/codeclimate/github/waterlinejs/waterline-postgresql.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/waterlinejs/waterline-postgresql
