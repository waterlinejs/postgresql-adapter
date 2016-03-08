const Waterline = require('waterline')

module.exports = {

  NoisyModel: Waterline.Collection.extend({
    identity: 'noisymodel',
    connection: 'edgetests',
    dynamicFinders: false,
    associationFinders: false,

    // noise
    description: 'hello',
    noise: {
      foo: 'bar'
    },

    attributes: {
      id: {
        type: 'integer',
        primaryKey: true,
        autoIncrement: true
      },
      name: 'string',
      identity: 'string',
      attributes: 'json',
      //noise: 'json',
      description: 'string'
    }
  })
}

