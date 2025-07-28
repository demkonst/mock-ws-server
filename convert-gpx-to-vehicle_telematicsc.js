
const fs = require('fs');
const xml2js = require('xml2js');

// Путь к GPX-файлу
const gpxPath = 'wroom.gpx';
const outputPath = 'output.json';

// navigation_time — можешь подставить актуальный
const DEFAULT_DATE = "2025-07-03T19:26:24+00:00";

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
            lat: parseFloat(wpt.$.lat),  lon: parseFloat(wpt.$.lon)
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
