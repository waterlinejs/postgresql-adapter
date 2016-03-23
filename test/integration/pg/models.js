const Waterline = require('waterline')

module.exports = {

  ArrayModel: Waterline.Collection.extend({
    identity: 'arraymodel',
    connection: 'edgetests',
    dynamicFinders: false,
    associationFinders: false,

    attributes: {
      list: {
        type: 'array'
      },
      listSyntaxA: {
        type: 'array',
        defaultsTo: '{}'
      },
      listOfObjects: {
        type: 'array',
        defaultsTo: []
      }
    }
  }),

  JsonModel: Waterline.Collection.extend({
    identity: 'jsonmodel',
    connection: 'edgetests',
    dynamicFinders: false,
    associationFinders: false,

    attributes: {
      json: {
        type: 'json'
      },
      jsonb: {
        type: 'json'
      },
      jsonbSyntaxA: {
        type: 'json',
        defaultsTo: '[]'
      },
      jsonbSyntaxB: {
        type: 'json',
        defaultsTo: '{}'
      }
    }
  })

}
