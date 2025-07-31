const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const moment = require('moment');
const dotenv = require('dotenv');

function loadEnvFor(env) {
  dotenv.config({ path: `.env.${env}` });
  console.log(`[Vehicle] Загружен .env.${env}, VEHICLE_BASE_URL:`, process.env.VEHICLE_BASE_URL);
}

const VEHICLES_DIR = path.join(__dirname, 'vehicles');
const DELAY_MS = 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для расчёта расстояния между двумя точками в метрах
function calculateDistance(point1, point2) {
  const R = 6371e3; // радиус Земли в метрах
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lon - point1.lon) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // расстояние в метрах
}

// Функция для интерполяции координат с учётом скорости
function interpolateCoordinates(waypoints, speedMps, intervalMs = 1000) {
  if (!waypoints || waypoints.length < 2) {
    return waypoints;
  }

  const interpolatedCoords = [];
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    
    // Расстояние между точками в метрах
    const distance = calculateDistance(start, end);
    
    // Время, необходимое для прохождения этого участка в секундах
    const timeNeeded = distance / speedMps;
    
    // Количество промежуточных точек на основе интервала
    const steps = Math.ceil(timeNeeded / (intervalMs / 1000));
    
    console.log(`🔄 [Interpolation] Участок ${i+1}: ${distance.toFixed(1)}м, ${timeNeeded.toFixed(1)}с, ${steps} шагов`);
    
    // Добавляем начальную точку (кроме первого участка, чтобы избежать дублирования)
    if (i === 0) {
      interpolatedCoords.push(start);
    }
    
    // Генерируем промежуточные точки
    for (let j = 1; j <= steps; j++) {
      const ratio = j / steps;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lon = start.lon + (end.lon - start.lon) * ratio;
      
      interpolatedCoords.push({ lat, lon });
    }
  }
  
  // Добавляем последнюю точку маршрута
  interpolatedCoords.push(waypoints[waypoints.length - 1]);
  
  console.log(`📊 [Interpolation] Исходных точек: ${waypoints.length}, интерполированных: ${interpolatedCoords.length}`);
  
  return interpolatedCoords;
}

