import path from 'path';
import glob from 'glob';
import fs from 'mz/fs';
import { series } from 'async';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const BLACKLIST = ['node_modules'];

/**
 * Run script in all packages
 * @param  {String}        dir     Where to look for scripts
 * @param  {String}        script  Name of script to run
 * @param  {Object}        options Modifies behaviour (optional)
 * @param  {Array<String>} ...args Rest params passed to script
 * @return {EventEmitter}          Forwards script output
 */

export function run(dir, script, options = {}, ...args) {
  const api = new EventEmitter();

  /**
   * If options is not an object add it to the arguments list
   */

  if (typeof options !== 'object') {
    args.unshift(options);
  }

  /**
   * Find all package.json
   */

  globber(dir, options).then(files => {
    /**
     * Run scripts in series
     */

    series(
      files.map(exec(api, script, args)),
      (err, codes) => {
        /**
         * Emit error or close depending on output
         */

        api.emit(err ? 'error' : 'close', err || codes);
      });
  });

  return api;
}

/**
 * List all npm scripts in directory
 * @param  {String} dir     Where to look for scripts
 * @param  {Object} options Modifies behaviour (optional)
 * @return {Promise}        Resolves to hash with key/value => file/scripts
 */

export function list(dir, options = {}) {
  /**
   * Find all package.json files
   */

  return globber(dir, options).then(files => {
    /**
     * Read all files
     */

    return Promise.all(files.map(collect)).then(collection => {
      const result = {};

      /**
       * Sort out only packages that have any scripts
       */

      collection.forEach((scripts, index) => {
        if (scripts && scripts.length) { result[files[index]] = scripts; }
      });

      return result;
    });
  });
}

/**
 * Promise wrapper for glob module
 * @param  {String} dir     Root directiory
 * @param  {Object} options Modifies behaviour (optional)
 * @return {Promise}        Resolves to list of package.json files
 */

function globber(dir, options) {
  return new Promise((resolve, reject) => {
    dir = dir.replace(/\/$/, '');

    /**
     * Construct glob pattern
     */

    const pattern = `${ dir }/**/package.json`;

    /**
     * Construct ignore patterns
     */

    const blacklist = [ ...BLACKLIST, ...options.ignore || [] ];
    const ignore = blacklist.map(name => `${ dir }/**/${ name }/**`);

    /**
     * Glob!
     */

    glob(pattern, { ignore }, (err, files) => {
      if (err) { return reject(err); }
      resolve(files);
    });
  });
}

/**
 * Read package.json from disc and collect it's scripts
 * @param  {String} file Path to package.json file
 * @return {Promise}     Resolves to a tuple if [file, [scripts]]
 */

function collect(file) {
  return fs.readFile(file)
    .then(JSON.parse)
    .then(pkg => 'scripts' in pkg && Object.keys(pkg.scripts));
}

/**
 * Script execution constructor
 * @param  {EventEmitter}  api    Where to forward output
 * @param  {String}        script Script to execute
 * @param  {Array<String>} args   Arguments to apply script with
 * @return {Function}             Iterable
 */

function exec(api, script, args = []) {
  return function (file) {
    /**
     * Callback for `async.series` wrapper
     */

    return function (callback) {
      collect(file)
        .catch(err => callback(err))
        .then(scripts => {
          /**
           * Check that package has script
           */

          if (!scripts || scripts.indexOf(script) === -1) {
            return callback(null);
          }

          /**
           * Execute command
           */

          const child = spawn('npm', [ 'run-script', script, ...args ], {
            env: process.env,
            cwd: path.dirname(file)
          });

          /**
           * Forward events to api
           */

          if (child.stderr) {
            child.stderr.on('data', chunk => api.emit('data', chunk));
          }

          if (child.stdout) {
            child.stdout.on('data', chunk => api.emit('data', chunk));
          }

          child.on('error', callback);
          child.on('close', code => callback(null, code));
        });
    };
  };
}
