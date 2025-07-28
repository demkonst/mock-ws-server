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
  }

  async connectAll() {
    if (!this.operators || this.operators.length === 0) {
      console.error('❌ Укажи хотя бы один оператор. Пример: ENV=dev node runner.js 1 2 3');
      throw new Error('Нет операторов');
    }
    const results = await Promise.all(this.operators.map(async (operator) => {
      try {
        const { ws } = await connectOperator(operator, this.env);
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
        runOperator(operator, this.env, ws, this.timeout).catch(err => {
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
}

if (require.main === module) {
  const operators = process.argv.slice(2);
  const env = process.env.ENV || 'dev';
  const runner = new Runner(operators, env, { debug: true });
  runner.run().catch(() => process.exit(1));
}

module.exports = { Runner };
