# Аудио транскрипция API

Этот документ описывает новые эндпоинты для аудио транскрипции с использованием различных моделей OpenAI.

## Доступные эндпоинты

### 1. Whisper транскрипция

**`POST /analysis/audio/whisper`**

Классическая транскрипция с использованием модели Whisper-1.

### 2. GPT-4o транскрипция

**`POST /audio/gpt-transcribe`**

Высококачественная транскрипция с использованием модели GPT-4o-transcribe.

### 3. GPT-4o Mini транскрипция

**`POST /audio/gpt-mini-transcribe`**

Быстрая транскрипция с использованием модели GPT-4o-mini-transcribe.

## Поддерживаемые форматы файлов

Все эндпоинты поддерживают следующие аудио форматы:

- mp3
- mp4
- mpeg
- mpga
- m4a
- wav
- webm

**Максимальный размер файла:** 25 MB

## Параметры запроса

### Общие параметры

- `audio` (file, обязательный): Аудио файл для транскрипции
- `language` (string, опциональный): Язык аудио
  - Поддерживаемые языки: `kz`, `ru`, `en`
  - По умолчанию: `ru`

### Специальные параметры для GPT-4o моделей

- `prompt` (string, опциональный): Промпт для улучшения качества транскрипции

## Примеры использования

### 1. Базовая транскрипция с Whisper

```bash
curl -X POST http://localhost:8080/analysis/audio/whisper \
  -F 'audio=@/path/to/audio.mp3' \
  -F 'language=ru'
```

**Ответ:**

```json
{
  "transcription": "Текст транскрипции",
  "language": "ru"
}
```

### 2. GPT-4o транскрипция с промптом

```bash
curl -X POST http://localhost:8080/audio/gpt-transcribe \
  -F 'audio=@/path/to/audio.mp3' \
  -F 'language=ru' \
  -F 'prompt=Это медицинская консультация о сердечно-сосудистых заболеваниях'
```

**Ответ:**

```json
{
  "transcription": "Текст транскрипции с улучшенным качеством",
  "language": "ru",
  "model": "gpt-4o-transcribe",
  "prompt": "Это медицинская консультация о сердечно-сосудистых заболеваниях"
}
```

### 3. GPT-4o Mini транскрипция

```bash
curl -X POST http://localhost:8080/audio/gpt-mini-transcribe \
  -F 'audio=@/path/to/audio.mp3' \
  -F 'language=kz' \
  -F 'prompt=Бұл денсаулық туралы сұхбат'
```

**Ответ:**

```json
{
  "transcription": "Текст транскрипции на казахском языке",
  "language": "kz",
  "model": "gpt-4o-mini-transcribe",
  "prompt": "Бұл денсаулық туралы сұхбат"
}
```

## Сравнение моделей

| Характеристика           | Whisper-1    | GPT-4o-transcribe | GPT-4o-mini-transcribe |
| ------------------------ | ------------ | ----------------- | ---------------------- |
| Качество                 | Хорошее      | Отличное          | Хорошее                |
| Скорость                 | Средняя      | Высокая           | Очень высокая          |
| Стоимость                | Низкая       | Средняя           | Низкая                 |
| Поддержка промптов       | Ограниченная | Полная            | Полная                 |
| Медицинская терминология | Базовая      | Продвинутая       | Продвинутая            |

## Рекомендации по выбору модели

### Whisper-1

- ✅ Для базовой транскрипции
- ✅ При ограниченном бюджете
- ✅ Для быстрого прототипирования
- ❌ Ограниченная поддержка промптов

### GPT-4o-transcribe

- ✅ Для максимального качества
- ✅ Для медицинской терминологии
- ✅ При необходимости точности
- ❌ Более высокая стоимость

### GPT-4o-mini-transcribe

- ✅ Для быстрой обработки
- ✅ Хорошее соотношение цена/качество
- ✅ Поддержка промптов
- ✅ Оптимальный выбор для большинства случаев

