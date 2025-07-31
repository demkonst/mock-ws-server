const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mock WebSocket Server API',
      version: '1.0.0',
      description: 'API для симуляции операторов и транспортных средств с поддержкой различных окружений',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
                         VehicleCoords: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2
                },
                description: 'Array of [lon, lat] coordinates'
              },
              {
                type: 'object',
                properties: {
                  coords: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 2,
                      maxItems: 2
                    },
                    description: 'Array of [lon, lat] coordinates'
                  },
                  client: {
                    type: 'integer',
                    description: 'Vehicle client ID'
                  },
                  speed: {
                    type: 'number',
                    description: 'Speed in m/s (overrides global speed)'
                  },
                  interpolate: {
                    type: 'boolean',
                    description: 'Whether to interpolate coordinates'
                  }
                },
                required: ['coords', 'client']
              }
            ]
          },
          example: {
            "my_route": [
              [106.54683029, 58.03256597],
              [106.5384, 58.03409],
              [106.53784625, 58.03890375]
            ],
            "vehicle_123": {
              "coords": [
                [106.54683029, 58.03256597],
                [106.5384, 58.03409],
                [106.53784625, 58.03890375]
              ],
              "client": 123456,
              "speed": 15,
              "interpolate": true
            }
          }
        },
        OperatorCoords: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2
                },
                description: 'Array of [lon, lat] coordinates'
              },
              {
                type: 'object',
                properties: {
                  coords: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 2,
                      maxItems: 2
                    },
                    description: 'Array of [lon, lat] coordinates'
                  },
                  operator_id: {
                    type: 'integer',
                    description: 'Operator ID for authentication'
                  },
                  speed: {
                    type: 'number',
                    description: 'Speed in km/h (overrides global speed)'
                  },
                  course: {
                    type: 'number',
                    description: 'Course in degrees'
                  },
                  altitude: {
                    type: 'number',
                    description: 'Altitude in meters'
                  },
                  delay: {
                    type: 'number',
                    description: 'Delay between messages in milliseconds'
                  },
                  interpolate: {
                    type: 'boolean',
                    description: 'Whether to interpolate coordinates'
                  }
                },
                required: ['coords', 'operator_id']
              }
            ]
          },
          example: {
            "my_operator": [
              [106.54683029, 58.03256597],
              [106.5384, 58.03409],
              [106.53784625, 58.03890375]
            ],
            "operator_123": {
              "coords": [
                [106.54683029, 58.03256597],
                [106.5384, 58.03409],
                [106.53784625, 58.03890375]
              ],
              "operator_id": 123456,
              "speed": 60,
              "course": 45,
              "altitude": 15,
              "delay": 3000,
              "interpolate": true
            }
          }
        },
        RunRequest: {
          type: 'object',
          properties: {
            env: {
              type: 'string',
              enum: ['dev', 'demo', 'stage'],
              default: 'demo',
              description: 'Окружение для запуска процессов'
            },
            operators: {
              type: 'array',
              items: { type: 'string' },
              description: 'Массив имён операторов для запуска'
            },
            vehicles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Массив имён транспортных средств для запуска'
            },
            speed: {
              type: 'number',
              minimum: 0,
              description: 'Скорость движения в м/с (переопределяет значение из файла)'
            },
            duration: {
              type: 'number',
              minimum: 1,
              description: 'Длительность симуляции в секундах'
            },
            notifications: {
              type: 'boolean',
              description: 'Включить автоматические уведомления'
            },
            allOperators: {
              type: 'boolean',
              description: 'Запустить всех операторов окружения'
            },
            allVehicles: {
              type: 'boolean',
              description: 'Запустить все транспортные средства окружения'
            },
            vehicleCoords: {
              $ref: '#/components/schemas/VehicleCoords'
            },
            operatorCoords: {
              $ref: '#/components/schemas/OperatorCoords'
            }
          }
        },
        RunResponse: {
          type: 'object',
          properties: {
            operators: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  client: { type: 'string' },
                  status: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            },
            vehicles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  client: { type: 'string' },
                  status: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        },
        StatusResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['running', 'stopped']
            }
          }
        },
        EnvStatusResponse: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              env: { type: 'string' },
              status: {
                type: 'string',
                enum: ['running', 'stopped']
              }
            }
          }
        },
        StopRequest: {
          type: 'object',
          properties: {
            env: {
              type: 'string',
              enum: ['dev', 'demo', 'stage'],
              description: 'Окружение для остановки (если не указано, останавливаются все процессы)'
            }
          }
        },
        StopResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['stopped']
            },
            message: { type: 'string' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./server.js'] // Путь к файлу с роутами
};

const specs = swaggerJsdoc(options);

module.exports = specs; 