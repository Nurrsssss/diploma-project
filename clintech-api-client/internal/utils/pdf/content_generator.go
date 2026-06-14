package pdf

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/utils/text"
)

/*
ContentGenerator — единая точка генерации текстов/структур для паспорта здоровья.
Добавлено:
- GenerateDoctorConclusionStructured: жёсткий JSON для Объективного статуса, Диагноза и планов.
- buildDoctorConclusionJSONPrompt: промпт, принуждающий модель вернуть ТОЛЬКО валидный JSON со строгими ключами.
Остальные методы сохранены без изменения сигнатур.
*/

type ContentGenerator struct {
	fileServerClient *client.FileServerClient
}

func NewContentGenerator() *ContentGenerator {
	return &ContentGenerator{}
}

func (c *ContentGenerator) SetFileServerClient(client *client.FileServerClient) {
	c.fileServerClient = client
}

func llmOfflineIntro(lang string) string {
	switch lang {
	case "en":
		return "_(Generated from questionnaire only — AI backend unavailable.)_\n\n"
	case "kz":
		return "_(Тек сауалнама бойынша — ИИ сервері қолжетімсіз.)_\n\n"
	default:
		return "_(Сформировано по анкете без нейросети — ИИ недоступен.)_\n\n"
	}
}

func narrativeFromAnswerMap(answers map[string]string) string {
	if len(answers) == 0 {
		return ""
	}
	var b strings.Builder
	for k, v := range answers {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		b.WriteString(k)
		b.WriteString(": ")
		b.WriteString(v)
		b.WriteString("\n")
	}
	return strings.TrimSpace(b.String())
}

func offlineComplaintsBody(answers map[string]string, lang string) string {
	if s := strings.TrimSpace(answers["complaints"]); s != "" {
		return s
	}
	if s := narrativeFromAnswerMap(answers); s != "" {
		return s
	}
	switch lang {
	case "en":
		return "No questionnaire data for complaints (AI unavailable)."
	case "kz":
		return "Шағымдар бойынша сауалнама деректері жоқ (ИИ қолжетімсіз)."
	default:
		return "Нет данных анкеты для описания жалоб (ИИ недоступен)."
	}
}

func offlineMedicalHistoryBody(profile *client.PatientProfile, answers map[string]string, lang string) string {
	var b strings.Builder
	if profile != nil {
		fn := strings.TrimSpace(profile.FirstName + " " + profile.LastName)
		if fn != "" {
			b.WriteString(fn)
			b.WriteString("\n")
		}
	}
	if s := narrativeFromAnswerMap(answers); s != "" {
		b.WriteString(s)
	}
	out := strings.TrimSpace(b.String())
	if out != "" {
		return out
	}
	switch lang {
	case "en":
		return "No anamnesis data (AI unavailable)."
	case "kz":
		return "Анамнез деректері жоқ (ИИ қолжетімсіз)."
	default:
		return "Нет данных для анамнеза (ИИ недоступен)."
	}
}

func (c *ContentGenerator) askOpenAITextOrOffline(prompt, lang, offlineBody string) (string, error) {
	out, err := openai.AskOpenAI(prompt, lang)
	if err == nil {
		return out, nil
	}
	if errors.Is(err, openai.ErrLLMUnavailable) {
		return llmOfflineIntro(lang) + offlineBody, nil
	}
	return "", err
}

func fallbackStructuredFromComplaints(complaints, fileAnalysis, lang string) *StructuredConclusion {
	diagnosis := "Требуется дообследование (ИИ недоступен)."
	plans := "- Клиническое наблюдение и дообследование по показаниям\n- Контроль у лечащего врача"
	if lang == "en" {
		diagnosis = "Further workup required (AI unavailable)."
		plans = "- Clinical observation and further tests as indicated\n- Follow-up with treating physician"
	}
	if lang == "kz" {
		diagnosis = "Қосымша зерттеу қажет (ИИ қолжетімсіз)."
		plans = "- Клиникалық бақылау және көрсеткіштер бойынша зерттеу\n- Емдеуші дәрігердің бақылауында болу"
	}
	bl := strings.TrimSpace(complaints)
	if bl == "" {
		bl = diagnosis
	}
	obj := bl
	if fa := strings.TrimSpace(fileAnalysis); fa != "" {
		if obj != "" {
			obj += "\n\n"
		}
		obj += fa
	}
	return &StructuredConclusion{
		CurrentState:      bl,
		ObjectiveStatus:   obj,
		DiagnosisMain:     diagnosis,
		DiagnosisComorbid: []string{},
		PlanExam:          plans,
		PlanTreatment:     plans,
		PlanGeneral:       plans,
	}
}

// -----------------------------
// ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
// -----------------------------

func (c *ContentGenerator) FilterAnswersByCategory(answers map[string]string, categories []string) map[string]string {
	filtered := make(map[string]string)
	for _, category := range categories {
		if answer, exists := answers[category]; exists && strings.TrimSpace(answer) != "" {
			filtered[category] = answer
		}
	}
	return filtered
}

func (c *ContentGenerator) filterAnswersByCategory(answers map[string]string, categories []string) map[string]string {
	return c.FilterAnswersByCategory(answers, categories)
}

func (c *ContentGenerator) getOtherAnswers(answers map[string]string, excludeCategories []string) map[string]string {
	excluded := make(map[string]bool)
	for _, cat := range excludeCategories {
		excluded[cat] = true
	}
	other := make(map[string]string)
	for key, value := range answers {
		if !excluded[key] && strings.TrimSpace(value) != "" {
			other[key] = value
		}
	}
	return other
}

// аккуратно вырезаем первый «наружный» JSON-объект из произвольной строки
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

// -----------------------------
// ПУБЛИЧНЫЕ ГЕНЕРАТОРЫ ТЕКСТА
// -----------------------------

func (c *ContentGenerator) GenerateComplaints(answers map[string]string, lang string) (string, error) {
	prompt := c.buildComplaintsPrompt(answers, lang)
	response, err := c.askOpenAITextOrOffline(prompt, lang, offlineComplaintsBody(answers, lang))
	if err != nil {
		return "", err
	}
	formatted := text.FormatMedicalText(response)

	// Если результат пустой или слишком короткий, генерируем на основе всех данных
	if strings.TrimSpace(formatted) == "" || len(strings.TrimSpace(formatted)) < 20 {
		// Повторная попытка с более явным указанием
		if lang == "ru" {
			formatted = "На основе предоставленных данных требуется дополнительный анализ для описания текущего состояния."
		} else if lang == "en" {
			formatted = "Based on the provided data, additional analysis is required to describe the current condition."
		} else {
			formatted = "Берілген деректер негізінде қазіргі жағдайды сипаттау үшін қосымша талдау қажет."
		}
	}

	return formatted, nil
}

func (c *ContentGenerator) GenerateMedicalHistory(profile *client.PatientProfile, answers map[string]string, lang string) (string, error) {
	prompt := c.buildMedicalHistoryPrompt(profile, answers, lang)
	response, err := c.askOpenAITextOrOffline(prompt, lang, offlineMedicalHistoryBody(profile, answers, lang))
	if err != nil {
		return "", err
	}
	formatted := text.FormatMedicalText(response)

	// Постобработка: заменяем "дата начала не указана" на "пациент не помнит"
	formatted = c.cleanMedicalHistoryText(formatted, lang)

	// Постобработка: добавляем годы к классам, если они упоминаются
	if profile != nil {
		formatted = c.addYearsToGrades(formatted, profile.DateOfBirth, lang)
	}
	return formatted, nil
}

