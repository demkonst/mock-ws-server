const express = require('express');
const { Runner } = require('./runner');
const { VehicleRunner } = require('./vehicleRunner');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const app = express();
const PORT = 3000;

const wsRegistry = new Map(); // region -> ws
const vehicleRegistry = new Map(); // client -> vehicle
const vehicleRunnerRegistry = new Map(); // env -> vehicleRunner
const runnerRegistry = new Map(); // env -> runner
const notificationTimers = new Map();

app.use(express.json());



function findOperators({ env, operators, allOperators } = {}) {
  const result = [];
  const operatorsDir = path.join(__dirname, `operators_${env}`);
  if (!fs.existsSync(operatorsDir)) return result;
  const files = fs.readdirSync(operatorsDir);
  if (Array.isArray(operators) && operators.length > 0) {
    operators.forEach(name => {
      const fileName = `operator_${name}.json`;
      if (files.includes(fileName)) {
        result.push(name);
      }
    });
    return result;
  }
  if (allOperators) {
    files.forEach(file => {
      const match = file.match(/^operator_(.+)\.json$/);
      if (match && match[1]) result.push(match[1]);
    });
    return result;
  }
  // Если не передано ни массива, ни флага — запускаем все
  files.forEach(file => {
    const match = file.match(/^operator_(.+)\.json$/);
    if (match && match[1]) result.push(match[1]);
  });
  return result;
}

function findClients({ env, vehicles, allVehicles } = {}) {
  const result = [];
  const vehiclesDir = path.join(__dirname, `vehicles_${env}`);
  if (!fs.existsSync(vehiclesDir)) return result;
  const files = fs.readdirSync(vehiclesDir);
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    vehicles.forEach(name => {
      const fileName = `vehicle_${name}.json`;
      if (files.includes(fileName)) {
        result.push(name);
      }
    });
    return result;
  }
  if (allVehicles) {
    files.forEach(file => {
      const match = file.match(/^vehicle_(.+)\.json$/);
      if (match && match[1]) result.push(match[1]);
    });
    return result;
  }
  // Если не передано ни массива, ни флага — запускаем все
  files.forEach(file => {
    const match = file.match(/^vehicle_(.+)\.json$/);
    if (match && match[1]) result.push(match[1]);
  });
  return result;
}

const messages = [
  "Оператор опоздал на смену",
  "Оператор в пути",
  "Оператор прибыл в геозону №2446"
];

