# Изменения в переменных окружения

## Обзор изменений

Была выполнена замена единой переменной `BASE_URL` на отдельные переменные для разных сервисов:

- `BASE_URL` → `BASE_URL_CONNECTOR` (для connector сервиса)
- `BASE_URL` → `BASE_URL_COLLECTOR` (для collector сервиса)  
- `BASE_URL` → `BASE_URL_UNITS` (для units сервиса)
- `BASE_URL` → `BASE_URL_STREAMER` (для streamer сервиса)

## Изменения в файлах

### vehicle.js
- Заменен `process.env.BASE_URL` на `process.env.BASE_URL_CONNECTOR`
- Обновлены URL пути: `/api/connector/debug/locations/vehicle` → `/debug/locations/vehicle`

### operator.js
- Заменен `process.env.BASE_URL` на `process.env.BASE_URL_UNITS` для работы с операторами
- Заменен `process.env.BASE_URL` на `process.env.BASE_URL_COLLECTOR` для WebSocket подключений
- Обновлены URL пути:
  - `/api/units/operators/credentials` → `/operators/credentials`
  - `/api/units/auth/operator/login` → `/auth/operator/login`
  - `/api/collector/locations/ws` → `/locations/ws`

### server.js
- Заменен `process.env.BASE_URL` на `process.env.BASE_URL_UNITS` для работы со сменами
- Заменен `process.env.BASE_URL` на `process.env.BASE_URL_STREAMER` для уведомлений
- Обновлены URL пути:
  - `/api/units/shifts/current` → `/shifts/current`
  - `/api/units/shift-templates` → `/shift-templates`
  - `/api/units/shifts` → `/shifts`
  - `/api/streamer/notifications/message` → `/notifications/message`

### README.md
- Обновлен раздел "Конфигурация окружений"
- Добавлено описание новых переменных окружения
- Удалены упоминания прокси маршрутов

## Новые переменные окружения

```env
# Базовые URL для разных сервисов
BASE_URL_CONNECTOR=https://your-domain.com/api/connector/
BASE_URL_COLLECTOR=https://your-domain.com/api/collector/
BASE_URL_UNITS=https://your-domain.com/api/units/
BASE_URL_STREAMER=https://your-domain.com/api/streamer/

# Авторизация
AUTH_HEADER=Basic aW5rLW1vbjppbmttb25pdG9yaW5n

# Токены для операторов
AUTH_TOKEN_OPERATOR_01=your-token-01
AUTH_TOKEN_OPERATOR_02=your-token-02
AUTH_TOKEN_OPERATOR_03=your-token-03
AUTH_TOKEN_OPERATOR_04=your-token-04
AUTH_TOKEN_OPERATOR_05=your-token-05
AUTH_TOKEN_OPERATOR_06=your-token-06
AUTH_TOKEN_OPERATOR_07=your-token-07
AUTH_TOKEN_OPERATOR_08=your-token-08
AUTH_TOKEN_OPERATOR_09=your-token-09
```

## Описание переменных

- **BASE_URL_CONNECTOR** - URL для connector сервиса (используется для отправки координат транспортных средств)
- **BASE_URL_COLLECTOR** - URL для collector сервиса (используется для WebSocket подключений операторов)
- **BASE_URL_UNITS** - URL для units сервиса (используется для работы с операторами и сменами)
- **BASE_URL_STREAMER** - URL для streamer сервиса (используется для отправки уведомлений)

## Преимущества изменений

1. **Разделение ответственности** - каждый сервис имеет свой собственный URL
2. **Гибкость** - можно использовать разные домены для разных сервисов
3. **Масштабируемость** - легко добавлять новые сервисы
4. **Безопасность** - можно ограничить доступ к разным сервисам
5. **Отладка** - проще отслеживать запросы к конкретным сервисам

## Миграция

Для миграции с старой системы:

1. Создайте новые переменные окружения в файлах `.env.dev`, `.env.demo`, `.env.stage`
2. Замените `BASE_URL` на соответствующие переменные для каждого сервиса
3. Обновите URL пути, убрав префиксы `/api/connector/`, `/api/collector/`, `/api/units/`, `/api/streamer/`

## Пример миграции

**Было:**
```env
BASE_URL=https://your-domain.com
```

**Стало:**
```env
BASE_URL_CONNECTOR=https://your-domain.com/api/connector/
BASE_URL_COLLECTOR=https://your-domain.com/api/collector/
BASE_URL_UNITS=https://your-domain.com/api/units/
BASE_URL_STREAMER=https://your-domain.com/api/streamer/
```

**Было:**
```javascript
const response = await axios.post(process.env.BASE_URL + '/api/connector/debug/locations/vehicle', payload);
```

**Стало:**
```javascript
const response = await axios.post(process.env.BASE_URL_CONNECTOR + '/debug/locations/vehicle', payload);
``` 