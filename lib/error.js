'use strict';

import _ from "lodash";
import AdapterUtil from "./util";

const Errors = {
  E_UNIQUE (pgError) {
    return {
      code: 'E_UNIQUE',
      message: pgError.message,
      invalidAttributes: [pgError.column]
    }
  },

  E_NOTNULL (pgError) {
    return {
      code: 'E_UNIQUE',
      message: pgError.message,
      invalidAttributes: [pgError.column]
    }
  },

  E_PGERROR (pgError) {
    return pgError
  }
};

const PostgresErrorMapping = {
  // uniqueness constraint violation
  '23505': Errors.E_UNIQUE,

  // null-constraint violation
  '22002': Errors.E_NOTNULL,
  '22004': Errors.E_NOTNULL,
  '23502': Errors.E_NOTNULL,
  '39004': Errors.E_NOTNULL,

  // todo finish mapping
};

const AdapterError = {
  wrap (cb, txn, payload) {
    return function (pgError) {
      let errorWrapper = PostgresErrorMapping[pgError.code];
      let error = pgError;

      if (_.isFunction(errorWrapper)) {
        error = errorWrapper(pgError)
      }

      console.error(error);
      if (AdapterUtil.isTransaction(txn)) {
        return txn.rollback().then(AdapterError.wrap(cb))
      }

      _.isFunction(cb) && cb(error)
    }
  }
};

export default AdapterError
