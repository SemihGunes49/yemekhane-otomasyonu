const mysql = require('mysql2/promise');

const ayarlar = {
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_ADI,
  user: process.env.DB_KULLANICI,
  password: process.env.DB_SIFRE,
  dateStrings: true,
  connectionLimit: 10
};

module.exports = {
  okuma: mysql.createPool({ ...ayarlar, host: process.env.DB_OKUMA_HOST, port: Number(process.env.DB_OKUMA_PORT || ayarlar.port) }),
  yazma: mysql.createPool({ ...ayarlar, host: process.env.DB_YAZMA_HOST, port: Number(process.env.DB_YAZMA_PORT || ayarlar.port) })
};
