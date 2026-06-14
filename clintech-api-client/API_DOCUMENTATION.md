# Vitalem API Documentation

## for alkuat bot

---

## **Содержание**

1. [Паспорт здоровья](#паспорт-здоровья)
2. [Анкета пациента](#анкета-пациента)
3. [Аудио транскрипция](#аудио-транскрипция)

---

# Паспорт здоровья

## **1. Создание паспорта здоровья**

**`POST /health-passport/generate`**

### Response:

```json
{
  "id": "health-passport-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_id": "appointment-uuid",
  "analysis_id": "analysis-uuid",
  "transcription_text": "Текст транскрипции",
  "content": {
    "patient": {
      "id": "uuid",
      "first_name": "Имя",
      "last_name": "Фамилия",
      "birth_date": "1990-01-01",
      "age": 34,
      "gender": "male"
    },
    "doctor": {
      "id": "uuid",
      "first_name": "Врач",
      "last_name": "Фамилия"
    },
    "complaints": "Жалобы пациента",
    "medical_history": "Анамнез заболевания",
    "chronic_diseases": "Хронические заболевания",
    "family_history": "Семейный анамнез",
    "medications": "Лекарственная история",
    "lifestyle": "Образ жизни",
    "diets_allergies": "Диеты и аллергии",
    "diagnoses": "Диагнозы",
    "files_analysis": "Анализ медицинских файлов",
    "observation_plan": "План наблюдения",
    "general_conclusion": "Общее заключение",
    "generated_at": "05.01.2025 15:30"
  },
  "file_id": "pdf-file-id",
  "created_at": "2025-01-05T15:30:00Z",
  "updated_at": "2025-01-05T15:30:00Z"
}
```

---

## **2. Получение паспорта здоровья**

**`GET /health-passport/{id}`**

### Response:

```json
{
  "id": "health-passport-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_id": "appointment-uuid",
  "analysis_id": "analysis-uuid",
  "transcription_text": "Текст транскрипции",
  "content": {
    /* структура HealthPassportData */
  },
  "file_id": "pdf-file-id",
  "created_at": "2025-01-05T15:30:00Z",
  "updated_at": "2025-01-05T15:30:00Z"
}
```

---

## **3. Получение содержимого для редактирования**

**`GET /health-passport/{id}/content`**

### Response:

```json
{
  "patient": {
    "id": "648bf601-9fb3-4c00-894e-4309774a248e",
    "first_name": "Берекет",
    "middle_name": "Берекетович",
    "last_name": "Берекетов",
    "birth_date": "2005-10-27T00:00:00Z",
    "age": 0,
    "gender": "male",
    "iin": "051027550521",
    "phone": "87476708705",
    "email": "patient_check@gmail.com",
    "address": "За Алматы-2",
    "height": 175,
    "weight": 78,
    "bmi": 25.46938775510204,
    "chronic_diseases": ["hypertension"],
    "allergies": ["dairy"],
    "diets": ["diet_5"]
  },
  "doctor": {
    "id": "7a75782d-35eb-4381-85ef-58a1581f680e",
    "first_name": "Ельтай",
    "middle_name": "Кадырбекович",
    "last_name": "Шильдебаев",
    "roles": ["Уролог"],
    "email": "shildebaev.eltay@vitalem.clinic",
    "phone": "+7 (777) 123-45-67",
    "description": "Врач уролог, андролог, эндоуролог высшей категории..."
  },
  "complaints": "Жалобы пациента",
  "medical_history": "Медицинский анамнез",
  "lifestyle": "Образ жизни",
  "diets_allergies": "Диеты и аллергии",
  "diagnoses": "Диагнозы",
  "files_analysis": "Анализ файлов",
  "observation_plan": "План наблюдения",
  "general_conclusion": "Общее заключение",
  "generated_at": "05.08.2025 08:34"
}
```

---

## **4. Обновление содержимого и автоматическая регенерация PDF**

**`PUT /health-passport/{id}/content`**

### Request (частичное обновление):

```json
{
  "complaints": "Обновленные жалобы",
  "medical_history": "Обновленный анамнез",
  "diagnoses": "Обновленные диагнозы",
  "lang": "ru"
}
```

### Response:

```json
{
  "id": "health-passport-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_id": "appointment-uuid",
  "analysis_id": "analysis-uuid",
  "transcription_text": "Текст транскрипции",
  "content": {
    /* Полная обновленная структура HealthPassportData */
    "complaints": "Обновленные жалобы",
    "medical_history": "Обновленный анамнез",
    "diagnoses": "Обновленные диагнозы"
    /* остальные поля остаются без изменений */
  },
  "file_id": "new-pdf-file-id",
  "created_at": "2025-01-05T15:30:00Z",
  "updated_at": "2025-01-05T16:45:00Z"
}
```

**Примечание:** После обновления содержимого PDF документ автоматически регенерируется с новым содержимым.

---

## **5. Обновление только содержимого (без регенерации PDF)**

**`PUT /health-passport/{id}/content-only`**

### Request (частичное обновление):

```json
{
  "complaints": "Обновленные жалобы",
  "medical_history": "Обновленный анамнез",
  "diagnoses": "Обновленные диагнозы"
}
```

### Response:

```json
{
  /* Полная обновленная структура HealthPassportData */
  "complaints": "Обновленные жалобы",
  "medical_history": "Обновленный анамнез",
  "diagnoses": "Обновленные диагнозы"
  /* остальные поля остаются без изменений */
}
```

**Примечание:** Этот endpoint обновляет только содержимое без автоматической регенерации PDF. Используйте для множественных правок перед финальной регенерацией.

---

## **6. Регенерация PDF**

**`POST /health-passport/{id}/regenerate`**

### Request (опционально):

```json
{
  "lang": "ru"
}
```

### Response:

```json
{
  "id": "health-passport-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "file_id": "new-pdf-file-id",
  "created_at": "2025-01-05T15:30:00Z",
  "updated_at": "2025-01-05T16:45:00Z"
}
```

---

## **7. Получение паспортов по пациенту**

**`GET /health-passport/patient/{patient_id}`**

### Response:

```json
[
  {
    "id": "health-passport-uuid-1",
    "patient_id": "patient-uuid",
    "doctor_id": "doctor-uuid-1",
    "file_id": "pdf-file-id-1",
    "created_at": "2025-01-05T15:30:00Z",
    "updated_at": "2025-01-05T15:30:00Z"
  }
]
```

---

## **8. Получение паспортов по врачу**

**`GET /health-passport/doctor/{doctor_id}`**

### Response:

```json
[
  {
    "id": "health-passport-uuid-1",
    "patient_id": "patient-uuid-1",
    "doctor_id": "doctor-uuid",
    "file_id": "pdf-file-id-1",
    "created_at": "2025-01-05T15:30:00Z",
    "updated_at": "2025-01-05T15:30:00Z"
  }
]
```

---

## **9. Удаление паспорта здоровья**

**`DELETE /health-passport/{id}`**

### Response:

```json
{
  "message": "Health passport deleted successfully"
}
```

---

# Анкета пациента

## **10. Получение анкеты пациента (13 вопросов с ответами)**

**`GET /patients/{patient_id}/questionnaire`**

**Доступ:** Только для врачей (роль `doctor`)

### Описание:
Получение всех 13 вопросов анкеты с текущими ответами пациента. Если пациент еще не отвечал на какой-то вопрос, поле `answer` будет пустым.

### Response:

```json
{
  "patient_id": "648bf601-9fb3-4c00-894e-4309774a248e",
  "questions": [
    {
      "question_id": 1,
      "question_text": "На что жалуетесь?",
      "answer": "Периодические головные боли в височной области"
    },
    {
      "question_id": 2,
      "question_text": "Какие у вас хронические заболевания?",
      "answer": "Артериальная гипертония, сахарный диабет 2 типа"
    },
    {
      "question_id": 3,
      "question_text": "Были ли у вас операции?",
      "answer": "Аппендэктомия в 2025 году"
    },
    {
      "question_id": 4,
      "question_text": "Есть ли аллергия на лекарства?",
      "answer": "Аллергия на пенициллин"
    },
    {
      "question_id": 5,
      "question_text": "Какие лекарства принимаете регулярно?",
      "answer": "Метформин 500 мг 2 раза в день, Витамин D 1000 МЕ"
    },
    {
      "question_id": 6,
      "question_text": "Семейный анамнез (чем болели родственники)?",
      "answer": "Мать - сахарный диабет, отец - гипертония"
    },
    {
      "question_id": 7,
      "question_text": "Курите ли вы?",
      "answer": "Да, до 10 сигарет в день"
    },
    {
      "question_id": 8,
      "question_text": "Употребляете ли алкоголь?",
      "answer": "Редко, по праздникам"
    },
    {
      "question_id": 9,
      "question_text": "Занимаетесь ли физической активностью?",
      "answer": "Нерегулярно, в основном прогулки по выходным"
    },
    {
      "question_id": 10,
      "question_text": "Как питаетесь?",
      "answer": "Нерегулярно, много перекусов, предпочитаю сладкое"
    },
    {
      "question_id": 11,
      "question_text": "Сколько часов спите в сутки?",
      "answer": "6 часов, часто просыпаюсь ночью"
    },
    {
      "question_id": 12,
      "question_text": "Испытываете ли стресс?",
      "answer": "Да, большая нагрузка на работе последние месяцы"
    },
    {
      "question_id": 13,
      "question_text": "Есть ли пищевая аллергия или диеты?",
      "answer": "Аллергия на молочные продукты, соблюдаю диету №5"
    }
  ]
}
```

---

## **11. Редактирование ответов анкеты пациента**

**`PUT /patients/{patient_id}/questionnaire/answers`**

**Доступ:** Только для врачей (роль `doctor`)

### Описание:
Массовое обновление ответов пациента на вопросы анкеты. Можно обновить один или несколько ответов за один запрос. Если ответ отсутствовал, он будет создан; если существовал - обновлен.

### Request:

```json
{
  "answers": [
    {
      "question_id": 1,
      "answer": "Обновленные жалобы: сильные мигрени каждый день"
    },
    {
      "question_id": 5,
      "answer": "Метформин 850 мг утром и вечером, Омега-3"
    },
    {
      "question_id": 11,
      "answer": "Теперь сплю 7-8 часов после корректировки режима"
    }
  ]
}
```

### Response:

```json
{
  "patient_id": "648bf601-9fb3-4c00-894e-4309774a248e",
  "updated_count": 3,
  "message": "Successfully updated 3 answers"
}
```

### Примеры использования:

#### Обновление одного ответа:

```bash
curl --request PUT \
  --url http://localhost:8080/patients/648bf601-9fb3-4c00-894e-4309774a248e/questionnaire/answers \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "answers": [
      {
        "question_id": 1,
        "answer": "Головные боли прошли после лечения"
      }
    ]
  }'
```

#### Массовое обновление нескольких ответов:

```bash
curl --request PUT \
  --url http://localhost:8080/patients/648bf601-9fb3-4c00-894e-4309774a248e/questionnaire/answers \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "answers": [
      {
        "question_id": 1,
        "answer": "Головные боли в височной области, усиливаются вечером"
      },
      {
        "question_id": 7,
        "answer": "Бросил курить 2 месяца назад"
      },
      {
        "question_id": 9,
        "answer": "Начал регулярно заниматься спортом 3 раза в неделю"
      }
    ]
  }'
```

### Важные замечания:

1. **Авторизация**: Оба endpoint доступны только врачам (требуется роль `doctor`)
2. **Валидация**: `question_id` должен быть от 1 до 13
3. **Пустые ответы**: Если нужно очистить ответ, передайте пустую строку в поле `answer`
4. **Частичное обновление**: Можно обновлять только те вопросы, которые нужны

---

# Аудио транскрипция

## **12. Аудио транскрипция с Whisper**

**`POST /analysis/audio/whisper`**

### Request (multipart/form-data):

- `audio` (file): Аудио файл для транскрипции
- `language` (string, optional): Язык аудио (kz, ru, en). По умолчанию "ru"

### Response:

```json
{
  "transcription": "Текст транскрипции",
  "language": "ru"
}
```

---

## **13. Аудио транскрипция с GPT-4o**

**`POST /audio/gpt-transcribe`**

### Request (multipart/form-data):

- `audio` (file): Аудио файл для транскрипции (максимум 25 MB)
- `language` (string, optional): Язык аудио (kz, ru, en). По умолчанию "ru"
- `prompt` (string, optional): Промпт для улучшения качества транскрипции

### Поддерживаемые форматы файлов:

- mp3, mp4, mpeg, mpga, m4a, wav, webm

### Response:

```json
{
  "transcription": "Текст транскрипции с улучшенным качеством",
  "language": "ru",
  "model": "gpt-4o-transcribe",
  "prompt": "Использованный промпт для улучшения качества"
}
```

### Примеры использования:

#### Базовый запрос:

```bash
curl --request POST \
  --url http://localhost:8080/audio/gpt-transcribe \
  --header 'Content-Type: multipart/form-data' \
  --form file=@/path/to/audio.mp3 \
  --form language=ru
```

#### Запрос с промптом для улучшения качества:

```bash
curl --request POST \
  --url http://localhost:8080/audio/gpt-transcribe \
  --header 'Content-Type: multipart/form-data' \
  --form file=@/path/to/audio.mp3 \
  --form language=ru \
  --form prompt="Это медицинская консультация о сердечно-сосудистых заболеваниях"
```

---

## **14. Аудио транскрипция с GPT-4o Mini**

**`POST /audio/gpt-mini-transcribe`**

### Request (multipart/form-data):

- `audio` (file): Аудио файл для транскрипции (максимум 25 MB)
- `language` (string, optional): Язык аудио (kz, ru, en). По умолчанию "ru"
- `prompt` (string, optional): Промпт для улучшения качества транскрипции

### Поддерживаемые форматы файлов:

- mp3, mp4, mpeg, mpga, m4a, wav, webm

### Response:

```json
{
  "transcription": "Текст транскрипции",
  "language": "ru",
  "model": "gpt-4o-mini-transcribe",
  "prompt": "Использованный промпт для улучшения качества"
}
```

### Примеры использования:

#### Базовый запрос:

```bash
curl --request POST \
  --url http://localhost:8080/audio/gpt-mini-transcribe \
  --header 'Content-Type: multipart/form-data' \
  --form file=@/path/to/audio.mp3 \
  --form language=ru
```

#### Запрос с промптом:

```bash
curl --request POST \
  --url http://localhost:8080/audio/gpt-mini-transcribe \
  --header 'Content-Type: multipart/form-data' \
  --form file=@/path/to/audio.mp3 \
  --form language=ru \
  --form prompt="Это разговор о симптомах простуды"
```

---

## **Сравнение моделей транскрипции**

| Модель                 | Качество | Скорость      | Стоимость | Поддерживаемые языки |
| ---------------------- | -------- | ------------- | --------- | -------------------- |
| whisper-1              | Хорошее  | Средняя       | Низкая    | 98+ языков           |
| gpt-4o-transcribe      | Отличное | Высокая       | Средняя   | 98+ языков           |
| gpt-4o-mini-transcribe | Хорошее  | Очень высокая | Низкая    | 98+ языков           |

### Рекомендации по выбору модели:

- **whisper-1**: Для базовой транскрипции с ограниченным бюджетом
- **gpt-4o-mini-transcribe**: Для быстрой транскрипции с хорошим качеством
- **gpt-4o-transcribe**: Для максимального качества транскрипции

### Особенности GPT-4o моделей:

1. **Поддержка промптов**: Можно использовать промпты для улучшения качества транскрипции
2. **Лучшее распознавание контекста**: Лучше понимают медицинскую терминологию
3. **Ограниченные параметры**: Поддерживают только `json` и `text` форматы ответа
4. **Быстрая обработка**: Оптимизированы для быстрой транскрипции
