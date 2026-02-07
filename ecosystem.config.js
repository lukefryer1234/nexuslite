/**
 * PM2 Ecosystem Configuration for Nexus Lite
 * This ensures the server always starts on port 4100 from the correct directory
 */
module.exports = {
  apps: [
    {
      name: 'nexus-lite',
      script: 'server/index.js',
      cwd: '/home/luke/Nexus lite',
      env: {
        NODE_ENV: 'production',
        PORT: 4100
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/luke/.pm2/logs/nexus-lite-error.log',
      out_file: '/home/luke/.pm2/logs/nexus-lite-out.log'
    }
  ]
};
