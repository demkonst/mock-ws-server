// Отладочный тест
const fetch = require('node-fetch');

async function debugTest() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Отладочный тест...\n');
  
  // Тест: только кастомные координаты операторов
  const test = {
    env: 'dev',
    duration: 5,
    operatorCoords: {
      'test_op': [
        [106.54683029, 58.03256597],
        [106.5384, 58.03409]
      ]
    }
  };
  
  console.log('📋 Отправляем запрос:', JSON.stringify(test, null, 2));
  
  try {
    const response = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test)
    });
    const result = await response.json();
    console.log('✅ Результат:', JSON.stringify(result, null, 2));
    
    // Анализируем результат
    console.log('\n📊 Анализ результата:');
    console.log(`   Операторы запущены: ${result.operators ? result.operators.length : 0}`);
    console.log(`   Транспорт запущен: ${result.vehicles ? result.vehicles.length : 0}`);
    
    if (result.operators) {
      console.log('   Операторы:');
      result.operators.forEach(op => {
        console.log(`     - ${op.operator}: ${op.status}${op.error ? ` (${op.error})` : ''}`);
      });
    }
    
    if (result.vehicles) {
      console.log('   Транспорт:');
      result.vehicles.forEach(v => {
        console.log(`     - ${v.client}: ${v.status}${v.error ? ` (${v.error})` : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Остановка
  await fetch(`${baseUrl}/stop`, { method: 'POST' });
  
  console.log('\n✅ Отладочный тест завершен');
}

debugTest().catch(console.error); 