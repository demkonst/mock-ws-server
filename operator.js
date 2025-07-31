const fs = require('fs');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const { interpolateCoordinates, calculateDistance } = require('./vehicle.js');

function loadEnvFor(env) {
  dotenv.config({ path: `.env.${env}` });
}

async function getOperatorToken(operatorId, env = 'dev') {
  loadEnvFor(env);
  const baseUrl = process.env.BASE_URL_UNITS;
  const authHeader = process.env.AUTH_HEADER || 'Basic aW5rLW1vbjppbmttb25pdG9yaW5n';
  
  if (!baseUrl) {
    throw new Error('Не найден BASE_URL_UNITS');
  }

  // Преобразуем имя оператора в числовой ID через маппинг
  const numericOperatorId = operatorId;
  console.log(`🔄 [${operatorId}] ID оператора для API: ${numericOperatorId}`);
  console.log(`🔗 [${operatorId}] URL: ${baseUrl.replace(/\/$/, '')}/operators/credentials?operator_id=${numericOperatorId}`);
  console.log(`🔐 [${operatorId}] Auth header: ${authHeader}`);

  try {
    // Получаем credentials для оператора
    const credentialsUrl = `${baseUrl.replace(/\/$/, '')}/operators/credentials?operator_id=${numericOperatorId}`;
    const credentialsResponse = await fetch(credentialsUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    });

    console.log(`📡 [${operatorId}] Response status: ${credentialsResponse.status}`);
    console.log(`📡 [${operatorId}] Response headers:`, Object.fromEntries(credentialsResponse.headers.entries()));

    if (!credentialsResponse.ok) {
      const errorText = await credentialsResponse.text();
      console.error(`❌ [${operatorId}] Error response: ${errorText}`);
      throw new Error(`Ошибка получения credentials: ${credentialsResponse.status}`);
    }

    const credentials = await credentialsResponse.json();
    console.log(`📋 [${operatorId}] Получены credentials`);

    // Логинимся с полученными credentials
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/auth/operator/login`;
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        login: credentials.login,
        password: credentials.password
      })
    });

    console.log(`🔐 [${operatorId}] Login response status: ${loginResponse.status}`);

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error(`❌ [${operatorId}] Login error response: ${errorText}`);
      throw new Error(`Ошибка логина: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log(`🔑 [${operatorId}] Получен токен: ${loginData.token || loginData.access_token}`);
    
    return loginData.token || loginData.access_token;
  } catch (error) {
    console.error(`❌ [${operatorId}] Ошибка получения токена:`, error.message);
    throw error;
  }
}

