const fs = require('fs');
const WebSocket = require('ws');
const dotenv = require('dotenv');

let lastLoadedEnv = null;
function loadEnvFor(env) {
  if (lastLoadedEnv !== env) {
    dotenv.config({ path: `.env.${env}` });
    lastLoadedEnv = env;
  }
}

function connectOperator(operator, env = 'dev') {
  loadEnvFor(env);
  if (!operator) {
    console.error('❌ Не указан оператор!');
    return Promise.reject(new Error('Не указан оператор'));
  }

  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    console.error('❌ BASE_URL не определён в .env');
    return Promise.reject(new Error('Не найден BASE_URL'));
  }
  const wsUrl = `${baseUrl}/api/collector/locations/ws`;
  
  // Форматируем номер оператора с ведущим нулем для поиска токена
  const operatorNum = operator.toString().padStart(2, '0');
  const TOKEN = process.env[`AUTH_TOKEN_OPERATOR_${operatorNum}`];

  if (!TOKEN) {
    console.error(`❌ Не найден токен для оператора "${operator}" (AUTH_TOKEN_OPERATOR_${operatorNum})`);
    return Promise.reject(new Error('Не найден токен'));
  }

  return new Promise((resolve, reject) => {
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

function runOperator(operator, env = 'dev', ws = null, timeout = null) {
  loadEnvFor(env);
  let messages;
  try {
    // Форматируем номер оператора с ведущим нулем
    const operatorNum = operator.toString().padStart(2, '0');
    messages = JSON.parse(fs.readFileSync(`operators_${env}/operator_${operatorNum}.json`));
  } catch (err) {
    console.error(`❌ Не удалось прочитать operators_${env}/operator_${operator.toString().padStart(2, '0')}.json: ${err.message}`);
    return Promise.reject(err);
  }

  const getWs = ws
    ? Promise.resolve({ ws })
    : connectOperator(operator, env);

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
