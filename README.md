# run-em

> Run npm scripts in some dir

Maintaining nestled modules can be a hassle. Use this module for running nestled module scripts such as tests or builds.

## Usage

### As a module dependency

Install it as a dependency to your module as so

```
$ npm install --save-dev run-em
```

Then add it as an npm script

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "scripts": {
    "test": "run-em path/to/other/modules test"
  }
}
```

And then watch the magic happen

```
$ npm run test
```

### As a global task runner

Use it as a general purpose task runner by installing it globally

```
$ npm install -g run-em
$ run-em all/my/modules test
```

## Todo

- [ ] Error handling
- [ ] Comments
- [ ] Better readme coverage
