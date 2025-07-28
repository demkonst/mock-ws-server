require('dotenv').config({ path: `.env.${process.env.ENV || 'dev'}` });

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const moment = require('moment');

const BASE_URL = process.env.TRANSPORT_BASE_URL;
const VEHICLES_DIR = path.join(__dirname, 'vehicles');
const DELAY_MS = 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Transport {
  constructor(client, env = 'dev', options = {}) {
    this.client = client; // это номер файла (например, "16")
    this.env = env;
    this.duration = options.duration || 300; // длительность в секундах
    this.delay = options.delay || DELAY_MS;
    this.isRunning = false;
  }

  async sendCoordinate({ lat, lon }) {
    const navigation_time = moment().format('YYYY-MM-DDTHH:mm:ss+02:00');

    const payload = {
      telemetry: [
        {
          client: this.clientId, // используем ID из файла
          navigation_time,
          latitude: lat,
          longitude: lon,
          moving: true,
          distance: 1930,
          nsat: 3,
          pdop: 4,
          speed: 80
        }
      ]
    };

    console.log(`📤 [${this.client}] Request payload:`, JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(BASE_URL, payload);
      console.log(`✅ [${this.client}] (${lat}, ${lon}) => ${response.status}`);
      return { success: true, status: response.status };
    } catch (err) {
      console.error(`❌ [${this.client}] (${lat}, ${lon}) => ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async run() {
    if (!BASE_URL) {
      console.error(`❌ Не найден TRANSPORT_BASE_URL для клиента "${this.client}"`);
      return Promise.reject(new Error('Не найден TRANSPORT_BASE_URL'));
    }

    // Форматируем номер клиента с ведущим нулем для поиска файла
    const clientNum = this.client.toString().padStart(2, '0');
    const filePath = path.join(VEHICLES_DIR, `vehicle_${clientNum}.json`);
    let coords;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Получаем ID клиента из файла
      this.clientId = data.client;
      if (!this.clientId) {
        throw new Error('Поле "client" не найдено в JSON файле');
      }
      
      coords = data.coords || data;
      console.log(`🚀 [${this.client}] Запуск, ID клиента: ${this.clientId}, координат: ${coords.length}`);
    } catch (err) {
      console.error(`❌ Не удалось прочитать ${filePath}: ${err.message}`);
      return Promise.reject(err);
    }

    return new Promise((resolve) => {
      this.isRunning = true;
      const startTime = Date.now();
      const maxDuration = this.duration * 1000; // конвертируем секунды в миллисекунды
      let index = 0;
      let results = [];

      const sendNext = async () => {
        if (!this.isRunning) {
          resolve(results);
          return;
        }

        if (Date.now() - startTime >= maxDuration) {
          console.log(`⏰ [${this.client}] Длительность истекла (${this.duration}с), завершаем отправку`);
          this.isRunning = false;
          resolve(results);
          return;
        }

        const coord = coords[index];
        const result = await this.sendCoordinate(coord);
        results.push(result);
        
        index = (index + 1) % coords.length;
        
        setTimeout(sendNext, this.delay);
      };

      sendNext();
    });
  }

  stop() {
    this.isRunning = false;
    console.log(`⏹️ [${this.client}] Остановлен`);
  }
}

if (require.main === module) {
  const client = process.argv[2];
  const env = process.env.ENV || 'dev';
  
  if (!client) {
    console.error('⚠️ Укажи имя клиента: node transport.js client1');
    process.exit(1);
  }

  const transport = new Transport(client, env);
  transport.run().catch(err => {
    console.error(`❌ Ошибка: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { Transport };
