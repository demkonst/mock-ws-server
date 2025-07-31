// Используем глобальный fetch для Node.js 18+ или импортируем node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

async function testFileNewFormat() {
  console.log('🧪 Тестируем новый формат координат [lon, lat] в файлах...');
  
  try {
    // 1. Тест с файлом в новом формате
    console.log('\n📤 Тест 1: Файл с новым форматом координат [lon, lat]...');
    const test1Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        vehicles: ['new_format'],
        speed: 5,
        duration: 10
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
    
    // 2. Тест с файлом в старом формате (для сравнения)
    console.log('\n📤 Тест 2: Файл со старым форматом координат {lat, lon}...');
    const test2Response = await fetch('http://localhost:3000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: 'dev',
        vehicles: ['11'],
        speed: 5,
        duration: 10
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
  testFileNewFormat();
}

module.exports = { testFileNewFormat }; 