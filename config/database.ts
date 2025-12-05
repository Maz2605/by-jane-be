// path: config/database.ts

import path from 'path';

export default ({ env }) => {
  // Lấy client (postgres)
  const client = env('DATABASE_CLIENT', 'postgres');

  // Cấu hình kết nối
  const connections = {
    postgres: {
      connection: {
        connectionString: env('DATABASE_URL'), // Nếu bạn dùng full URL
        // Hoặc dùng từng biến lẻ:
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          rejectUnauthorized: false, // Bắt buộc dòng này để connect Render từ Local
        },
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
    },
    // ... các config khác ...
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};