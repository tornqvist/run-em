import path from 'path';
import npm from 'npm';
import glob from 'glob';
import fs from 'mz/fs';
import { series } from 'async';

const BLACKLIST = ['node_modules'];

export function run(dir, script, ...args) {
  return globber(dir).then(files => {
    return new Promise((resolve, reject) => {
      series(
        files.map(exec(script, args)),
        (err, result) => {
          if (err) { return reject(err); }
          resolve(result);
        });
    });
  });
}

export function list(dir) {
  return globber(dir).then(files => {
    return Promise.all(files.map(collect)).then(pairs => {
      const scripts = {};

      pairs.filter(pair => pair[1]).forEach(pair => scripts[pair[0]] = pair[1]);

      return scripts;
    });
  });
}

function globber(dir) {
  return new Promise((resolve, reject) => {
    dir = dir.replace(/\/$/, '');

    const pattern = `${ dir }/**/package.json`;
    const ignore = BLACKLIST.map(name => `${ dir }/**/${ name }/**`);

    glob(pattern, { ignore }, (err, files) => {
      if (err) { return reject(err); }

      resolve(files);
    });
  });
}

function collect(file) {
  return fs.readFile(file)
    .then(JSON.parse)
    .then(pkg => [file, Object.keys(pkg.scripts)]);
}

function exec(script, args = []) {
  return function (file) {
    return function (callback) {
      npm.load({ prefix: path.dirname(file) }, err => {
        if (err) { return callback(err); }

        npm.commands['run-script']([ script, ...args ], (err, data) => {
          if (err) { return callback(err); }
          callback(null, data);
        });
      });
    };
  };
}