// cleanMedicalHistoryText очищает текст анамнеза заболевания
func (c *ContentGenerator) cleanMedicalHistoryText(text string, lang string) string {
	// Убираем повторяющийся заголовок "Анамнез заболевания:" из начала текста
	text = regexp.MustCompile(`(?i)^\s*Анамнез\s+заболевания[:\s]*`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)^\s*Anamnesis\s+morbi[:\s]*`).ReplaceAllString(text, "")

	// Заменяем варианты "дата начала не указана" на "пациент не помнит"
	replacements := map[string]string{
		"дата начала не указана":             "пациент не помнит",
		"точная дата начала не указана":      "пациент не помнит",
		"дата начала заболевания не указана": "пациент не помнит",
		"дата начала симптомов не указана":   "пациент не помнит",
		"начало не указано":                  "пациент не помнит",
		"дата начала не установлена":         "пациент не помнит",
		"не указана":                         "пациент не помнит",
		"start date not specified":           "patient does not remember",
		"onset date not specified":           "patient does not remember",
		"exact start date not specified":     "patient does not remember",
	}

	for old, new := range replacements {
		// Заменяем с учетом регистра
		text = strings.ReplaceAll(text, old, new)
		// Также заменяем с заглавной буквы в начале предложения
		if len(old) > 0 && len(new) > 0 {
			oldTitle := strings.ToUpper(old[:1]) + old[1:]
			newTitle := strings.ToUpper(new[:1]) + new[1:]
			text = strings.ReplaceAll(text, oldTitle, newTitle)
		}
	}

	// Убираем повторение персональных данных (имя, возраст)
	// Паттерны для поиска и удаления: "У пациента [Имя] [Фамилия], [возраст] лет"
	text = regexp.MustCompile(`(?i)У\s+пациента\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+,\s+\d+\s+лет[^\n]*[\.;]\s*`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)Patient\s+[A-Z][a-z]+\s+[A-Z][a-z]+,\s+\d+\s+years?\s+old[^\n]*[\.;]\s*`).ReplaceAllString(text, "")

	// Убираем фразы типа "симптомы (периодические головные боли...)" - это повторение жалоб
	// Ищем паттерн "симптомы (...)" в начале предложения
	text = regexp.MustCompile(`(?i)симптомы\s*\([^)]+\)\s*присутствуют\s+на\s+момент\s+обращения[^\n]*[\.;]\s*`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)symptoms\s*\([^)]+\)\s+are\s+present\s+at\s+the\s+time\s+of\s+consultation[^\n]*[\.;]\s*`).ReplaceAllString(text, "")

	text = strings.TrimSpace(text)
	// Нормализуем множественные пробелы
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return text
}

func (c *ContentGenerator) GenerateLifestyle(answers map[string]string, lang string) (string, error) {
	prompt := c.buildLifestylePrompt(answers, lang)
	response, err := c.askOpenAITextOrOffline(prompt, lang, narrativeFromAnswerMap(answers))
	if err != nil {
		return "", err
	}
	return text.FormatMedicalText(response), nil
}

// GenerateLifestyleWithProfile генерирует анамнез жизни с учетом профиля пациента для обработки классов
func (c *ContentGenerator) GenerateLifestyleWithProfile(profile *client.PatientProfile, answers map[string]string, lang string) (string, error) {
	prompt := c.buildLifestylePrompt(answers, lang)
	response, err := c.askOpenAITextOrOffline(prompt, lang, narrativeFromAnswerMap(answers))
	if err != nil {
		return "", err
	}
	formatted := text.FormatMedicalText(response)
	// Постобработка: добавляем годы к классам, если они упоминаются
	if profile != nil {
		formatted = c.addYearsToGrades(formatted, profile.DateOfBirth, lang)
	}
	return formatted, nil
}

func (c *ContentGenerator) GenerateDoctorRecommendations(profile *client.PatientProfile, answers map[string]string, complaints string, medicalHistory string, lang string) (string, error) {
	prompt := c.buildDoctorRecommendationsPrompt(profile, answers, complaints, medicalHistory, lang)
	fb := complaints + "\n\n" + medicalHistory + "\n\n" + narrativeFromAnswerMap(answers)
	response, err := c.askOpenAITextOrOffline(prompt, lang, strings.TrimSpace(fb))
	if err != nil {
		return "", err
	}
	return text.FormatMedicalText(response), nil
}

func (c *ContentGenerator) GenerateGeneralConclusion(profile *client.PatientProfile, answers map[string]string, fileAnalysis string, lang string) (string, error) {
	prompt := c.buildGeneralConclusionPrompt(profile, answers, fileAnalysis, lang)
	fb := narrativeFromAnswerMap(answers)
	if strings.TrimSpace(fileAnalysis) != "" {
		if fb != "" {
			fb += "\n\n"
		}
		fb += fileAnalysis
	}
	response, err := c.askOpenAITextOrOffline(prompt, lang, strings.TrimSpace(fb))
	if err != nil {
		return "", err
	}
	return text.FormatMedicalText(response), nil
}

// Legacy: свободный Markdown-текст врача (оставляем для обратной совместимости)
func (c *ContentGenerator) GenerateDoctorConclusion(profile *client.PatientProfile, answers map[string]string, complaints string, fileAnalysis string, lang string) (string, error) {
	prompt := c.buildDoctorConclusionPrompt(profile, answers, complaints, fileAnalysis, lang)
	fb := strings.TrimSpace(complaints + "\n\n" + narrativeFromAnswerMap(answers) + "\n\n" + fileAnalysis)
	response, err := c.askOpenAITextOrOffline(prompt, lang, fb)
	if err != nil {
		return "", err
	}
	return text.FormatMedicalText(response), nil
}

// -----------------------------
// СТРУКТУРИРОВАННОЕ ЗАКЛЮЧЕНИЕ (ЖЁСТКИЙ JSON)
// -----------------------------

type StructuredConclusion struct {
	CurrentState      string   `json:"current_state"`      // НОВОЕ: 2–4 предложения по факту на момент осмотра
	ObjectiveStatus   string   `json:"objective_status"`   // Ключевые объективные факты/находки (Markdown допустим)
	DiagnosisMain     string   `json:"diagnosis_main"`     // одна строка
	DiagnosisComorbid []string `json:"diagnosis_comorbid"` // массив строк (может быть пустым)
	PlanExam          string   `json:"plan_exam"`          // Markdown-список
	PlanTreatment     string   `json:"plan_treatment"`     // Markdown-список
	PlanGeneral       string   `json:"plan_general"`       // Markdown-список
}

// GenerateDoctorConclusionStructured — запрашивает у LLM строгое JSON-ядро.
// Возвращает распарсенную структуру и сырое тело ответа (на случай логирования).
// GenerateDoctorConclusionStructured — запрашивает у LLM строгое JSON-ядро.
func (c *ContentGenerator) GenerateDoctorConclusionStructured(
	profile *client.PatientProfile,
	answers map[string]string,
	complaints string,
	fileAnalysis string,
	lang string,
) (*StructuredConclusion, string, error) {

	prompt := c.buildDoctorConclusionJSONPrompt(profile, answers, complaints, fileAnalysis, lang)

	raw, err := openai.AskOpenAI(prompt, lang)
	if err != nil {
		if errors.Is(err, openai.ErrLLMUnavailable) {
			sc := fallbackStructuredFromComplaints(complaints, fileAnalysis, lang)
			return sc, llmOfflineIntro(lang) + "structured-offline", nil
		}
		return nil, "", err
	}

	jsonStr := extractJSON(raw)
	var sc StructuredConclusion
	if err := json.Unmarshal([]byte(jsonStr), &sc); err != nil {
		return nil, raw, fmt.Errorf("parse structured conclusion JSON: %w", err)
	}

	// защита от nil-слайса + trim пробелов
	if sc.DiagnosisComorbid == nil {
		sc.DiagnosisComorbid = []string{}
	}
	sc.CurrentState = strings.TrimSpace(sc.CurrentState)
	sc.ObjectiveStatus = strings.TrimSpace(sc.ObjectiveStatus)
	sc.DiagnosisMain = strings.TrimSpace(sc.DiagnosisMain)
	sc.PlanExam = strings.TrimSpace(sc.PlanExam)
	sc.PlanTreatment = strings.TrimSpace(sc.PlanTreatment)
	sc.PlanGeneral = strings.TrimSpace(sc.PlanGeneral)

	return &sc, raw, nil
}

// -----------------------------
// ПРОМПТЫ
// -----------------------------

func (c *ContentGenerator) buildComplaintsPrompt(answers map[string]string, lang string) string {
	var prompt strings.Builder

	if lang == "kz" {
		prompt.WriteString("Сіз тәжірибелі дәрігерсіз. Науқастың шағымдары мен симптомдарын ТАЛДАП, медициналық тұрғыдан ҚЫСҚА және АНЫҚ сипаттаңыз.\n\n")
		prompt.WriteString("**КРИТИКАЛЫҚ МАҢЫЗДЫ:**\n")
		prompt.WriteString("- НЕ просто переписывайте ответы анкеты - АНАЛИЗИРУЙТЕ и ОБЪЯСНЯЙТЕ состояние пациента\n")
		prompt.WriteString("- Опишите ЧТО беспокоит пациента СЕЙЧАС, КАК это проявляется, ГДЕ локализуется\n")
		prompt.WriteString("- Если симптомов нет в явном виде - проанализируйте все данные и опишите текущее состояние\n")
		prompt.WriteString("- Максимум 4-6 предложений, связный текст, не список\n")
		prompt.WriteString("- Пишите понятным языком, но медицински корректно\n\n")
	} else if lang == "en" {
		prompt.WriteString("You are an experienced physician. ANALYZE and describe the patient's complaints and symptoms in medical terms, BRIEFLY and CLEARLY.\n\n")
		prompt.WriteString("**CRITICALLY IMPORTANT:**\n")
		prompt.WriteString("- DO NOT simply rewrite questionnaire answers - ANALYZE and EXPLAIN the patient's condition\n")
		prompt.WriteString("- Describe WHAT bothers the patient NOW, HOW it manifests, WHERE it is localized\n")
		prompt.WriteString("- If symptoms are not explicitly stated - analyze all data and describe current condition\n")
		prompt.WriteString("- Maximum 4-6 sentences, coherent text, not a list\n")
		prompt.WriteString("- Write in understandable language but medically correct\n\n")
	} else {
		prompt.WriteString("Вы опытный врач. ПРОАНАЛИЗИРУЙТЕ и опишите жалобы и симптомы пациента медицинским языком, КРАТКО и ЧЕТКО.\n\n")
		prompt.WriteString("**КРИТИЧЕСКИ ВАЖНО:**\n")
		prompt.WriteString("- НЕ просто переписывайте ответы анкеты - АНАЛИЗИРУЙТЕ и ОБЪЯСНЯЙТЕ состояние пациента\n")
		prompt.WriteString("- Опишите ЧТО беспокоит пациента СЕЙЧАС, КАК это проявляется, ГДЕ локализуется\n")
		prompt.WriteString("- Если симптомов нет в явном виде - проанализируйте все данные и опишите текущее состояние\n")
		prompt.WriteString("- Максимум 4-6 предложений, связный текст, не список\n")
		prompt.WriteString("- Пишите понятным языком, но медицински корректно\n\n")
	}

	// Используем ВСЕ данные из answers для анализа, не только симптомы
	prompt.WriteString("**ДАННЫЕ ПАЦИЕНТА:**\n")
	for key, value := range answers {
		if strings.TrimSpace(value) != "" {
			prompt.WriteString(fmt.Sprintf("%s: %s\n", key, value))
		}
	}
	prompt.WriteString("\n")

	if lang == "kz" {
		prompt.WriteString("**ФОРМАТ ОТВЕТА:** Связный текст (не список!), который объясняет текущее состояние пациента. Если симптомов нет - опишите общее состояние на основе всех данных. НЕ включайте анамнез, лечение, диагноз - только текущее состояние.")
	} else if lang == "en" {
		prompt.WriteString("**RESPONSE FORMAT:** Coherent text (not a list!) that explains the patient's current condition. If no symptoms - describe general condition based on all data. DO NOT include anamnesis, treatment, diagnosis - only current condition.")
	} else {
		prompt.WriteString("**ФОРМАТ ОТВЕТА:** Связный текст (не список!), который объясняет текущее состояние пациента. Если симптомов нет - опишите общее состояние на основе всех данных. НЕ включайте анамнез, лечение, диагноз - только текущее состояние.")
	}

	return prompt.String()
}

func (c *ContentGenerator) buildGeneralConclusionPrompt(profile *client.PatientProfile, answers map[string]string, fileAnalysis string, lang string) string {
	var prompt strings.Builder

	if lang == "en" {
		prompt.WriteString("You are an experienced medical doctor creating a QUALITY analytical conclusion for a patient's PRELIMINARY CONCLUSION.\n\n")
		prompt.WriteString("**CRITICALLY IMPORTANT:**\n")
		prompt.WriteString("- This is a PRELIMINARY CONCLUSION - you are NOT making a diagnosis, you are ANALYZING and EXPLAINING the patient's condition\n")
		prompt.WriteString("- DO NOT simply rewrite questionnaire answers - ANALYZE, INTERPRET, and EXPLAIN what the data means\n")
		prompt.WriteString("- Help the patient UNDERSTAND their condition - explain WHAT is happening, WHY it might be happening\n")
		prompt.WriteString("- Recommend WHICH specialists to book and WHY (therapist, neurologist, gastroenterologist, etc.)\n")
		prompt.WriteString("- Be COMPACT but INFORMATIVE - maximum 1-2 sentences per section\n")
		prompt.WriteString("- Write in clear, understandable language that helps the patient\n\n")
	} else if lang == "kz" {
		prompt.WriteString("Сіз тәжірибелі дәрігерсіз, науқастың АЛДЫН АЛА ҚОРЫТЫНДЫСЫ үшін САПАЛЫ талдамалық қорытынды жасайсыз.\n\n")
		prompt.WriteString("**КРИТИКАЛЫҚ МАҢЫЗДЫ:**\n")
		prompt.WriteString("- Бұл АЛДЫН АЛА ҚОРЫТЫНДЫ - сіз диагноз ҚОЙМАЙСЫЗ, науқастың жағдайын ТАЛДАЙСЫЗ және ТҮСІНДІРЕСІЗ\n")
		prompt.WriteString("- Сауалнама жауаптарын жай ғана қайталамаңыз - ТАЛДАҢЫЗ, ТҮСІНДІРІҢІЗ және деректердің не дегенін ТҮСІНДІРІҢІЗ\n")
		prompt.WriteString("- Науқастың жағдайын ТҮСІНУГЕ көмектесіңіз - не болып жатқанын, неге болуы мүмкін екенін ТҮСІНДІРІҢІЗ\n")
		prompt.WriteString("- Қай мамандарға жазылу керектігін және НЕГЕ ұсыныңыз (терапевт, невролог, гастроэнтеролог және т.б.)\n")
		prompt.WriteString("- ҚЫСҚА, бірақ АҚПАРАТТЫ болыңыз - бөлімге максимум 1-2 сөйлем\n")
		prompt.WriteString("- Науқастың түсінуіне көмектесетін анық, түсінікті тілде жазыңыз\n\n")
	} else {
		prompt.WriteString("Вы опытный врач, создающий КАЧЕСТВЕННОЕ аналитическое заключение для ПРЕДВАРИТЕЛЬНОГО ЗАКЛЮЧЕНИЯ пациента.\n\n")
		prompt.WriteString("**КРИТИЧЕСКИ ВАЖНО:**\n")
		prompt.WriteString("- Это ПРЕДВАРИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ - вы НЕ ставите диагноз, вы АНАЛИЗИРУЕТЕ и ОБЪЯСНЯЕТЕ состояние пациента\n")
		prompt.WriteString("- НЕ просто переписывайте ответы анкеты - АНАЛИЗИРУЙТЕ, ИНТЕРПРЕТИРУЙТЕ и ОБЪЯСНЯЙТЕ что означают данные\n")
		prompt.WriteString("- Помогите пациенту ПОНЯТЬ его состояние - объясните ЧТО происходит, ПОЧЕМУ это может происходить\n")
		prompt.WriteString("- Рекомендуйте К КАКИМ специалистам записаться и ПОЧЕМУ (терапевт, невролог, гастроэнтеролог и т.д.)\n")
		prompt.WriteString("- Будьте КОМПАКТНЫМ, но ИНФОРМАТИВНЫМ - максимум 1-2 предложения на раздел\n")
		prompt.WriteString("- Пишите понятным языком, который помогает пациенту понять ситуацию\n\n")
	}

	if len(answers) > 0 {
		prompt.WriteString("## ОТВЕТЫ НА АНКЕТУ\n")
		for question, answer := range answers {
			if strings.TrimSpace(answer) != "" {
				prompt.WriteString(fmt.Sprintf("- %s: %s\n", question, answer))
			}
		}
		prompt.WriteString("\n")
	}

	low := strings.ToLower(fileAnalysis)
	if strings.TrimSpace(fileAnalysis) != "" &&
		!strings.Contains(low, "не найден") &&
		!strings.Contains(low, "not found") &&
		!strings.Contains(low, "табылмады") {
		if lang == "en" {
			prompt.WriteString("## FILE ANALYSIS RESULTS\n")
		} else if lang == "kz" {
			prompt.WriteString("## ФАЙЛДАРДЫ ТАЛДАУ НӘТИЖЕЛЕРІ\n")
		} else {
			prompt.WriteString("## РЕЗУЛЬТАТЫ АНАЛИЗА ФАЙЛОВ\n")
		}
		prompt.WriteString(fileAnalysis + "\n\n")
	}

	if lang == "en" {
		prompt.WriteString("## CONCLUSION FORMAT (STRICT)\n")
		prompt.WriteString("Keep it EXTREMELY CONCISE, no filler, and NO DUPLICATES between sections. Use short, factual sentences. Maximum 1-2 sentences per section.\n\n")
		prompt.WriteString("1) CURRENT CONDITION:\n- ANALYZE and EXPLAIN what is happening with the patient based on all data. Help patient understand their condition. 2-3 sentences.\n\n")
		prompt.WriteString("2) WHO TO BOOK:\n- Recommend specific specialists (therapist, neurologist, gastroenterologist, etc.) with brief justification (1 sentence per specialist).\n- If only therapist needed — specify only therapist.\n- If no specialists needed — write 'No specialist appointments required'.\n\n")
		prompt.WriteString("3) RECOMMENDED:\n- Up to 3-4 specific, actionable recommendations (tests, consults, next steps). No generic advice. Each recommendation — 1 sentence.\n\n")
		prompt.WriteString("**CRITICAL:** DO NOT make a diagnosis. This is a PRELIMINARY CONCLUSION - analyze, explain, and guide the patient. DO NOT simply rewrite questionnaire answers.\n")
		prompt.WriteString("Rules: avoid repeating the same information; merge overlapping items; do not restate questionnaire/files verbatim; be precise and brief.\n")
	} else if lang == "kz" {
		prompt.WriteString("## ҚОРЫТЫНДЫ ҚҰРЫЛЫМЫ (ҚАТАҢ)\n")
		prompt.WriteString("ӨТЕ ҚЫСҚА жазыңыз, артық сөзсіз, бөлімдер арасында ҚАЙТАЛАУ БОЛМАСЫН. Фактілерді ғана қолданыңыз. Бөлімге максимум 1-2 сөйлем.\n\n")
		prompt.WriteString("1) ҚАЗІРГІ ЖАҒДАЙ:\n- Барлық деректер негізінде науқаспен не болып жатқанын ТАЛДАҢЫЗ және ТҮСІНДІРІҢІЗ. Науқастың жағдайын түсінуге көмектесіңіз. 2-3 сөйлем.\n\n")
		prompt.WriteString("2) КІМГЕ ЖАЗЫЛУ КЕРЕК:\n- Нақты мамандарды ұсыныңыз (терапевт, невролог, гастроэнтеролог және т.б.) қысқа негіздемемен (әр маманға 1 сөйлем).\n- Егер тек терапевт қажет болса — тек терапевтті көрсетіңіз.\n- Егер мамандар қажет емес болса — 'Мамандарға жазылу қажет емес' деп жазыңыз.\n\n")
		prompt.WriteString("3) ҰСЫНЫЛАДЫ:\n- 3-4-тен аспайтын нақтылы қадамдар (талдаулар, кеңестер, келесі әрекеттер). Жалпы сөздерсіз. Әр ұсыныс — 1 сөйлем.\n\n")
		prompt.WriteString("**КРИТИКАЛЫҚ:** Диагноз ҚОЙМАҢЫЗ. Бұл АЛДЫН АЛА ҚОРЫТЫНДЫ - талдаңыз, түсіндіріңіз және науқасты бағыттаңыз. Сауалнама жауаптарын жай ғана қайталамаңыз.\n")
		prompt.WriteString("Ережелер: ақпаратты қайталамаңыз; қабаттасатын тармақтарды біріктіріңіз; сауалнама/файл мәтіндерін сөзбе-сөз қайталамаңыз; нақты және қысқа болыңыз.\n")
	} else {
		prompt.WriteString("## ФОРМАТ ОБЩЕГО ЗАКЛЮЧЕНИЯ (СТРОГО)\n")
		prompt.WriteString("КРАТКО, без воды и БЕЗ ДУБЛИКАТОВ между разделами. Используйте короткие фактические формулировки. Максимум 1-2 предложения на раздел.\n\n")
		prompt.WriteString("1) ТЕКУЩЕЕ СОСТОЯНИЕ:\n- ПРОАНАЛИЗИРУЙТЕ и ОБЪЯСНИТЕ что происходит с пациентом на основе всех данных. Помогите пациенту понять его состояние. 2-3 предложения.\n\n")
		prompt.WriteString("2) КОМУ ЗАПИСАТЬСЯ:\n- Рекомендуйте конкретных специалистов (терапевт, невролог, гастроэнтеролог и т.д.) с кратким обоснованием (1 предложение на каждого специалиста).\n- Если нужен только терапевт — укажите только терапевта.\n- Если специалисты не требуются — напишите 'Запись к специалистам не требуется'.\n\n")
		prompt.WriteString("3) РЕКОМЕНДОВАНО:\n- До 3-4 конкретных, выполнимых рекомендаций (анализы, консультации, следующие шаги). Без общих фраз. Каждая рекомендация — 1 предложение.\n\n")
		prompt.WriteString("**КРИТИЧЕСКИ ВАЖНО:** НЕ ставьте диагноз. Это ПРЕДВАРИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ - анализируйте, объясняйте и направляйте пациента. НЕ просто переписывайте ответы анкеты.\n")
		prompt.WriteString("Правила: не повторяйте одну и ту же информацию; объединяйте пересекающиеся пункты; не переписывайте анкету/файлы дословно; формулируйте точно и кратко.\n")
	}

	return prompt.String()
}

// Legacy Markdown-подсказка (оставлена для совместимости)
func (c *ContentGenerator) buildDoctorConclusionPrompt(profile *client.PatientProfile, answers map[string]string, complaints string, fileAnalysis string, lang string) string {
	var b strings.Builder

	if lang == "en" {
		b.WriteString("You are a senior physician. Create a structured medical conclusion for the patient's Health Passport.\n\n")
		b.WriteString("IMPORTANT: You have access to ALL patient data: complaints, questionnaire responses, and medical file analysis. Use ALL of this information when formulating the diagnosis, treatment plans, and recommendations.\n\n")
	} else if lang == "kz" {
		b.WriteString("Сіз аға дәрігерсіз. Денсаулық паспорты үшін құрылымдалған медициналық қорытынды жасаңыз.\n\n")
		b.WriteString("МАҢЫЗДЫ: Сізде науқастың БАРЛЫҚ деректері бар: шағымдар, сауалнама жауаптары және медициналық құжат талдауы. Диагноз, ем жоспары және ұсыныстарды қалыптастыру кезінде БАРЛЫҚ осы ақпаратты пайдаланыңыз.\n\n")
	} else {
		b.WriteString("Вы старший врач. Сформируйте структурированное медицинское заключение для паспорта здоровья.\n\n")
		b.WriteString("ВАЖНО: У вас есть доступ ко ВСЕМ данным пациента: жалобы, ответы на анкету и анализ медицинских файлов. Используйте ВСЮ эту информацию при формулировке диагноза, планов лечения и рекомендаций.\n\n")
	}

	// Жалобы пациента
	if strings.TrimSpace(complaints) != "" {
		if lang == "en" {
			b.WriteString("## PATIENT COMPLAINTS\n")
		} else if lang == "kz" {
			b.WriteString("## ПАЦИЕНТ ШАҒЫМДАРЫ\n")
		} else {
			b.WriteString("## ЖАЛОБЫ ПАЦИЕНТА\n")
		}
		b.WriteString(complaints + "\n\n")
	}

	// Анкета
	if len(answers) > 0 {
		if lang == "en" {
			b.WriteString("## QUESTIONNAIRE RESPONSES\n")
		} else if lang == "kz" {
			b.WriteString("## САУАЛНАМА ЖАУАПТАРЫ\n")
		} else {
			b.WriteString("## ОТВЕТЫ НА АНКЕТУ\n")
		}
		for k, v := range answers {
			if strings.TrimSpace(v) != "" {
				b.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
			}
		}
		b.WriteString("\n")
	}

	// Анализ файлов
	low := strings.ToLower(fileAnalysis)
	if strings.TrimSpace(fileAnalysis) != "" &&
		!strings.Contains(low, "не найдено") &&
		!strings.Contains(low, "not found") {
		if lang == "en" {
			b.WriteString("## RESULTS OF MEDICAL DOCUMENT ANALYSIS\n")
		} else if lang == "kz" {
			b.WriteString("## МЕДИЦИНАЛЫҚ ҚҰЖАТТАРДЫ ТАЛДАУ НӘТИЖЕЛЕРІ\n")
		} else {
			b.WriteString("## РЕЗУЛЬТАТЫ АНАЛИЗА МЕДИЦИНСКИХ ДОКУМЕНТОВ\n")
		}
		b.WriteString(fileAnalysis + "\n\n")
	}

	if lang == "en" {
		b.WriteString("## OUTPUT (STRICT)\n")
		b.WriteString("Write the following sections as Markdown, concise, no duplicates:\n\n")
		b.WriteString("### Текущее состояние\n")
		b.WriteString(c.buildCurrentStatePromptInstruction(lang))
		b.WriteString("### ОБЪЕКТИВНЫЙ СТАТУС\n")
		b.WriteString(c.buildObjectiveStatusPromptInstruction(lang))
		b.WriteString("### Диагноз\nВАЖНО: Всегда включайте ОБА пункта - Основной и Сопутствующие диагнозы.\n- **Основной:** [один основной диагноз, одна строка. ОБЯЗАТЕЛЬНО учитывайте жалобы пациента, данные анкеты и результаты анализа файлов. НЕ упоминайте названия файлов, просто пишите медицинские факты]\n- **Сопутствующие:** [список сопутствующих диагнозов, каждый на новой строке с дефисом, или 'отсутствуют' если их нет. Также учитывайте жалобы, анкету и файлы. НЕ упоминайте названия файлов]\n\n")
		b.WriteString("### План обследования\n- ...\n\n### План лечения\n- ...\n\n### Общие рекомендации\n- ...\n")
	} else if lang == "kz" {
		b.WriteString("## ШЫҒАРЫЛЫМ (ҚАТАҢ)\n")
		b.WriteString("Төмендегі бөлімдерді Markdown түрінде жазыңыз, қысқа және қайталанусыз:\n\n")
		b.WriteString("### Текущее состояние\n")
		b.WriteString(c.buildCurrentStatePromptInstruction(lang))
		b.WriteString("### ОБЪЕКТИВНЫЙ СТАТУС\n")
		b.WriteString(c.buildObjectiveStatusPromptInstruction(lang))
		b.WriteString("### Диагноз\nВАЖНО: Всегда включайте ОБА пункта - Основной и Сопутствующие диагнозы.\n- **Основной:** [один основной диагноз, одна строка. ОБЯЗАТЕЛЬНО учитывайте жалобы пациента, данные анкеты и результаты анализа файлов. НЕ упоминайте названия файлов, просто пишите медицинские факты]\n- **Сопутствующие:** [список сопутствующих диагнозов, каждый на новой строке с дефисом, или 'отсутствуют' если их нет. Также учитывайте жалобы, анкету и файлы. НЕ упоминайте названия файлов]\n\n")
		b.WriteString("### План обследования\n- ...\n\n### План лечения\n- ...\n\n### Общие рекомендации\n- ...\n")
	} else {
		b.WriteString("## ФОРМАТ (СТРОГО)\n")
		b.WriteString("Ниже перечисленные разделы — Markdown, кратко, без дублирования:\n\n")
		b.WriteString("### Текущее состояние\n")
		b.WriteString(c.buildCurrentStatePromptInstruction(lang))
		b.WriteString("### ОБЪЕКТИВНЫЙ СТАТУС\n")
		b.WriteString(c.buildObjectiveStatusPromptInstruction(lang))
		b.WriteString("### Диагноз\nВАЖНО: Всегда включайте ОБА пункта - Основной и Сопутствующие диагнозы.\n- **Основной:** [один основной диагноз, одна строка. ОБЯЗАТЕЛЬНО учитывайте жалобы пациента, данные анкеты и результаты анализа файлов. НЕ упоминайте названия файлов, просто пишите медицинские факты]\n- **Сопутствующие:** [список сопутствующих диагнозов, каждый на новой строке с дефисом, или 'отсутствуют' если их нет. Также учитывайте жалобы, анкету и файлы. НЕ упоминайте названия файлов]\n\n")
		b.WriteString("### План обследования\n- ...\n\n### План лечения\n- ...\n\n### Общие рекомендации\n- ...\n")
	}
	return b.String()
}

// buildObjectiveStatusPromptInstruction создает инструкцию для объективного статуса в новом формате
func (c *ContentGenerator) buildObjectiveStatusPromptInstruction(lang string) string {
	var b strings.Builder

	if lang == "en" {
		b.WriteString("You are a clinician with 40 years of experience. Form the 'Objective Status' section based on patient data.\n\n")
		b.WriteString("CRITICALLY IMPORTANT:\n")
		b.WriteString("- The 'Current State' section is formed separately, DO NOT include it in the objective status.\n")
		b.WriteString("- DO NOT repeat patient complaints in the objective status. Complaints are already described in a separate 'Complaints' section.\n")
		b.WriteString("- Objective status contains ONLY examination results: condition of skin, organs and systems, physical examination data.\n")
		b.WriteString("- DO NOT write 'Patient complains of...' or similar phrases. Start directly with description of organs and systems condition.\n\n")
		b.WriteString("GENERAL RULES:\n")
		b.WriteString("- Do NOT use numbering in the response.\n")
		b.WriteString("- Each item starts only with the item name (e.g., 'Current state: …').\n")
		b.WriteString("- Order of items strictly as below (1–16), but WITHOUT numbers in the response.\n")
		b.WriteString("- CRITICAL: Objective status contains ONLY physical examination data (inspection, palpation, percussion, auscultation). DO NOT include data from instrumental examinations (InBody, ECG, blood tests, X-rays, etc.) in objective status. Instrumental examination data should be used ONLY in diagnosis and treatment plan sections, NOT in objective status.\n\n")
		b.WriteString("- If there is no data for an item → write 'Без особенностей.'\n")
		b.WriteString("- Where listing characteristics, use single line format with ; separator.\n")
		b.WriteString("- Do not use words: normal, in norm, normal.\n")
		b.WriteString("- Style: brief, medical, without unnecessary details.\n\n")
		b.WriteString("STRUCTURE (numbered FOR YOU, but without numbering in response):\n\n")
		b.WriteString("❗ CRITICALLY IMPORTANT:\n")
		b.WriteString("- DO NOT repeat patient complaints. Complaints are already described in a separate 'Complaints' section.\n")
		b.WriteString("- DO NOT write about pain, pain intensification, patient sensations, or complaints. This is NOT objective status!\n")
		b.WriteString("- Objective status starts with 'Общее самочувствие' - describe ONLY objective condition at the time of examination (general condition, body temperature, signs of acute pathologies). DO NOT write about pain, sensations, or complaints!\n")
		b.WriteString("- If there is no objective state in input data, determine what to write based on examination data and files, but DO NOT include complaints!\n")
		b.WriteString("- CRITICAL: Objective status contains ONLY physical examination data. DO NOT include data from instrumental examinations (InBody, ECG, blood tests, X-rays, ultrasound, etc.) in objective status. These data should be used ONLY in diagnosis and treatment plan sections, NOT in objective status.\n\n")
		b.WriteString("1. Общее самочувствие (CRITICALLY IMPORTANT - ONLY general objective condition at the time of doctor's examination: general condition (satisfactory/moderate/severe), signs of acute systemic pathologies, functions of other organs and systems. DO NOT write: patient complaints ('Patient presents...'), specific findings by organs (joint enlargement, temperature - these go in items 11, 16), instrumental examination data (body mass, visceral fat - these are from InBody). CORRECT example: 'Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.' INCORRECT example: 'Patient presents movement limitations...' or 'There is excess body mass...' - this is NOT for this item!)\n")
		b.WriteString("2. Кожные покровы и ногти\n")
		b.WriteString("3. Язык\n")
		b.WriteString("4. Зев, нос и уши\n")
		b.WriteString("5. Региональные лимфатические узлы\n")
		b.WriteString("6. Щитовидная железа\n")
		b.WriteString("7. Грудная клетка — ОБЯЗАТЕЛЬНО одна строка через ; со ВСЕМИ подпунктами: тип грудной клетки; деформация грудной клетки; симметричность; экскурсия; тип дыхания; ритм дыхания; голосовое дрожание; нижние границы лёгких; при перкуссии лёгких; при аускультации дыхание; хрипы. Если данных нет - пиши 'не изменено', 'сохранено', 'нет' для каждого подпункта\n")
		b.WriteString("8. Область сердца — ОБЯЗАТЕЛЬНО одна строка через ; со ВСЕМИ подпунктами: область сердца; верхушечный толчок; границы относительной тупости сердца; границы абсолютной тупости сердца; ширина сосудистого пучка; тоны сердца; шумы сердца; пульс на обеих руках. Если данных нет - пиши 'не изменено', 'сохранено', 'нет' для каждого подпункта\n")
		b.WriteString("9. Обследование живота — ОБЯЗАТЕЛЬНО одной строкой через ; со ВСЕМИ подпунктами: живот; печень; селезенка. Если данных нет - пиши 'не изменено', 'сохранено', 'нет' для каждого подпункта\n")
		b.WriteString("10. Симптом поколачивания\n")
		b.WriteString("11. Опорно-двигательный аппарат\n")
		b.WriteString("12. Неврологический статус\n")
		b.WriteString("13. Отеки\n")
		b.WriteString("14. Стул\n")
		b.WriteString("15. Диурез\n")
		b.WriteString("16. Status localis\n\n")
		b.WriteString("RESPONSE FORMAT (MANDATORY!):\n")
		b.WriteString("No numbers. Only item names + text. Each item starts with header and colon. Items follow one after another in order 1–16, each item on a new line.\n\n")
		b.WriteString("❗ FORMAT SPECIFICS:\n")
		b.WriteString("- Items 1-6, 10-16: each item on a separate line, format 'Name: value'\n")
		b.WriteString("- Items 7, 8, 9 (Грудная клетка, Область сердца, Обследование живота): ALL sub-items through ; in one line, format 'Name: subitem1; subitem2; subitem3...'\n\n")
		b.WriteString("EXAMPLE FORMAT:\n")
		b.WriteString("Общее самочувствие: Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.\n\n")
		b.WriteString("WRONG EXAMPLE (DO NOT DO THIS!):\n")
		b.WriteString("Общее самочувствие: Пациент предъявляет выраженные ограничения движений в правом коленном суставе, увеличение его объема и локальное повышение температуры... (WRONG! These are complaints and specific findings - they should be in items 11 'Опорно-двигательный аппарат' and 16 'Status localis')\n\n")
		b.WriteString("Общее самочувствие: Пациент ощущает боль в суставе, усиливающуюся при нагрузке... (WRONG! This is complaints, not objective status!)\n\n")
		b.WriteString("Общее самочувствие: Имеется избыточная масса тела и повышенное содержание висцерального жира... (WRONG! This is data from instrumental examination InBody, DO NOT include in objective status!)\n\n")
		b.WriteString("Кожные покровы и ногти: Без особенностей\n\n")
		b.WriteString("Язык: Без особенностей\n\n")
		b.WriteString("Зев, нос и уши: Без особенностей\n\n")
		b.WriteString("Региональные лимфатические узлы: Без особенностей\n\n")
		b.WriteString("Щитовидная железа: Без особенностей\n\n")
		b.WriteString("Грудная клетка: нормостеническая; деформация грудной клетки: нет; симметричность: симметричная; экскурсия: сохранена; тип дыхания: брюшной; ритм дыхания: ритмичное; голосовое дрожание: симметричное; нижние границы лёгких: не изменены; при перкуссии лёгких: ясный легочный звук; при аускультации дыхание: везикулярное; хрипы: нет\n\n")
		b.WriteString("Область сердца: визуально не изменена; верхушечный толчок: не смещен; границы относительной тупости сердца: не изменены; границы абсолютной тупости сердца: не изменены; ширина сосудистого пучка: не изменена; тоны сердца: сохранены; шумы сердца: нет; пульс на обеих руках: ритмичный\n\n")
		b.WriteString("Обследование живота: живот мягкий; печень: не увеличена; селезенка: не увеличена\n\n")
		b.WriteString("Симптом поколачивания: Без особенностей\n\n")
		b.WriteString("Опорно-двигательный аппарат: увеличение объема правого коленного сустава, локальное повышение температуры, ограничение разгибания и сгибания, хромота\n\n")
		b.WriteString("Неврологический статус: Без особенностей\n\n")
		b.WriteString("Отеки: Без особенностей\n\n")
		b.WriteString("Стул: Без особенностей\n\n")
		b.WriteString("Диурез: Без особенностей\n\n")
		b.WriteString("Status localis: правый коленный сустав увеличен в объеме, горячий на ощупь, ограничение движений\n\n")
	} else if lang == "kz" {
		b.WriteString("Сіз 40 жылдық тәжірибесі бар клиницистсіз. Науқас деректері негізінде 'Объективтік статус' бөлімін құрыңыз.\n\n")
		b.WriteString("КРИТИКАЛЫҚ МАҢЫЗДЫ:\n")
		b.WriteString("- 'Текущее состояние' бөлімі бөлек қалыптастырылады, оны объективтік статусқа ҚОСПАҢЫЗ.\n")
		b.WriteString("- Объективтік статуста науқастың шағымдарын ҚАЙТАЛАМАҢЫЗ. Шағымдар бөлек 'Шағымдар' бөлімінде сипатталған.\n")
		b.WriteString("- Объективтік статус ТЕК зерттеу нәтижелерін қамтиды: тері, мүшелер мен жүйелердің жағдайы, физикалық зерттеу деректері.\n")
		b.WriteString("- 'Науқас шағымданады...' немесе осындай фразаларды ЖАЗБАҢЫЗ. Мүшелер мен жүйелердің жағдайын сипаттаудан тікелей бастаңыз.\n\n")
		b.WriteString("ЖАЛПЫ ЕРЕЖЕЛЕР:\n")
		b.WriteString("- Жауапта нумерацияны ҚОЛДАНБАҢЫЗ.\n")
		b.WriteString("- Әр пункт тек пункт атауынан басталады (мысалы: 'Текущее состояние: …').\n")
		b.WriteString("- Пункттар реті төмендегідей (1–16), бірақ жауапта — САНСЫЗ.\n")
		b.WriteString("- КРИТИКАЛЫҚ: Объективтік статус ТЕК физикалық зерттеу деректерін қамтиды (көзбен тексеру, пальпация, перкуссия, аускультация). Объективтік статусқа инструменталды зерттеу деректерін (InBody, ЭКГ, қан талдаулары, рентген, УЗИ және т.б.) ҚОСПАҢЫЗ. Инструменталды зерттеу деректері ТЕК диагноз және ем жоспары бөлімдерінде пайдаланылуы керек, объективтік статуста ЕМЕС.\n\n")
		b.WriteString("- Пункт бойынша деректер жоқ болса → 'Без особенностей.' деп жазыңыз.\n")
		b.WriteString("- Сипаттамаларды тізбектегенде, ; бөлгішімен бір жол форматын қолданыңыз.\n")
		b.WriteString("- Мына сөздерді қолданбаңыз: норма, нормада, қалыпты.\n")
		b.WriteString("- Стиль: қысқа, медициналық, артық мәліметтерсіз.\n\n")
		b.WriteString("ҚҰРЫЛЫМ (СІЗГЕ арналған нумерация, бірақ жауапта — нумерациясыз):\n\n")
		b.WriteString("❗ КРИТИКАЛЫҚ МАҢЫЗДЫ:\n")
		b.WriteString("- Науқастың шағымдарын ҚАЙТАЛАМАҢЫЗ. Шағымдар бөлек «Шағымдар» бөлімінде сипатталған.\n")
		b.WriteString("- Ауру, аурудың күшеюі, науқастың сезімдері, шағымдар туралы ЖАЗБАҢЫЗ. Бұл объективтік статус ЕМЕС!\n")
		b.WriteString("- Объективтік статус «Общее самочувствие»-ден басталады - ТЕК зерттеу сәтіндегі объективтік жағдайды сипаттаңыз (жалпы жағдай, дене температурасы, жедел патологиялардың белгілері). Ауру, сезімдер, шағымдар туралы ЖАЗБАҢЫЗ!\n")
		b.WriteString("- Егер кіріс деректерінде объективтік жағдай жоқ болса, зерттеу деректері мен файлдар негізінде не жазу керектігін өзіңіз анықтаңыз, бірақ шағымдарды ҚОСПАҢЫЗ!\n")
		b.WriteString("- КРИТИКАЛЫҚ: Объективтік статус ТЕК физикалық зерттеу деректерін қамтиды. Объективтік статусқа инструменталды зерттеу деректерін (InBody, ЭКГ, қан талдаулары, рентген, УЗИ және т.б.) ҚОСПАҢЫЗ. Бұл деректер ТЕК диагноз және ем жоспары бөлімдерінде пайдаланылуы керек, объективтік статуста ЕМЕС.\n\n")
		b.WriteString("1. Общее самочувствие (КРИТИКАЛЫҚ МАҢЫЗДЫ - ТЕК дәрігердің зерттеу сәтіндегі жалпы объективтік жағдайы: жалпы жағдай (қанағаттанарлық/орташа ауыр/ауыр), жедел жүйелік патологиялардың белгілері, басқа мүшелер мен жүйелердің функциялары. ЖАЗБАҢЫЗ: науқастың шағымдары («Науқас шағымданады...»), мүшелер бойынша нақты табыстар (буынның көлемінің ұлғаюы, температура - бұл 11, 16 пункттарда), инструменталды зерттеу деректері (дене салмағы, висцералды май - бұл InBody-дан). ДҮРЫС мысал: «Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.» ДҮРЫС ЕМЕС мысал: «Науқас қозғалыс шектеулерін шағымданады...» немесе «Артық дене салмағы бар...» - бұл БУЛ ПУНКТ ҮШІН ЕМЕС!)\n")
		b.WriteString("2. Кожные покровы и ногти\n")
		b.WriteString("3. Язык\n")
		b.WriteString("4. Зев, нос и уши\n")
		b.WriteString("5. Региональные лимфатические узлы\n")
		b.WriteString("6. Щитовидная железа\n")
		b.WriteString("7. Грудная клетка — МИНДЕТТЕМЕ бір жол ; арқылы БАРЛЫҚ ішкі пункттермен: тип грудной клетки; деформация грудной клетки; симметричность; экскурсия; тип дыхания; ритм дыхания; голосовое дрожание; нижние границы лёгких; при перкуссии лёгких; при аускультации дыхание; хрипы. Деректер жоқ болса - әр ішкі пункт үшін 'өзгерген жоқ', 'сақталған', 'жоқ' деп жаз\n")
		b.WriteString("8. Область сердца — МИНДЕТТЕМЕ бір жол ; арқылы БАРЛЫҚ ішкі пункттермен: область сердца; верхушечный толчок; границы относительной тупости сердца; границы абсолютной тупости сердца; ширина сосудистого пучка; тоны сердца; шумы сердца; пульс на обеих руках. Деректер жоқ болса - әр ішкі пункт үшін 'өзгерген жоқ', 'сақталған', 'жоқ' деп жаз\n")
		b.WriteString("9. Обследование живота — МИНДЕТТЕМЕ бір жол ; арқылы БАРЛЫҚ ішкі пункттермен: живот; печень; селезенка. Деректер жоқ болса - әр ішкі пункт үшін 'өзгерген жоқ', 'сақталған', 'жоқ' деп жаз\n")
		b.WriteString("10. Симптом поколачивания\n")
		b.WriteString("11. Опорно-двигательный аппарат\n")
		b.WriteString("12. Неврологический статус\n")
		b.WriteString("13. Отеки\n")
		b.WriteString("14. Стул\n")
		b.WriteString("15. Диурез\n")
		b.WriteString("16. Status localis\n\n")
		b.WriteString("ЖАУАП ФОРМАТЫ (Міндетті!):\n")
		b.WriteString("Сан жоқ. Тек пункт атаулары + мәтін. Әр пункт тақырып пен қос нүктеден басталады. Пункттар 1–16 ретімен бірінен соң бірі орналасады, әр пункт жаңа жолда.\n\n")
		b.WriteString("❗ ФОРМАТ ЕРЕКШЕЛІКТЕРІ:\n")
		b.WriteString("- 1-6, 10-16 пункттар: әр пункт бөлек жолда, формат 'Атауы: мәні'\n")
		b.WriteString("- 7, 8, 9 пункттар (Грудная клетка, Область сердца, Обследование живота): БАРЛЫҚ ішкі пункттер ; арқылы бір жолда, формат 'Атауы: ішкіпункт1; ішкіпункт2; ішкіпункт3...'\n\n")
	} else {
		b.WriteString("Ты — врач-клиницист с 40-летним опытом.\n\n")
		b.WriteString("По входным данным пациента сформируй раздел «Объективный статус».\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО:\n")
		b.WriteString("- Раздел «Текущее состояние» формируется отдельно, НЕ включай его в объективный статус.\n")
		b.WriteString("- НЕ повторяй жалобы пациента в объективном статусе. Жалобы уже описаны в отдельном разделе «Жалобы».\n")
		b.WriteString("- Объективный статус содержит ТОЛЬКО результаты осмотра: состояние кожных покровов, органов и систем, данные физикального обследования.\n")
		b.WriteString("- НЕ пиши «Пациент жалуется на...» или подобные фразы. Начинай сразу с описания состояния органов и систем.\n\n")
		b.WriteString("Общие правила\n\n")
		b.WriteString("В ответе НЕЛЬЗЯ использовать нумерацию.\n\n")
		b.WriteString("Каждый пункт начинается только с названия пункта (например: «Кожные покровы и ногти: …»).\n\n")
		b.WriteString("Порядок пунктов строго как ниже (1–16), но в ответе — БЕЗ цифр.\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО: Объективный статус содержит ТОЛЬКО данные физикального осмотра (осмотр, пальпация, перкуссия, аускультация). НЕ включай в объективный статус данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген, УЗИ и т.д.). Данные инструментальных обследований должны использоваться ТОЛЬКО в разделах диагноза и плана лечения, НЕ в объективном статусе.\n\n")
		b.WriteString("Если данных по пункту нет → пиши «Без особенностей» (БЕЗ точки в конце).\n\n")
		b.WriteString("Для пунктов 7, 8, 9: подпункты (которые не имеют нумерации) должны писаться через ; в одну строку после заголовка, а не как отдельные заголовки.\n\n")
		b.WriteString("НЕ используй слова: норма, в норме, нормальный, норме. Вместо этого используй: без особенностей, сохранено, не изменено, не выявлено и т.д.\n\n")
		b.WriteString("Стиль: кратко, медицински, без лишних подробностей.\n\n")
		b.WriteString("СТРУКТУРА (с нумерацией ДЛЯ ТЕБЯ, но без нумерации в ответе)\n\n")
		b.WriteString("❗ КРИТИЧЕСКИ ВАЖНО:\n")
		b.WriteString("- НЕ повторяй жалобы пациента. Жалобы уже описаны в отдельном разделе «Жалобы».\n")
		b.WriteString("- НЕ пиши про боль, усиление боли, ощущения пациента, жалобы на что-либо. Это НЕ объективный статус!\n")
		b.WriteString("- Объективный статус начинается с «Общее самочувствие» - опиши ТОЛЬКО объективное состояние на момент осмотра (общее состояние, температура тела, признаки острых патологий). НЕ пиши про боль, ощущения, жалобы!\n")
		b.WriteString("- Если в входных данных нет объективного состояния, то на основе данных осмотра и файлов сам определи что писать, но НЕ включай жалобы!\n")
		b.WriteString("- КРИТИЧЕСКИ ВАЖНО: Объективный статус содержит ТОЛЬКО данные физикального осмотра. НЕ включай в объективный статус данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген, УЗИ и т.д.). Эти данные должны использоваться ТОЛЬКО в разделах диагноза и плана лечения, НЕ в объективном статусе.\n\n")
		b.WriteString("1. Общее самочувствие: (КРИТИЧЕСКИ ВАЖНО - ТОЛЬКО общее объективное состояние на момент осмотра врача: общее состояние (удовлетворительное/средней тяжести/тяжелое), признаки острых системных патологий, функции других органов и систем. НЕ пиши: жалобы пациента («Пациент предъявляет...»), конкретные находки по органам (увеличение сустава, температура - это в пунктах 11, 16), данные инструментальных обследований (масса тела, висцеральный жир - это из InBody). Пример ПРАВИЛЬНО: «Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.» Пример НЕПРАВИЛЬНО: «Пациент предъявляет ограничения движений...» или «Имеется избыточная масса тела...» - это НЕ для этого пункта!)\n\n")
		b.WriteString("2. Кожные покровы и ногти: (если данных нет - Без особенностей)\n\n")
		b.WriteString("3. Язык: (если данных нет - Без особенностей)\n\n")
		b.WriteString("4. Зев, нос и уши: (если данных нет - Без особенностей)\n\n")
		b.WriteString("5. Региональные лимфатические узлы: (если данных нет - Без особенностей)\n\n")
		b.WriteString("6. Щитовидная железа: (если данных нет - Без особенностей)\n\n")
		b.WriteString("7. Грудная клетка: (ОБЯЗАТЕЛЬНО все подпункты через ; в одну строку, НИКОГДА не пиши 'Без особенностей' для этого пункта!)\n")
		b.WriteString("   Подпункты (БЕЗ нумерации, через ;): тип грудной клетки; деформация грудной клетки; симметричность; экскурсия; тип дыхания; ритм дыхания; голосовое дрожание; нижние границы лёгких; при перкуссии лёгких; при аускультации дыхание; хрипы\n")
		b.WriteString("   Пример: Грудная клетка: нормостеническая; деформация грудной клетки: нет; симметричность: симметричная; экскурсия: сохранена; тип дыхания: брюшной; ритм дыхания: ритмичное; голосовое дрожание: симметричное; нижние границы лёгких: не изменены; при перкуссии лёгких: ясный легочный звук; при аускультации дыхание: везикулярное; хрипы: нет\n")
		b.WriteString("   Если данных нет - пиши: Грудная клетка: нормостеническая; деформация грудной клетки: нет; симметричность: симметричная; экскурсия: сохранена; тип дыхания: грудобрюшной; ритм дыхания: ритмичное; голосовое дрожание: симметричное; нижние границы лёгких: сохранены; при перкуссии лёгких: ясный легочный звук; при аускультации дыхание: везикулярное; хрипы: нет\n\n")
		b.WriteString("8. Область сердца: (ОБЯЗАТЕЛЬНО все подпункты через ; в одну строку, НИКОГДА не пиши 'Без особенностей' для этого пункта!)\n")
		b.WriteString("   Подпункты (БЕЗ нумерации, через ;): область сердца; верхушечный толчок; границы относительной тупости сердца; границы абсолютной тупости сердца; ширина сосудистого пучка; тоны сердца; шумы сердца; пульс на обеих руках\n")
		b.WriteString("   Пример: Область сердца: визуально не изменена; верхушечный толчок: не смещен; границы относительной тупости сердца: сохранены; границы абсолютной тупости сердца: сохранены; ширина сосудистого пучка: сохранена; тоны сердца: ясные; шумы сердца: не выявлено; пульс на обеих руках: ритмичный\n")
		b.WriteString("   Если данных нет - пиши: Область сердца: визуально не изменена; верхушечный толчок: не смещен; границы относительной тупости сердца: сохранены; границы абсолютной тупости сердца: сохранены; ширина сосудистого пучка: сохранена; тоны сердца: ясные; шумы сердца: не выявлено; пульс на обеих руках: ритмичный\n\n")
		b.WriteString("9. Обследование живота: (ОБЯЗАТЕЛЬНО все подпункты через ; в одну строку, НИКОГДА не пиши 'Без особенностей' для этого пункта!)\n")
		b.WriteString("   Подпункты (БЕЗ нумерации, через ;): живот; печень; селезенка\n")
		b.WriteString("   Пример: Обследование живота: живот мягкий; печень: не увеличена; селезенка: не увеличена\n")
		b.WriteString("   Если данных нет - пиши: Обследование живота: живот мягкий; печень: не увеличена; селезенка: не увеличена\n\n")
		b.WriteString("10. Симптом поколачивания: (если данных нет - Без особенностей)\n\n")
		b.WriteString("11. Опорно-двигательный аппарат: (если данных нет - Без особенностей)\n\n")
		b.WriteString("12. Неврологический статус: (если данных нет - Без особенностей)\n\n")
		b.WriteString("13. Отеки: (если данных нет - Без особенностей)\n\n")
		b.WriteString("14. Стул: (если данных нет - Без особенностей)\n\n")
		b.WriteString("15. Диурез: (если данных нет - Без особенностей)\n\n")
		b.WriteString("16. Status localis: (если данных нет - Без особенностей)\n\n")
		b.WriteString("ФОРМАТ ОТВЕТА (ОБЯЗАТЕЛЬНО!)\n\n")
		b.WriteString("Никаких цифр.\n\n")
		b.WriteString("Только названия пунктов + текст.\n\n")
		b.WriteString("Каждый пункт начинается с заголовка и двоеточия.\n\n")
		b.WriteString("Пункты идут друг за другом в порядке 1–16, каждый пункт на новой строке.\n\n")
		b.WriteString("❗ ОСОБЕННОСТИ ФОРМАТА:\n")
		b.WriteString("- Пункты 1-6, 10-16: каждый пункт на отдельной строке, формат 'Название: значение'\n")
		b.WriteString("- Пункты 7, 8, 9 (Грудная клетка, Область сердца, Обследование живота): ВСЕ подпункты через ; в одну строку, формат 'Название: подпункт1; подпункт2; подпункт3...'\n\n")
		b.WriteString("❗ ПРИМЕР ПРАВИЛЬНОГО ФОРМАТА ОТВЕТА (пример, не содержание):\n\n")
		b.WriteString("Общее самочувствие: Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.\n\n")
		b.WriteString("❗ НЕПРАВИЛЬНО (НЕ ДЕЛАЙ ТАК!):\n")
		b.WriteString("Общее самочувствие: Пациент предъявляет выраженные ограничения движений в правом коленном суставе, увеличение его объема и локальное повышение температуры... (НЕПРАВИЛЬНО! Это жалобы и конкретные находки - они должны быть в пунктах 11 «Опорно-двигательный аппарат» и 16 «Status localis»)\n\n")
		b.WriteString("Общее самочувствие: Пациент ощущает боль в суставе, усиливающуюся при нагрузке... (НЕПРАВИЛЬНО! Это жалобы, а не объективный статус!)\n\n")
		b.WriteString("Общее самочувствие: Имеется избыточная масса тела и повышенное содержание висцерального жира... (НЕПРАВИЛЬНО! Это данные инструментального обследования InBody, НЕ включай в объективный статус!)\n\n")
		b.WriteString("Кожные покровы и ногти: Без особенностей\n\n")
		b.WriteString("Язык: Без особенностей\n\n")
		b.WriteString("Зев, нос и уши: Без особенностей\n\n")
		b.WriteString("Региональные лимфатические узлы: Без особенностей\n\n")
		b.WriteString("Щитовидная железа: Без особенностей\n\n")
		b.WriteString("Грудная клетка: нормостеническая; деформация грудной клетки: нет; симметричность: симметричная; экскурсия: сохранена; тип дыхания: брюшной; ритм дыхания: ритмичное; голосовое дрожание: симметричное; нижние границы лёгких: не изменены; при перкуссии лёгких: ясный легочный звук; при аускультации дыхание: везикулярное; хрипы: нет\n\n")
		b.WriteString("Область сердца: визуально не изменена; верхушечный толчок: не смещен; границы относительной тупости сердца: не изменены; границы абсолютной тупости сердца: не изменены; ширина сосудистого пучка: не изменена; тоны сердца: сохранены; шумы сердца: нет; пульс на обеих руках: ритмичный\n\n")
		b.WriteString("Обследование живота: живот мягкий; печень: не увеличена; селезенка: не увеличена\n\n")
		b.WriteString("Симптом поколачивания: Без особенностей\n\n")
		b.WriteString("Опорно-двигательный аппарат: увеличение объема правого коленного сустава, локальное повышение температуры, ограничение разгибания и сгибания, хромота\n\n")
		b.WriteString("Неврологический статус: Без особенностей\n\n")
		b.WriteString("Отеки: Без особенностей\n\n")
		b.WriteString("Стул: Без особенностей\n\n")
		b.WriteString("Диурез: Без особенностей\n\n")
		b.WriteString("Status localis: правый коленный сустав увеличен в объеме, горячий на ощупь, ограничение движений\n\n")
	}

	return b.String()
}

// buildCurrentStatePromptInstruction создает инструкцию для раздела "Текущее состояние"
func (c *ContentGenerator) buildCurrentStatePromptInstruction(lang string) string {
	var b strings.Builder

	if lang == "en" {
		b.WriteString("You are an experienced physician. Form the 'Current State' section based on patient data.\n\n")
		b.WriteString("CRITICALLY IMPORTANT:\n")
		b.WriteString("- Write naturally, as a doctor would, not like a robot.\n")
		b.WriteString("- The text should flow naturally, describing the patient's condition in a professional but human way.\n")
		b.WriteString("- DO NOT use bullet points or lists - write in continuous text.\n")
		b.WriteString("- DO NOT repeat patient complaints verbatim - describe the current state based on examination.\n")
		b.WriteString("- DO NOT include data from instrumental examinations (InBody, ECG, blood tests, X-rays, etc.) - only physical examination findings.\n\n")
		b.WriteString("STRUCTURE (must be included naturally in the text, not as separate items):\n\n")
		b.WriteString("1. **State (Состояние)**: General condition of the patient (e.g., 'Общее состояние удовлетворительное', 'Общее состояние средней тяжести', 'Общее состояние тяжелое'). Describe the overall physical condition based on examination.\n\n")
		b.WriteString("2. **Consciousness (Сознание)**: Level of consciousness and contact (e.g., 'Сознание ясное', 'Сознание ясное, в контакт вступает', 'Сознание ясное, но пациент раздражителен, неохотно вступает в контакт', 'Сознание спутанное'). Describe how the patient interacts and their mental state.\n\n")
		b.WriteString("3. **Position (Положение)**: Patient's mobility and ability to move (e.g., 'Положение активное, пациент передвигается самостоятельно', 'Положение вынужденное', 'Положение удовлетворительное, передвижение без затруднений', 'Положение пассивное, передвижение затруднено'). Describe whether the patient can move independently, walk, and their general mobility.\n\n")
		b.WriteString("EXAMPLE FORMAT (write naturally, not as a list):\n")
		b.WriteString("Общее состояние удовлетворительное. Сознание ясное, пациент адекватно отвечает на вопросы, в контакт вступает. Положение активное, передвигается самостоятельно без затруднений.\n\n")
		b.WriteString("OR:\n")
		b.WriteString("Общее состояние средней тяжести. Сознание ясное, но пациент несколько раздражителен, на вопросы отвечает неохотно. Положение удовлетворительное, может передвигаться самостоятельно, но отмечает некоторую слабость.\n\n")
	} else if lang == "kz" {
		b.WriteString("Сіз тәжірибелі дәрігерсіз. Науқас деректері негізінде 'Текущее состояние' бөлімін құрыңыз.\n\n")
		b.WriteString("КРИТИКАЛЫҚ МАҢЫЗДЫ:\n")
		b.WriteString("- Табиғи түрде жазыңыз, дәрігер сияқты, робот сияқты емес.\n")
		b.WriteString("- Мәтін табиғи ағуы керек, науқастың жағдайын кәсіби, бірақ адамгершілікті түрде сипаттау керек.\n")
		b.WriteString("- Маркерлер немесе тізімдерді ҚОЛДАНБАҢЫЗ - үздіксіз мәтінде жазыңыз.\n")
		b.WriteString("- Науқастың шағымдарын дәлме-дәл ҚАЙТАЛАМАҢЫЗ - зерттеу негізінде ағымдағы жағдайды сипаттаңыз.\n")
		b.WriteString("- Инструменталды зерттеу деректерін (InBody, ЭКГ, қан талдаулары, рентген және т.б.) ҚОСПАҢЫЗ - тек физикалық зерттеу табыстары.\n\n")
		b.WriteString("ҚҰРЫЛЫМ (мәтінде табиғи түрде қосылуы керек, бөлек пункттар ретінде емес):\n\n")
		b.WriteString("1. **Состояние (Жағдай)**: Науқастың жалпы жағдайы (мысалы: 'Общее состояние удовлетворительное', 'Общее состояние средней тяжести', 'Общее состояние тяжелое'). Зерттеу негізінде жалпы физикалық жағдайды сипаттаңыз.\n\n")
		b.WriteString("2. **Сознание (Сана)**: Сана деңгейі және байланыс (мысалы: 'Сознание ясное', 'Сознание ясное, в контакт вступает', 'Сознание ясное, но пациент раздражителен, неохотно вступает в контакт', 'Сознание спутанное'). Науқастың қалай әрекет ететінін және оның психикалық жағдайын сипаттаңыз.\n\n")
		b.WriteString("3. **Положение (Орналасу)**: Науқастың қозғалғыштығы және қозғалу қабілеті (мысалы: 'Положение активное, пациент передвигается самостоятельно', 'Положение вынужденное', 'Положение удовлетворительное, передвижение без затруднений', 'Положение пассивное, передвижение затруднено'). Науқас тәуелсіз қозғалуға қабілетті ме, жүруге қабілетті ме және оның жалпы қозғалғыштығын сипаттаңыз.\n\n")
		b.WriteString("МЫСАЛ ФОРМАТЫ (табиғи түрде жазыңыз, тізім ретінде емес):\n")
		b.WriteString("Общее состояние удовлетворительное. Сознание ясное, пациент адекватно отвечает на вопросы, в контакт вступает. Положение активное, передвигается самостоятельно без затруднений.\n\n")
	} else {
		b.WriteString("Ты — опытный врач. Сформируй раздел «Текущее состояние» на основе данных пациента.\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО:\n")
		b.WriteString("- Пиши естественно, как пишет доктор, а не как робот.\n")
		b.WriteString("- Текст должен течь естественно, описывая состояние пациента профессионально, но по-человечески.\n")
		b.WriteString("- НЕ используй маркеры или списки — пиши сплошным текстом.\n")
		b.WriteString("- НЕ повторяй жалобы пациента дословно — описывай текущее состояние на основе осмотра.\n")
		b.WriteString("- НЕ включай данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген и т.д.) — только данные физикального осмотра.\n\n")
		b.WriteString("СТРУКТУРА (должна быть естественно включена в текст, не как отдельные пункты):\n\n")
		b.WriteString("1. **Состояние**: Общее состояние пациента (например: 'Общее состояние удовлетворительное', 'Общее состояние средней тяжести', 'Общее состояние тяжелое'). Опиши общее физическое состояние на основе осмотра.\n\n")
		b.WriteString("2. **Сознание**: Уровень сознания и контакта (например: 'Сознание ясное', 'Сознание ясное, в контакт вступает', 'Сознание ясное, но пациент раздражителен, неохотно вступает в контакт', 'Сознание спутанное'). Опиши, как пациент взаимодействует и его психическое состояние.\n\n")
		b.WriteString("3. **Положение**: Подвижность пациента и способность передвигаться (например: 'Положение активное, пациент передвигается самостоятельно', 'Положение вынужденное', 'Положение удовлетворительное, передвижение без затруднений', 'Положение пассивное, передвижение затруднено'). Опиши, может ли пациент передвигаться самостоятельно, ходить, его общую подвижность.\n\n")
		b.WriteString("ПРИМЕР ФОРМАТА (пиши естественно, не как список):\n")
		b.WriteString("Общее состояние удовлетворительное. Сознание ясное, пациент адекватно отвечает на вопросы, в контакт вступает. Положение активное, передвигается самостоятельно без затруднений.\n\n")
		b.WriteString("ИЛИ:\n")
		b.WriteString("Общее состояние средней тяжести. Сознание ясное, но пациент несколько раздражителен, на вопросы отвечает неохотно. Положение удовлетворительное, может передвигаться самостоятельно, но отмечает некоторую слабость.\n\n")
		b.WriteString("ИЛИ:\n")
		b.WriteString("Общее состояние тяжелое. Сознание спутанное, контакт затруднен. Положение пассивное, передвижение резко ограничено.\n\n")
		b.WriteString("ВАЖНО: Все три элемента (Состояние, Сознание, Положение) должны быть естественно вплетены в текст, а не перечислены как отдельные пункты. Пиши так, как пишет врач в медицинской документации — профессионально, но естественно.\n")
	}

	return b.String()
}

// Новый JSON-промпт, который принуждает модель вернуть только валидный JSON
func (c *ContentGenerator) buildDoctorConclusionJSONPrompt(profile *client.PatientProfile, answers map[string]string, complaints string, fileAnalysis string, lang string) string {
	var b strings.Builder

	switch lang {
	case "en":
		b.WriteString("You are a senior physician. Produce a STRICT JSON object with clinical sections.\n\n")
		b.WriteString("CRITICAL: You have access to ALL patient data: complaints, questionnaire responses, and medical file analysis. You MUST use ALL of this information when formulating the diagnosis (diagnosis_main and diagnosis_comorbid), treatment plans, and recommendations.\n\n")
	case "kz":
		b.WriteString("Сіз аға дәрігерсіз. Клиникалық бөлімдері бар ҚАТАҢ JSON жасаңыз.\n\n")
		b.WriteString("МАҢЫЗДЫ: Сізде науқастың БАРЛЫҚ деректері бар: шағымдар, сауалнама жауаптары және медициналық құжат талдауы. Диагноз (diagnosis_main және diagnosis_comorbid), ем жоспары және ұсыныстарды қалыптастыру кезінде СІЗ МИНДЕТТЕМЕСІЗ БАРЛЫҚ осы ақпаратты пайдалануға.\n\n")
	default: // ru
		b.WriteString("Вы старший врач. Сформируйте СТРОГИЙ JSON-объект с клиническими разделами.\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО: У вас есть доступ ко ВСЕМ данным пациента: жалобы, ответы на анкету и анализ медицинских файлов. Вы ОБЯЗАНЫ использовать ВСЮ эту информацию при формулировке диагноза (diagnosis_main и diagnosis_comorbid), планов лечения и рекомендаций.\n\n")
	}

	// Минимальные данные пациента — помогают контексту, но не обязательны
	if profile != nil {
		if lang == "en" {
			fmt.Fprintf(&b, "Patient: %s %s, born %s, sex: %s\n\n",
				profile.FirstName, profile.LastName, profile.DateOfBirth, profile.Gender)
		} else {
			fmt.Fprintf(&b, "Пациент: %s %s, %s г.р., пол: %s\n\n",
				profile.LastName, profile.FirstName, profile.DateOfBirth, profile.Gender)
		}
	}

	// Жалобы пациента
	if strings.TrimSpace(complaints) != "" {
		if lang == "en" {
			b.WriteString("Patient complaints (context):\n")
		} else if lang == "kz" {
			b.WriteString("Пайдаланушы шағымдары (контекст):\n")
		} else {
			b.WriteString("Жалобы пациента (контекст):\n")
		}
		b.WriteString(complaints + "\n\n")
	}

	// Анкета — как контекст
	if len(answers) > 0 {
		if lang == "en" {
			b.WriteString("Questionnaire (context):\n")
		} else if lang == "kz" {
			b.WriteString("Сауалнама жауаптары (контекст):\n")
		} else {
			b.WriteString("Ответы анкеты (контекст):\n")
		}
		for k, v := range answers {
			if strings.TrimSpace(v) != "" {
				fmt.Fprintf(&b, "- %s: %s\n", k, v)
			}
		}
		b.WriteString("\n")
	}

	// Проверяем, является ли fileAnalysis стандартным сообщением об ошибке
	// Только если это НЕ стандартное сообщение об ошибке, добавляем в промпт
	trimmed := strings.TrimSpace(fileAnalysis)
	if trimmed != "" && !isStandardErrorMessage(trimmed, lang) {
		if lang == "en" {
			b.WriteString("Medical file analysis (context):\n")
			b.WriteString("⚠️ CRITICAL: Use data from this analysis ONLY for 'diagnosis_main'/'diagnosis_comorbid' and treatment plans. DO NOT use instrumental examination data (InBody, ECG, blood tests, X-rays, etc.) in 'objective_status'. Objective status contains ONLY physical examination data (inspection, palpation, percussion, auscultation). Extract medical facts but DO NOT mention file names!\n\n")
		} else if lang == "kz" {
			b.WriteString("Медициналық құжат талдауы (контекст):\n")
			b.WriteString("⚠️ МАҢЫЗДЫ: Осы талдау деректерін ТЕК 'diagnosis_main'/'diagnosis_comorbid' және ем жоспары үшін пайдаланыңыз. 'objective_status' үшін инструменталды зерттеу деректерін (InBody, ЭКГ, қан талдаулары, рентген және т.б.) ҚОЛДАНБАҢЫЗ. Объективтік статус ТЕК физикалық зерттеу деректерін қамтиды (көзбен тексеру, пальпация, перкуссия, аускультация). Медициналық фактілерді шығарыңыз, бірақ файл атауларын ЕСКЕРТПЕҢІЗ!\n\n")
		} else {
			b.WriteString("Анализ медицинских файлов (контекст):\n")
			b.WriteString("⚠️ КРИТИЧЕСКИ ВАЖНО: Используй данные из этого анализа ТОЛЬКО для 'diagnosis_main'/'diagnosis_comorbid' и планов лечения. НЕ используй данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген и т.д.) в 'objective_status'. Объективный статус содержит ТОЛЬКО данные физикального осмотра (осмотр, пальпация, перкуссия, аускультация). Извлекай медицинские факты, но НЕ упоминай названия файлов!\n\n")
		}
		b.WriteString(fileAnalysis + "\n\n")
	}

	// Жесткие требования к ВЫХОДУ
	if lang == "en" {
		b.WriteString("RETURN ONLY VALID JSON. NO COMMENTS, NO CODE FENCES.\n")
	} else if lang == "kz" {
		b.WriteString("ТЕК ҚАНА ЖАРАМДЫ JSON ҚАЙТАРЫҢЫЗ. ЕШ ТҮСІНДІРМЕ/КОД БЛОКТАРЫ БОЛМАСЫН.\n")
	} else {
		b.WriteString("ВЕРНИТЕ ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ КОММЕНТАРИЕВ И БЕЗ КОДОВЫХ БЛОКОВ.\n")
	}

	b.WriteString("КЛЮЧИ ДОЛЖНЫ БЫТЬ РОВНО ТАКИЕ (snake_case) и в указанном порядке:\n")
	b.WriteString(`{
		"current_state": "<Текущее состояние пациента. КРИТИЧЕСКИ ВАЖНО: Пиши естественно, как пишет доктор, а не как робот. Текст должен течь естественно, описывая состояние пациента профессионально, но по-человечески. НЕ используй маркеры или списки — пиши сплошным текстом. НЕ повторяй жалобы пациента дословно — описывай текущее состояние на основе осмотра. НЕ включай данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген и т.д.) — только данные физикального осмотра. ОБЯЗАТЕЛЬНО включи в текст (естественно, не как отдельные пункты) три элемента: 1) Состояние — общее состояние пациента (например: 'Общее состояние удовлетворительное', 'Общее состояние средней тяжести', 'Общее состояние тяжелое'); 2) Сознание — уровень сознания и контакта (например: 'Сознание ясное', 'Сознание ясное, в контакт вступает', 'Сознание ясное, но пациент раздражителен, неохотно вступает в контакт', 'Сознание спутанное'); 3) Положение — подвижность пациента и способность передвигаться (например: 'Положение активное, пациент передвигается самостоятельно', 'Положение вынужденное', 'Положение удовлетворительное, передвижение без затруднений', 'Положение пассивное, передвижение затруднено'). Пример: 'Общее состояние удовлетворительное. Сознание ясное, пациент адекватно отвечает на вопросы, в контакт вступает. Положение активное, передвигается самостоятельно без затруднений.'>",
		"objective_status": "<Объективный статус в строгом формате: 16 пунктов без нумерации, каждый пункт начинается с заголовка и двоеточия. КРИТИЧЕСКИ ВАЖНО: 1) НЕ повторяй жалобы! НЕ пиши про боль, ощущения, жалобы пациента! 2) Начинай с 'Общее самочувствие' - ТОЛЬКО общее объективное состояние на момент осмотра врача (общее состояние, признаки острых системных патологий, функции других органов и систем). НЕ пиши: жалобы пациента ('Пациент предъявляет...'), конкретные находки по органам (увеличение сустава, температура - это в пунктах 11, 16), данные инструментальных обследований (масса тела, висцеральный жир - это из InBody). Пример ПРАВИЛЬНО: 'Общее самочувствие: Общее состояние удовлетворительное, признаков острой системной патологии не выявлено. Функции других органов и систем не нарушены.' 3) Пункты 7, 8, 9 (Грудная клетка, Область сердца, Обследование живота) ОБЯЗАТЕЛЬНО должны содержать ВСЕ подпункты через ; в одну строку, НИКОГДА не пиши 'Без особенностей' для этих пунктов! Если данных нет - используй нормальные значения (не изменено, сохранено, нет). 4) НЕ используй данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген и т.д.) в объективном статусе! Эти данные должны использоваться ТОЛЬКО в диагнозе и плане лечения! Формат: Общее самочувствие: ...; Кожные покровы и ногти: ...; и т.д.>",
		"diagnosis_main": "<строка, КРАТКО, только сам диагноз без дополнительных слов. КРИТИЧЕСКИ ВАЖНО: 1) НЕ пишите 'диагноз:', 'Предварительный диагноз:', 'Заключительный диагноз:' - пишите ТОЛЬКО сам диагноз. 2) НЕ пишите 'синдром неуточнённой этиологии', 'неуточнённый', 'неясной этиологии', 'неустановленной этиологии' - это НЕ диагнозы! 3) ДАВАЙТЕ КОНКРЕТНЫЙ ФИНАЛЬНЫЙ ДИАГНОЗ на основе всех данных (жалобы, анамнез, объективный статус, результаты исследований). Если данных достаточно для постановки диагноза - пишите конкретный диагноз (например: 'Хронический бронхит', 'Гипотиреоз', 'Артериальная гипертензия'). Если данных недостаточно, используйте наиболее вероятный диагноз на основе симптомов и данных исследований. 4) ОБЯЗАТЕЛЬНО учитывайте жалобы пациента, данные анкеты и результаты анализа файлов при формулировке диагноза. НЕ упоминайте названия файлов, просто пишите медицинские факты. НЕ включайте в диагноз данные из анамнеза жизни (травмы, операции в прошлом) - только текущие состояния и патологии>",
		"diagnosis_comorbid": ["<строка>", "<строка>", "<КРИТИЧЕСКИ ВАЖНО: Каждый элемент должен быть ТОЛЬКО медицинским диагнозом, а НЕ заключением исследования, симптомом или описанием состояния. ПРАВИЛЬНО: 'Хронический бронхит', 'Гипотиреоз', 'Хронический запор', 'Артериальная гипертензия', 'Сахарный диабет 2 типа'. НЕПРАВИЛЬНО: 'Синусовая брадикардия' (это описание из ЭКГ, не диагноз), 'Сколиоз грудного отдела позвоночника' (это описание из МРТ/КТ/рентгена, не диагноз), 'диффузные изменения щитовидной железы' (это заключение УЗИ, не диагноз), 'склонность к запорам' (это симптом, не диагноз), 'минимальная пастозность голеней' (это симптом, не диагноз), 'фиброзно-жировая инволюция молочных желез' (это описание состояния, не диагноз), 'рекомендуется дообследование' (это рекомендация, не диагноз). КРИТИЧЕСКИ ВАЖНО: НЕ включайте в диагнозы описания из инструментальных исследований (ЭКГ, МРТ, КТ, рентген, УЗИ и т.д.) - это описания, а не диагнозы! Каждый диагноз должен быть КРАТКИМ, только название диагноза без дополнительных описаний, заключений, симптомов или рекомендаций. Каждый диагноз должен учитывать жалобы, анкету и файлы. НЕ упоминайте названия файлов. НЕ включайте в сопутствующие диагнозы данные из анамнеза жизни (травмы, операции в прошлом) - только текущие медицинские диагнозы, которые влияют на здоровье сейчас>"],
		"plan_exam": "<Markdown-список: анализы/инструментальные исследования/консультации>",
		"plan_treatment": "<Markdown-список: терапия/препараты/режим>",
		"plan_general": "<Markdown-список: наблюдение/образ жизни/контроль>"
	  }
	  `)
	b.WriteString("\n❗❗❗ КРИТИЧЕСКИ ВАЖНО для current_state: Используй формат из инструкции ниже:\n\n")
	b.WriteString("⚠️ ОБЯЗАТЕЛЬНО ПРОЧИТАЙ И СЛЕДУЙ ЭТИМ ИНСТРУКЦИЯМ ДЛЯ ТЕКУЩЕГО СОСТОЯНИЯ:\n\n")
	b.WriteString(c.buildCurrentStatePromptInstruction(lang))
	b.WriteString("\n\n❗❗❗ КРИТИЧЕСКИ ВАЖНО для objective_status: Используй формат из инструкции ниже:\n\n")
	b.WriteString("⚠️ ОБЯЗАТЕЛЬНО ПРОЧИТАЙ И СЛЕДУЙ ЭТИМ ИНСТРУКЦИЯМ ТОЧНО:\n\n")
	b.WriteString(c.buildObjectiveStatusPromptInstruction(lang))
	b.WriteString("\n\n❗❗❗ ПОВТОРЯЕМ КРИТИЧЕСКИ ВАЖНО:\n")
	if lang == "en" {
		b.WriteString("- 'Общее самочувствие' - ONLY objective condition, NO complaints, NO pain, NO sensations!\n")
		b.WriteString("- Items 7, 8, 9 (Грудная клетка, Область сердца, Обследование живота) - MUST contain ALL sub-items through ; in one line, NEVER write 'Без особенностей'!\n")
		b.WriteString("- DO NOT include instrumental examination data (InBody, ECG, blood tests, X-rays, etc.) in objective status! These should be used ONLY in diagnosis and treatment plans!\n")
	} else if lang == "kz" {
		b.WriteString("- 'Общее самочувствие' - ТЕК объективтік жағдай, шағымдар ЖОҚ, ауру ЖОҚ, сезімдер ЖОҚ!\n")
		b.WriteString("- 7, 8, 9 пункттар (Грудная клетка, Область сердца, Обследование живота) - МИНДЕТТЕМЕ БАРЛЫҚ ішкі пункттер ; арқылы бір жолда, 'Без особенностей' ЖАЗБАҢЫЗ!\n")
		b.WriteString("- Объективтік статусқа инструменталды зерттеу деректерін (InBody, ЭКГ, қан талдаулары, рентген және т.б.) ҚОСПАҢЫЗ! Бұл деректер ТЕК диагноз және ем жоспарында пайдаланылуы керек!\n")
	} else {
		b.WriteString("- 'Общее самочувствие' - ТОЛЬКО общее объективное состояние (общее состояние, признаки острых системных патологий, функции других органов и систем), НЕ жалобы ('Пациент предъявляет...'), НЕ конкретные находки по органам (они в пунктах 11, 16), НЕ данные инструментальных обследований (InBody и т.д.)!\n")
		b.WriteString("- Пункты 7, 8, 9 (Грудная клетка, Область сердца, Обследование живота) - ОБЯЗАТЕЛЬНО должны содержать ВСЕ подпункты через ; в одну строку, НИКОГДА не пиши 'Без особенностей'!\n")
		b.WriteString("- НЕ включай данные инструментальных обследований (InBody, ЭКГ, анализы крови, рентген и т.д.) в объективный статус! Эти данные должны использоваться ТОЛЬКО в диагнозе и плане лечения!\n")
	}
	// Правила формулирования
	switch lang {
	case "en":
		b.WriteString("\nRules:\n- Start with 'current_state' (write naturally as a doctor, including State, Consciousness, and Position naturally in the text, not as separate items).\n- No duplication across sections.\n- Use concise clinical language, but write naturally, not like a robot.\n- Markdown is allowed only inside values (bulleted lists / paragraphs).\n- CRITICAL FOR DIAGNOSIS: When formulating 'diagnosis_main' and 'diagnosis_comorbid', you MUST consider:\n  * Patient complaints (provided above)\n  * Questionnaire responses (provided above)\n  * Medical file analysis results (provided above)\n  * All available patient data\n- IMPORTANT: If a field has no data, set it to an empty string \"\" instead of writing '—', 'no data', 'absent' or similar. Do not mention empty sections.\n")
	case "kz":
		b.WriteString("\nЕрежелер:\n- Алдымен 'current_state' (дәрігер сияқты табиғи түрде жазыңыз, Жағдай, Сана және Орналасу элементтерін мәтінде табиғи түрде қосыңыз, бөлек пункттар ретінде емес).\n- Бөлімдер арасында қайталамаңыз.\n- Қысқа клиникалық тіл қолданыңыз, бірақ табиғи түрде жазыңыз, робот сияқты емес.\n- Markdown тек мәндердің ішінде рұқсат (тізімдер/абзацтар).\n- ДИАГНОЗ ҮШІН МАҢЫЗДЫ: 'diagnosis_main' және 'diagnosis_comorbid' қалыптастыру кезінде СІЗ МИНДЕТТЕМЕСІЗ:\n  * Пайдаланушы шағымдары (жоғарыда берілген)\n  * Сауалнама жауаптары (жоғарыда берілген)\n  * Медициналық құжат талдау нәтижелері (жоғарыда берілген)\n  * Барлық қолжетімді науқас деректері\n- МАҢЫЗДЫ: Егер өрісте деректер болмаса, '—', 'деректер жоқ', 'жоқ' немесе басқа осындай жазулардың орнына бос жол \"\" қалдырыңыз. Бос бөлімдерді еске алмаңыз.\n")
	default:
		b.WriteString("\nПравила:\n- Всегда начинайте с 'current_state' (пишите естественно, как пишет доктор, включая Состояние, Сознание и Положение естественно в текст, не как отдельные пункты).\n- Без дублирования между разделами.\n- Язык — клинический и краткий, но пишите естественно, не как робот.\n- Markdown допускается только внутри значений (списки/абзацы).\n- КРИТИЧЕСКИ ВАЖНО ДЛЯ ДИАГНОЗА: При формулировке 'diagnosis_main' и 'diagnosis_comorbid' вы ОБЯЗАНЫ учитывать:\n  * Жалобы пациента (предоставлены выше)\n  * Ответы на анкету (предоставлены выше)\n  * Результаты анализа медицинских файлов (предоставлены выше)\n  * Все доступные данные пациента\n- КРИТИЧЕСКИ ВАЖНО ДЛЯ ОСНОВНОГО ДИАГНОЗА: НЕ пишите 'синдром неуточнённой этиологии', 'неуточнённый', 'неясной этиологии', 'неустановленной этиологии' - это НЕ диагнозы! ДАВАЙТЕ КОНКРЕТНЫЙ ФИНАЛЬНЫЙ ДИАГНОЗ на основе всех данных. Если данных достаточно - пишите конкретный диагноз (например: 'Хронический бронхит', 'Гипотиреоз', 'Артериальная гипертензия'). Если данных недостаточно, используйте наиболее вероятный диагноз на основе симптомов и данных исследований.\n- КРИТИЧЕСКИ ВАЖНО: НЕ упоминайте названия файлов в диагнозе и объективном статусе. Просто пишите медицинские факты (например: 'Избыточная масса тела' вместо 'Избыточная масса тела по данным InBody').\n- КРИТИЧЕСКИ ВАЖНО ДЛЯ ДИАГНОЗА: НЕ включайте в диагноз данные из анамнеза жизни (травмы в прошлом, операции в прошлом, состояния после травм). Включайте только текущие патологии и состояния, которые влияют на здоровье сейчас. Например, НЕ пишите 'Состояние после ЧМТ 2009 года' - это анамнез, а не диагноз.\n- КРИТИЧЕСКИ ВАЖНО ДЛЯ СОПУТСТВУЮЩИХ ДИАГНОЗОВ: Каждый элемент в 'diagnosis_comorbid' должен быть ТОЛЬКО медицинским диагнозом, а НЕ заключением исследования, симптомом или описанием состояния. ПРАВИЛЬНО: 'Хронический бронхит', 'Гипотиреоз', 'Хронический запор', 'Артериальная гипертензия', 'Сахарный диабет 2 типа'. НЕПРАВИЛЬНО: 'Синусовая брадикардия' (это описание из ЭКГ, не диагноз), 'Сколиоз грудного отдела позвоночника' (это описание из МРТ/КТ/рентгена, не диагноз), 'диффузные изменения щитовидной железы' (это заключение УЗИ), 'склонность к запорам' (это симптом), 'минимальная пастозность голеней' (это симптом), 'фиброзно-жировая инволюция молочных желез' (это описание состояния), 'рекомендуется дообследование' (это рекомендация). КРИТИЧЕСКИ ВАЖНО: НЕ включайте в диагнозы описания из инструментальных исследований (ЭКГ, МРТ, КТ, рентген, УЗИ и т.д.) - это описания, а не диагнозы!\n- ВАЖНО: Если поле не имеет данных, установите его в пустую строку \"\" вместо написания '—', 'данных нет', 'отсутствует' или подобного. Не упоминайте пустые разделы.\n")
	}

	return b.String()
}

// GenerateDiagnosisFromDOCX генерирует диагноз на основе текста DOCX файла (Фаза 2)
func (c *ContentGenerator) GenerateDiagnosisFromDOCX(docxText string, lang string) (*DiagnosisResult, error) {
	prompt := c.buildDiagnosisFromDOCXPrompt(docxText, lang)
	response, err := openai.AskOpenAI(prompt, lang)
	if err != nil {
		if errors.Is(err, openai.ErrLLMUnavailable) {
			main := "Требуется дообследование (ИИ недоступен)."
			if lang == "en" {
				main = "Further workup required (AI unavailable)."
			}
			if lang == "kz" {
				main = "Қосымша зерттеу қажет (ИИ қолжетімсіз)."
			}
			return &DiagnosisResult{DiagnosisMain: main, DiagnosisComorbid: []string{}}, nil
		}
		return nil, err
	}

	// Парсим JSON ответ
	jsonStr := extractJSON(response)
	var result DiagnosisResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse diagnosis JSON: %w", err)
	}

	// Защита от nil-слайса
	if result.DiagnosisComorbid == nil {
		result.DiagnosisComorbid = []string{}
	}
	result.DiagnosisMain = strings.TrimSpace(result.DiagnosisMain)
	for i := range result.DiagnosisComorbid {
		result.DiagnosisComorbid[i] = strings.TrimSpace(result.DiagnosisComorbid[i])
	}

	return &result, nil
}

// GeneratePlansFromDOCX генерирует планы на основе текста DOCX файла с диагнозом (Фаза 3)
func (c *ContentGenerator) GeneratePlansFromDOCX(docxText string, lang string) (*PlansResult, error) {
	prompt := c.buildPlansFromDOCXPrompt(docxText, lang)
	response, err := openai.AskOpenAI(prompt, lang)
	if err != nil {
		if errors.Is(err, openai.ErrLLMUnavailable) {
			plans := "- Клиническое наблюдение и дообследование по показаниям\n- Контроль у лечащего врача"
			if lang == "en" {
				plans = "- Clinical observation and further tests as indicated\n- Follow-up with treating physician"
			}
			if lang == "kz" {
				plans = "- Клиникалық бақылау және көрсеткіштер бойынша зерттеу\n- Емдеуші дәрігердің бақылауында болу"
			}
			return &PlansResult{PlanExam: plans, PlanTreatment: plans, PlanGeneral: plans}, nil
		}
		return nil, err
	}

	// Парсим JSON ответ
	jsonStr := extractJSON(response)
	var result PlansResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse plans JSON: %w", err)
	}

	result.PlanExam = strings.TrimSpace(result.PlanExam)
	result.PlanTreatment = strings.TrimSpace(result.PlanTreatment)
	result.PlanGeneral = strings.TrimSpace(result.PlanGeneral)

	return &result, nil
}

type DiagnosisResult struct {
	DiagnosisMain     string   `json:"diagnosis_main"`
	DiagnosisComorbid []string `json:"diagnosis_comorbid"`
}

type PlansResult struct {
	PlanExam      string `json:"plan_exam"`
	PlanTreatment string `json:"plan_treatment"`
	PlanGeneral   string `json:"plan_general"`
}

func (c *ContentGenerator) buildDiagnosisFromDOCXPrompt(docxText string, lang string) string {
	var b strings.Builder

	switch lang {
	case "en":
		b.WriteString("You are a senior physician. Based on the medical document provided below, formulate ONLY the diagnosis.\n\n")
		b.WriteString("CRITICAL: You have access to the ENTIRE medical document including patient data, complaints, medical history, objective status, and interpretation of research data. Use ALL of this information when formulating the diagnosis.\n\n")
	case "kz":
		b.WriteString("Сіз аға дәрігерсіз. Төменде берілген медициналық құжат негізінде ТЕК диагнозды қалыптастырыңыз.\n\n")
		b.WriteString("МАҢЫЗДЫ: Сізде БАРЛЫҚ медициналық құжат бар, соның ішінде науқас деректері, шағымдар, ауру тарихы, объективтік статус және зерттеу деректерінің интерпретациясы. Диагноз қалыптастыру кезінде БАРЛЫҚ осы ақпаратты пайдаланыңыз.\n\n")
	default: // ru
		b.WriteString("Вы старший врач. На основе предоставленного ниже медицинского документа сформулируйте ТОЛЬКО диагноз.\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО: У вас есть доступ ко ВСЕМУ медицинскому документу, включая данные пациента, жалобы, анамнез заболевания, объективный статус и интерпретацию данных исследований. Используйте ВСЮ эту информацию при формулировке диагноза.\n\n")
		b.WriteString("❗❗❗ КРИТИЧЕСКИ ВАЖНО ДЛЯ ОСНОВНОГО ДИАГНОЗА:\n")
		b.WriteString("НЕ пишите 'синдром неуточнённой этиологии', 'неуточнённый', 'неясной этиологии', 'неустановленной этиологии' - это НЕ диагнозы!\n")
		b.WriteString("ДАВАЙТЕ КОНКРЕТНЫЙ ФИНАЛЬНЫЙ ДИАГНОЗ на основе всех данных из документа.\n")
		b.WriteString("Если данных достаточно для постановки диагноза - пишите конкретный диагноз (например: 'Хронический бронхит', 'Гипотиреоз', 'Артериальная гипертензия').\n")
		b.WriteString("Если данных недостаточно, используйте наиболее вероятный диагноз на основе симптомов и данных исследований.\n\n")
	}

	b.WriteString("МЕДИЦИНСКИЙ ДОКУМЕНТ:\n")
	b.WriteString("═══════════════════════════════════════════════════════════════\n")
	b.WriteString(docxText)
	b.WriteString("\n═══════════════════════════════════════════════════════════════\n\n")

	if lang == "ru" {
		b.WriteString("❗❗❗ КРИТИЧЕСКИ ВАЖНО ДЛЯ СОПУТСТВУЮЩИХ ДИАГНОЗОВ:\n")
		b.WriteString("Каждый элемент в 'diagnosis_comorbid' должен быть ТОЛЬКО медицинским диагнозом, а НЕ:\n")
		b.WriteString("- описанием из инструментальных исследований (например: 'Синусовая брадикардия' - это описание из ЭКГ, не диагноз; 'Сколиоз грудного отдела позвоночника' - это описание из МРТ/КТ/рентгена, не диагноз)\n")
		b.WriteString("- заключением исследования (например: 'диффузные изменения щитовидной железы' - это заключение УЗИ, не диагноз)\n")
		b.WriteString("- симптомом (например: 'склонность к запорам', 'минимальная пастозность голеней' - это симптомы, не диагнозы)\n")
		b.WriteString("- описанием состояния (например: 'фиброзно-жировая инволюция молочных желез' - это описание, не диагноз)\n")
		b.WriteString("- рекомендацией (например: 'рекомендуется дообследование' - это рекомендация, не диагноз)\n")
		b.WriteString("ПРАВИЛЬНО формулировать диагнозы: 'Хронический бронхит', 'Гипотиреоз', 'Хронический запор', 'Артериальная гипертензия', 'Сахарный диабет 2 типа'.\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО: НЕ включайте в диагнозы описания из инструментальных исследований (ЭКГ, МРТ, КТ, рентген, УЗИ и т.д.) - это описания, а не диагнозы!\n\n")
	}

	b.WriteString("ВЕРНИТЕ ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ КОММЕНТАРИЕВ И БЕЗ КОДОВЫХ БЛОКОВ.\n\n")
	b.WriteString(`{
		"diagnosis_main": "<строка, КРАТКО, только сам диагноз без дополнительных слов. КРИТИЧЕСКИ ВАЖНО: 1) НЕ пишите 'диагноз:', 'Предварительный диагноз:', 'Заключительный диагноз:' - пишите ТОЛЬКО сам диагноз. 2) НЕ пишите 'синдром неуточнённой этиологии', 'неуточнённый', 'неясной этиологии', 'неустановленной этиологии' - это НЕ диагнозы! 3) ДАВАЙТЕ КОНКРЕТНЫЙ ФИНАЛЬНЫЙ ДИАГНОЗ на основе всех данных из документа (жалобы, анамнез, объективный статус, результаты исследований). Если данных достаточно для постановки диагноза - пишите конкретный диагноз (например: 'Хронический бронхит', 'Гипотиреоз', 'Артериальная гипертензия'). Если данных недостаточно, используйте наиболее вероятный диагноз на основе симптомов и данных исследований. 4) ОБЯЗАТЕЛЬНО учитывайте все данные из документа: жалобы, анамнез, объективный статус, результаты исследований. НЕ упоминайте названия файлов, просто пишите медицинские факты. НЕ включайте в диагноз данные из анамнеза жизни (травмы, операции в прошлом) - только текущие состояния и патологии>",
		"diagnosis_comorbid": ["<строка>", "<строка>", "<КРИТИЧЕСКИ ВАЖНО: Каждый элемент должен быть ТОЛЬКО медицинским диагнозом, а НЕ заключением исследования, симптомом или описанием состояния. ПРАВИЛЬНО: 'Хронический бронхит', 'Гипотиреоз', 'Хронический запор', 'Артериальная гипертензия', 'Сахарный диабет 2 типа'. НЕПРАВИЛЬНО: 'Синусовая брадикардия' (это описание из ЭКГ, не диагноз), 'Сколиоз грудного отдела позвоночника' (это описание из МРТ/КТ/рентгена, не диагноз), 'диффузные изменения щитовидной железы' (это заключение УЗИ, не диагноз), 'склонность к запорам' (это симптом, не диагноз), 'минимальная пастозность голеней' (это симптом, не диагноз), 'фиброзно-жировая инволюция молочных желез' (это описание состояния, не диагноз), 'рекомендуется дообследование' (это рекомендация, не диагноз). КРИТИЧЕСКИ ВАЖНО: НЕ включайте в диагнозы описания из инструментальных исследований (ЭКГ, МРТ, КТ, рентген, УЗИ и т.д.) - это описания, а не диагнозы! Каждый диагноз должен быть КРАТКИМ, только название диагноза без дополнительных описаний, заключений, симптомов или рекомендаций. НЕ упоминайте названия файлов. НЕ включайте в сопутствующие диагнозы данные из анамнеза жизни (травмы, операции в прошлом) - только текущие медицинские диагнозы, которые влияют на здоровье сейчас>"]
	  }`)

	return b.String()
}

func (c *ContentGenerator) buildPlansFromDOCXPrompt(docxText string, lang string) string {
	var b strings.Builder

	switch lang {
	case "en":
		b.WriteString("You are a senior physician. Based on the medical document provided below (which includes diagnosis), formulate ONLY the examination plan, treatment plan, and general recommendations.\n\n")
		b.WriteString("CRITICAL: You have access to the ENTIRE medical document including patient data, complaints, medical history, objective status, interpretation of research data, and DIAGNOSIS. Use ALL of this information when formulating the plans.\n\n")
	case "kz":
		b.WriteString("Сіз аға дәрігерсіз. Төменде берілген медициналық құжат негізінде (диагнозды қоса алғанда) ТЕК зерттеу жоспарын, ем жоспарын және жалпы ұсыныстарды қалыптастырыңыз.\n\n")
		b.WriteString("МАҢЫЗДЫ: Сізде БАРЛЫҚ медициналық құжат бар, соның ішінде науқас деректері, шағымдар, ауру тарихы, объективтік статус, зерттеу деректерінің интерпретациясы және ДИАГНОЗ. Жоспарларды қалыптастыру кезінде БАРЛЫҚ осы ақпаратты пайдаланыңыз.\n\n")
	default: // ru
		b.WriteString("Вы старший врач. На основе предоставленного ниже медицинского документа (включая диагноз) сформулируйте ТОЛЬКО план обследования, план лечения и общие рекомендации.\n\n")
		b.WriteString("КРИТИЧЕСКИ ВАЖНО: У вас есть доступ ко ВСЕМУ медицинскому документу, включая данные пациента, жалобы, анамнез заболевания, объективный статус, интерпретацию данных исследований и ДИАГНОЗ. Используйте ВСЮ эту информацию при формулировке планов.\n\n")
	}

	b.WriteString("МЕДИЦИНСКИЙ ДОКУМЕНТ:\n")
	b.WriteString("═══════════════════════════════════════════════════════════════\n")
	b.WriteString(docxText)
	b.WriteString("\n═══════════════════════════════════════════════════════════════\n\n")

	b.WriteString("ВЕРНИТЕ ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ КОММЕНТАРИЕВ И БЕЗ КОДОВЫХ БЛОКОВ.\n\n")
	b.WriteString(`{
		"plan_exam": "<Markdown-список: анализы/инструментальные исследования/консультации. Учитывайте диагноз и все данные из документа>",
		"plan_treatment": "<Markdown-список: терапия/препараты/режим. Учитывайте диагноз и все данные из документа>",
		"plan_general": "<Markdown-список: наблюдение/образ жизни/контроль. Учитывайте диагноз и все данные из документа>"
	  }`)

	return b.String()
}

func (c *ContentGenerator) buildMedicalHistoryPrompt(profile *client.PatientProfile, answers map[string]string, lang string) string {
	var b strings.Builder

	// Инструкция без тайтла - сразу содержание
	if lang == "kz" {
		b.WriteString("Сіз тәжірибелі дәрігерсіз. Науқастың ауру тарихын ТАЛДАП, қысқаша және анық сипаттаңыз.\n\n")
		b.WriteString("**КРИТИКАЛЫҚ МАҢЫЗДЫ:**\n")
		b.WriteString("- НЕ просто переписывайте ответы - АНАЛИЗИРУЙТЕ развитие заболевания\n")
		b.WriteString("- Опишите КАК началось, КАК развивалось, ЧТО было сделано, КАКОЙ эффект\n")
		b.WriteString("- Связный текст, не список. Максимум 4-6 предложений\n")
		b.WriteString("- Если данных нет - напишите 'Анамнез заболевания не указан'\n")
		b.WriteString("- НЕ повторяй заголовок, персональные данные, жалобы\n\n")
	} else if lang == "en" {
		b.WriteString("You are an experienced physician. ANALYZE and briefly describe the patient's medical history.\n\n")
		b.WriteString("**CRITICALLY IMPORTANT:**\n")
		b.WriteString("- DO NOT simply rewrite answers - ANALYZE the disease development\n")
		b.WriteString("- Describe HOW it started, HOW it developed, WHAT was done, WHAT effect\n")
		b.WriteString("- Coherent text, not a list. Maximum 4-6 sentences\n")
		b.WriteString("- If no data - write 'Medical history not specified'\n")
		b.WriteString("- DO NOT repeat title, personal data, complaints\n\n")
	} else {
		b.WriteString("Вы опытный врач. ПРОАНАЛИЗИРУЙТЕ и кратко опишите анамнез заболевания пациента.\n\n")
		b.WriteString("**КРИТИЧЕСКИ ВАЖНО:**\n")
		b.WriteString("- НЕ просто переписывайте ответы - АНАЛИЗИРУЙТЕ развитие заболевания\n")
		b.WriteString("- Опишите КАК началось, КАК развивалось, ЧТО было сделано, КАКОЙ эффект\n")
		b.WriteString("- Связный текст, не список. Максимум 4-6 предложений\n")
		b.WriteString("- Если данных нет - напишите 'Анамнез заболевания не указан'\n")
		b.WriteString("- НЕ повторяй заголовок, персональные данные, жалобы\n\n")
	}

	// Профиль пациента (только для расчета классов, без персональных данных в промпте)
	// Проверяем, есть ли упоминания классов в исходных данных
	hasClassMentions := c.hasClassMentionsInAnswers(answers)

	if profile != nil && hasClassMentions {
		// Инструкция по расчету года по классу ТОЛЬКО если классы упоминаются в исходных данных
		if lang == "en" {
			b.WriteString("ВАЖНО: Если в исходных данных упоминаются классы обучения, добавляйте год как 'N класс (YYYY)'.\n")
			b.WriteString("Правило: 7 лет = 1 класс, 8 лет = 2 класс, ..., 17 лет = 11 класс.\n")
			b.WriteString("НО: Если в исходных данных есть ТОЧНЫЙ год события - используйте его, НЕ переводите год в класс!\n")
			b.WriteString("Классы добавляйте ТОЛЬКО если в исходных данных есть неточные даты типа 'учился в 6 классе когда начал болеть'.\n\n")
		} else if lang == "kz" {
			b.WriteString("МАҢЫЗДЫ: Егер бастапқы деректерде сыныптар аталса, жылды қосыңыз: 'N сынып (ЖЖЖЖ)'.\n")
			b.WriteString("Ереже: 7 жас = 1 сынып, 8 жас = 2 сынып, ..., 17 жас = 11 сынып.\n")
			b.WriteString("БІРАҚ: Егер бастапқы деректерде оқиғаның ДӘЛ жылы болса - оны қолданыңыз, жылды сыныпқа АЙНАЛДЫРМАҢЫЗ!\n")
			b.WriteString("Сыныптарды ТЕК бастапқы деректерде '6 сыныпта оқығанда ауру басталды' сияқты дәл емес күндер болғанда қосыңыз.\n\n")
		} else {
			b.WriteString("ВАЖНО: Если в исходных данных упоминаются классы обучения, добавляйте год как 'N класс (YYYY)'.\n")
			b.WriteString("Правило: 7 лет = 1 класс, 8 лет = 2 класс, ..., 17 лет = 11 класс.\n")
			b.WriteString("НО: Если в исходных данных есть ТОЧНЫЙ год события - используйте его, НЕ переводите год в класс!\n")
			b.WriteString("Классы добавляйте ТОЛЬКО если в исходных данных есть неточные даты типа 'учился в 6 классе когда начал болеть'.\n\n")
		}
	} else if profile != nil {
		// Если классов нет в исходных данных - явно запрещаем их упоминать
		if lang == "en" {
			b.WriteString("ВАЖНО: В исходных данных НЕТ упоминаний классов обучения. НЕ упоминайте классы в ответе!\n")
			b.WriteString("Используйте только точные годы событий, если они указаны в исходных данных.\n\n")
		} else if lang == "kz" {
			b.WriteString("МАҢЫЗДЫ: Бастапқы деректерде оқу сыныптарының аталуы ЖОҚ. Жауапта сыныптарды ЕСКЕРТПЕҢІЗ!\n")
			b.WriteString("Бастапқы деректерде көрсетілген дәл жылдарды ғана қолданыңыз.\n\n")
		} else {
			b.WriteString("ВАЖНО: В исходных данных НЕТ упоминаний классов обучения. НЕ упоминайте классы в ответе!\n")
			b.WriteString("Используйте только точные годы событий, если они указаны в исходных данных.\n\n")
		}
	}

	// Симптомы и их характеристика (только технические данные, без жалоб)
	symptomCats := []string{"symptoms_start_date", "symptoms_location", "symptoms_intensity"}
	symptomAnswers := c.filterAnswersByCategory(answers, symptomCats)
	if len(symptomAnswers) > 0 {
		if lang == "en" {
			b.WriteString("Symptoms data:\n")
		} else {
			b.WriteString("Данные о симптомах:\n")
		}
		for k, v := range symptomAnswers {
			if strings.TrimSpace(v) != "" {
				b.WriteString(fmt.Sprintf("%s: %s\n", k, v))
			}
		}
		b.WriteString("\n")
	}

	// Лечение
	if v, ok := answers["medications"]; ok && strings.TrimSpace(v) != "" {
		if lang == "en" {
			b.WriteString("Treatment: ")
		} else {
			b.WriteString("Лечение: ")
		}
		b.WriteString(v + "\n\n")
	}

	// Финальная инструкция
	if hasClassMentions {
		if lang == "en" {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. Если в исходных данных упоминаются классы - добавляйте годы к классам. Если есть точный год - используйте его, НЕ переводите в класс! Без повторения персональных данных и жалоб.")
		} else if lang == "kz" {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. Егер бастапқы деректерде сыныптар аталса - сыныптарға жылдарды қосыңыз. Егер дәл жыл болса - оны қолданыңыз, сыныпқа АЙНАЛДЫРМАҢЫЗ! Без повторения персональных данных и жалоб.")
		} else {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. Если в исходных данных упоминаются классы - добавляйте годы к классам. Если есть точный год - используйте его, НЕ переводите в класс! Без повторения персональных данных и жалоб.")
		}
	} else {
		if lang == "en" {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. НЕ упоминайте классы обучения - их нет в исходных данных! Используйте только точные годы, если они указаны. Без повторения персональных данных и жалоб.")
		} else if lang == "kz" {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. Оқу сыныптарын ЕСКЕРТПЕҢІЗ - олар бастапқы деректерде жоқ! Көрсетілген дәл жылдарды ғана қолданыңыз. Без повторения персональных данных и жалоб.")
		} else {
			b.WriteString("ФОРМАТ: Связный текст без заголовка. Включите когда началось (или 'пациент не помнит'), как развивалось, какое лечение и эффект. НЕ упоминайте классы обучения - их нет в исходных данных! Используйте только точные годы, если они указаны. Без повторения персональных данных и жалоб.")
		}
	}
	return b.String()
}

// hasClassMentionsInAnswers проверяет, есть ли упоминания классов в исходных данных
func (c *ContentGenerator) hasClassMentionsInAnswers(answers map[string]string) bool {
	classPattern := regexp.MustCompile(`(?i)(\d{1,2})\s*(?:-?(?:й|й|го|ом|ом)?\s*)?класс(?:е|а|ом)?|(\d{1,2})(?:th|st|nd|rd)?\s*grade|grade\s+(\d{1,2})`)

	for _, value := range answers {
		if classPattern.MatchString(value) {
			return true
		}
	}

	return false
}

// calculateAge вычисляет возраст на основе даты рождения
// isStandardErrorMessage проверяет, является ли fileAnalysis стандартным сообщением об ошибке
// Эти сообщения не должны добавляться в промпт OpenAI, так как они не содержат реального анализа
// ВАЖНО: Функция должна быть очень точной - блокировать только короткие стандартные сообщения,
// но НЕ блокировать реальный анализ файлов, даже если он содержит слова "не найдено"
func isStandardErrorMessage(fileAnalysis, lang string) bool {
	trimmed := strings.TrimSpace(fileAnalysis)
	trimmedLower := strings.ToLower(trimmed)

	// Если файлAnalysis очень короткий (< 60 символов), это скорее всего стандартное сообщение
	if len(trimmed) < 60 {
		// Стандартные сообщения об ошибках для разных языков (точные совпадения)
		errorMessages := []string{
			// Русский
			"файлы для анализа не найдены.",
			"файлы для анализа не найдены",
			"не удалось получить список файлов назначения.",
			"не удалось получить список файлов назначения",
			"нет результатов анализа",
			// English
			"no files found for analysis.",
			"no files found for analysis",
			"failed to retrieve appointment files.",
			"failed to retrieve appointment files",
			"no analysis results",
			// Kazakh
			"талдауға арналған файлдар табылмады.",
			"талдауға арналған файлдар табылмады",
			"тағайындау файлдарын алу мүмкін болмады.",
			"тағайындау файлдарын алу мүмкін болмады",
			"талдау нәтижелері жоқ",
		}

		// Проверяем точное совпадение (без точки в конце или с точкой)
		for _, msg := range errorMessages {
			if trimmedLower == msg || trimmedLower == strings.TrimSuffix(msg, ".") {
				return true
			}
		}

		// Если это очень короткое сообщение и содержит только слова об ошибке
		if strings.Contains(trimmedLower, "не найдены") &&
			!strings.Contains(trimmedLower, "документ") &&
			!strings.Contains(trimmedLower, "параметр") &&
			!strings.Contains(trimmedLower, "результат") {
			return true
		}
		if strings.Contains(trimmedLower, "not found") &&
			!strings.Contains(trimmedLower, "document") &&
			!strings.Contains(trimmedLower, "parameter") &&
			!strings.Contains(trimmedLower, "result") {
			return true
		}
	}

	// Если fileAnalysis длинный (> 60 символов) или содержит ключевые слова анализа,
	// это реальный анализ, а не стандартное сообщение об ошибке
	// НЕ блокируем его, даже если он содержит слова "не найдено" где-то в тексте
	return false
}

func (c *ContentGenerator) calculateAge(birthDate string) int {
	layouts := []string{
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05.000Z",
		"2006-01-02",
		"02.01.2006",
		"02/01/2006",
	}

	for _, layout := range layouts {
		if birth, err := time.Parse(layout, birthDate); err == nil {
			now := time.Now()
			age := now.Year() - birth.Year()
			if now.YearDay() < birth.YearDay() {
				age--
			}
			return age
		}
	}
	return 0
}

// addYearsToGrades добавляет годы к упоминаниям классов в тексте
// Правило: 7 лет = 1 класс, 8 лет = 2 класс, ..., 17 лет = 11 класс
// Если упоминается класс N, то пациенту было 7 + (N - 1) лет в этом классе
func (c *ContentGenerator) addYearsToGrades(text, birthDate string, lang string) string {
	age := c.calculateAge(birthDate)
	if age == 0 {
		return text
	}

	currentYear := time.Now().Year()

	// Регулярное выражение для поиска упоминаний классов
	// Паттерны: "8 класс", "в 8 классе", "8-й класс", "8-го класса", "grade 8", "8th grade" и т.д.
	// Ищем классы только в диапазоне 1-11
	re := regexp.MustCompile(`(?i)(в\s+)?(\d{1,2})(-?(й|й|го|ом|ом)?\s+)?класс(е|а|ом)?|(\d{1,2})(th|st|nd|rd)?\s+grade|grade\s+(\d{1,2})`)

	result := re.ReplaceAllStringFunc(text, func(match string) string {
		// Проверяем, не добавлен ли уже год к этому упоминанию
		if strings.Contains(match, "(") && strings.Contains(match, ")") {
			return match
		}

		// Извлекаем номер класса (первое число в совпадении)
		gradeRe := regexp.MustCompile(`\d{1,2}`)
		gradeStr := gradeRe.FindString(match)
		if gradeStr == "" {
			return match
		}

		grade, err := strconv.Atoi(gradeStr)
		if err != nil || grade < 1 || grade > 11 {
			return match
		}

		// Вычисляем возраст в этом классе: 7 + (N - 1)
		// Например: 1 класс = 7 лет, 8 класс = 14 лет, 11 класс = 17 лет
		ageInGrade := 7 + (grade - 1)

		// Вычисляем год: текущий год - (текущий возраст - возраст в классе)
		year := currentYear - (age - ageInGrade)

		// Если год в будущем или слишком далеко в прошлом (больше 100 лет назад), не добавляем его
		if year > currentYear || year < currentYear-100 {
			return match
		}

		// Формируем замену в зависимости от языка и формата упоминания
		matchLower := strings.ToLower(match)
		if strings.Contains(matchLower, "класс") {
			// Русский/казахский формат
			if strings.HasPrefix(matchLower, "в ") {
				return fmt.Sprintf("в %d классе (%d)", grade, year)
			}
			// Для других форматов: "8 класс", "8-й класс", "8-го класса" и т.д.
			return fmt.Sprintf("%d класс (%d)", grade, year)
		} else if strings.Contains(matchLower, "grade") {
			// Английский формат
			if strings.HasPrefix(matchLower, "in ") {
				return fmt.Sprintf("in %dth grade (%d)", grade, year)
			}
			if strings.HasPrefix(matchLower, "grade ") {
				return fmt.Sprintf("grade %d (%d)", grade, year)
			}
			// Для формата "8th grade"
			return fmt.Sprintf("%dth grade (%d)", grade, year)
		}

		return match
	})

	return result
}

func (c *ContentGenerator) buildLifestylePrompt(answers map[string]string, lang string) string {
	var b strings.Builder

	// Заголовок с инструкцией всегда включать все разделы
	if lang == "kz" {
		b.WriteString("Сіз тәжірибелі дәрігерсіз. Қысқаша және нақты сипаттаңыз науқастың өмір анамнезін.\n\n")
		b.WriteString("**КРИТИКАЛЫҚ МАҢЫЗДЫ:**\n")
		b.WriteString("- Тек фактілерді жазыңыз, интерпретациялар мен болжамдарсыз\n")
		b.WriteString("- 'бұл көрсетеді', 'бұл айтады' сияқты фразаларды қолданбаңыз\n")
		b.WriteString("- Формат: бар нәрсені (аурулар, операциялар, аллергиялар) үтір немесе нүктелі үтір арқылы тізіп көрсетіңіз\n")
		b.WriteString("- СТРОГО: Әрқашан 7 тармақ. Әр тармақ — максимум 1 сөйлем, тек фактілер\n")
		b.WriteString("- Егер деректер жоқ болса — 'ерекшеліктер жоқ' немесе 'жоқ' деп жазыңыз\n\n")
	} else if lang == "en" {
		b.WriteString("You are an experienced physician. Briefly and specifically describe the patient's lifestyle history.\n\n")
		b.WriteString("**CRITICALLY IMPORTANT:**\n")
		b.WriteString("- Write ONLY facts, WITHOUT interpretations and assumptions\n")
		b.WriteString("- DO NOT use phrases like 'which may indicate', 'which suggests', 'which points to'\n")
		b.WriteString("- Format: simply list what exists (diseases, operations, allergies) separated by commas or semicolons\n")
		b.WriteString("- STRICT: Always 7 items. Each item — maximum 1 sentence, only facts\n")
		b.WriteString("- If no data — write 'no features' or 'absent'\n\n")
	} else {
		b.WriteString("Вы опытный врач. Кратко и конкретно опишите анамнез жизни пациента.\n\n")
		b.WriteString("**КРИТИЧЕСКИ ВАЖНО:**\n")
		b.WriteString("- Пишите ТОЛЬКО факты, БЕЗ интерпретаций и предположений\n")
		b.WriteString("- НЕ используйте фразы типа 'что может свидетельствовать', 'что говорит о', 'что указывает на'\n")
		b.WriteString("- НЕ пишите 'в анамнезе отмечается' - просто перечисляйте факты\n")
		b.WriteString("- НЕ включайте информацию об отсутствии обращений к врачу или лечения (например, 'нет обращений и лечения по поводу колена') - это не заболевание\n")
		b.WriteString("- Формат: просто перечислите что есть (болезни, операции, аллергии) через запятую или точку с запятой\n")
		b.WriteString("- СТРОГО: Всегда 7 пунктов. Каждый пункт — максимум 1 предложение, только факты\n")
		b.WriteString("- Если данных нет — пишите 'без особенностей' или 'отсутствуют'\n")
		b.WriteString("- Пример правильного формата:\n")
		b.WriteString("  1. Перенесенные заболевания: гайморит, черепно-мозговая травма\n")
		b.WriteString("  2. Операции: аппендэктомия, операция по поводу грыжи, операции на челюсти\n")
		b.WriteString("  3. Аллергии: реакция на избыток сахара (насморк)\n\n")
	}

	var sectionsToWrite []string
	var absentText1, absentText2, absentText3, absentText4, absentText5, absentText6, absentText7 string
	if lang == "en" {
		absentText1 = "отсутствуют"
		absentText2 = "отсутствуют"
		absentText3 = "отсутствуют"
		absentText4 = "отсутствует"
		absentText5 = "отсутствуют"
		absentText6 = "отсутствует"
		absentText7 = "отсутствуют"
	} else if lang == "kz" {
		absentText1 = "жоқ"
		absentText2 = "жоқ"
		absentText3 = "жоқ"
		absentText4 = "жоқ"
		absentText5 = "жоқ"
		absentText6 = "жоқ"
		absentText7 = "жоқ"
	} else {
		absentText1 = "отсутствуют"
		absentText2 = "отсутствуют"
		absentText3 = "отсутствуют"
		absentText4 = "отсутствует"
		absentText5 = "отсутствуют"
		absentText6 = "отсутствует"
		absentText7 = "отсутствуют"
	}

	// Собираем все данные о заболеваниях и операциях
	var diseasesParts []string
	var operationsParts []string

	// Собираем заболевания (без операций)
	for _, k := range []string{"chronic_diseases", "past_year_symptoms"} {
		if v := strings.TrimSpace(answers[k]); v != "" {
			// Убираем упоминания операций из текста заболеваний
			cleaned := c.removeOperationsFromText(v)
			if cleaned != "" {
				diseasesParts = append(diseasesParts, cleaned)
			}
			// Извлекаем операции из текста
			extractedOps := c.extractOperationsFromText(v)
			if extractedOps != "" {
				operationsParts = append(operationsParts, extractedOps)
			}
		}
	}

	// 1) Перенесенные заболевания
	{
		var content string
		if len(diseasesParts) > 0 {
			content = strings.Join(diseasesParts, " ")
			// Убираем лишние фразы про отсутствие операций
			content = c.cleanDiseasesText(content)
		} else {
			content = absentText1
		}
		sectionsToWrite = append(sectionsToWrite, "1. Перенесенные заболевания: "+content+"\n")
	}

	// 2) Операции
	{
		var txt string
		// Сначала берем из специальных полей
		for _, k := range []string{"operations", "surgeries"} {
			if v := strings.TrimSpace(answers[k]); v != "" {
				if txt != "" {
					txt += ", "
				}
				txt += v
			}
		}
		// Добавляем операции, извлеченные из других полей
		if len(operationsParts) > 0 {
			opsText := strings.Join(operationsParts, ", ")
			if txt != "" {
				txt += ", " + opsText
			} else {
				txt = opsText
			}
		}
		// Убираем дубликаты
		txt = c.removeDuplicateOperations(txt)
		if txt == "" {
			txt = absentText2
		}
		sectionsToWrite = append(sectionsToWrite, "2. Операции: "+txt+"\n")
	}

	// 3) Аллергии
	{
		v := strings.TrimSpace(answers["allergies"])
		if v == "" {
			v = absentText3
		}
		sectionsToWrite = append(sectionsToWrite, "3. Аллергии: "+v+"\n")
	}

	// 4) Наследственность
	{
		v := strings.TrimSpace(answers["family_history"])
		if v == "" {
			v = absentText4
		}
		// AI сам будет писать кратко согласно инструкции в промпте: если пациент говорит что нет - "чистая", если ничего не говорит - "отсутствует"
		sectionsToWrite = append(sectionsToWrite, "4. Наследственность: "+v+"\n")
	}

	// 5) Вредные привычки
	{
		var txt string
		if v := strings.TrimSpace(answers["smoking"]); v != "" {
			txt += "Курение: " + v + ". "
		}
		if v := strings.TrimSpace(answers["alcohol"]); v != "" {
			txt += "Алкоголь: " + v + ". "
		}
		if v := strings.TrimSpace(answers["drugs"]); v != "" {
			txt += "Наркотики: " + v + ". "
		}
		if txt == "" {
			txt = absentText5
		} else {
			txt = strings.TrimSpace(txt)
		}
		sectionsToWrite = append(sectionsToWrite, "5. Вредные привычки: "+txt+"\n")
	}

	// 6) Гинекологический анамнез (только для женского пола)
	{
		v := strings.TrimSpace(answers["gynecological_history"])
		if v == "" {
			v = absentText6
		}
		sectionsToWrite = append(sectionsToWrite, "6. Гинекологический анамнез: "+v+"\n")
	}

	// 7) Какие препараты принимает в данное время
	{
		v := strings.TrimSpace(answers["medications"])
		if v == "" {
			v = absentText7
		}
		sectionsToWrite = append(sectionsToWrite, "7. Какие препараты принимает в данное время: "+v+"\n")
	}

	// Всегда пишем все разделы
	for _, section := range sectionsToWrite {
		b.WriteString(section + "\n")
	}

	// Добавляем финальную инструкцию
	if lang == "en" {
		b.WriteString("\n**FORMAT REQUIREMENTS:**")
		b.WriteString("\n- Write ONLY facts, list items separated by commas or semicolons")
		b.WriteString("\n- NO interpretations, NO phrases like 'which may indicate', 'which suggests'")
		b.WriteString("\n- Maximum 1 sentence per item, be concise and specific")
		b.WriteString("\n- All 7 sections must be present")
		b.WriteString("\n\nВАЖНО для пункта 4 (Наследственность): Если пациент говорит, что у него нет наследственных заболеваний - пиши просто 'чистая'. Если пациент об этом ничего не говорит - пиши 'отсутствует'.")
	} else if lang == "kz" {
		b.WriteString("\n**ФОРМАТ ТАЛАПТАРЫ:**")
		b.WriteString("\n- Тек фактілерді жазыңыз, элементтерді үтір немесе нүктелі үтір арқылы бөліңіз")
		b.WriteString("\n- Интерпретациялар жоқ, 'бұл көрсетеді', 'бұл айтады' сияқты фразалар жоқ")
		b.WriteString("\n- Әр элемент үшін максимум 1 сөйлем, қысқа және нақты")
		b.WriteString("\n- Барлық 7 бөлім болуы керек")
		b.WriteString("\n\nМАҢЫЗДЫ 4-бөлім үшін (Тұқым қуалаушылық): Егер пациент тұқым қуалаушылық аурулары жоқ деп айтса - тек 'таза' деп жазыңыз. Егер пациент бұл туралы ештеңе айтпаса - 'жоқ' деп жазыңыз.")
	} else {
		b.WriteString("\n**ТРЕБОВАНИЯ К ФОРМАТУ:**")
		b.WriteString("\n- Пишите ТОЛЬКО факты, перечисляйте через запятую или точку с запятой")
		b.WriteString("\n- БЕЗ интерпретаций, БЕЗ фраз типа 'что может свидетельствовать', 'что говорит о'")
		b.WriteString("\n- Максимум 1 предложение на пункт, кратко и конкретно")
		b.WriteString("\n- Все 7 разделов должны присутствовать")
		b.WriteString("\n\nВАЖНО для пункта 4 (Наследственность): Если пациент говорит, что у него нет наследственных заболеваний - пиши просто 'чистая'. Если пациент об этом ничего не говорит - пиши 'отсутствует'.")
	}

	return b.String()
}

// removeOperationsFromText убирает упоминания операций из текста заболеваний
func (c *ContentGenerator) removeOperationsFromText(text string) string {
	// Более точные паттерны для операций (только конкретные упоминания)
	operationPatterns := []string{
		`(?:три|несколько|много)?\s*операции?\s+на\s+челюсть`,
		`операция\s+по\s+поводу\s+грыжи`,
		`аппендэктомия`,
		`аппендицит`,
		`операции?\s+челюсть`,
		`операции?\s+грыжа`,
	}

	result := text
	for _, pattern := range operationPatterns {
		// Убираем фразы с операциями (с контекстом до и после, но более аккуратно)
		re := regexp.MustCompile(`(?i)[^\.]*(?:,|;)?\s*` + pattern + `[^\.]*\.?`)
		result = re.ReplaceAllString(result, "")
	}

	// Убираем множественные пробелы и запятые
	result = regexp.MustCompile(`\s+`).ReplaceAllString(result, " ")
	result = regexp.MustCompile(`,\s*,`).ReplaceAllString(result, ",")
	result = strings.TrimSpace(result)

	return result
}

// extractOperationsFromText извлекает упоминания операций из текста
func (c *ContentGenerator) extractOperationsFromText(text string) string {
	var operations []string

	// Ищем конкретные операции с более точными паттернами
	operationPatterns := []struct {
		pattern string
		result  string
	}{
		{`(?i)три\s+операции?\s+на\s+челюсть`, "Три операции на челюсть"},
		{`(?i)операции?\s+на\s+челюсть`, "операции на челюсть"},
		{`(?i)аппендэктомия`, "аппендэктомия"},
		{`(?i)аппендицит`, "аппендэктомия"},
		{`(?i)операция\s+по\s+поводу\s+грыжи`, "операция по поводу грыжи"},
		{`(?i)операция.*грыжа`, "операция по поводу грыжи"},
		{`(?i)грыжа`, "операция по поводу грыжи"},
	}

	seen := make(map[string]bool)
	for _, op := range operationPatterns {
		re := regexp.MustCompile(op.pattern)
		if re.MatchString(text) {
			// Извлекаем контекст операции
			matches := re.FindAllString(text, -1)
			for _, match := range matches {
				match = strings.TrimSpace(match)
				// Нормализуем
				normalized := c.normalizeOperationsText(match)
				if normalized != "" && !seen[normalized] {
					seen[normalized] = true
					operations = append(operations, normalized)
				}
			}
		}
	}

	if len(operations) > 0 {
		return strings.Join(operations, ", ")
	}

	return ""
}

// normalizeOperationsText нормализует текст операций
func (c *ContentGenerator) normalizeOperationsText(text string) string {
	textLower := strings.ToLower(text)

	// Определяем тип операции и возвращаем нормализованную форму
	if strings.Contains(textLower, "три") && strings.Contains(textLower, "челюсть") {
		return "Три операции на челюсть"
	}
	if strings.Contains(textLower, "челюсть") {
		return "операции на челюсть"
	}
	if strings.Contains(textLower, "аппендэктомия") || strings.Contains(textLower, "аппендицит") {
		return "аппендэктомия"
	}
	if strings.Contains(textLower, "грыжа") {
		return "операция по поводу грыжи"
	}

	// Если не определили - возвращаем как есть, но очищенный
	result := strings.TrimSpace(text)
	result = regexp.MustCompile(`\s+`).ReplaceAllString(result, " ")
	return result
}

// cleanDiseasesText очищает текст заболеваний от лишних фраз
func (c *ContentGenerator) cleanDiseasesText(text string) string {
	// Убираем фразы про отсутствие операций
	text = regexp.MustCompile(`(?i)[^\.]*(?:нет|отсутствуют?|не было).*операций?[^\.]*\.?`).ReplaceAllString(text, "")
	// Убираем фразы про отсутствие госпитализаций, если они не несут смысла
	text = regexp.MustCompile(`(?i)нет.*госпитализаций?.*за последний год`).ReplaceAllString(text, "")
	// Убираем фразы про отсутствие обращений и лечения (не являются заболеваниями)
	text = regexp.MustCompile(`(?i)[^\.]*(?:нет|отсутствуют?|не было).*обращений?.*лечения?[^\.]*\.?`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)[^\.]*(?:нет|отсутствуют?|не было).*лечения?.*обращений?[^\.]*\.?`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)[^\.]*(?:нет|отсутствуют?|не было).*обращений?.*по поводу[^\.]*\.?`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)[^\.]*(?:нет|отсутствуют?|не было).*лечения?.*по поводу[^\.]*\.?`).ReplaceAllString(text, "")
	// Убираем множественные пробелы
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	return text
}