function connectOperator(operator, env = 'dev', operatorId = null) {
  loadEnvFor(env);
  if (!operator) {
    console.error('❌ Не указан оператор!');
    return Promise.reject(new Error('Не указан оператор'));
  }

  const baseUrl = process.env.BASE_URL_COLLECTOR;
  if (!baseUrl) {
    console.error('❌ BASE_URL_COLLECTOR не определён в .env');
    return Promise.reject(new Error('Не найден BASE_URL_COLLECTOR'));
  }
  const wsUrl = `${baseUrl.replace(/\/$/, '')}/locations/ws`;
  console.log(`🔗 [${operator}] WebSocket URL: ${wsUrl}`);
  
  return new Promise(async (resolve, reject) => {
    try {
      let TOKEN;
      
      // Всегда используем API для получения токена
      // Если operatorId передан, используем его, иначе используем имя оператора
      console.log(`🔍 [${operator}] operatorId: "${operatorId}", operator: "${operator}"`);
      const targetOperatorId = (operatorId && operatorId !== 'null') ? operatorId : operator;
      console.log(`🔍 [${operator}] targetOperatorId: "${targetOperatorId}"`);
      TOKEN = await getOperatorToken(targetOperatorId, env);
      console.log(`🔐 [${operator}] Используем токен: ${TOKEN.substring(0, 20)}...`);

      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      });
      
      ws.once('open', () => {
        console.log(`✅ [${operator}] Подключено`);
        resolve({ ws });
      });
      
      ws.once('error', err => {
        console.error(`⚠️ [${operator}] Ошибка подключения: ${err.message}`);
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getCloseReason(code, reason) {
  const reasons = {
    1000: 'Normal Closure',
    1001: 'Going Away',
    1002: 'Protocol Error',
    1003: 'Unsupported Data',
    1005: 'No Status Received',
    1006: 'Abnormal Closure',
    1007: 'Invalid frame payload data',
    1008: 'Policy Violation',
    1009: 'Message too big',
    1010: 'Mandatory Extension',
    1011: 'Internal Server Error',
    1015: 'TLS Handshake'
  };
  const reasonText = reasons[code] || 'Unknown';
  return `${reasonText} (${code})${reason ? ` - ${reason}` : ''}`;
}

function generateMessagesFromWaypoints(waypoints, config) {
  const { speed = 40, course = 90, altitude = 10, delay = 2000, interpolate = true } = config;
  
  // Конвертируем координаты из [lon, lat] или [lat, lon] в {lat, lon}
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
      return coord; // уже в правильном формате
    } else {
      throw new Error(`Неверный формат координаты: ${JSON.stringify(coord)}. Ожидается [lon, lat], [lat, lon] или {lat, lon}`);
    }
  });
  
  let finalCoords;
  
  if (interpolate) {
    // Интерполируем координаты на основе скорости
    const speedMps = speed / 3.6; // конвертируем км/ч в м/с
    const intervalMs = delay; // используем delay как интервал
    finalCoords = interpolateCoordinates(convertedWaypoints, speedMps, intervalMs);
    console.log(`🔄 [Operator] Интерполяция: ${convertedWaypoints.length} waypoints → ${finalCoords.length} точек`);
  } else {
    // Используем waypoints как есть, без интерполяции
    finalCoords = convertedWaypoints;
    console.log(`📍 [Operator] Без интерполяции: ${finalCoords.length} waypoints`);
  }
  
  // Генерируем сообщения для каждой точки
  const messages = finalCoords.map((coord, index) => {
    return {
      payload: {
        lat: coord.lat,
        lon: coord.lon,
        timestamp: Math.floor(Date.now() / 1000) + index * 2,
        speed: speed,
        speed_accuracy: 1,
        course: course,
        course_accuracy: 5,
        altitude: altitude,
        altitude_accuracy: 2
      },
      delay: delay
    };
  });
  
  return messages;
}

function runOperator(operator, env = 'dev', ws = null, timeout = null, customCoords = null, operatorId = null) {
  loadEnvFor(env);
  console.log(`🔍 [${operator}] runOperator вызван с operatorId: "${operatorId}"`);
  let messages;
  
  try {
          if (customCoords) {
        // Используем кастомные координаты из запроса
        console.log(`🚀 [${operator}] Используем кастомные координаты: ${customCoords.length} точек`);
        
        if (Array.isArray(customCoords)) {
          // Простой массив координат [lon, lat]
          messages = generateMessagesFromWaypoints(customCoords, {
            speed: 40,
            course: 90,
            altitude: 10,
            delay: 2000,
            interpolate: true
          });
        } else if (customCoords.coords && customCoords.operator_id) {
          // Объект с координатами и operator_id
          const config = {
            speed: customCoords.speed || 40,
            course: customCoords.course || 90,
            altitude: customCoords.altitude || 10,
            delay: customCoords.delay || 2000,
            interpolate: customCoords.interpolate !== false
          };
          
          console.log(`⚡ [${operator}] Кастомные параметры: скорость=${config.speed} км/ч, курс=${config.course}°, высота=${config.altitude}м, задержка=${config.delay}мс, интерполяция=${config.interpolate}`);
          
          messages = generateMessagesFromWaypoints(customCoords.coords, config);
          operatorId = customCoords.operator_id;
        } else {
          throw new Error(`Неверный формат кастомных координат для ${operator}`);
        }
    } else {
      // Используем координаты из файла
      const operatorNum = operator.toString().padStart(2, '0');
      const filePath = `operators_${env}/operator_${operatorNum}.json`;
      const fileContent = fs.readFileSync(filePath);
      const data = JSON.parse(fileContent);
      
      // Проверяем, является ли это новым форматом с waypoints
      if (data.waypoints && Array.isArray(data.waypoints)) {
        // Новый формат: генерируем сообщения из waypoints
        console.log(`🚀 [${operator}] Используем новый формат с waypoints: ${data.waypoints.length} точек`);
        messages = generateMessagesFromWaypoints(data.waypoints, data);
      } else if (Array.isArray(data)) {
        // Старый формат: массив сообщений
        console.log(`🚀 [${operator}] Используем старый формат: ${data.length} сообщений`);
        messages = data;
      } else {
        throw new Error(`Неизвестный формат файла оператора: ${filePath}`);
      }
      
      // Для файловых операторов используем ID из имени файла (с обрезкой ведущих нулей)
      if (!operatorId || operatorId === 'null') {
        // Убираем ведущие нули из имени оператора для получения числового ID
        console.log(`🔍 [${operator}] Исходное имя оператора: "${operator}"`);
        const withoutLeadingZeros = operator.replace(/^0+/, '');
        console.log(`🔍 [${operator}] После удаления ведущих нулей: "${withoutLeadingZeros}"`);
        operatorId = withoutLeadingZeros || operator;
        console.log(`🆔 [${operator}] ID оператора из имени файла: ${operatorId}`);
      }
    }
  } catch (err) {
    console.error(`❌ Не удалось прочитать operators_${env}/operator_${operator.toString().padStart(2, '0')}.json: ${err.message}`);
    return Promise.reject(err);
  }

  const getWs = ws
    ? Promise.resolve({ ws })
    : connectOperator(operator, env, operatorId);

  return getWs.then(({ ws }) => {
    return new Promise((resolve, reject) => {
      let output = '';
      let totalDelay = 0;
      let timeoutId = null;
      let isRunning = true;
      let activeTimers = []; // Массив для отслеживания активных таймеров

      // Установить таймаут, если передан
      if (timeout) {
        timeoutId = setTimeout(() => {
          isRunning = false;
          console.log(`⏰ [${operator}] Длительность истекла (${timeout}с), завершаем отправку`);
          // Очистить все активные таймеры
          activeTimers.forEach( timerId => clearTimeout( timerId ) );
          activeTimers = [];
          resolve(output);
        }, timeout * 1000);
      }

      ws.on('message', data => {
        console.log(`⬅️ [${operator}] ${data}`);
        output += `⬅️ [${operator}] ${data}\n`;
      });

      ws.on('close', (code, reason) => {
        isRunning = false;
        if ( timeoutId ) {
          clearTimeout( timeoutId );
          timeoutId = null;
        }
        // Очистить все активные таймеры
        activeTimers.forEach( timerId => clearTimeout( timerId ) );
        activeTimers = [];
        const closeReason = getCloseReason(code, reason);
        console.log(`❌ [${operator}] Закрыто: ${closeReason}`);
        output += `❌ [${operator}] Закрыто: ${closeReason}\n`;
        resolve(output);
      });

      ws.on('error', err => {
        isRunning = false;
        if ( timeoutId ) {
          clearTimeout( timeoutId );
          timeoutId = null;
        }
        // Очистить все активные таймеры
        activeTimers.forEach( timerId => clearTimeout( timerId ) );
        activeTimers = [];
        console.error(`⚠️ [${operator}] Ошибка: ${err.message}`);
        output += `⚠️ [${operator}] Ошибка: ${err.message}\n`;
        reject(err);
      });

      // Функция для отправки сообщений
      function sendMessages() {
        if (!isRunning) return;
        
        let cycleDelay = 0;
        messages.forEach((msg, index) => {
          cycleDelay += msg.delay;
          const timerId = setTimeout( () => {
            if (!isRunning) return;
            
            const updatedMsg = {
              ...msg,
              payload: {
                ...msg.payload,
                timestamp: Math.floor(Date.now() / 1000)
              }
            };
            const json = JSON.stringify(updatedMsg);
            console.log(`➡️ [${operator}] ${json}`);
            output += `➡️ [${operator}] ${json}\n`;

            try {
              ws.send( json );
            } catch ( err ) {
              console.error( `⚠️ [${operator}] Ошибка отправки: ${err.message}` );
              isRunning = false;
              return;
            }
            
            // Если это последнее сообщение в цикле, запустить следующий цикл
            if (index === messages.length - 1) {
              const cycleTimerId = setTimeout( () => {
                if (isRunning) {
                  sendMessages(); // Рекурсивно запустить следующий цикл
                }
              }, 1000); // Пауза 1 секунда между циклами
              activeTimers.push( cycleTimerId );
            }
          }, cycleDelay);
          activeTimers.push( timerId );
        });
      }

      // Запустить отправку сообщений
      sendMessages();
    });
  });
}

if (require.main === module) {
  const operator = process.argv[2] || process.env.REGION;
  const env = process.env.ENV || 'dev';
  runOperator(operator, env).catch(err => process.exit(1));
}

module.exports = { runOperator, connectOperator };
