// Тест кастомных координат для операторов
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  fetch = global.fetch;
}

async function testOperatorCustomCoords() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Тестируем кастомные координаты для операторов...\n');
  
  // Тест 1: Простой массив координат
  console.log('📋 Тест 1: Простой массив координат');
  const test1 = {
    env: 'dev',
    duration: 10,
    operatorCoords: {
      'simple_operator': [
        [106.54683029, 58.03256597],
        [106.5384, 58.03409],
        [106.53784625, 58.03890375]
      ]
    }
  };
  
  try {
    const response1 = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test1)
    });
    const result1 = await response1.json();
    console.log('✅ Результат:', JSON.stringify(result1, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Остановка
  await fetch(`${baseUrl}/stop`, { method: 'POST' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Тест 2: С operator_id
  console.log('\n📋 Тест 2: С operator_id');
  const test2 = {
    env: 'dev',
    duration: 10,
    operatorCoords: {
      'custom_operator': {
        coords: [
          [106.54683029, 58.03256597],
          [106.5384, 58.03409],
          [106.53784625, 58.03890375]
        ],
        operator_id: 123456
      }
    }
  };
  
  try {
    const response2 = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test2)
    });
    const result2 = await response2.json();
    console.log('✅ Результат:', JSON.stringify(result2, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Остановка
  await fetch(`${baseUrl}/stop`, { method: 'POST' });
  
  console.log('\n✅ Тестирование завершено');
}

testOperatorCustomCoords().catch(console.error); 