// removeDuplicateOperations убирает дубликаты операций
func (c *ContentGenerator) removeDuplicateOperations(text string) string {
	if text == "" {
		return text
	}

	// Разбиваем по запятым
	parts := strings.Split(text, ",")
	var unique []string
	seen := make(map[string]bool)

	for _, part := range parts {
		part = strings.TrimSpace(part)
		partLower := strings.ToLower(part)
		if part != "" && !seen[partLower] {
			seen[partLower] = true
			unique = append(unique, part)
		}
	}

	return strings.Join(unique, ", ")
}

// simplifyFamilyHistory упрощает текст наследственности
func (c *ContentGenerator) simplifyFamilyHistory(text, absentText string) string {
	textLower := strings.ToLower(text)

	// Сначала проверяем паттерны "чистой" наследственности
	// Это важно, чтобы правильно обработать случаи типа "чистая, ни онкологии, ни туберкулеза"
	cleanPatterns := []string{
		"чистая",
		"не отягощена",
		"не отягощен",
	}

	hasCleanPattern := false
	for _, pattern := range cleanPatterns {
		if strings.Contains(textLower, pattern) {
			hasCleanPattern = true
			break
		}
	}

	// Если есть паттерн "чистая" - возвращаем просто "чистая"
	// Даже если в тексте есть упоминания заболеваний в отрицательном контексте
	if hasCleanPattern {
		return "чистая"
	}

	// Проверяем отрицательные упоминания заболеваний (ни онкологии, ни туберкулеза и т.д.)
	negativePatterns := []string{
		"ни онкологии",
		"ни туберкулёза",
		"ни туберкулеза",
		"нет онкологии",
		"нет туберкулёза",
		"нет туберкулеза",
		"отсутствует онкология",
		"отсутствует туберкулёз",
		"отсутствует туберкулез",
		"не отягощена",
		"не отягощен",
		"не выявлено",
		"не обнаружено",
	}

	hasNegativePattern := false
	for _, pattern := range negativePatterns {
		if strings.Contains(textLower, pattern) {
			hasNegativePattern = true
			break
		}
	}

	// Если есть только отрицательные упоминания заболеваний (нет онкологии, нет туберкулеза)
	// и нет упоминания "чистая", но есть общий паттерн "нет" или "отсутствует" - возвращаем absentText
	otherCleanPatterns := []string{
		"нет",
		"отсутствует",
		"отсутствуют",
	}

	hasOtherCleanPattern := false
	for _, pattern := range otherCleanPatterns {
		if strings.Contains(textLower, pattern) {
			hasOtherCleanPattern = true
			break
		}
	}

	// Если есть отрицательные паттерны или общие паттерны "нет/отсутствует" - упрощаем
	if hasNegativePattern || hasOtherCleanPattern {
		// Если текст содержит только отрицательные упоминания без конкретных заболеваний - возвращаем absentText
		// Но если есть "чистая" - уже обработано выше
		return absentText
	}

	// Проверяем, есть ли реальные заболевания в тексте (только если нет паттернов "чистой" наследственности)
	diseasePatterns := []string{
		"диабет",
		"гипертония",
		"инфаркт",
		"инсульт",
		"рак",
		"онкология",
		"туберкулёз",
		"туберкулез",
		"заболевание",
		"болезнь",
		"патология",
		"гипертензия",
		"ишемия",
	}

	hasDisease := false
	for _, disease := range diseasePatterns {
		// Проверяем, что заболевание упоминается не в отрицательном контексте
		// Ищем паттерн заболевания, но не в сочетании с "ни", "нет", "отсутствует"
		diseaseIndex := strings.Index(textLower, disease)
		if diseaseIndex >= 0 {
			// Проверяем контекст перед словом (не должно быть "ни ", "нет ", "отсутствует ")
			beforeContext := ""
			if diseaseIndex > 0 {
				start := diseaseIndex - 20
				if start < 0 {
					start = 0
				}
				beforeContext = textLower[start:diseaseIndex]
			}
			// Проверяем, что перед заболеванием нет отрицательных слов
			negativeWords := []string{"ни ", "нет ", "отсутствует ", "не "}
			isNegative := false
			for _, negWord := range negativeWords {
				if strings.HasSuffix(beforeContext, negWord) || strings.HasSuffix(beforeContext, negWord[:len(negWord)-1]) {
					isNegative = true
					break
				}
			}
			if !isNegative {
				hasDisease = true
				break
			}
		}
	}

	// Если есть реальные заболевания (не в отрицательном контексте) - возвращаем текст как есть
	if hasDisease {
		return text
	}

	// Если ничего не подошло - возвращаем текст как есть
	return text
}

