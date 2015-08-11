# <img src="http://i.imgur.com/tMBZE5W.png" height=48></img>PostgreSQL Waterline Adapter

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]
[![Code Climate][codeclimate-image]][codeclimate-url]

A [Waterline](https://github.com/balderdashy/waterline) adapter for PostgreSQL
written in ES6. Waterline is the ORM layer used by [Sails](http://sailsjs.org)
and [Treeline](http://treeline.io).

## 1. Install

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

[npm-image]: https://img.shields.io/npm/v/@balderdash/waterline-postgresql.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@balderdash/waterline-postgresql
[ci-image]: https://img.shields.io/circleci/project/tjwebb/waterline-postgresql/master.svg?style=flat-square
[ci-url]: https://circleci.com/gh/tjwebb/waterline-postgresql
[daviddm-image]: http://img.shields.io/david/tjwebb/waterline-postgresql.svg?style=flat-square
[daviddm-url]: https://david-dm.org/tjwebb/waterline-postgresql
[codeclimate-image]: https://img.shields.io/codeclimate/github/tjwebb/@balderdash/waterline-postgresql.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/tjwebb/waterline-postgresql
