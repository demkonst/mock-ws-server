const { Vehicle } = require('./vehicle');
const fs = require('fs');
const path = require('path');

class VehicleRunner {
  constructor(clients, env = 'dev', options = {}) {
    this.clients = clients;
    this.env = env;
    this.debug = options.debug || false;
    this.logBuffer = [];
    this.vehicleMap = new Map(); // client -> vehicle
    this.vehicleRegistry = options.vehicleRegistry || null; // глобальный реестр vehicles
    this.duration = options.duration || 300; // длительность в секундах
  }

  async connectAll() {
    console.log('VehicleRunner env:', this.env, 'clients:', this.clients);
    if (!this.clients || this.clients.length === 0) {
      console.error('❌ Укажи хотя бы один клиент. Пример: node vehicleRunner.js client1 client2');
      throw new Error('Нет клиентов');
    }
    
    const results = await Promise.all(this.clients.map(async (client) => {
      try {
        // Проверяем, что файл данных существует
        const clientNum = client.toString().padStart(2, '0');
        const filePath = path.join(__dirname, `vehicles_${this.env}`, `vehicle_${clientNum}.json`);
        console.log('Ищу файл:', filePath);
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
    // Запускать Vehicle для всех клиентов в фоне
    for (const client of this.clients) {
      const vehicle = new Vehicle(client, this.env, { 
        duration: this.duration,
        delay: 1000 
      });
      this.vehicleMap.set(client, vehicle);
      
      // Добавить в глобальный реестр, если он есть
      if ( this.vehicleRegistry ) {
        this.vehicleRegistry.set( client, vehicle );
      }

      vehicle.run().catch(err => {
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
    console.log( `🛑 Останавливаем VehicleRunner для клиентов: [${this.clients.join( ', ' )}]` );

    for (const [client, vehicle] of this.vehicleMap) {
      try {
        console.log( `🛑 Останавливаем vehicle для клиента ${client}` );
        vehicle.stop();
      } catch ( e ) {
        console.error( `Ошибка при остановке vehicle для клиента ${client}:`, e );
      }
    }

    // Очистить локальный реестр
    this.vehicleMap.clear();

    // Очистить глобальный реестр
    if ( this.vehicleRegistry ) {
      for ( const client of this.clients ) {
        this.vehicleRegistry.delete( client );
      }
    }
  }
}

if (require.main === module) {
  const clients = process.argv.slice(2);
  const env = process.env.ENV || 'dev';
  const runner = new VehicleRunner(clients, env, { debug: true });
  runner.run().catch(() => process.exit(1));
}

module.exports = { VehicleRunner }; 