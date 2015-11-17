'use strict';

require('babel-core/register');

const path = require('path');
const test = require('tape');
const pkg = require('../package.json');
const program = require(path.resolve(__dirname, '..', pkg.main));

test('lists all scripts', assert => {
  program.list(path.resolve(__dirname, 'fixtures'))
    .catch(assert.end)
    .then(scripts => {
      Object.keys(scripts).forEach(file => {
        const dirname = path.dirname(file).replace(`${ __dirname }/`, '');

        assert.equal(scripts[file].length, 1, `${ dirname } has one script`);
        assert.equal(scripts[file][0], 'test', `${ dirname } has script "test"`);
      });

      assert.end();
    });
});

test('list excludes node_modules by default', assert => {
  program.list(path.resolve(__dirname, 'fixtures'))
    .catch(assert.end)
    .then(scripts => {
      assert.ok(
        Object.keys(scripts).every(file => !file.match(/node_modules/)),
        'no script in node_modules found'
      );

      assert.end();
    });
});

test('list includes node_modules when specified in path', assert => {
  const dirname = 'fixtures/node_modules/c';

  program.list(path.resolve(__dirname, dirname))
    .catch(assert.end)
    .then(scripts => {
      assert.equal(
        Object.keys(scripts).length,
        1,
        `one script found in ${ dirname }`
      );

      assert.end();
    });
});

test('executes scripts', assert => {
  const queue = [ 'a', 'b' ];
  const child = program.run(path.resolve(__dirname, 'fixtures'), 'test');

  child.on('data', chunk => {
    const output = chunk.toString().trim();

    if (queue.indexOf(output) !== -1) {
      queue.splice(queue.indexOf(output), 1);
    }
  });

  child.on('error', assert.end);
  child.on('close', () => {
    let err = null;

    if (queue.length !== 0) {
      err = new Error('program exited before all had scripts run');
    }

    assert.end(err);
  });
});
