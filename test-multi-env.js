const fetch = require('node-fetch');

async function testMultiEnv() {
  console.log('🧪 Тестируем независимое управление окружениями...');
  
  try {
    // 1. Запускаем процессы в dev окружении
    console.log('\n📤 Запускаем процессы в dev окружении...');
    const devResponse = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        vehicles: ['11'],
        speed: 5,
        duration: 30
      })
    });
    const devResult = await devResponse.json();
    console.log('✅ Dev результат:', JSON.stringify(devResult, null, 2));
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Проверяем статус dev
    console.log('\n📊 Проверяем статус dev окружения...');
    const devStatusResponse = await fetch('http://localhost:3000/status?env=dev');
    const devStatus = await devStatusResponse.json();
    console.log('✅ Dev статус:', JSON.stringify(devStatus, null, 2));
    
    // 3. Запускаем процессы в demo окружении
    console.log('\n📤 Запускаем процессы в demo окружении...');
    const demoResponse = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'demo',
        vehicles: ['custom_demo'],
        speed: 3,
        duration: 30,
        vehicleCoords: {
          custom_demo: [
            { lat: 58.03256597, lon: 106.54683029 },
            { lat: 58.03409, lon: 106.5384 }
          ]
        }
      })
    });
    const demoResult = await demoResponse.json();
    console.log('✅ Demo результат:', JSON.stringify(demoResult, null, 2));
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Проверяем общий статус
    console.log('\n📊 Проверяем общий статус...');
    const overallStatusResponse = await fetch('http://localhost:3000/status');
    const overallStatus = await overallStatusResponse.json();
    console.log('✅ Общий статус:', JSON.stringify(overallStatus, null, 2));
    
    // 5. Останавливаем только dev окружение
    console.log('\n🛑 Останавливаем только dev окружение...');
    const stopDevResponse = await fetch('http://localhost:3000/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: 'dev' })
    });
    const stopDevResult = await stopDevResponse.json();
    console.log('✅ Остановка dev:', JSON.stringify(stopDevResult, null, 2));
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Проверяем статус после остановки dev
    console.log('\n📊 Проверяем статус после остановки dev...');
    const finalStatusResponse = await fetch('http://localhost:3000/status');
    const finalStatus = await finalStatusResponse.json();
    console.log('✅ Финальный статус:', JSON.stringify(finalStatus, null, 2));
    
    // 7. Останавливаем все процессы
    console.log('\n🛑 Останавливаем все процессы...');
    const stopAllResponse = await fetch('http://localhost:3000/stop', {
      method: 'POST'
    });
    const stopAllResult = await stopAllResponse.json();
    console.log('✅ Остановка всех процессов:', JSON.stringify(stopAllResult, null, 2));
    
    console.log('\n✅ Тест завершен успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

if (require.main === module) {
  testMultiEnv();
}

module.exports = { testMultiEnv }; 