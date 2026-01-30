/**
 * PM2 Ecosystem Configuration Example
 * 
 * Copy this file to ecosystem.config.js and fill in your values:
 *   cp ecosystem.config.example.js ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'lite-crime',
      script: 'run-crime-scriptV2.js',
      cwd: __dirname,
      env: {
        CHAIN_CHOICE: '0',  // 0=PLS, 1=BNB, 2=BOTH
        GLOBAL_PASSWORD: 'YOUR_KEYSTORE_PASSWORD_HERE',
        KEYSTORE_PATH: '/path/to/your/keystores'  // or leave empty to use ~/.foundry/keystores
      }
    },
    {
      name: 'lite-killskill',
      script: 'run-killskill-scheduler.js',
      cwd: __dirname,
      env: {
        CHAIN_CHOICE: '0',
        GLOBAL_PASSWORD: 'YOUR_KEYSTORE_PASSWORD_HERE',
        KEYSTORE_PATH: '/path/to/your/keystores'
      }
    },
    {
      name: 'lite-nickcar',
      script: 'run-nickcar-scheduler.js',
      cwd: __dirname,
      env: {
        CHAIN_CHOICE: '0',
        GLOBAL_PASSWORD: 'YOUR_KEYSTORE_PASSWORD_HERE',
        KEYSTORE_PATH: '/path/to/your/keystores'
      }
    }
  ]
};
