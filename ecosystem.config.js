module.exports = {
  apps: [
    {
      name: 'leadmaster-hub',
      cwd: '/root/leadmaster-workspace/services/central-hub',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
