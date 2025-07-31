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
    this.speed = options.speed || 10; // скорость в м/с (36 км/ч по умолчанию)
    this.vehicleCoords = options.vehicleCoords || null; // координаты из запроса
    this.interpolate = options.interpolate !== false; // интерполяция включена по умолчанию
  }

  async connectAll() {
    console.log('VehicleRunner env:', this.env, 'clients:', this.clients, 'speed:', this.speed, 'm/s');
    if (!this.clients || this.clients.length === 0) {
      console.error('❌ Укажи хотя бы один клиент. Пример: node vehicleRunner.js client1 client2');
      throw new Error('Нет клиентов');
    }
    
    const results = await Promise.all(this.clients.map(async (client) => {
      try {
        // Проверяем, есть ли кастомные координаты для этого клиента
        const hasCustomCoords = this.vehicleCoords && this.vehicleCoords[client];
        
        if (hasCustomCoords) {
          // Для кастомных координат не проверяем файл
          console.log(`✅ [${client}] Используем кастомные координаты, пропускаем проверку файла`);
          return { client, status: 'ready', error: null };
        } else {
          // Проверяем, что файл данных существует только для файловых клиентов
          const clientNum = client.toString().padStart(2, '0');
          const filePath = path.join(__dirname, `vehicles_${this.env}`, `vehicle_${clientNum}.json`);
          console.log('Ищу файл:', filePath);
          if (!fs.existsSync(filePath)) {
            return { client, status: 'error', error: `Файл vehicle_${clientNum}.json не найден` };
          }
          
          return { client, status: 'ready', error: null };
        }
      } catch (err) {
        return { client, status: 'error', error: err.message };
      }
    }));
    
    return results;
  }

  async runInBackground() {
    // Запускать Vehicle для всех клиентов в фоне
    for (const client of this.clients) {
      // Получаем координаты для этого клиента из запроса или null
      let customCoords = null;
      if (this.vehicleCoords && this.vehicleCoords[client]) {
        const coordsData = this.vehicleCoords[client];
        
        // Проверяем формат данных
        if (Array.isArray(coordsData)) {
          // Простой массив координат [lon, lat]
          customCoords = coordsData;
        } else if (coordsData.coords && coordsData.client) {
          // Объект с координатами и client ID
          customCoords = {
            coords: coordsData.coords,
            client: coordsData.client,
            speed: coordsData.speed, // кастомная скорость
            interpolate: coordsData.interpolate // кастомная интерполяция
          };
        } else {
          console.warn(`⚠️ Неверный формат координат для ${client}:`, coordsData);
        }
      }
      
      const vehicle = new Vehicle(client, this.env, { 
        duration: this.duration,
        delay: 1000,
        speed: this.speed, // если указан в запросе, переопределит значение из файла
        customCoords: customCoords, // координаты из запроса для этого клиента
        interpolate: this.interpolate // передаем настройку интерполяции
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