app.post('/run', async (req, res) => {
  try {
  const env = req.body.env || 'demo';
    // Загружаем .env.<env> файл
    try {
      dotenv.config({ path: `.env.${env}` });
      console.log(`Загружен .env.${env}`);
    } catch (e) {
      console.warn(`Не удалось загрузить .env.${env}:`, e.message);
    }
    const operators = req.body.operators;
    const vehicles = req.body.vehicles;
    const allOperators = req.body.allOperators;
    const allVehicles = req.body.allVehicles;
    const duration = req.body.duration || null;
    const notifications = req.body.notifications;

    const operatorList = findOperators({ env, operators, allOperators });
    const vehicleList = findClients({ env, vehicles, allVehicles });
    
    // Определяем, что было передано
    const hasOperators = (operators && operators.length > 0) || allOperators;
    const hasVehicles = (vehicles && vehicles.length > 0) || allVehicles;
    const hasAnySpecific = hasOperators || hasVehicles;
    
    console.log(`🔄 Получен новый запрос:`);
    console.log(`   📡 Операторы: [${operatorList.join(', ')}]`);
    console.log(`   🚛 Транспорт: [${vehicleList.join(', ')}]`);
    console.log(`   🔄 Сбрасываем старые процессы...`);
    
    if (duration) {
      console.log(`⏰ Длительность: ${duration} секунд`);
    }
  
  // Остановить старые runner'ы
  for ( const [ envKey, runner ] of runnerRegistry.entries() ) {
    try {
      console.log( `🛑 Останавливаем старый Runner для ${envKey}` );
      runner.stopAll();
    } catch ( e ) {
      console.error( `Ошибка при остановке Runner для ${envKey}:`, e );
    }
  }
  runnerRegistry.clear();

  // Остановить старые vehicleRunner'ы
  for ( const [ envKey, vehicleRunner ] of vehicleRunnerRegistry.entries() ) {
    try {
      console.log( `🛑 Останавливаем старый vehicleRunner для ${envKey}` );
      vehicleRunner.stopAll();
    } catch ( e ) {
      console.error( `Ошибка при остановке vehicleRunner для ${envKey}:`, e );
    }
  }
  vehicleRunnerRegistry.clear();

  // Завершить все старые ws
  for (const ws of wsRegistry.values()) {
    try {
      ws.close();
    } catch (e) {
      // ignore
    }
  }
  wsRegistry.clear();

  // Остановить все старые транспорты
  for (const vehicle of vehicleRegistry.values()) {
    try {
      vehicle.stop();
    } catch (e) {
      // ignore
    }
  }
  vehicleRegistry.clear();

  const results = {};

    // Проверка и создание смен перед запуском процессов
    try {
      const baseUrl = process.env.BASE_URL;
      if (baseUrl) {
        console.log('🔍 Проверяем текущие смены...');
        
        // Проверяем текущие смены
        const currentShiftsResponse = await fetch(`${baseUrl}/api/units/shifts/current`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Basic aW5rLW1vbjppbmttb25pdG9yaW5n'
          }
        });
        const currentShiftsData = await currentShiftsResponse.text();
        console.log(`📊 Статус проверки смен: ${currentShiftsResponse.status}, данные: ${currentShiftsData.substring(0, 100)}...`);
        
        if (currentShiftsResponse.status === 404 || !currentShiftsData || currentShiftsData === '[]') {
          console.log('⚠️ Текущие смены не найдены, создаём новые...');
          
          // Получаем шаблоны смен
          const templatesResponse = await fetch(`${baseUrl}/api/units/shift-templates`, {
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Basic aW5rLW1vbjppbmttb25pdG9yaW5n'
            }
          });
          console.log(`📊 Статус получения шаблонов: ${templatesResponse.status}`);
          
          if (templatesResponse.ok) {
            const templatesText = await templatesResponse.text();
            console.log(`📊 Сырой ответ от сервера: ${templatesText.substring(0, 200)}...`);
            
            let templates;
            try {
              templates = JSON.parse(templatesText);
            } catch (e) {
              console.error(`❌ Ошибка парсинга JSON: ${e.message}`);
              templates = null;
            }
            
            console.log(`📊 Получено шаблонов: ${templates && templates.items ? templates.items.length : 0}`);
            
            if (templates && templates.items && templates.items.length > 0) {
              // Создаём смены для каждого шаблона
              const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
              console.log(`📅 Создаём смены на дату: ${today}`);
              
              for (const template of templates.items) {
                console.log(`🔄 Создаём смену для шаблона ID: ${template.id}`);
                const shiftData = {
                  shift_template_id: template.id,
                  shift_date: today
                };
                
                const createShiftResponse = await fetch(`${baseUrl}/api/units/shifts`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Basic aW5rLW1vbjppbmttb25pdG9yaW5n'
                  },
                  body: JSON.stringify(shiftData)
                });
                
                const createShiftData = await createShiftResponse.text();
                console.log(`📊 Статус создания смены ${template.id}: ${createShiftResponse.status}, ответ: ${createShiftData.substring(0, 100)}...`);
                
                if (createShiftResponse.ok) {
                  console.log(`✅ Смена создана для шаблона ${template.id}`);
                } else {
                  console.error(`❌ Ошибка создания смены для шаблона ${template.id}: ${createShiftResponse.status} - ${createShiftData}`);
                }
              }
            } else {
              console.warn('⚠️ Шаблоны смен не найдены или пустой массив');
            }
          } else {
            const errorData = await templatesResponse.text();
            console.error(`❌ Ошибка получения шаблонов смен: ${templatesResponse.status} - ${errorData}`);
          }
        } else {
          console.log('✅ Текущие смены найдены, пропускаем создание');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при проверке/создании смен:', error.message);
    }

    // Отправка уведомления только если notifications === true
    if (notifications) {
      const baseUrl = process.env.BASE_URL;
      if (!baseUrl) {
        console.error('❌ BASE_URL не определён в .env');
      } else {
        const notificationUrl = `${baseUrl}/api/streamer/notifications/message`;
        // Отправка уведомления сразу
        const randomIndex = Math.floor(Math.random() * messages.length);
        const notificationBody = {
          id: "42660254-8dc0-4e85-a67a-5b8d580b2c20",
          type: "operators_late",
          text: messages[randomIndex]
        };
        fetch(notificationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(notificationBody)
        })
        .then(response => response.text())
        .then(data => {
          console.log('Уведомление отправлено:', data);
        })
        .catch(err => {
          console.error('Ошибка при отправке уведомления:', err);
        });

        // Очищаем старый таймер для этого env, если был
        if (notificationTimers.has(env)) {
          clearInterval(notificationTimers.get(env).interval);
          if (notificationTimers.get(env).timeout) {
            clearTimeout(notificationTimers.get(env).timeout);
          }
          notificationTimers.delete(env);
        }

        // Запускаем новый таймер
        const interval = setInterval(() => {
          const randomIndex = Math.floor(Math.random() * messages.length);
          const notificationBody = {
            id: "42660254-8dc0-4e85-a67a-5b8d580b2c20",
            type: "operators_late",
            text: messages[randomIndex]
          };
          fetch(notificationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(notificationBody)
          })
          .then(response => response.text())
          .then(data => {
            console.log('Уведомление отправлено (таймер):', data);
          })
          .catch(err => {
            console.error('Ошибка при отправке уведомления (таймер):', err);
          });
        }, 3 * 60 * 1000); // 3 минуты

        let timeout = null;
        if (duration) {
          timeout = setTimeout(() => {
            clearInterval(interval);
            notificationTimers.delete(env);
            console.log(`Таймер уведомлений для env=${env} остановлен по истечении duration`);
          }, duration * 1000);
        }
        notificationTimers.set(env, { interval, timeout });
      }
    }

  // Запустить WebSocket операторы
  if (operatorList && operatorList.length > 0 && (hasAnySpecific ? hasOperators : true)) {
    const runner = new Runner(operatorList, env, { wsRegistry, timeout: duration });
    runnerRegistry.set( env, runner );
    try {
      const statuses = await runner.run();
      results.operators = statuses;
    } catch (err) {
      console.error('Ошибка при запуске Runner:', err);
      results.operators = { error: err.message };
    }
  } else {
    results.operators = [];
  }

  // Запустить HTTP vehicle
  if (vehicleList && vehicleList.length > 0 && (hasAnySpecific ? hasVehicles : true)) {
    const vehicleRunner = new VehicleRunner( vehicleList, env, {
      duration: duration || 300,
      vehicleRegistry: vehicleRegistry
    } );
    vehicleRunnerRegistry.set( env, vehicleRunner );
    try {
      const statuses = await vehicleRunner.run();
      results.vehicles = statuses;
    } catch (err) {
      console.error('Ошибка при запуске VehicleRunner:', err);
      results.vehicles = { error: err.message };
    }
  } else {
    results.vehicles = [];
  }

  res.json(results);
  } catch (error) {
    console.error('❌ Ошибка в роуте /run:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Ошибка при запуске процессов',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/status', (req, res) => {
  try {
    let status = 'stopped';
    
    // Если есть запущенные процессы любого типа, считаем что все запущено
    if (runnerRegistry.size > 0 || vehicleRunnerRegistry.size > 0 || wsRegistry.size > 0) {
      status = 'running';
    }

    res.json({ status });
  } catch (error) {
    console.error('❌ Ошибка в роуте /status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Ошибка при получении статуса',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post( '/stop', async ( req, res ) => {
  try {
  console.log( '🛑 Получен запрос на остановку всех процессов...' );

  // Остановить старые runner'ы
  for ( const [ envKey, runner ] of runnerRegistry.entries() ) {
    try {
      console.log( `🛑 Останавливаем Runner для ${envKey}` );
      runner.stopAll();
    } catch ( e ) {
      console.error( `Ошибка при остановке Runner для ${envKey}:`, e );
    }
  }
  runnerRegistry.clear();

  // Остановить старые vehicleRunner'ы
  for ( const [ envKey, vehicleRunner ] of vehicleRunnerRegistry.entries() ) {
    try {
      console.log( `🛑 Останавливаем vehicleRunner для ${envKey}` );
      vehicleRunner.stopAll();
    } catch ( e ) {
      console.error( `Ошибка при остановке vehicleRunner для ${envKey}:`, e );
    }
  }
  vehicleRunnerRegistry.clear();

  // Завершить все старые ws
  for ( const ws of wsRegistry.values() ) {
    try {
      ws.close();
    } catch ( e ) {
      // ignore
    }
  }
  wsRegistry.clear();

  // Остановить все старые транспорты
    for ( const vehicle of vehicleRegistry.values() ) {
    try {
        vehicle.stop();
    } catch ( e ) {
      // ignore
    }
  }
    vehicleRegistry.clear();

    // Остановить все таймеры уведомлений
    for (const { interval, timeout } of notificationTimers.values()) {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    }
    notificationTimers.clear();

  console.log( '✅ Все процессы остановлены' );
  res.json( { status: 'stopped', message: 'Все процессы остановлены' } );
  } catch (error) {
    console.error('❌ Ошибка в роуте /stop:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Ошибка при остановке процессов',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} );



app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
}); 