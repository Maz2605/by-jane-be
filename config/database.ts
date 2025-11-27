const path = require('path');

module.exports = ({ env }) => {
  // Kiểm tra xem có biến DATABASE_URL không (Trên Render sẽ có)
  const client = env('DATABASE_URL') ? 'postgres' : 'sqlite';

  // Cấu hình cho PostgreSQL (Trên Render)
  if (client === 'postgres') {
    const parse = require('pg-connection-string').parse;
    const config = parse(env('DATABASE_URL'));
    return {
      connection: {
        client: 'postgres',
        connection: {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: {
            rejectUnauthorized: false, // Bắt buộc cho Render
          },
        },
        debug: false,
      },
    };
  }

  // Cấu hình cho SQLite (Ở máy local của bạn)
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };
};