// Интерфейс для секции рекомендации
export interface RecommendationSection {
    emoji: string;
    title: string;
    content: string;
    id: string;
}

// Функция для парсинга рекомендаций по смайликам
export function parseRecommendations(recommendations: string): RecommendationSection[] {
    if (!recommendations || typeof recommendations !== 'string') {
        return [];
    }

    // Регулярное выражение для поиска смайликов
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    
    // Разделяем текст на части по смайликам
    const parts = recommendations.split(emojiRegex);
    const emojis = recommendations.match(emojiRegex) || [];
    
    const sections: RecommendationSection[] = [];
    
    // Если нет смайликов, возвращаем весь текст как одну секцию
    if (emojis.length === 0) {
        return [{
            emoji: '📝',
            title: 'Рекомендации',
            content: recommendations.trim(),
            id: 'general'
        }];
    }

    // Обрабатываем каждую секцию
    for (let i = 0; i < emojis.length; i++) {
        const emoji = emojis[i];
        const content = parts[i + 1]?.trim() || '';
        
        if (content) {
            // Извлекаем заголовок (первая строка или первые слова до двоеточия)
            const lines = content.split('\n').filter(line => line.trim());
            const firstLine = lines[0] || '';
            
            let title = '';
            let bodyContent = '';
            
            // Ищем двоеточие для разделения заголовка и содержимого
            const colonIndex = firstLine.indexOf(':');
            if (colonIndex !== -1) {
                title = firstLine.substring(0, colonIndex).trim();
                bodyContent = firstLine.substring(colonIndex + 1).trim();
                
                // Добавляем остальные строки к содержимому
                if (lines.length > 1) {
                    bodyContent += '\n' + lines.slice(1).join('\n');
                }
            } else {
                // Если нет двоеточия, используем первые слова как заголовок
                const words = firstLine.split(' ');
                if (words.length > 3) {
                    title = words.slice(0, 3).join(' ');
                    bodyContent = words.slice(3).join(' ');
                    
                    if (lines.length > 1) {
                        bodyContent += '\n' + lines.slice(1).join('\n');
                    }
                } else {
                    title = firstLine;
                    bodyContent = lines.slice(1).join('\n');
                }
            }
            
            sections.push({
                emoji,
                title: title || getDefaultTitle(emoji),
                content: bodyContent || content,
                id: `section-${i}`
            });
        }
    }

    return sections;
}

// Функция для получения заголовка по умолчанию на основе смайлика
function getDefaultTitle(emoji: string): string {
    const titleMap: Record<string, string> = {
        '🍎': 'Питание',
        '🥗': 'Питание',
        '🍽️': 'Питание',
        '💊': 'Лекарства',
        '🏥': 'Медицина',
        '⚕️': 'Медицина',
        '🏃': 'Физическая активность',
        '🏃‍♂️': 'Физическая активность',
        '🏃‍♀️': 'Физическая активность',
        '🚴': 'Спорт',
        '🏋️': 'Спорт',
        '😴': 'Сон',
        '🛏️': 'Сон',
        '🧘': 'Релаксация',
        '🧘‍♂️': 'Релаксация',
        '🧘‍♀️': 'Релаксация',
        '💧': 'Питьевой режим',
        '🌿': 'Природные средства',
        '🚭': 'Вредные привычки',
        '🍷': 'Алкоголь',
        '📱': 'Образ жизни',
        '⚠️': 'Важно',
        '🔍': 'Обследование',
        '📊': 'Анализы',
        '🩺': 'Консультация',
        '❤️': 'Здоровье сердца',
        '🧠': 'Психическое здоровье',
        '🦴': 'Здоровье костей',
        '👁️': 'Зрение',
        '👂': 'Слух',
        '🦷': 'Зубы'
    };
    
    return titleMap[emoji] || 'Рекомендация';
}

// Функция для форматирования содержимого секции
export function formatSectionContent(content: string): string {
    return content
        .replace(/\n\n+/g, '\n\n') // Убираем лишние переносы
        .replace(/^\s+|\s+$/g, '') // Убираем пробелы в начале и конце
        .replace(/\n/g, '\n'); // Нормализуем переносы строк
} 