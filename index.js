import path from 'path';
import glob from 'glob';
import fs from 'mz/fs';
import { series } from 'async';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const BLACKLIST = ['node_modules'];

export function run(dir, script, ...args) {
  const api = new EventEmitter();

  globber(dir).then(files => {
    series(files.map(exec(api, script, args)), (err, codes) => {
      api.emit(err ? 'error' : 'close', err || codes);
    });
  });

  return api;
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

function exec(api, script, args = []) {
  return function (file) {
    return function (callback) {
      const child = spawn('npm', [ script, ...args ], {
        env: process.env,
        cwd: path.dirname(file)
      });

      if (child.stderr) {
        child.stderr.on('data', chunk => api.emit('data', chunk));
      }

      if (child.stdout) {
        child.stdout.on('data', chunk => api.emit('data', chunk));
      }

      child.on('error', callback);

      child.on('close', code => callback(null, code));
    };
  };
}
