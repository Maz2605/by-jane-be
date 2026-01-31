export default ({ env }) => {
  // Kiểm tra biến môi trường DATABASE_SSL
  // Nếu là true -> bật cấu hình SSL (cho Supabase/Render)
  // Nếu là false -> tắt SSL (cho Local)
  const sslConfig = env.bool('DATABASE_SSL', false) 
    ? {
        rejectUnauthorized: false, 
      } 
    : false;

  return {
    connection: {
      client: 'postgres',
      connection: {
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        schema: env('DATABASE_SCHEMA', 'public'),
        ssl: sslConfig,
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};