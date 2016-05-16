'use strict';

require('babel-register');

const path = require('path');
const test = require('tape');
const program = require('../src/run-em');

test('lists scripts', assert => {
  const dir = path.resolve(__dirname, 'fixtures');

  program.list(dir)
    .catch(assert.end)
    .then(scripts => {
      Object.keys(scripts).forEach(file => {
        const pkg = require(file);

        assert.equal(scripts[file].length, 1, `one script found in "${ pkg.name }"`);
        assert.equal(scripts[file][0], 'test', `script "test" found in "${ pkg.name }"`);
      });

      assert.end();
    });
});

test('list excludes files that has no scripts', assert => {
  program.list(path.resolve(__dirname, 'fixtures'))
    .catch(assert.end)
    .then(scripts => {
      assert.ok(
        Object.keys(scripts).every(file => !file.match(/\/c\//)),
        'no script found in "c" package'
      );

      assert.end();
    });
});

test('list excludes node_modules by default', assert => {
  program.list(path.resolve(__dirname, 'fixtures'))
    .catch(assert.end)
    .then(scripts => {
      assert.ok(
        Object.keys(scripts).every(file => !file.match(/node_modules/)),
        'no script found in "node_modules"'
      );

      assert.end();
    });
});

test('list includes node_modules when specified in dir', assert => {
  const dir = path.resolve(__dirname, 'fixtures/node_modules');

  program.list(dir)
    .catch(assert.end)
    .then(scripts => {
      var pkg = require(Object.keys(scripts)[0]);

      assert.equal(
        Object.keys(scripts).length,
        1,
        `one script found in "${ pkg.name }"`
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
