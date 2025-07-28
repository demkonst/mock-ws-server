const { Transport } = require('./transport');
const fs = require('fs');
const path = require('path');

class TransportRunner {
  constructor(clients, env = 'dev', options = {}) {
    this.clients = clients;
    this.env = env;
    this.debug = options.debug || false;
    this.logBuffer = [];
    this.transportMap = new Map(); // client -> transport
    this.duration = options.duration || 300; // длительность в секундах
  }

  async connectAll() {
    if (!this.clients || this.clients.length === 0) {
      console.error('❌ Укажи хотя бы один клиент. Пример: node transportRunner.js client1 client2');
      throw new Error('Нет клиентов');
    }
    
    const results = await Promise.all(this.clients.map(async (client) => {
      try {
        // Проверяем, что файл данных существует
        const clientNum = client.toString().padStart(2, '0');
        const filePath = path.join(__dirname, 'vehicles', `vehicle_${clientNum}.json`);
        if (!fs.existsSync(filePath)) {
          return { client, status: 'error', error: `Файл vehicle_${clientNum}.json не найден` };
        }
        
        return { client, status: 'ready', error: null };
      } catch (err) {
        return { client, status: 'error', error: err.message };
      }
    }));
    
    return results;
  }

  async runInBackground() {
    // Запускать Transport для всех клиентов в фоне
    for (const client of this.clients) {
      const transport = new Transport(client, this.env, { 
        duration: this.duration,
        delay: 1000 
      });
      this.transportMap.set(client, transport);
      
      transport.run().catch(err => {
        console.error(`[${client}] Ошибка в фоне:`, err);
      });
    }
  }

  async run() {
    const statuses = await this.connectAll();
    // Запускать основную работу в фоне
    this.runInBackground();
    return statuses;
  }

  stopAll() {
    for (const [client, transport] of this.transportMap) {
      transport.stop();
    }
    this.transportMap.clear();
  }
}

if (require.main === module) {
  const clients = process.argv.slice(2);
  const env = process.env.ENV || 'dev';
  const runner = new TransportRunner(clients, env, { debug: true });
  runner.run().catch(() => process.exit(1));
}

module.exports = { TransportRunner }; 