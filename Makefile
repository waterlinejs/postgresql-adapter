MOCHA_OPTS= --check-leaks --compilers js:babel/register
REPORTER = spec

test: build test-unit test-integration

build:
	gulp

test-unit:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		$(MOCHA_OPTS)

test-integration:
	@NODE_ENV=test node test/integration/runner.js
