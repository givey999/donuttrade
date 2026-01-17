module.exports = {
  apps: [{
    name: 'miau-minecraft-bot',
    script: 'src/index.js',

    // Auto-restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,

    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,

    // Environment
    env: {
      NODE_ENV: 'production'
    },

    // Memory management
    max_memory_restart: '500M',

    // Watch for file changes (disable in production)
    watch: false
  }]
};
