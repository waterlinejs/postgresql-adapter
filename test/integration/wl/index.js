'use strict';

const _ = require('lodash');
const assert = require('assert');
const Waterline = require('waterline');
const models = require('./models');
const Adapter = require('../../../dist/adapter');

describe('wl edge cases', () => {
    const wlconfig = {
        adapters: {
            edgetests: Adapter
        },
        connections: {
            edgetests: {
                adapter: 'edgetests',
                connection: {}
            }
        }
    };
    let waterline, orm, wl;

    before(done => {
        waterline = new Waterline();
        waterline.loadCollection(models.NoisyModel);
        waterline.loadCollection(models.NormalModel);
        waterline.initialize(wlconfig, (err, _orm) => {
            if (err) return done(err);

            wl = _orm;
            orm = _orm.collections;
            done()
        });
    });

    describe('update order by', () => {
        it('update should ignore orderBy', () => {
            orm.normalmodel.update({id: 1}, {
                where: {
                    name: 'hello'
                },
                orderBy: 'id asc'
            })
        })
    });

    describe('model definition noise', () => {
        it('should insert itself normally when .create invoked on the model', done => {
            const model = orm.noisymodel;
            const modelObject = {
                name: model.globalId,
                identity: model.identity,
                attributes: _.omit(model.attributes, _.functions(model.attributes)),
                noise: model.noise,
                description: model.description
            };
            orm.noisymodel.create(modelObject)
                .then(record => {
                    assert.equal(record.identity, 'noisymodel');
                    done()
                })
        });

        it('should insert normally when .create invoked on the adapter', done => {
            const model = orm.noisymodel;
            const modelObject = {
                name: model.globalId,
                identity: model.identity,
                attributes: _.omit(model.attributes, _.functions(model.attributes)),
                noise: model.noise,
                description: model.description
            };
            wl.connections.edgetests._adapter.create('edgetests', 'noisymodel', modelObject, (err, record) => {
                assert.equal(record.identity, 'noisymodel');
                done()
            })
        })
    })
});
