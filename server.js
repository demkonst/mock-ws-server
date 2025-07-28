const express = require('express');
const { Runner } = require('./runner');
const { TransportRunner } = require('./transportRunner');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const wsRegistry = new Map(); // region -> ws
const transportRegistry = new Map(); // client -> transport

app.use(express.json());

function findOperators() {
  const operators = [];
  const operatorsDir = path.join(__dirname, 'operators');
  
  // Проверяем файлы от 01 до 20
  for (let i = 1; i <= 99; i++) {
    const operatorNum = i.toString().padStart(2, '0');
    const filePath = path.join(operatorsDir, `operator_${operatorNum}.json`);
    
    if (fs.existsSync(filePath)) {
      operators.push(i.toString());
    }
  }
  
  return operators;
}

function findClients() {
  const clients = [];
  const vehiclesDir = path.join(__dirname, 'vehicles');
  
  // Проверяем файлы vehicle_*.json от 01 до 20
  if (fs.existsSync(vehiclesDir)) {
    for (let i = 1; i <= 99; i++) {
      const vehicleNum = i.toString().padStart(2, '0');
      const filePath = path.join(vehiclesDir, `vehicle_${vehicleNum}.json`);
      
      if (fs.existsSync(filePath)) {
        clients.push(i.toString());
      }
    }
  }
  
  return clients;
}

app.post('/run', async (req, res) => {
  const operators = findOperators();
  const clients = findClients();
  const env = req.body.env || 'demo';
  const duration = req.body.duration || null; // длительность в секундах
  
  console.log(`🔄 Получен новый запрос:`);
  console.log(`   📡 Операторы: [${operators.join(', ')}]`);
  console.log(`   🚛 Транспорт: [${clients.join(', ')}]`);
  console.log(`   🔄 Сбрасываем старые процессы...`);
  
  if (duration) {
    console.log(`⏰ Длительность: ${duration} секунд`);
  }
  
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
  for (const transport of transportRegistry.values()) {
    try {
      transport.stop();
    } catch (e) {
      // ignore
    }
  }
  transportRegistry.clear();

  const results = {};

  // Запустить WebSocket операторы
  if (operators.length > 0) {
    const runner = new Runner(operators, env, { wsRegistry, timeout: duration });
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

  // Запустить HTTP транспорт
  if (clients.length > 0) {
    const transportRunner = new TransportRunner(clients, env, { duration: duration || 300 });
    try {
      const statuses = await transportRunner.run();
      results.transport = statuses;
    } catch (err) {
      console.error('Ошибка при запуске TransportRunner:', err);
      results.transport = { error: err.message };
    }
  } else {
    results.transport = [];
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
}); 