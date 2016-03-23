'use strict'

const _ = require('lodash')
const assert = require('assert')
const Waterline = require('waterline')
const models = require('./models')
const Adapter = require('../../../dist/adapter')

describe('pg edge cases', () => {
  const wlconfig = {
    adapters: {
      edgetests: Adapter
    },
    connections: {
      edgetests: {
        migrate: 'drop',
        adapter: 'edgetests',
        connection: {
        }
      }
    }
  }
  let waterline, orm

  before(done => {
    waterline = new Waterline();
    waterline.loadCollection(models.ArrayModel)
    waterline.loadCollection(models.JsonModel)
    waterline.initialize(wlconfig, (err, _orm) => {
      if (err) return done(err)

      orm = _orm.collections
      done()
    })
  })

  describe('array type', () => {
    it('should initialize without error', () => {
      assert(orm.arraymodel)
    })
    it('should support insertion with list field', done => {
      orm.arraymodel.create({
          list: [1,2,3],
          listSyntaxA: [4,5,6]
        })
        .then(record => {
          assert.equal(record.list.length, 3)
          assert.equal(record.listSyntaxA.length, 3)
          done()
        })
    })

  })

  describe('jsonb type', () => {
    it('should initialize without error', () => {
      assert(orm.jsonmodel)
    })

    it('should support insertion with json field', done => {
      orm.jsonmodel.create({
          json: { foo: 'bar' },
          jsonb: { foo: 'bar' },
          jsonbSyntaxA: {
            a: 1,
            b: { foo: 'bar' }
          }
        })
        .then(record => {
          assert.equal(record.json.foo, 'bar')
          assert.equal(record.jsonbSyntaxA.b.foo, 'bar')
          done()
        })
    })
  })

})
