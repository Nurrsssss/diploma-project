#!/bin/bash

# Тестовый скрипт для новых эндпоинтов аудио транскрипции
# Убедитесь, что сервер запущен на localhost:8080

BASE_URL="http://localhost:8080"

echo "🧪 Тестирование новых эндпоинтов аудио транскрипции"
echo "=================================================="

# Проверяем, что сервер запущен
echo "📡 Проверка доступности сервера..."
if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✅ Сервер доступен"
else
    echo "❌ Сервер недоступен. Убедитесь, что он запущен на $BASE_URL"
    exit 1
fi

echo ""
echo "📋 Доступные эндпоинты:"
echo "1. POST /analysis/audio/whisper - Whisper транскрипция"
echo "2. POST /audio/gpt-transcribe - GPT-4o транскрипция"
echo "3. POST /audio/gpt-mini-transcribe - GPT-4o Mini транскрипция"

echo ""
echo "💡 Для тестирования вам понадобится аудио файл в одном из форматов:"
echo "   mp3, mp4, mpeg, mpga, m4a, wav, webm"
echo ""
echo "📝 Примеры команд для тестирования:"
echo ""
echo "1. Whisper транскрипция:"
echo "curl -X POST $BASE_URL/analysis/audio/whisper \\"
echo "  -F 'audio=@/path/to/your/audio.mp3' \\"
echo "  -F 'language=ru'"
echo ""
echo "2. GPT-4o транскрипция:"
echo "curl -X POST $BASE_URL/audio/gpt-transcribe \\"
echo "  -F 'audio=@/path/to/your/audio.mp3' \\"
echo "  -F 'language=ru' \\"
echo "  -F 'prompt=Это медицинская консультация'"
echo ""
echo "3. GPT-4o Mini транскрипция:"
echo "curl -X POST $BASE_URL/audio/gpt-mini-transcribe \\"
echo "  -F 'audio=@/path/to/your/audio.mp3' \\"
echo "  -F 'language=ru' \\"
echo "  -F 'prompt=Это разговор о симптомах'"
echo ""
echo "🔧 Параметры:"
echo "   - audio: файл аудио (обязательный)"
echo "   - language: язык (kz, ru, en), по умолчанию 'ru'"
echo "   - prompt: промпт для улучшения качества (только для GPT-4o моделей)"
echo ""
echo "📊 Ожидаемые ответы:"
echo "   - whisper: {\"transcription\": \"текст\", \"language\": \"ru\"}"
echo "   - gpt-4o: {\"transcription\": \"текст\", \"language\": \"ru\", \"model\": \"gpt-4o-transcribe\", \"prompt\": \"...\"}"
echo "   - gpt-4o-mini: {\"transcription\": \"текст\", \"language\": \"ru\", \"model\": \"gpt-4o-mini-transcribe\", \"prompt\": \"...\"}"
