# Changelog: Новые эндпоинты аудио транскрипции

## Добавлено в версии 1.1.0

### Новые эндпоинты

1. **`POST /audio/gpt-transcribe`** - Транскрипция с использованием GPT-4o-transcribe
2. **`POST /audio/gpt-mini-transcribe`** - Транскрипция с использованием GPT-4o-mini-transcribe

### Новые функции

#### В `internal/openai/whisper.go`:

- `TranscribeAudioWithGPT4o(filePath, language, prompt string)` - транскрипция с GPT-4o
- `TranscribeAudioWithGPT4oMini(filePath, language, prompt string)` - транскрипция с GPT-4o-mini

#### В `internal/handlers/audio_handler.go`:

- `TranscribeAudioWithGPT4o(c *gin.Context)` - обработчик для GPT-4o
- `TranscribeAudioWithGPT4oMini(c *gin.Context)` - обработчик для GPT-4o-mini

### Новые маршруты

В `internal/router/routes.go` добавлены:

```go
r.POST("/audio/gpt-transcribe", handlers.TranscribeAudioWithGPT4o)
r.POST("/audio/gpt-mini-transcribe", handlers.TranscribeAudioWithGPT4oMini)
```

### Документация

1. **API_DOCUMENTATION.md** - обновлен с новыми эндпоинтами
2. **AUDIO_TRANSCRIPTION_README.md** - подробная документация по аудио транскрипции
3. **test_audio_endpoints.sh** - скрипт для тестирования эндпоинтов

## Особенности новых эндпоинтов

### Поддерживаемые параметры:

- `audio` (file, обязательный) - аудио файл
- `language` (string, опциональный) - язык (kz, ru, en)
- `prompt` (string, опциональный) - промпт для улучшения качества

### Поддерживаемые форматы:

- mp3, mp4, mpeg, mpga, m4a, wav, webm
- Максимальный размер: 25 MB

### Ответы API:

#### GPT-4o транскрипция:

```json
{
  "transcription": "Текст транскрипции",
  "language": "ru",
  "model": "gpt-4o-transcribe",
  "prompt": "Использованный промпт"
}
```

#### GPT-4o Mini транскрипция:

```json
{
  "transcription": "Текст транскрипции",
  "language": "ru",
  "model": "gpt-4o-mini-transcribe",
  "prompt": "Использованный промпт"
}
```

## Сравнение с существующими эндпоинтами

| Эндпоинт                     | Модель                 | Качество | Скорость      | Промпты      |
| ---------------------------- | ---------------------- | -------- | ------------- | ------------ |
| `/analysis/audio/whisper`    | whisper-1              | Хорошее  | Средняя       | Ограниченные |
| `/audio/gpt-transcribe`      | gpt-4o-transcribe      | Отличное | Высокая       | Полные       |
| `/audio/gpt-mini-transcribe` | gpt-4o-mini-transcribe | Хорошее  | Очень высокая | Полные       |

## Примеры использования

### Базовый запрос:

```bash
curl -X POST http://localhost:8080/audio/gpt-transcribe \
  -F 'audio=@audio.mp3' \
  -F 'language=ru'
```

### Запрос с промптом:

```bash
curl -X POST http://localhost:8080/audio/gpt-transcribe \
  -F 'audio=@audio.mp3' \
  -F 'language=ru' \
  -F 'prompt=Это медицинская консультация'
```

## Тестирование

Запустите тестовый скрипт:

```bash
./test_audio_endpoints.sh
```

## Обратная совместимость

Все существующие эндпоинты продолжают работать без изменений:

- `POST /analysis/audio/whisper` - без изменений
