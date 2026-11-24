const { createClient } = require('redis');

const redis = createClient({
  database: Number(process.env.REDIS_DB || 0),
  socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379) }
});
redis.on('error', hata => console.error('Redis:', hata.message));

async function baslat() {
  await redis.connect();
  if (await redis.get('menu-sema-surumu') !== '4') {
    const eski = [];
    for await (const grup of redis.scanIterator({ MATCH: 'menu:*' })) eski.push(...grup);
    for (const anahtar of eski) await redis.del(anahtar);
    await redis.set('menu-sema-surumu', '4');
  }
}

module.exports = { redis, baslat };
