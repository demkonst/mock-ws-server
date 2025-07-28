# Mock WebSocket Server

Сервер для эмуляции WebSocket операторов и HTTP транспорта с возможностью отправки телеметрических данных.

## 🚀 Возможности

- **WebSocket операторы**: Подключение и отправка сообщений через WebSocket
- **HTTP транспорт**: Отправка координат через HTTP POST запросы
- **Автоматическое обнаружение**: Поиск файлов операторов и транспорта
- **Управление временем**: Настройка длительности выполнения
- **Конкурентное выполнение**: Одновременная работа операторов и транспорта
- **Отладка**: Поддержка breakpoints в VSCode/Cursor

## 📁 Структура проекта

```
mock-ws-server/
├── server.js              # Основной сервер
├── operator.js            # WebSocket операторы
├── runner.js              # Управление операторами
├── transport.js           # HTTP транспорт
├── transportRunner.js     # Управление транспортом
├── operators/             # Файлы операторов
│   ├── operator_01.json
│   ├── operator_02.json
│   └── ...
├── vehicles/              # Файлы транспорта
│   ├── vehicle_01.json
│   ├── vehicle_02.json
│   └── ...
├── .env.demo              # Переменные окружения для demo
├── .env.dev               # Переменные окружения для dev
└── .vscode/launch.json    # Конфигурация отладки
```

## 🛠️ Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd mock-ws-server
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
# Скопируйте и настройте файлы окружения
cp .env.demo .env.dev
cp .env.demo .env.stage
```

## ⚙️ Конфигурация

### Переменные окружения

Создайте файлы `.env.demo`, `.env.dev`, `.env.stage` с переменными:

```env
# WebSocket
WS_URL=wss://your-websocket-server.com
AUTH_TOKEN_OPERATOR_01=your-token-1
AUTH_TOKEN_OPERATOR_02=your-token-2
# ... до AUTH_TOKEN_OPERATOR_20

# HTTP Transport
TRANSPORT_BASE_URL=https://your-api-server.com/telemetry
```

### Файлы операторов

Создайте файлы `operators/operator_XX.json`:

```json
[
  {
    "type": "message",
    "payload": {
      "timestamp": 1234567890,
      "data": "test"
    },
    "delay": 1000
  }
]
```

### Файлы транспорта

Создайте файлы `vehicles/vehicle_XX.json`:

```json
{
  "client": 25071737,
  "moving": true,
  "coords": [
    {
      "lat": 58.07615459,
      "lon": 106.41344925
    }
  ]
}
```

## 🚀 Запуск

### Обычный запуск
```bash
node server.js
```

### Отладка в VSCode/Cursor
1. Откройте проект в VSCode/Cursor
2. Нажмите F5 или выберите "Debug mock-ws-server"
3. Установите breakpoints в коде

## 📡 API

### POST /run

Запускает операторы и транспорт.

**Параметры:**
- `env` (string): Окружение (demo, dev, stage)
- `duration` (number): Длительность выполнения в секундах

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "env": "demo",
    "duration": 120
  }'
```

**Ответ:**
```json
{
  "operators": [
    {
      "operator": "1",
      "status": "connected",
      "error": null
    }
  ],
  "transport": [
    {
      "client": "1",
      "status": "ready",
      "error": null
    }
  ]
}
```

## 🔧 Разработка

### Структура кода

- **`server.js`**: Основной Express сервер с роутами
- **`operator.js`**: WebSocket подключение и отправка сообщений
- **`runner.js`**: Управление множественными операторами
- **`transport.js`**: HTTP отправка координат
- **`transportRunner.js`**: Управление множественным транспортом

### Добавление новых операторов

1. Создайте файл `operators/operator_XX.json`
2. Добавьте токен в `.env.*` файлы
3. Перезапустите сервер

### Добавление нового транспорта

1. Создайте файл `vehicles/vehicle_XX.json`
2. Убедитесь, что `TRANSPORT_BASE_URL` настроен
3. Перезапустите сервер

## 📝 Логирование

Сервер выводит подробные логи:
- ✅ Успешные подключения
- ❌ Ошибки подключения
- ⬅️➡️ Входящие/исходящие сообщения
- ⏰ Истечение времени
- 🔄 Сброс старых процессов

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License 