// contains проверяет, содержит ли слайс строку
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}

func (c *ContentGenerator) buildDoctorRecommendationsPrompt(profile *client.PatientProfile, answers map[string]string, complaints string, medicalHistory string, lang string) string {
	var prompt strings.Builder

	if lang == "en" {
		prompt.WriteString("You are an experienced medical doctor providing professional recommendations based on comprehensive patient data.\n\n")
		prompt.WriteString("Analyze the following complete medical information and provide detailed, evidence-based recommendations.\n\n")
	} else if lang == "kz" {
		prompt.WriteString("Сіз тәжірибелі дәрігерсіз, толық науқас деректері негізінде кәсіби ұсыныстар бересіз.\n\n")
		prompt.WriteString("Келесі толық медициналық ақпаратты талдаңыз және дәлелдемелі ұсыныстар беріңіз.\n\n")
	} else {
		prompt.WriteString("Вы опытный врач, предоставляющий профессиональные рекомендации на основе комплексных данных пациента.\n\n")
		prompt.WriteString("Проанализируйте следующую полную медицинскую информацию и предоставьте детальные, основанные на доказательствах рекомендации.\n\n")
	}

	if profile != nil {
		prompt.WriteString("## ПРОФИЛЬ ПАЦИЕНТА\n")
		prompt.WriteString(fmt.Sprintf("- ФИО: %s %s %s\n", profile.LastName, profile.FirstName, profile.MiddleName))
		prompt.WriteString(fmt.Sprintf("- Дата рождения: %s\n", profile.DateOfBirth))
		prompt.WriteString(fmt.Sprintf("- Пол: %s\n", profile.Gender))
		prompt.WriteString(fmt.Sprintf("- Рост: %d см, Вес: %d кг\n", profile.Height, profile.Weight))
		if len(profile.Diagnoses) > 0 {
			prompt.WriteString(fmt.Sprintf("- Диагнозы: %v\n", profile.Diagnoses))
		}
		if len(profile.Allergens) > 0 {
			prompt.WriteString(fmt.Sprintf("- Аллергены: %v\n", profile.Allergens))
		}
		if len(profile.Diet) > 0 {
			prompt.WriteString(fmt.Sprintf("- Диета: %v\n", profile.Diet))
		}
		prompt.WriteString("\n")
	}

	if strings.TrimSpace(complaints) != "" {
		prompt.WriteString("## ТЕКУЩИЕ ЖАЛОБЫ\n")
		prompt.WriteString(complaints + "\n\n")
	}

	if strings.TrimSpace(medicalHistory) != "" {
		prompt.WriteString("## МЕДИЦИНСКИЙ АНАМНЕЗ\n")
		prompt.WriteString(medicalHistory + "\n\n")
	}

	if lang == "en" {
		prompt.WriteString("## STRUCTURE OF MEDICAL RECOMMENDATIONS\n\n")
		prompt.WriteString("### IMMEDIATE DIAGNOSTIC RECOMMENDATIONS\n")
		prompt.WriteString("- Recommend imaging studies if necessary (e.g., X-ray, ultrasound, CT, MRI)\n")
		prompt.WriteString("- Suggest laboratory tests based on symptoms and medical history\n")
		prompt.WriteString("- Recommend specialized consultations if needed\n\n")
	} else {
		prompt.WriteString("## СТРУКТУРА МЕДИЦИНСКИХ РЕКОМЕНДАЦИЙ\n\n")
		prompt.WriteString("### НЕМЕДЛЕННЫЕ ДИАГНОСТИЧЕСКИЕ РЕКОМЕНДАЦИИ\n")
		prompt.WriteString("- Рекомендуйте визуализационные исследования при необходимости (например, рентген, УЗИ, КТ, МРТ)\n")
		prompt.WriteString("- Предложите лабораторные тесты на основе симптомов и медицинской истории\n")
		prompt.WriteString("- Рекомендуйте специализированные консультации при необходимости\n\n")
	}

	prompt.WriteString("**ВАЖНО**: Основывайте все рекомендации на современных медицинских доказательствах и руководствах. Учитывайте конкретные обстоятельства пациента, возраст, пол и медицинскую историю.")

	return prompt.String()
}
