import _ from 'lodash'
import SQL from './sql'

export const Procedures = {

  /**
   * Return a collection of all stored procedures accessible to the current
   * database connection
   */
  describeAll (cxn) {
    let sp = cxn.knex.raw(SQL.storedProcedures)

    return sp
      .then(({ rows }) => {
        let procedures = _.map(rows, row => {
          return Procedures.buildStoredProcedure(row, cxn)
        })

        procedures.push(Procedures.buildStoredProcedure({ name: 'version' }, cxn))

        return _.isEmpty(procedures) ? { } : _.indexBy(procedures, 'name')
      })
  },

  /**
   * Build a function that invokes the SP with the required arguments
   */
  buildStoredProcedure ({ schema, name, returntype, signature }, cxn) {
    let argTemplate = Procedures.buildArgumentTemplate(signature)
    let fullName = (!schema || (schema == 'public')) ? name : `${schema}.${name}`

    return {
      name: fullName,
      signature: Procedures.parseSignature(signature),
      invoke (args) {
        if (!schema) {
          return cxn.knex.raw(`select ${name}(${argTemplate})`, args)
        }
        else {
          return cxn.knex.raw(`select ${schema}.${name}(${argTemplate})`, args)
        }
      }
    }
  },

  buildArgumentTemplate (signature) {
    if (!signature) return ''

    let args = signature.split(', ')
    return args.map(arg => '?').join(',')
  },

  parseSignature (signature = '') {
    let parameters = signature.split(', ')
    return _.map(parameters, param => {
      return param.split(' ')[0]
    })
  }
}

export default Procedures
