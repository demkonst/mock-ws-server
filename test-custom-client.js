// Используем глобальный fetch для Node.js 18+ или импортируем node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

async function testCustomClient() {
  console.log('🧪 Тестируем кастомные координаты с указанием client ID...');
  
  try {
    // 1. Тест с простым массивом координат (дефолтный client ID)
    console.log('\n📤 Тест 1: Простой массив координат (дефолтный client ID = 999999)...');
    const test1Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        vehicles: ['simple_route'],
        speed: 5,
        duration: 10,
        vehicleCoords: {
          simple_route: [
            { lat: 58.03256597, lon: 106.54683029 },
            { lat: 58.03409, lon: 106.5384 }
          ]
        }
      })
    });
    const test1Result = await test1Response.json();
    console.log('✅ Тест 1 результат:', JSON.stringify(test1Result, null, 2));
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Останавливаем первый тест
    await fetch('http://localhost:3000/stop', { method: 'POST' });
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Тест с указанием client ID
    console.log('\n📤 Тест 2: Координаты с указанием client ID = 123456...');
    const test2Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        vehicles: ['custom_client'],
        speed: 3,
        duration: 10,
        vehicleCoords: {
          custom_client: {
            coords: [
              { lat: 58.03256597, lon: 106.54683029 },
              { lat: 58.03409, lon: 106.5384 },
              { lat: 58.03890375, lon: 106.53784625 }
            ],
            client: 123456
          }
        }
      })
    });
    const test2Result = await test2Response.json();
    console.log('✅ Тест 2 результат:', JSON.stringify(test2Result, null, 2));
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Останавливаем второй тест
    await fetch('http://localhost:3000/stop', { method: 'POST' });
    
    console.log('\n✅ Все тесты завершены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

if (require.main === module) {
  testCustomClient();
}

module.exports = { testCustomClient }; 