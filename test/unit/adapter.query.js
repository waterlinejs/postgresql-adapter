var adapter = require('../../lib/adapter'),
    should = require('should'),
    support = require('./support/bootstrap');

describe('adapter', function() {

  /**
   * Setup and Teardown
   */

  before(function(done) {
    support.registerConnection(['test_query'], done);
  });

  after(function(done) {
    support.Teardown('test_query', done);
  });

  // Attributes for the test table
  var definition = {
    id: {
      type: 'serial',
      autoIncrement: true
    },
    name: {
      type: 'string',
      index: true
    },
    languages: {
      type: 'json'
    },
    metadata: {
      type: 'json'
    },
    foos: {
      type: 'array'
    }
  };

  /**
   * JSON
   *
   * Execute a query with JSON parameters
   */

  describe('.query()', function() {

    // JSON array as parameter
    it('should support josn array parameters', function(done) {

      adapter.define('test', 'test_query', definition, function(err) {
        var languageArray = ['English','Italian','French'];
        // Stringify array in order to insert JSON into postgres
        var params = [1, 'John Doe', JSON.stringify(languageArray)];

        adapter.query('test', 'test_query', 'INSERT INTO test_query (id, name, languages) VALUES ($1,$2,$3)', params, function(queryErr, queryResults) {
          should.not.exist(queryErr);
          // Check records was actually inserted
          support.Client(function(err, client, close) {
            client.query('SELECT * FROM "test_query" WHERE id = 1', function(err, result) {

              // Test the inserted record is returned
              result.rows.length.should.eql(1);
              result.rows[0].languages.should.deepEqual(languageArray);
              // close client
              close();

              done();
            });
          });
        });
      });
    });

    // JSON object as parameter
    it('should support josn object parameters', function(done) {

      adapter.define('test', 'test_query', definition, function(err) {
        var metadata = {
          age: 28,
          sex: 'Female',
          eye_color: 'Green'
        };
        // Stringify object in order to insert JSON into postgres
        var params = [2, 'Jane Doe', JSON.stringify(metadata)];

        adapter.query('test', 'test_query', 'INSERT INTO test_query (id, name, metadata) VALUES ($1,$2,$3)', params, function(queryErr, queryResults) {
          should.not.exist(queryErr);
          // Check records was actually inserted
          support.Client(function(err, client, close) {
            client.query('SELECT * FROM "test_query" WHERE id = 2', function(err, result) {

              // Test the inserted record is returned
              result.rows.length.should.eql(1);
              result.rows[0].metadata.should.deepEqual(metadata);
              // close client
              close();

              done();
            });
          });
        });
      });
    });

    // Native Postgres Array as parameter
    it('should support native array parameters', function(done) {

      adapter.define('test', 'test_query', definition, function(err) {
        var foos = ['foo','bar'];
        var params = [3, 'John Smith', foos];

        adapter.query('test', 'test_query', 'INSERT INTO test_query (id, name, foos) VALUES ($1,$2,$3)', params, function(queryErr, queryResults) {
          should.not.exist(queryErr);
          // Check records were actually inserted
          support.Client(function(err, client, close) {
            client.query('SELECT * FROM "test_query" WHERE id = 3', function(err, result) {

              // Test the inserted record is returned
              result.rows.length.should.eql(1);
              result.rows[0].foos.should.deepEqual(foos);
              // close client
              close();

              done();
            });
          });
        });
      });
    });

  });
});
