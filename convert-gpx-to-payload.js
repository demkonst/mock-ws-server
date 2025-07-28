const fs = require('fs');
const xml2js = require('xml2js');

// Путь к GPX-файлу
const gpxPath = 'track.gpx';
const outputPath = 'output.json';

// timestamp — можешь подставить актуальный
const DEFAULT_TIMESTAMP = 1744365976;

fs.readFile(gpxPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Ошибка чтения GPX:', err);
    return;
  }

  xml2js.parseString(data, (err, result) => {
    if (err) {
      console.error('Ошибка парсинга XML:', err);
      return;
    }

    const waypoints = result.gpx.wpt || [];

    const messages = waypoints.map(wpt => ({
      payload: {
        lat: parseFloat(wpt.$.lat),
        lon: parseFloat(wpt.$.lon),
        timestamp: DEFAULT_TIMESTAMP,
        speed: 10,
        speed_accuracy: 1,
        course: 90,
        course_accuracy: 5,
        altitude: parseInt(wpt.ele?.[0] || 0),
        altitude_accuracy: 2
      },
      delay: 2000
    }));

    fs.writeFile(outputPath, JSON.stringify(messages, null, 2), err => {
      if (err) {
        console.error('Ошибка сохранения JSON:', err);
        return;
      }
      console.log(`✅ Готово! Сохранено в ${outputPath}`);
    });
  });
});
