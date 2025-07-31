const fetch = require('node-fetch');

async function testCustomCoords() {
  console.log('🧪 Тестируем кастомные координаты...');
  
  const testData = {
    env: 'dev',
    vehicles: ['custom_test'],
    speed: 5, // медленная скорость для тестирования
    vehicleCoords: {
      custom_test: [
        { lat: 58.03256597, lon: 106.54683029 },
        { lat: 58.03409, lon: 106.5384 },
        { lat: 58.03890375, lon: 106.53784625 }
      ]
    }
  };

  try {
    console.log('📤 Отправляем запрос с кастомными координатами...');
    const response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('✅ Результат:', JSON.stringify(result, null, 2));

    // Останавливаем через 10 секунд
    setTimeout(async () => {
      console.log('🛑 Останавливаем тест...');
      await fetch('http://localhost:3000/stop', { method: 'POST' });
      console.log('✅ Тест завершен');
    }, 10000);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

if (require.main === module) {
  testCustomCoords();
}

module.exports = { testCustomCoords }; 