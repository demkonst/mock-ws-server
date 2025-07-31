// Простой тест кастомных координат для операторов
const fetch = require('node-fetch');

async function testSimpleOperatorCoords() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Простой тест кастомных координат для операторов...\n');
  
  // Тест: только кастомные координаты операторов
  console.log('📋 Тест: Только кастомные координаты операторов');
  const test = {
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
    const response = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test)
    });
    const result = await response.json();
    console.log('✅ Результат:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Остановка
  await fetch(`${baseUrl}/stop`, { method: 'POST' });
  
  console.log('\n✅ Тестирование завершено');
}

testSimpleOperatorCoords().catch(console.error); 