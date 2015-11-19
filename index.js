'use strict';

const path = require('path');
const glob = require('glob');
const fs = require('mz/fs');
const spawn = require('child_process').spawn;
const MultiStream = require('multistream');

const BLACKLIST = ['node_modules'];

/**
 * Run script in all packages
 * @param  {String}        dir     Where to look for scripts
 * @param  {String}        script  Name of script to run
 * @param  {Object}        options Modifies behaviour (optional)
 * @param  {Array<String>} ...args Rest params passed to script
 * @return {MultiStream}           Child processes streams in one
 */

function run(dir, script, options) {
  let queue;
  let args = Array.prototype.slice.call(
    arguments,
    typeof options !== 'object' ? 3 : 2
  );

  /**
   * Find all package.json
   */

  return MultiStream(callback => {
    function createStream() {
      exec(queue.shift(), script, args).then(child => {
        if (child) {
          callback(null, child.stdout);
          callback(null, child.stderr);

          child.on('exit', code => {
            if (code === 1) { process.exit(1); }
          });
        }
      });
    }

    if (!queue) {
      globber(dir, options).then(files => {
        if (files) {
          queue = files;
          createStream();
        } else {
          callback(null, null);
        }
      });
    } else if (!queue.length) {
      callback(null, null);
    } else {
      createStream();
    }
  });
}

/**
 * List all npm scripts in directory
 * @param  {String} dir     Where to look for scripts
 * @param  {Object} options Modifies behaviour (optional)
 * @return {Promise}        Resolves to hash with key/value => file/scripts
 */

function list(dir, options) {
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
  options = options || {};

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

function exec(file, script, args) {
  args = args || [];

  return collect(file).then(scripts => {
    /**
     * Check that package has script
     */

    if (!scripts || scripts.indexOf(script) === -1) {
      return null;
    }

    /**
     * Execute command
     */

    return spawn('npm', [ 'run-script', script, ...args ], {
      env: process.env,
      cwd: path.dirname(file)
    });
  });
}

module.exports = { run, list };
