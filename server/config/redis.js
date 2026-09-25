// server/src/config/redis.js
class RedisMock {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value, mode, duration) {
    this.store.set(key, value);
    return 'OK';
  }

  async del(key) {
    this.store.delete(key);
    return 1;
  }

  async sadd(key, value) {
    if (!this.store.has(key)) {
      this.store.set(key, new Set());
    }
    this.store.get(key).add(value);
    return 1;
  }

  async srem(key, value) {
    if (this.store.has(key)) {
      this.store.get(key).delete(value);
    }
    return 1;
  }

  async scard(key) {
    return this.store.has(key) ? this.store.get(key).size : 0;
  }

  async smembers(key) {
    return this.store.has(key) ? Array.from(this.store.get(key)) : [];
  }

  on(event, callback) {
    if (event === 'connect') {
      // Симулируем успешное подключение
      setTimeout(callback, 10);
    }
    // Для эвента 'error' ничего не делаем, так как это Mock
    return this;
  }

  connect() {
    console.log('⚠️ Redis mock: using in-memory storage');
    return this;
  }

  quit() {
    return Promise.resolve('OK');
  }
}

const client = new RedisMock();
module.exports = client;
