// Тест кастомных параметров для операторов и транспортных средств
const fetch = require('node-fetch');

async function testCustomParameters() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Тестируем кастомные параметры...\n');
  
  // Тест 1: Кастомные параметры для оператора
  console.log('📋 Тест 1: Кастомные параметры для оператора');
  const test1 = {
    env: 'dev',
    duration: 10,
    operatorCoords: {
      'fast_operator': {
        coords: [
          [106.54683029, 58.03256597],
          [106.5384, 58.03409],
          [106.53784625, 58.03890375]
        ],
        operator_id: 123456,
        speed: 80, // высокая скорость
        course: 45, // курс 45 градусов
        altitude: 20, // высота 20 метров
        delay: 1000, // быстрая отправка
        interpolate: true
      }
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
  
  // Тест 2: Кастомные параметры для транспортного средства
  console.log('\n📋 Тест 2: Кастомные параметры для транспортного средства');
  const test2 = {
    env: 'dev',
    duration: 10,
    vehicleCoords: {
      'fast_vehicle': {
        coords: [
          [106.54683029, 58.03256597],
          [106.5384, 58.03409],
          [106.53784625, 58.03890375]
        ],
        client: 123456,
        speed: 25, // высокая скорость (25 м/с = 90 км/ч)
        interpolate: true
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

testCustomParameters().catch(console.error); 