package text

import (
	"regexp"
)

func FormatMedicalText(text string) string {
	if text == "" {
		return text
	}

	text = formatMedicalSections(text)

	return text
}

func formatMedicalSections(text string) string {
	sections := []string{
		"Основные жалобы",
		"Характеристика симптомов",
		"Дополнительная информация",
		"Анамнез жизни",
		"Хронические заболевания",
		"Лекарственная терапия",
		"Аллергические реакции",
		"Семейный анамнез",
		"Операции и травмы",
		"Питание и диета",
		"Физическая активность",
		"Сон и отдых",
		"Стресс и психологическое состояние",
		"Вредные привычки",
		"Факторы риска",
		"Рекомендации по врачам-специалистам",
		"Первоочередные консультации",
		"Дополнительные специалисты",
		"Срочность обращения",
		"Персонализированные медицинские рекомендации",
		"Дополнительные обследования",
		"Диета и питание",
		"Управление аллергиями",
		"Самоконтроль",
	}

	for _, section := range sections {

		pattern := regexp.QuoteMeta(section)
		text = regexp.MustCompile(`\n\s*`+pattern+`\s*\n`).ReplaceAllString(text, "\n\n## "+section+"\n\n")
	}

	return text
}
