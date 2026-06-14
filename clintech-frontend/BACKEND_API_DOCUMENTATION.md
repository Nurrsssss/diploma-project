# API: Создание пациента врачом без OTP

## Что нужно для фронтенда

### Эндпоинт
**URL:** `POST /auth/register-patient-by-doctor`  
**Авторизация:** Обязательна, только для врачей (Bearer Token)

### Запрос (Request)

**Обязательные поля:**
- `phone`: string (11 цифр, начинается с 7) - `"77071234567"`
- `password`: string (минимум 8 символов)
- `first_name`: string
- `last_name`: string

**Опциональные поля:**
- `middle_name`: string
- `iin`: string (12 цифр)
- `date_of_birth`: string (формат: "YYYY-MM-DD")
- `email`: string
- `address`: string
- `gender`: string ("male" | "female" | "other")
- `height`: number (50-250)
- `weight`: number (20-300)
- `phys_activity`: string
- `diagnoses`: string[]
- `allergens`: string[]
- `diet`: string[]

**Пример запроса:**
```json
{
  "phone": "77071234567",
  "password": "temp_password_123",
  "first_name": "Иван",
  "last_name": "Иванов",
  "middle_name": "Иванович",
  "iin": "123456789012",
  "date_of_birth": "1990-01-15",
  "email": "patient@example.com",
  "address": "г. Алматы, ул. Примерная, 1",
  "gender": "male",
  "height": 175,
  "weight": 70,
  "phys_activity": "moderate",
  "diagnoses": ["диабет", "гипертония"],
  "allergens": ["пенициллин"],
  "diet": ["безглютеновая"]
}
```

### Ответ (Response)

**Успех (200 OK):**
```json
{
  "success": true,
  "message": "Пациент успешно создан",
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "patient_id": "660e8400-e29b-41d4-a716-446655440001",
    "phone": "77071234567",
    "first_name": "Иван",
    "last_name": "Иванов",
    "middle_name": "Иванович",
    "email": "patient@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Ошибки:**
- `400` - Ошибка валидации (некорректные данные)
- `401` - Не авторизован
- `403` - Доступ запрещен (не врач)
- `409` - Пользователь с таким телефоном уже существует
- `500` - Внутренняя ошибка сервера

**Структура ошибки:**
```json
{
  "success": false,
  "error": "Тип ошибки",
  "message": "Человекочитаемое сообщение",
  "details": {}  // Опционально, для ошибок валидации
}
```

### Важно

1. **OTP-верификация НЕ требуется** - пропускается полностью
2. **Авторизация обязательна** - только врачи могут создавать пациентов
3. **Создание в одном запросе** - пользователь и профиль создаются вместе
4. **Проверка дубликатов** - если телефон уже существует, вернуть 409

---

**Версия:** 1.0
