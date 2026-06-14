module.exports = {
    apps: [{
      name: 'vitalem-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/opt/apps/vitalem-frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // ✅ ЯВНО указываем все переменные окружения
        GATEWAY: 'http://127.0.0.1:8800',
        BACKEND_URL: 'http://127.0.0.1:8801',
        SPECIALIST_SERVICE: 'http://127.0.0.1:8803',
        PATIENT_SERVICE: 'http://127.0.0.1:8804',
        CALENDAR_SERVICE: 'http://127.0.0.1:8805',
        NOTIFICATION_SERVICE: 'http://127.0.0.1:8806',
        ANKETA_SERVICE: 'http://127.0.0.1:8080',
        FILE_SERVICE: 'http://127.0.0.1:8087',
        // REPLICATE_API_TOKEN: 'ваш_токен_если_нужен',
      },
      // Автоматический перезапуск при сбоях
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Логирование
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }]
  };