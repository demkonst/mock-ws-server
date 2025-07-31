// Используем глобальный fetch для Node.js 18+ или импортируем node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

async function testOperatorInterpolation() {
  console.log('🧪 Тестируем интерполяцию операторов...');
  
  try {
    // 1. Тест с оператором без интерполяции (старый формат)
    console.log('\n📤 Тест 1: Оператор без интерполяции (старый формат)...');
    const test1Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        operators: ['01'],
        duration: 5
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
    
    // 2. Тест с оператором с интерполяцией (новый формат)
    console.log('\n📤 Тест 2: Оператор с интерполяцией (новый формат)...');
    const test2Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        operators: ['interpolation_test'],
        duration: 5
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
  testOperatorInterpolation();
}

module.exports = { testOperatorInterpolation }; 