const { interpolateCoordinates, calculateDistance } = require('./vehicle');

// Тестовые координаты
const testWaypoints = [
  { lat: 58.03256597, lon: 106.54683029 },
  { lat: 58.03409, lon: 106.5384 },
  { lat: 58.03890375, lon: 106.53784625 }
];

console.log('🚀 Тест приоритетов настроек скорости');
console.log('📊 Исходные точки:', testWaypoints.length);

// Симулируем разные сценарии
const scenarios = [
  { name: 'Файловая скорость (5 м/с)', speed: 5 },
  { name: 'Запросная скорость (15 м/с)', speed: 15 },
  { name: 'По умолчанию (10 м/с)', speed: 10 }
];

scenarios.forEach(scenario => {
  console.log(`\n🔄 ${scenario.name}:`);
  
  const interpolatedCoords = interpolateCoordinates(testWaypoints, scenario.speed, 1000);
  
  console.log(`📊 Интерполированных точек: ${interpolatedCoords.length}`);
  console.log(`⏱️ Время прохождения: ${(calculateDistance(testWaypoints[0], testWaypoints[1]) / scenario.speed).toFixed(1)}с`);
  console.log(`🚗 Скорость: ${scenario.speed} м/с (${(scenario.speed * 3.6).toFixed(1)} км/ч)`);
});

console.log('\n✅ Тест завершён!');
console.log('\n📋 Приоритеты скорости:');
console.log('1. Параметр speed в запросе (высший)');
console.log('2. Параметр speed в JSON файле (средний)');
console.log('3. Значение по умолчанию 10 м/с (низший)'); 