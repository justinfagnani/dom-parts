export default {
  files: ['test/**/*_test.js'],
  nodeResolve: {
    exportConditions: ['development'],
  },
  testFramework: {
    // https://mochajs.org/api/mocha
    config: {
      ui: 'tdd',
      timeout: '60000', // default 2000
    },
  },
};