class Vehicle {
  constructor(client, env = 'dev', options = {}) {
    loadEnvFor(env);
    console.log(`[Vehicle ${client}] Конструктор, env: ${env}, VEHICLE_BASE_URL:`, process.env.VEHICLE_BASE_URL);
    this.client = client;
    this.env = env;
    this.duration = options.duration || 300; // длительность в секундах
    this.delay = options.delay || DELAY_MS;
    this.speed = options.speed || 10; // скорость в м/с (36 км/ч по умолчанию)
    this.customCoords = options.customCoords || null; // кастомные координаты из запроса
    this.interpolate = options.interpolate !== false; // интерполяция включена по умолчанию
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
          speed: Math.round(this.speed * 3.6) // конвертируем м/с в км/ч
        }
      ]
    };

    console.log(`📤 [${this.client}] Отправляем координату: (${lat.toFixed(8)}, ${lon.toFixed(8)})`);

    try {
      const response = await axios.post(process.env.BASE_URL_CONNECTOR + '/debug/locations/vehicle', payload);
      console.log(`✅ [${this.client}] (${lat.toFixed(8)}, ${lon.toFixed(8)}) => ${response.status}`);
      return { success: true, status: response.status };
    } catch (err) {
      console.error(`❌ [${this.client}] (${lat.toFixed(8)}, ${lon.toFixed(8)}) => ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async run() {
    console.log(`[Vehicle ${this.client}] run(), BASE_URL_CONNECTOR:`, process.env.BASE_URL_CONNECTOR);
    const baseUrl = process.env.BASE_URL_CONNECTOR;
    if (!baseUrl) {
      console.error(`❌ Не найден BASE_URL_CONNECTOR для клиента "${this.client}"`);
      return Promise.reject(new Error('Не найден BASE_URL_CONNECTOR'));
    }
    const vehicleBaseUrl = `${baseUrl}/debug/locations/vehicle`;

    let coords;
    
    // Если есть кастомные координаты из запроса, используем их
    if (this.customCoords) {
      // Проверяем формат кастомных координат
      if (Array.isArray(this.customCoords)) {
        // Простой массив координат - используем дефолтный client ID
        console.log(`🚀 [${this.client}] Используем кастомные координаты из запроса, waypoints: ${this.customCoords.length}`);
        this.clientId = 999999; // дефолтный ID для кастомных координат
        
        // Конвертируем формат координат из [lon, lat] в {lat, lon}
        const convertedCoords = this.customCoords.map(coord => {
          if (Array.isArray(coord) && coord.length === 2) {
            // Определяем, какой формат используется: [lon, lat] или [lat, lon]
            const first = coord[0];
            const second = coord[1];
            
            // Если первое значение > 90, то это долгота (lon), иначе широта (lat)
            if (Math.abs(first) > 90) {
              // Формат [lon, lat] - нужно поменять местами
              return { lon: first, lat: second };
            } else {
              // Формат [lat, lon] - уже в правильном порядке
              return { lat: first, lon: second };
            }
          } else if (coord.lat && coord.lon) {
            return coord; // уже в правильном формате
          } else {
            throw new Error(`Неверный формат координаты: ${JSON.stringify(coord)}. Ожидается [lon, lat], [lat, lon] или {lat, lon}`);
          }
        });
        
        if (this.interpolate) {
          coords = interpolateCoordinates(convertedCoords, this.speed, this.delay);
          console.log(`🔄 [Vehicle] Интерполяция: ${convertedCoords.length} waypoints → ${coords.length} точек`);
        } else {
          coords = convertedCoords;
          console.log(`📍 [Vehicle] Без интерполяции: ${coords.length} waypoints`);
        }
      } else if (this.customCoords.coords && this.customCoords.client) {
        // Объект с координатами и client ID
        console.log(`🚀 [${this.client}] Используем кастомные координаты с client ID: ${this.customCoords.client}, waypoints: ${this.customCoords.coords.length}`);
        this.clientId = this.customCoords.client;
        
        // Применяем кастомную скорость, если указана
        if (this.customCoords.speed !== undefined) {
          this.speed = this.customCoords.speed;
          console.log(`⚡ [${this.client}] Кастомная скорость: ${this.speed} м/с (${Math.round(this.speed * 3.6)} км/ч)`);
        }
        
        // Применяем кастомную интерполяцию, если указана
        if (this.customCoords.interpolate !== undefined) {
          this.interpolate = this.customCoords.interpolate;
          console.log(`🔄 [${this.client}] Кастомная интерполяция: ${this.interpolate}`);
        }
        
        // Конвертируем формат координат из [lon, lat] в {lat, lon}
        const convertedCoords = this.customCoords.coords.map(coord => {
          if (Array.isArray(coord) && coord.length === 2) {
            // Определяем, какой формат используется: [lon, lat] или [lat, lon]
            const first = coord[0];
            const second = coord[1];
            
            // Если первое значение > 90, то это долгота (lon), иначе широта (lat)
            if (Math.abs(first) > 90) {
              // Формат [lon, lat] - нужно поменять местами
              return { lon: first, lat: second };
            } else {
              // Формат [lat, lon] - уже в правильном порядке
              return { lat: first, lon: second };
            }
          } else if (coord.lat && coord.lon) {
            return coord; // уже в правильном формате
          } else {
            throw new Error(`Неверный формат координаты: ${JSON.stringify(coord)}. Ожидается [lon, lat], [lat, lon] или {lat, lon}`);
          }
        });
        
        if (this.interpolate) {
          coords = interpolateCoordinates(convertedCoords, this.speed, this.delay);
          console.log(`🔄 [Vehicle] Интерполяция: ${convertedCoords.length} waypoints → ${coords.length} точек`);
        } else {
          coords = convertedCoords;
          console.log(`📍 [Vehicle] Без интерполяции: ${coords.length} waypoints`);
        }
      } else {
        throw new Error('Неверный формат кастомных координат. Ожидается массив координат или объект {coords: [...], client: number}');
      }
      
      // Получаем скорость из запроса или используем значение по умолчанию
      console.log(`⚡ [${this.client}] Используем скорость: ${this.speed} м/с (${(this.speed * 3.6).toFixed(1)} км/ч)`);
      console.log(`📊 [${this.client}] После интерполяции координат: ${coords.length}`);
      
    } else {
      // Используем координаты из файла
      const clientNum = this.client.toString().padStart(2, '0');
      const filePath = path.join(__dirname, `vehicles_${this.env}`, `vehicle_${clientNum}.json`);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Получаем ID клиента из файла
        this.clientId = data.client;
        if (!this.clientId) {
          throw new Error('Поле "client" не найдено в JSON файле');
        }
        
        // Получаем исходные координаты (waypoints)
        const waypoints = data.coords || data;
        console.log(`🚀 [${this.client}] Запуск, ID клиента: ${this.clientId}, waypoints: ${waypoints.length}`);
        
        // Конвертируем координаты из файла в нужный формат
        const convertedWaypoints = waypoints.map(coord => {
          if (Array.isArray(coord) && coord.length === 2) {
            // Определяем, какой формат используется: [lon, lat] или [lat, lon]
            const first = coord[0];
            const second = coord[1];
            
            // Если первое значение > 90, то это долгота (lon), иначе широта (lat)
            if (Math.abs(first) > 90) {
              // Формат [lon, lat] - нужно поменять местами
              return { lon: first, lat: second };
            } else {
              // Формат [lat, lon] - уже в правильном порядке
              return { lat: first, lon: second };
            }
          } else if (coord.lat && coord.lon) {
            // Старый формат: {lat, lon}
            return coord;
          } else {
            throw new Error(`Неверный формат координаты в файле: ${JSON.stringify(coord)}. Ожидается [lon, lat], [lat, lon] или {lat, lon}`);
          }
        });
        
        // Получаем скорость из файла или используем значение по умолчанию
        const fileSpeed = data.speed;
        if (fileSpeed !== undefined && this.speed === 10) { // только если скорость не была переопределена в запросе
          this.speed = fileSpeed;
          console.log(`⚡ [${this.client}] Скорость из файла: ${this.speed} м/с (${(this.speed * 3.6).toFixed(1)} км/ч)`);
        } else {
          console.log(`⚡ [${this.client}] Используем скорость: ${this.speed} м/с (${(this.speed * 3.6).toFixed(1)} км/ч)`);
        }
        
        // Проверяем, нужно ли интерполировать координаты
        if (this.interpolate) {
          coords = interpolateCoordinates(convertedWaypoints, this.speed, this.delay);
          console.log(`🔄 [Vehicle] Интерполяция: ${convertedWaypoints.length} waypoints → ${coords.length} точек`);
        } else {
          coords = convertedWaypoints;
          console.log(`📍 [Vehicle] Без интерполяции: ${coords.length} waypoints`);
        }
        
      } catch (err) {
        console.error(`❌ Не удалось прочитать ${filePath}: ${err.message}`);
        return Promise.reject(err);
      }
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
        if (!coord || typeof coord.lat === 'undefined' || typeof coord.lon === 'undefined') {
          console.error(`❌ [${this.client}] Некорректная координата по индексу ${index}:`, coord);
          index = (index + 1) % coords.length;
          setTimeout(sendNext, this.delay);
          return;
        }
        console.log(`🔄 [${this.client}] Индекс: ${index}/${coords.length}, координата: (${coord.lat.toFixed(8)}, ${coord.lon.toFixed(8)})`);
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
    console.error('⚠️ Укажи имя клиента: node vehicle.js client1');
    process.exit(1);
  }

  const vehicle = new Vehicle(client, env);
  vehicle.run().catch(err => {
    console.error(`❌ Ошибка: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { Vehicle, interpolateCoordinates, calculateDistance, delay };
