import { questionnaireStructure } from '@/arrays/chat/questions';

/**
 * Преобразует ответы анализа в формат, ожидаемый бэкендом для генерации паспорта здоровья
 */
export function transformAnalysisAnswers(answers: Record<string, string>): Record<string, string> {
    const transformedAnswers: Record<string, string> = {};
    
    // Маппинг числовых ключей на текстовые
    const keyMapping: Record<string, string> = {
        "1": "symptoms",
        "2": "past_year_symptoms", 
        "3": "chronic_diseases",
        "4": "medications",
        "5": "allergies",
        "6": "family_history",
        "7": "diet",
        "8": "physical_activity",
        "9": "sleep",
        "10": "stress",
        "11": "bad_habits",
        "12": "additional_questions"
    };

    // Преобразуем ответы
    Object.entries(answers).forEach(([key, value]) => {
        const mappedKey = keyMapping[key] || key;
        if (value && value.trim() !== '') {
            transformedAnswers[mappedKey] = value.trim();
        }
    });

    // Проверяем, что все обязательные поля присутствуют
    questionnaireStructure.forEach(question => {
        if (!transformedAnswers[question.id]) {
            transformedAnswers[question.id] = 'Нет данных';
        }
    });

    return transformedAnswers;
}

/**
 * Проверяет, содержит ли анализ все необходимые данные для генерации паспорта
 */
export function validateAnalysisData(analysis: any): boolean {
    if (!analysis || !analysis.answers) {
        return false;
    }

    const requiredFields = questionnaireStructure.map(q => q.id);
    const hasRequiredFields = requiredFields.some(field => 
        analysis.answers[field] || analysis.answers[field] === ''
    );

    return hasRequiredFields;
} 