const express = require('express');
const { Runner } = require('./runner');
const { VehicleRunner } = require('./vehicleRunner');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const specs = require('./swagger');

const app = express();
const PORT = 3000;

// Реестры с поддержкой разделения по env
const wsRegistry = new Map(); // env -> Map(region -> ws)
const vehicleRegistry = new Map(); // env -> Map(client -> vehicle)
const vehicleRunnerRegistry = new Map(); // env -> vehicleRunner
const runnerRegistry = new Map(); // env -> runner
const notificationTimers = new Map(); // env -> timer

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));



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

/**
 * @swagger
 * /run:
 *   post:
 *     summary: Запуск симуляции операторов и/или транспортных средств
 *     description: Запускает симуляцию операторов через WebSocket и транспортных средств через HTTP POST запросы
 *     tags: [Simulation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RunRequest'
 *           examples:
 *             basic:
 *               summary: Базовый запуск
 *               value:
 *                 env: "dev"
 *                 vehicles: ["11", "12"]
 *                 speed: 8
 *                 duration: 200
 *             custom_coords:
 *               summary: Запуск с кастомными координатами
 *               value:
 *                 env: "dev"
 *                 vehicles: ["custom_route"]
 *                 speed: 5
 *                 vehicleCoords:
 *                   custom_route:
 *                     coords:
 *                       - [106.54683029, 58.03256597]
 *                       - [106.5384, 58.03409]
 *                       - [106.53784625, 58.03890375]
 *                     client: 123456
 *             all_processes:
 *               summary: Запуск всех процессов
 *               value:
 *                 env: "dev"
 *                 allOperators: true
 *                 allVehicles: true
 *                 notifications: true
 *     responses:
 *       200:
 *         description: Процессы успешно запущены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RunResponse'
 *             examples:
 *               success:
 *                 summary: Успешный запуск
 *                 value:
 *                   operators:
 *                     - { client: "01", status: "ready" }
 *                     - { client: "02", status: "ready" }
 *                   vehicles:
 *                     - { client: "11", status: "ready" }
 *                     - { client: "12", status: "ready" }
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/run', async (req, res) => {
  try {
  const env = req.body.env || 'dev';
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
    const vehicleCoords = req.body.vehicleCoords; // координаты для vehicles в формате { "vehicle_name": [{ lat, lon }, ...] }
    const operatorCoords = req.body.operatorCoords; // координаты для operators в формате { "operator_name": [{ lon, lat }, ...] }

    // Определяем, что было передано
    const hasOperators = (operators && operators.length > 0) || allOperators;
    const hasVehicles = (vehicles && vehicles.length > 0) || allVehicles;
    const hasVehicleCoords = vehicleCoords && Object.keys(vehicleCoords).length > 0;
    const hasOperatorCoords = operatorCoords && Object.keys(operatorCoords).length > 0;
    const hasAnySpecific = hasOperators || hasVehicles || hasVehicleCoords || hasOperatorCoords;
    
    // Если есть кастомные координаты, игнорируем флаги allOperators/allVehicles
    const shouldRunOperators = hasOperatorCoords || hasOperators;
    const shouldRunVehicles = hasVehicleCoords || hasVehicles;
    
    // Получаем списки только если нет кастомных координат
    let operatorList = [];
    let vehicleList = [];
    
    if (!hasOperatorCoords) {
      operatorList = findOperators({ env, operators, allOperators });
    }
    
    if (!hasVehicleCoords) {
      vehicleList = findClients({ env, vehicles, allVehicles });
    }
    
    // Если есть кастомные координаты, не запускаем файловые процессы
    if (hasOperatorCoords) {
      operatorList = [];
    }
    
    if (hasVehicleCoords) {
      vehicleList = [];
    }
    
    console.log(`🔄 Получен новый запрос:`);
    console.log(`   📡 Операторы: [${operatorList.join(', ')}]`);
    console.log(`   🚛 Транспорт: [${vehicleList.join(', ')}]`);
    console.log(`   🔄 hasOperatorCoords: ${hasOperatorCoords}, hasVehicleCoords: ${hasVehicleCoords}`);
    console.log(`   🔄 hasOperators: ${hasOperators}, hasVehicles: ${hasVehicles}`);
    console.log(`   🔄 hasAnySpecific: ${hasAnySpecific}`);
    console.log(`   🔄 Сбрасываем старые процессы...`);
    
    if (duration) {
      console.log(`⏰ Длительность: ${duration} секунд`);
    }
  
  // Остановить старые процессы только для текущего env
  console.log(`🔄 Останавливаем старые процессы для env: ${env}`);
  
  // Остановить старый runner для этого env
  const oldRunner = runnerRegistry.get(env);
  if (oldRunner) {
    try {
      console.log(`🛑 Останавливаем старый Runner для ${env}`);
      oldRunner.stopAll();
    } catch (e) {
      console.error(`Ошибка при остановке Runner для ${env}:`, e);
    }
    runnerRegistry.delete(env);
  }

  // Остановить старый vehicleRunner для этого env
  const oldVehicleRunner = vehicleRunnerRegistry.get(env);
  if (oldVehicleRunner) {
    try {
      console.log(`🛑 Останавливаем старый vehicleRunner для ${env}`);
      oldVehicleRunner.stopAll();
    } catch (e) {
      console.error(`Ошибка при остановке vehicleRunner для ${env}:`, e);
    }
    vehicleRunnerRegistry.delete(env);
  }

  // Завершить старые ws для этого env
  const envWsRegistry = wsRegistry.get(env);
  if (envWsRegistry) {
    for (const ws of envWsRegistry.values()) {
      try {
        ws.close();
      } catch (e) {
        // ignore
      }
    }
    wsRegistry.delete(env);
  }

  // Остановить старые транспорты для этого env
  const envVehicleRegistry = vehicleRegistry.get(env);
  if (envVehicleRegistry) {
    for (const vehicle of envVehicleRegistry.values()) {
      try {
        vehicle.stop();
      } catch (e) {
        // ignore
      }
    }
    vehicleRegistry.delete(env);
  }

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
  let finalOperatorList = [];
  
  if (hasOperatorCoords) {
    // Если есть кастомные координаты, запускаем только их
    const customOperatorNames = Object.keys(operatorCoords);
    finalOperatorList = customOperatorNames;
    console.log(`🚀 Запускаем только кастомные операторы: [${customOperatorNames.join(', ')}]`);
  } else if (operatorList && operatorList.length > 0) {
    // Если нет кастомных координат, запускаем файловые операторы
    finalOperatorList = operatorList;
    console.log(`🚀 Запускаем файловые операторы: [${operatorList.join(', ')}]`);
  }
  
  if (finalOperatorList.length > 0) {
    // Создаем реестр ws для этого env, если его нет
    if (!wsRegistry.has(env)) {
      wsRegistry.set(env, new Map());
    }
    
    const runner = new Runner(finalOperatorList, env, { 
      wsRegistry: wsRegistry.get(env), 
      timeout: duration,
      operatorCoords: operatorCoords // передаем кастомные координаты
    });
    runnerRegistry.set(env, runner);
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
  let finalVehicleList = [];
  
  if (hasVehicleCoords) {
    // Если есть кастомные координаты, запускаем только их
    const customVehicleNames = Object.keys(vehicleCoords);
    finalVehicleList = customVehicleNames;
    console.log(`🚀 Запускаем только кастомные маршруты: [${customVehicleNames.join(', ')}]`);
  } else if (vehicleList && vehicleList.length > 0) {
    // Если нет кастомных координат, запускаем файловые vehicles
    finalVehicleList = vehicleList;
    console.log(`🚀 Запускаем файловые vehicles: [${vehicleList.join(', ')}]`);
  }
  
  if (finalVehicleList.length > 0) {
    
    // Создаем реестр vehicles для этого env, если его нет
    if (!vehicleRegistry.has(env)) {
      vehicleRegistry.set(env, new Map());
    }
    
    const vehicleRunner = new VehicleRunner( finalVehicleList, env, {
      duration: duration || 300,
      vehicleRegistry: vehicleRegistry.get(env),
      speed: req.body.speed, // если указан в запросе, будет переопределять значение из файла
      vehicleCoords: vehicleCoords, // координаты из запроса
      interpolate: req.body.interpolate !== false // интерполяция включена по умолчанию
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

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Получение статуса сервера
 *     description: Возвращает статус всех процессов или конкретного окружения
 *     tags: [Status]
 *     parameters:
 *       - in: query
 *         name: env
 *         schema:
 *           type: string
 *           enum: [dev, demo, stage]
 *         description: Окружение для проверки статуса (если не указано, возвращается общий статус)
 *     responses:
 *       200:
 *         description: Статус успешно получен
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/StatusResponse'
 *                 - $ref: '#/components/schemas/EnvStatusResponse'
 *             examples:
 *               specific_env:
 *                 summary: Статус конкретного окружения
 *                 value: { "status": "running" }
 *               all_envs:
 *                 summary: Статус всех окружений
 *                 value:
 *                   - { "env": "dev", "status": "running" }
 *                   - { "env": "demo", "status": "stopped" }
 *                   - { "env": "stage", "status": "running" }
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/status', (req, res) => {
  try {
    const targetEnv = req.query.env; // если указан env, показываем статус только для него
    
    if (targetEnv) {
      // Статус для конкретного env - только простой статус
      const hasRunner = runnerRegistry.has(targetEnv);
      const hasVehicleRunner = vehicleRunnerRegistry.has(targetEnv);
      const hasWs = wsRegistry.has(targetEnv) && wsRegistry.get(targetEnv).size > 0;
      const hasVehicles = vehicleRegistry.has(targetEnv) && vehicleRegistry.get(targetEnv).size > 0;
      
      const status = (hasRunner || hasVehicleRunner || hasWs || hasVehicles) ? 'running' : 'stopped';
      
      res.json({ status });
    } else {
      // Общий статус всех env - массив { env, status }
      const envStatuses = [];
      
      // Собираем все уникальные env из всех реестров
      const allEnvs = new Set([
        ...runnerRegistry.keys(),
        ...vehicleRunnerRegistry.keys(),
        ...wsRegistry.keys(),
        ...vehicleRegistry.keys()
      ]);
      
      for (const env of allEnvs) {
        const hasRunner = runnerRegistry.has(env);
        const hasVehicleRunner = vehicleRunnerRegistry.has(env);
        const hasWs = wsRegistry.has(env) && wsRegistry.get(env).size > 0;
        const hasVehicles = vehicleRegistry.has(env) && vehicleRegistry.get(env).size > 0;
        
        const status = (hasRunner || hasVehicleRunner || hasWs || hasVehicles) ? 'running' : 'stopped';
        envStatuses.push({ env, status });
      }
      
      res.json(envStatuses);
    }
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

/**
 * @swagger
 * /stop:
 *   post:
 *     summary: Остановка процессов
 *     description: Останавливает все запущенные процессы или процессы конкретного окружения
 *     tags: [Control]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StopRequest'
 *           examples:
 *             stop_all:
 *               summary: Остановить все процессы
 *               value: {}
 *             stop_env:
 *               summary: Остановить конкретное окружение
 *               value: { "env": "dev" }
 *     responses:
 *       200:
 *         description: Процессы успешно остановлены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StopResponse'
 *             examples:
 *               success:
 *                 summary: Успешная остановка
 *                 value:
 *                   status: "stopped"
 *                   message: "Все процессы остановлены"
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post( '/stop', async ( req, res ) => {
  try {
    const targetEnv = req.body.env; // если указан env, останавливаем только его
    
    if (targetEnv) {
      console.log(`🛑 Получен запрос на остановку процессов для env: ${targetEnv}`);
      
      // Остановить runner для конкретного env
      const runner = runnerRegistry.get(targetEnv);
      if (runner) {
        try {
          console.log(`🛑 Останавливаем Runner для ${targetEnv}`);
          runner.stopAll();
        } catch (e) {
          console.error(`Ошибка при остановке Runner для ${targetEnv}:`, e);
        }
        runnerRegistry.delete(targetEnv);
      }

      // Остановить vehicleRunner для конкретного env
      const vehicleRunner = vehicleRunnerRegistry.get(targetEnv);
      if (vehicleRunner) {
        try {
          console.log(`🛑 Останавливаем vehicleRunner для ${targetEnv}`);
          vehicleRunner.stopAll();
        } catch (e) {
          console.error(`Ошибка при остановке vehicleRunner для ${targetEnv}:`, e);
        }
        vehicleRunnerRegistry.delete(targetEnv);
      }

      // Завершить ws для конкретного env
      const envWsRegistry = wsRegistry.get(targetEnv);
      if (envWsRegistry) {
        for (const ws of envWsRegistry.values()) {
          try {
            ws.close();
          } catch (e) {
            // ignore
          }
        }
        wsRegistry.delete(targetEnv);
      }

      // Остановить транспорты для конкретного env
      const envVehicleRegistry = vehicleRegistry.get(targetEnv);
      if (envVehicleRegistry) {
        for (const vehicle of envVehicleRegistry.values()) {
          try {
            vehicle.stop();
          } catch (e) {
            // ignore
          }
        }
        vehicleRegistry.delete(targetEnv);
      }

      // Остановить таймер уведомлений для конкретного env
      const notificationTimer = notificationTimers.get(targetEnv);
      if (notificationTimer) {
        clearInterval(notificationTimer.interval);
        if (notificationTimer.timeout) clearTimeout(notificationTimer.timeout);
        notificationTimers.delete(targetEnv);
      }

      console.log(`✅ Все процессы для env ${targetEnv} остановлены`);
      res.json({ status: 'stopped', message: `Все процессы для env ${targetEnv} остановлены` });
      
    } else {
      console.log('🛑 Получен запрос на остановку всех процессов...');

      // Остановить все runner'ы
      for (const [envKey, runner] of runnerRegistry.entries()) {
        try {
          console.log(`🛑 Останавливаем Runner для ${envKey}`);
          runner.stopAll();
        } catch (e) {
          console.error(`Ошибка при остановке Runner для ${envKey}:`, e);
        }
      }
      runnerRegistry.clear();

      // Остановить все vehicleRunner'ы
      for (const [envKey, vehicleRunner] of vehicleRunnerRegistry.entries()) {
        try {
          console.log(`🛑 Останавливаем vehicleRunner для ${envKey}`);
          vehicleRunner.stopAll();
        } catch (e) {
          console.error(`Ошибка при остановке vehicleRunner для ${envKey}:`, e);
        }
      }
      vehicleRunnerRegistry.clear();

      // Завершить все ws
      for (const envWsRegistry of wsRegistry.values()) {
        for (const ws of envWsRegistry.values()) {
          try {
            ws.close();
          } catch (e) {
            // ignore
          }
        }
      }
      wsRegistry.clear();

      // Остановить все транспорты
      for (const envVehicleRegistry of vehicleRegistry.values()) {
        for (const vehicle of envVehicleRegistry.values()) {
          try {
            vehicle.stop();
          } catch (e) {
            // ignore
          }
        }
      }
      vehicleRegistry.clear();

      // Остановить все таймеры уведомлений
      for (const { interval, timeout } of notificationTimers.values()) {
        clearInterval(interval);
        if (timeout) clearTimeout(timeout);
      }
      notificationTimers.clear();

      console.log('✅ Все процессы остановлены');
      res.json({ status: 'stopped', message: 'Все процессы остановлены' });
    }
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