## Лучшие практики

### 1. Использование промптов

Промпты могут значительно улучшить качество транскрипции:

```bash
# Для медицинских консультаций
prompt="Это медицинская консультация. Обратите внимание на медицинские термины и названия препаратов."

# Для технических разговоров
prompt="Это техническая дискуссия. Сохраните точность технических терминов и аббревиатур."

# Для многоязычного контента
prompt="Это разговор на смеси русского и казахского языков. Сохраните оба языка."
```

### 2. Выбор языка

- Используйте `ru` для русского языка
- Используйте `kz` для казахского языка
- Используйте `en` для английского языка
- Для многоязычного контента используйте основной язык

### 3. Обработка ошибок

Все эндпоинты возвращают стандартные HTTP коды:

- `200 OK`: Успешная транскрипция
- `400 Bad Request`: Неверные параметры или неподдерживаемый формат
- `413 Payload Too Large`: Файл превышает 25 MB
- `500 Internal Server Error`: Ошибка сервера или OpenAI API

### 4. Оптимизация файлов

- Сжимайте аудио файлы до разумного размера
- Используйте качество 128-192 kbps для MP3
- Избегайте очень длинных файлов (разбивайте на части)

## Примеры интеграции

### JavaScript (Node.js)

```javascript
const FormData = require("form-data");
const fs = require("fs");

async function transcribeAudio(filePath, language = "ru", prompt = "") {
  const form = new FormData();
  form.append("audio", fs.createReadStream(filePath));
  form.append("language", language);

  if (prompt) {
    form.append("prompt", prompt);
  }

  const response = await fetch("http://localhost:8080/audio/gpt-transcribe", {
    method: "POST",
    body: form,
  });

  return await response.json();
}

// Использование
transcribeAudio("/path/to/audio.mp3", "ru", "Медицинская консультация")
  .then((result) => console.log(result.transcription))
  .catch((error) => console.error("Ошибка:", error));
```

### Python

```python
import requests

def transcribe_audio(file_path, language='ru', prompt=''):
    url = 'http://localhost:8080/audio/gpt-transcribe'

    with open(file_path, 'rb') as audio_file:
        files = {'audio': audio_file}
        data = {'language': language}

        if prompt:
            data['prompt'] = prompt

        response = requests.post(url, files=files, data=data)

    return response.json()

# Использование
result = transcribe_audio('/path/to/audio.mp3', 'ru', 'Медицинская консультация')
print(result['transcription'])
```

### cURL

```bash
# Базовый запрос
curl -X POST http://localhost:8080/audio/gpt-transcribe \
  -F 'audio=@audio.mp3' \
  -F 'language=ru'

# С промптом
curl -X POST http://localhost:8080/audio/gpt-transcribe \
  -F 'audio=@audio.mp3' \
  -F 'language=ru' \
  -F 'prompt=Медицинская консультация о сердечно-сосудистых заболеваниях'
```

## Тестирование

Для тестирования эндпоинтов используйте скрипт `test_audio_endpoints.sh`:

```bash
./test_audio_endpoints.sh
```

Этот скрипт покажет примеры команд и проверит доступность сервера.

## Устранение неполадок

### Частые проблемы

1. **"audio file is required"**

   - Убедитесь, что файл передается с именем `audio`
   - Проверьте, что файл существует и доступен для чтения

2. **"unsupported language"**

   - Используйте только поддерживаемые языки: `kz`, `ru`, `en`

3. **"transcription failed"**

   - Проверьте, что файл не поврежден
   - Убедитесь, что формат файла поддерживается
   - Проверьте подключение к интернету (для OpenAI API)

4. **"failed to save file"**
   - Проверьте права доступа к директории `/tmp`
   - Убедитесь, что на диске достаточно места

### Логи и отладка

Для отладки включите подробные логи в конфигурации сервера и проверьте:

- Логи сервера на предмет ошибок
- Ответы OpenAI API
- Размер и формат загружаемых файлов
