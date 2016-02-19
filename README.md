# PostgreSQL Waterline Adapter

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]
[![Code Climate][codeclimate-image]][codeclimate-url]

A [Waterline](https://github.com/balderdashy/waterline) adapter for
[PostgreSQL](http://www.postgresql.org/), with [PostGIS](http://postgis.net/)
support.

## Features
- 100% re-write of the original
  [sails-postgresql](https://github.com/balderdashy/sails-postgresql) adapter in [ES6](https://en.wikipedia.org/wiki/ECMAScript#Harmony.2C_6th_Edition)
- Uses [knex.js](http://knexjs.org/) for query building and connection pooling
- Utilizes native array/json aggregation functions in PostgreSQL 9.2+ to
  optimize query performance
- PostGIS 2.1+ Support

## Compatibility
- Waterline v0.11 and later
- PostgreSQL 9.2 and later

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
    }
  }
}
```

## License
MIT

## Maintained By
##### [<img src='http://i.imgur.com/zM0ynQk.jpg' height='34px'>](http://balderdash.io)

[waterline-version-image]: https://goo.gl/goisO1
[waterline-url]: http://sailsjs.org
[npm-image]: https://img.shields.io/npm/v/waterline-postgresql.svg?style=flat
[npm-url]: https://npmjs.org/package/waterline-postgresql
[ci-image]: https://img.shields.io/travis/waterlinejs/postgresql-adapter/master.svg?style=flat
[ci-url]: https://travis-ci.org/waterlinejs/postgresql-adapter
[daviddm-image]: http://img.shields.io/david/waterlinejs/postgresql-adapter.svg?style=flat
[daviddm-url]: https://david-dm.org/waterlinejs/postgresql-adapter
[codeclimate-image]: https://img.shields.io/codeclimate/github/waterlinejs/postgresql-adapter.svg?style=flat
[codeclimate-url]: https://codeclimate.com/github/waterlinejs/postgresql-adapter
