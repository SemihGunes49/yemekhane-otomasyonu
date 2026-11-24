const { createClient } = require('redis');

const redis = createClient({
  database: Number(process.env.REDIS_DB || 0),
  socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379) }
});
redis.on('error', hata => console.error('Redis:', hata.message));

async function baslat() {
  await redis.connect();

}

module.exports = { redis, baslat };
