# PostgreSQL Waterline Adapter

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]
[![Code Climate][codeclimate-image]][codeclimate-url]

A [Waterline](https://github.com/balderdashy/waterline) adapter for PostgreSQL
written in ES6. Waterline is the ORM layer used by [Sails](http://sailsjs.org)
and [Treeline](http://treeline.io).

## 1. Install

```sh
$ npm install @balderdash/waterline-postgresql --save
```

## Configuration

#### `config/connections.js`

```js
module.exports.connectionas

config: {
  database: 'databaseName',
  host: 'localhost',
  user: 'root',
  password: '',
  port: 5432,
  pool: false,
  ssl: false
};


[npm-image]: https://img.shields.io/npm/v/@balderdash/waterline-postgresql.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@balderdash/waterline-postgresql
[ci-image]: https://img.shields.io/circleci/project/tjwebb/waterline-postgresql/master.svg?style=flat-square
[ci-url]: https://circleci.com/gh/tjwebb/waterline-postgresql
[daviddm-image]: http://img.shields.io/david/tjwebb/waterline-postgresql.svg?style=flat-square
[daviddm-url]: https://david-dm.org/tjwebb/waterline-postgresql
[codeclimate-image]: https://img.shields.io/codeclimate/github/tjwebb/@balderdash/waterline-postgresql.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/tjwebb/waterline-postgresql
