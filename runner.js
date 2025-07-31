const { runOperator, connectOperator } = require('./operator');

class Runner {
  constructor(operators, env = 'dev', options = {}) {
    this.operators = operators;
    this.env = env;
    this.debug = options.debug || false;
    this.logBuffer = [];
    this.wsMap = new Map(); // operator -> ws
    this.wsRegistry = options.wsRegistry || null; // глобальный реестр ws
    this.timeout = options.timeout || null; // таймаут в секундах
    this.operatorCoords = options.operatorCoords || null; // кастомные координаты для операторов
  }

  async connectAll() {
    if (!this.operators || this.operators.length === 0) {
      console.error('❌ Укажи хотя бы один оператор. Пример: ENV=dev node runner.js 1 2 3');
      throw new Error('Нет операторов');
    }
    const results = await Promise.all(this.operators.map(async (operator) => {
      try {
        // Получаем operator_id для кастомных координат
        let operatorId = null;
        if (this.operatorCoords && this.operatorCoords[operator]) {
          const coordsData = this.operatorCoords[operator];
          if (typeof coordsData === 'object' && coordsData.operator_id) {
            operatorId = coordsData.operator_id;
          }
        }
        
        const { ws } = await connectOperator(operator, this.env, operatorId);
        this.wsMap.set(operator, ws);
        if (this.wsRegistry) {
          this.wsRegistry.set(operator, ws);
        }
        return { operator, status: 'connected', error: null };
      } catch (err) {
        return { operator, status: 'error', error: err.message };
      }
    }));
    return results;
  }

  async runInBackground() {
    // Запускать runOperator для всех операторов в фоне, используя уже подключённый ws
    for (const operator of this.operators) {
      const ws = this.wsMap.get(operator);
      if (ws) {
        // Получаем кастомные координаты для этого оператора
        let customCoords = null;
        let operatorId = null;
        
        if (this.operatorCoords && this.operatorCoords[operator]) {
          const coordsData = this.operatorCoords[operator];
          
          if (Array.isArray(coordsData)) {
            // Простой массив координат [lon, lat]
            customCoords = coordsData;
          } else if (coordsData.coords && coordsData.operator_id) {
            // Объект с координатами и operator_id
            customCoords = {
              coords: coordsData.coords,
              operator_id: coordsData.operator_id,
              speed: coordsData.speed, // кастомная скорость
              course: coordsData.course, // кастомный курс
              altitude: coordsData.altitude, // кастомная высота
              delay: coordsData.delay, // кастомная задержка
              interpolate: coordsData.interpolate // кастомная интерполяция
            };
            operatorId = coordsData.operator_id;
          }
        }
        
        runOperator(operator, this.env, ws, this.timeout, customCoords, operatorId).catch(err => {
          console.error(`[${operator}] Ошибка в фоне:`, err);
        });
      }
    }
  }

  async run() {
    const statuses = await this.connectAll();
    // Запускать основную работу в фоне
    this.runInBackground();
    return statuses;
  }

  stopAll() {
    console.log( `🛑 Останавливаем Runner для операторов: [${this.operators.join( ', ' )}]` );

    // Закрыть все WebSocket соединения
    for ( const [ operator, ws ] of this.wsMap.entries() ) {
      try {
        console.log( `🛑 Закрываем WebSocket для оператора ${operator}` );
        ws.close();
      } catch ( e ) {
        console.error( `Ошибка при закрытии WebSocket для оператора ${operator}:`, e );
      }
    }

    // Очистить реестры
    this.wsMap.clear();
    if ( this.wsRegistry ) {
      for ( const [ operator, ws ] of this.wsRegistry.entries() ) {
        if ( this.operators.includes( operator ) ) {
          try {
            ws.close();
          } catch ( e ) {
            // ignore
          }
        }
      }
    }
  }
}

if (require.main === module) {
  const operators = process.argv.slice(2);
  const env = process.env.ENV || 'dev';
  const runner = new Runner(operators, env, { debug: true });
  runner.run().catch(() => process.exit(1));
}

module.exports = { Runner };
