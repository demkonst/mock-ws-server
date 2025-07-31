const { interpolateCoordinates, calculateDistance } = require('./vehicle');

// Тестовые координаты (простой маршрут)
const testWaypoints = [
  { lat: 58.03256597, lon: 106.54683029 },
  { lat: 58.03409, lon: 106.5384 },
  { lat: 58.03890375, lon: 106.53784625 }
];

console.log('🚀 Тест интерполяции координат');
console.log('📊 Исходные точки:', testWaypoints.length);

// Тестируем интерполяцию с разными скоростями
const speeds = [2, 5, 10, 20]; // м/с

speeds.forEach(speed => {
  console.log(`\n🔄 Тест со скоростью ${speed} м/с (${(speed * 3.6).toFixed(1)} км/ч):`);
  
  const interpolatedCoords = interpolateCoordinates(testWaypoints, speed, 1000);
  
  console.log(`📊 Интерполированных точек: ${interpolatedCoords.length}`);
  console.log(`📏 Расстояние между точками: ${calculateDistance(testWaypoints[0], testWaypoints[1]).toFixed(1)}м`);
  console.log(`⏱️ Время прохождения: ${(calculateDistance(testWaypoints[0], testWaypoints[1]) / speed).toFixed(1)}с`);
  
  console.log('📍 Первые 3 точки:');
  interpolatedCoords.slice(0, 3).forEach((coord, index) => {
    console.log(`  ${index + 1}. lat: ${coord.lat.toFixed(8)}, lon: ${coord.lon.toFixed(8)}`);
  });
});

console.log('\n✅ Тест завершён!'); 