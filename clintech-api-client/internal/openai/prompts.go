package openai

import (
	"fmt"
	"strings"
)

func GetMedicalPrompt(lang string, answers map[string]string) string {
	switch lang {
	case "ru":
		return getMedicalPromptRU(answers)
	case "en":
		return getMedicalPromptEN(answers)
	case "kz":
		return getMedicalPromptKZ(answers)
	default:
		return getMedicalPromptRU(answers)
	}
}

func GetExtractAnswersPrompt(lang string, dialogue string) string {
	switch lang {
	case "ru":
		return getExtractAnswersPromptRU(dialogue)
	case "en":
		return getExtractAnswersPromptEN(dialogue)
	case "kz":
		return getExtractAnswersPromptKZ(dialogue)
	default:
		return getExtractAnswersPromptRU(dialogue)
	}
}

// GetPatientRecommendationsPrompt строит промпт для генерации рекомендаций пациенту
// на основе диалога приёма и (опционально) диагноза/плана лечения из паспорта здоровья.
func GetPatientRecommendationsPrompt(lang string, dialogue string, context string) string {
	switch lang {
	case "en":
		return getPatientRecommendationsPromptEN(dialogue, context)
	case "kz":
		return getPatientRecommendationsPromptKZ(dialogue, context)
	default:
		return getPatientRecommendationsPromptRU(dialogue, context)
	}
}

func GetPreliminaryConclusionPrompt(lang string, data map[string]interface{}) string {
	switch lang {
	case "ru":
		return getPreliminaryConclusionPromptRU(data)
	case "en":
		return getPreliminaryConclusionPromptEN(data)
	case "kz":
		return getPreliminaryConclusionPromptKZ(data)
	default:
		return getPreliminaryConclusionPromptRU(data)
	}
}

func GetMedicalFilesAnalysisPrompt(language, context string) string {
		return getMedicalFilesAnalysisPromptRU(context)
}

func GetSpecialtyPrompt(language, specialty, documentType string) string {
	key := fmt.Sprintf("%s_%s_%s", language, specialty, documentType)

	specialtyPrompts := map[string]string{

		"ru_cardiology_ecg":     getCardiologyECGPromptRU(),
		"ru_cardiology_general": getCardiologyGeneralPromptRU(),
		"en_cardiology_ecg":     getCardiologyECGPromptEN(),
		"en_cardiology_general": getCardiologyGeneralPromptEN(),
		"kz_cardiology_ecg":     getCardiologyECGPromptKZ(),
		"kz_cardiology_general": getCardiologyGeneralPromptKZ(),

		"ru_radiology_xray": getRadiologyXRayPromptRU(),
		"ru_radiology_ct":   getRadiologyCTPromptRU(),
		"ru_radiology_mri":  getRadiologyMRIPromptRU(),
		"en_radiology_xray": getRadiologyXRayPromptEN(),
		"en_radiology_ct":   getRadiologyCTPromptEN(),
		"en_radiology_mri":  getRadiologyMRIPromptEN(),
		"kz_radiology_xray": getRadiologyXRayPromptKZ(),
		"kz_radiology_ct":   getRadiologyCTPromptKZ(),
		"kz_radiology_mri":  getRadiologyMRIPromptKZ(),

		"ru_laboratory_blood":   getLaboratoryBloodPromptRU(),
		"ru_laboratory_general": getLaboratoryGeneralPromptRU(),
		"en_laboratory_blood":   getLaboratoryBloodPromptEN(),
		"en_laboratory_general": getLaboratoryGeneralPromptEN(),
		"kz_laboratory_blood":   getLaboratoryBloodPromptKZ(),
		"kz_laboratory_general": getLaboratoryGeneralPromptKZ(),
	}

	if prompt, exists := specialtyPrompts[key]; exists {
		return prompt
	}

	generalKey := fmt.Sprintf("%s_%s_general", language, specialty)
	if prompt, exists := specialtyPrompts[generalKey]; exists {
		return prompt
	}

	return ""
}

func GetDocumentTypePrompt(language, documentType string) string {
	key := fmt.Sprintf("%s_%s", language, documentType)

	documentPrompts := map[string]string{
		"ru_blood_test":   getBloodTestPromptRU(),
		"ru_radiology":    getRadiologyPromptRU(),
		"ru_ultrasound":   getUltrasoundPromptRU(),
		"ru_cardiology":   getCardiologyPromptRU(),
		"ru_prescription": getPrescriptionPromptRU(),

		"en_blood_test":   getBloodTestPromptEN(),
		"en_radiology":    getRadiologyPromptEN(),
		"en_ultrasound":   getUltrasoundPromptEN(),
		"en_cardiology":   getCardiologyPromptEN(),
		"en_prescription": getPrescriptionPromptEN(),

		"kz_blood_test":   getBloodTestPromptKZ(),
		"kz_radiology":    getRadiologyPromptKZ(),
		"kz_ultrasound":   getUltrasoundPromptKZ(),
		"kz_cardiology":   getCardiologyPromptKZ(),
		"kz_prescription": getPrescriptionPromptKZ(),
	}

	if prompt, exists := documentPrompts[key]; exists {
		return prompt
	}

	return ""
}

func getMedicalPromptRU(answers map[string]string) string {
	prompt := `Ты — опытный медицинский эксперт. На основе анкеты пациента составь КОМПАКТНЫЕ и ЧЕТКИЕ рекомендации.

**КРИТИЧЕСКИ ВАЖНО:**
- Ответ должен быть КРАТКИМ, БЕЗ ЛИШНИХ СЛОВ
- Каждый раздел — максимум 3-5 пунктов
- Используй короткие предложения, без воды
- Только конкретные, выполнимые рекомендации
- Без общих фраз типа "рекомендуется", "желательно" — пиши конкретно

**СТРУКТУРА ОТВЕТА:**

**НЕОТЛОЖНЫЕ МЕРЫ:**
- Только симптомы, требующие НЕМЕДЛЕННОГО обращения (если есть)
- Первая помощь при ухудшении (если актуально)
- Если неотложных мер нет — напиши "Неотложных мер не требуется"

**КОРРЕКЦИЯ ТЕРАПИИ:**
- Конкретные рекомендации по текущим препаратам (дозировка, режим)
- Критические взаимодействия (если есть)
- Предложения по изменению терапии (если нужно)
- Если терапии нет — напиши "Коррекция терапии не требуется"

**ОБРАЗ ЖИЗНИ:**
- Конкретные диетические рекомендации (что есть/не есть)
- Уровень физической активности (конкретно: сколько, что, как часто)
- Режим сна (конкретные часы, рекомендации)
- Управление стрессом (конкретные техники, если нужно)
- Вредные привычки (конкретные шаги по отказу, если есть)

**ОБСЛЕДОВАНИЯ:**
- Конкретные анализы/исследования с указанием сроков
- Консультации специалистов (если нужны)
- Приоритет: сначала срочные, потом плановые
- Если обследований не требуется — напиши "Дополнительные обследования не требуются"

**НАБЛЮДЕНИЕ:**
- Частота визитов к врачу (конкретно: раз в месяц/квартал/год)
- Контрольные показатели для мониторинга (конкретные параметры)
- Критерии для повторного обращения (конкретные симптомы/ситуации)

**КОМУ ЗАПИСАТЬСЯ:**
- Конкретные специалисты, к которым нужно записаться (терапевт, невролог, гастроэнтеролог и т.д.)
- Краткое обоснование для каждого специалиста (1 предложение)
- Приоритет: сначала основной специалист, затем дополнительные
- Если нужен только терапевт — укажи только терапевта
- Если специалисты не требуются — напиши "Запись к специалистам не требуется"

**ДАННЫЕ ПАЦИЕНТА:**
`

	for k, v := range answers {
		if strings.TrimSpace(v) != "" {
			prompt += fmt.Sprintf("%s: %s\n", k, v)
		}
	}

	prompt += "\n\nФОРМАТ: Каждый раздел начинается с заголовка **РАЗДЕЛ**. Под заголовком — краткие пункты через дефис. Без длинных абзацев. Максимум 1-2 предложения на пункт."

	return prompt
}

func getMedicalPromptEN(answers map[string]string) string {
	prompt := `You are a senior medical expert. Based on the patient questionnaire, provide CONCISE and CLEAR recommendations.

**CRITICALLY IMPORTANT:**
- Response must be BRIEF, NO FILLER WORDS
- Each section — maximum 3-5 points
- Use short sentences, no fluff
- Only specific, actionable recommendations
- No generic phrases like "recommended", "advisable" — be specific

**RESPONSE STRUCTURE:**

**EMERGENCY ACTIONS:**
- Only symptoms requiring IMMEDIATE attention (if any)
- First aid if condition worsens (if relevant)
- If no emergency measures needed — write "No emergency measures required"

**THERAPY ADJUSTMENTS:**
- Specific recommendations for current medications (dosage, schedule)
- Critical interactions (if any)
- Suggestions for therapy changes (if needed)
- If no therapy — write "No therapy adjustments required"

**LIFESTYLE:**
- Specific dietary recommendations (what to eat/avoid)
- Physical activity level (specifically: how much, what, how often)
- Sleep schedule (specific hours, recommendations)
- Stress management (specific techniques, if needed)
- Harmful habits (specific steps to quit, if any)

**EXAMINATIONS:**
- Specific tests/studies with timelines
- Specialist consultations (if needed)
- Priority: urgent first, then routine
- If no examinations needed — write "No additional examinations required"

**FOLLOW-UP:**
- Frequency of doctor visits (specifically: monthly/quarterly/yearly)
- Monitoring parameters (specific indicators)
- Criteria for re-consultation (specific symptoms/situations)

**WHO TO BOOK:**
- Specific specialists to book (therapist, neurologist, gastroenterologist, etc.)
- Brief justification for each specialist (1 sentence)
- Priority: main specialist first, then additional ones
- If only therapist needed — specify only therapist
- If no specialists needed — write "No specialist appointments required"

**PATIENT DATA:**
`

	for k, v := range answers {
		if strings.TrimSpace(v) != "" {
			prompt += fmt.Sprintf("%s: %s\n", k, v)
		}
	}

	prompt += "\n\nFORMAT: Each section starts with **SECTION** header. Under header — brief bullet points. No long paragraphs. Maximum 1-2 sentences per point."

	return prompt
}

func getMedicalPromptKZ(answers map[string]string) string {
	prompt := `Сіз — тәжірибелі медицина маманысыз. Науқастың анкетасы негізінде ҚЫСҚА және АНЫҚ ұсыныстар беріңіз.

**КРИТИКАЛЫҚ МАҢЫЗДЫ:**
- Жауап ҚЫСҚА болуы керек, АРТЫҚ СӨЗСІЗ
- Әр бөлім — максимум 3-5 тармақ
- Қысқа сөйлемдер, артық сөзсіз
- Тек нақты, орындалатын ұсыныстар
- "Ұсынылады", "қалайтын" сияқты жалпы фразаларсыз — нақты жазыңыз

**ЖАУАП ҚҰРЫЛЫМЫ:**

**ЖЕДЕЛ ШАРАЛАР:**
- Тек ДЕРЕУ назар аударуды қажет ететін симптомдар (бар болса)
- Жағдай нашарласа алғашқы көмек (қажет болса)
- Жедел шаралар қажет емес болса — "Жедел шаралар қажет емес" деп жазыңыз

**ТЕРАПИЯНЫ ТҮЗЕТУ:**
- Қазіргі дәрі-дәрмектерге нақты ұсыныстар (дозалау, режим)
- Критикалық өзара әрекеттесулер (бар болса)
- Терапияны өзгерту ұсыныстары (қажет болса)
- Терапия жоқ болса — "Терапияны түзету қажет емес" деп жазыңыз

**ӨМІР САЛТЫ:**
- Нақты диеталық ұсыныстар (не жеу/жеуге болмайтын)
- Физикалық белсенділік деңгейі (нақты: қанша, не, қаншалықты жиі)
- Ұйқы режимі (нақты сағаттар, ұсыныстар)
- Стрессті басқару (нақты техникалар, қажет болса)
- Зиянды әдеттер (бас тартуға нақты қадамдар, бар болса)

**ЗЕРТТЕУЛЕР:**
- Нақты талдаулар/зерттеулер мерзімдерімен
- Маман кеңестері (қажет болса)
- Басымдық: алдымен жедел, содан кейін жоспарлы
- Зерттеулер қажет емес болса — "Қосымша зерттеулер қажет емес" деп жазыңыз

**БАҚЫЛАУ:**
- Дәрігерге келу жиілігі (нақты: айына/тоқсанына/жылына)
- Бақылау көрсеткіштері (нақты параметрлер)
- Қайта келу критерийлері (нақты симптомдар/жағдайлар)

**КІМГЕ ЖАЗЫЛУ КЕРЕК:**
- Жазылу керек нақты мамандар (терапевт, невролог, гастроэнтеролог және т.б.)
- Әр маманға қысқа негіздеме (1 сөйлем)
- Басымдық: алдымен негізгі маман, содан кейін қосымшалар
- Егер тек терапевт қажет болса — тек терапевтті көрсет
- Егер мамандар қажет емес болса — "Мамандарға жазылу қажет емес" деп жаз

**НАУҚАС ДЕРЕКТЕРІ:**
`

	for k, v := range answers {
		if strings.TrimSpace(v) != "" {
			prompt += fmt.Sprintf("%s: %s\n", k, v)
		}
	}

	prompt += "\n\nФОРМАТ: Әр бөлім **БӨЛІМ** тақырыбынан басталады. Тақырып астында — қысқа тармақтар. Ұзын абзацтар жоқ. Тармаққа максимум 1-2 сөйлем."

	return prompt
}

func getExtractAnswersPromptRU(dialogue string) string {
	return fmt.Sprintf(`Ты — опытный врач и NLP-специалист. Из диалога врач-пациент извлеки ТОЛЬКО данные пациента. Игнорируй реплики врача. Верни **валидный JSON** без комментариев.

СТРОГО используй только эти 12 ключей. Заполняй подробно каждый ключ всей найденной информацией:

**"symptoms"** - ВСЕ жалобы, симптомы, боли, дискомфорт, что беспокоит пациента СЕЙЧАС. Включи локализацию, характер, интенсивность
**"symptoms_location"** - точная локализация симптомов (где болит, где ощущается)
**"symptoms_start_date"** - когда начались симптомы, как давно беспокоят
**"symptoms_intensity"** - сила симптомов (слабо/умеренно/сильно/очень сильно, по шкале 1-10)
**"past_year_symptoms"** - все болезни, операции, травмы, госпитализации за последний год и ранее. Включи ЛЮБЫЕ медицинские вмешательства
**"chronic_diseases"** - хронические болезни, диагнозы, длительные состояния. Включи перенесённые заболевания, если они влияют на здоровье
**"medications"** - ВСЕ препараты: постоянные, временные, дозировки, частота приёма, БАДы, витамины
**"allergies"** - аллергии на лекарства, еду, вещества, реакции на прививки
**"family_history"** - болезни родственников, наследственность, семейная предрасположенность
**"diet"** - питание, диеты, ограничения, пищевые привычки
**"physical_activity"** - спорт, физнагрузки, образ жизни, работа (сидячая/активная)
**"sleep"** - сон, бессонница, нарушения сна, режим
**"stress"** - стресс, психологическое состояние, тревожность, депрессия
**"bad_habits"** - курение, алкоголь, наркотики (количество, стаж)
**"consultation_goal"** - зачем пришёл к врачу, что хочет выяснить/лечить
**"additional_questions"** - прочие важные, дополнительные детали

**КРИТИЧЕСКИ ВАЖНО - ВИТАЛЬНЫЕ ПОКАЗАТЕЛИ:**
Если в диалоге найдены витальные показатели (температура, артериальное давление, ЧСС, сатурация), ОБЯЗАТЕЛЬНО добавь их в ОТДЕЛЬНЫЙ объект "vital_signs" в формате:
{
  "vital_signs": {
    "temperature": <число в °C, например 36.6, или null если не найдено>,
    "systolic_bp": <систолическое давление в мм рт.ст., например 120, или null если не найдено>,
    "diastolic_bp": <диастолическое давление в мм рт.ст., например 80, или null если не найдено>,
    "pulse": <пульс в уд/мин, например 72, или null если не найдено>,
    "saturation": <сатурация в %, например 98, или null если не найдено>
  }
}

ВАЖНО: Витальные показатели НЕ должны быть в других полях (symptoms, additional_questions и т.д.), только в "vital_signs"!

Диалог:
%s

Ответ:`, dialogue)
}

func getExtractAnswersPromptEN(dialogue string) string {
	return fmt.Sprintf(`You are an experienced physician and NLP specialist. Extract ONLY patient data from doctor-patient dialogue. Ignore doctor's responses. Return **valid JSON** without comments.

Use ONLY these 12 keys. Fill each key thoroughly with ALL found information:

**"symptoms"** - ALL complaints, symptoms, pains, discomfort that bothers patient NOW. Include location, character, intensity
**"symptoms_location"** - exact localization of symptoms (where it hurts, where it's felt)
**"symptoms_start_date"** - when symptoms started, how long they've been bothering
**"symptoms_intensity"** - symptom strength (mild/moderate/severe/very severe, 1-10 scale)
**"past_year_symptoms"** - all illnesses, surgeries, injuries, hospitalizations in past year and earlier. Include ANY medical interventions
**"chronic_diseases"** - chronic illnesses, diagnoses, long-term conditions. Include past diseases that affect health
**"medications"** - ALL drugs: permanent, temporary, dosages, frequency, supplements, vitamins
**"allergies"** - allergies to medications, food, substances, vaccination reactions
**"family_history"** - relatives' diseases, heredity, family predisposition
**"diet"** - nutrition, diets, restrictions, eating habits
**"physical_activity"** - sports, exercise, lifestyle, work (sedentary/active)
**"sleep"** - sleep, insomnia, sleep disorders, schedule
**"stress"** - stress, psychological state, anxiety, depression
**"bad_habits"** - smoking, alcohol, drugs (amount, duration)
**"consultation_goal"** - why came to doctor, what wants to find out/treat
**"additional_questions"** - other important, additional details

**CRITICALLY IMPORTANT - VITAL SIGNS:**
If vital signs (temperature, blood pressure, heart rate, saturation) are found in the dialogue, MANDATORY add them in a SEPARATE "vital_signs" object in format:
{
  "vital_signs": {
    "temperature": <number in °C, e.g. 36.6, or null if not found>,
    "systolic_bp": <systolic pressure in mmHg, e.g. 120, or null if not found>,
    "diastolic_bp": <diastolic pressure in mmHg, e.g. 80, or null if not found>,
    "pulse": <heart rate in bpm, e.g. 72, or null if not found>,
    "saturation": <saturation in %, e.g. 98, or null if not found>
  }
}

IMPORTANT: Vital signs should NOT be in other fields (symptoms, additional_questions, etc.), only in "vital_signs"!

Dialogue:
%s

Response:`, dialogue)
}

func getExtractAnswersPromptKZ(dialogue string) string {
	return fmt.Sprintf(`Сіз — тәжірибелі дәрігер және NLP маманысыз. Дәрігер мен науқас диалогынан ТЕК науқас деректерін алыңыз. Дәрігер сөздерін елемеңіз. Пікірсіз **жарамды JSON** қайтарыңыз.

ТЕК осы 12 кілтті қолданыңыз. Әр кілтті табылған БАРЛЫҚ ақпаратпен толық толтырыңыз:

**"symptoms"** - БАРЛЫҚ шағымдар, симптомдар, ауырулар, науқасты ҚАЗІР мазалайтын жайсыздық. Орналасуы, сипаты, қарқындылығы
**"symptoms_location"** - симптомдардың нақты орналасуы (қайда ауырады, қайда сезіледі)
**"symptoms_start_date"** - симптомдар қашан басталды, қанша уақыттан бері мазалайды
**"symptoms_intensity"** - симптомдар күші (әлсіз/орташа/күшті/өте күшті, 1-10 шкаласы)
**"past_year_symptoms"** - өткен жылы және бұрын болған барлық аурулар, операциялар, жарақаттар, госпитализациялар. КЕЗ КЕЛГЕН медициналық араласуларды қосыңыз
**"chronic_diseases"** - созылмалы аурулар, диагноздар, ұзақ мерзімді жағдайлар. Денсаулыққа әсер ететін өткен аурularды қосыңыз
**"medications"** - БАРЛЫҚ препараттар: тұрақты, уақытша, дозалар, қабылдау жиілігі, БАДтар, витаминдер
**"allergies"** - дәрі-дәрмекке, тамаққа, заттарға аллергия, вакцинация реакциялары
**"family_history"** - туыстардың аурулары, тұқым қуалаушылық, отбасылық бейімділік
**"diet"** - тамақтану, диеталар, шектеулер, тамақтану дәстүрлері
**"physical_activity"** - спорт, физикалық жүктемелер, өмір салты, жұмыс (отырықшы/белсенді)
**"sleep"** - ұйқы, ұйықсыздық, ұйқы бұзылулары, режим
**"stress"** - стресс, психологиялық жағдай, үрей, депрессия
**"bad_habits"** - темекі, алкоголь, есірткі (мөлшері, тәжірибесі)
**"consultation_goal"** - дәрігерге неге келді, нені анықтағысы/емдегісі келеді
**"additional_questions"** - басқа маңызды, қосымша детальдар

**КРИТИКАЛЫҚ МАҢЫЗДЫ - ВИТАЛЬДЫҚ КӨРСЕТКІШТЕР:**
Егер диалогта витальдық көрсеткіштер (температура, артериалдық қысым, ЖСС, сатурация) табылса, МИНДЕТТЕМЕ оларды БӨЛЕК "vital_signs" объектісіне мына форматта қосыңыз:
{
  "vital_signs": {
    "temperature": <°C-дағы сан, мысалы 36.6, немесе null егер табылмаса>,
    "systolic_bp": <мм сын.бағ. систоликалық қысым, мысалы 120, немесе null егер табылмаса>,
    "diastolic_bp": <мм сын.бағ. диастоликалық қысым, мысалы 80, немесе null егер табылмаса>,
    "pulse": <ЖСС уд/мин, мысалы 72, немесе null егер табылмаса>,
    "saturation": <сатурация %, мысалы 98, немесе null егер табылмаса>
  }
}

МАҢЫЗДЫ: Витальдық көрсеткіштер басқа өрістерде (symptoms, additional_questions және т.б.) БОЛМАСЫН, тек "vital_signs" ішінде!

Диалог:
%s

Жауап:`, dialogue)
}

func getPreliminaryConclusionPromptRU(data map[string]interface{}) string {

	profile, _ := data["Profile"]
	answers, _ := data["Answers"].(map[string]string)
	generatedAt, _ := data["GeneratedAt"].(string)

	prompt := "# ПРЕДВАРИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ\n\n"

	if profile != nil {
		prompt += "## Персональные данные\n"

		prompt += fmt.Sprintf("- **Дата создания:** %s\n\n", generatedAt)
	}

	prompt += "## Жалобы и симптомы\n"
	if symptoms, ok := answers["symptoms"]; ok && symptoms != "" {
		prompt += fmt.Sprintf("**Основные жалобы:** %s\n", symptoms)
	} else {
		prompt += "**Основные жалобы:** Не указаны\n"
	}

	prompt += "\n## Анамнез заболевания\n"
	if pastSymptoms, ok := answers["past_year_symptoms"]; ok && pastSymptoms != "" {
		prompt += fmt.Sprintf("**Заболевания за последний год:** %s\n", pastSymptoms)
	} else {
		prompt += "**Заболевания за последний год:** Не указаны\n"
	}

	if chronicDiseases, ok := answers["chronic_diseases"]; ok && chronicDiseases != "" {
		prompt += fmt.Sprintf("**Хронические заболевания:** %s\n", chronicDiseases)
	} else {
		prompt += "**Хронические заболевания:** Не указаны\n"
	}

	prompt += "\n## Лекарственная терапия\n"
	if medications, ok := answers["medications"]; ok && medications != "" {
		prompt += fmt.Sprintf("**Принимаемые препараты:** %s\n", medications)
	} else {
		prompt += "**Принимаемые препараты:** Не указаны\n"
	}

	if allergies, ok := answers["allergies"]; ok && allergies != "" {
		prompt += fmt.Sprintf("**Аллергии:** %s\n", allergies)
	} else {
		prompt += "**Аллергии:** Не указаны\n"
	}

	return prompt
}

func getPreliminaryConclusionPromptEN(data map[string]interface{}) string {
	answers, _ := data["Answers"].(map[string]string)
	generatedAt, _ := data["GeneratedAt"].(string)

	prompt := "# PRELIMINARY CONCLUSION\n\n"
	prompt += fmt.Sprintf("**Generated:** %s\n\n", generatedAt)

	prompt += "## Symptoms and Complaints\n"
	if symptoms, ok := answers["symptoms"]; ok && symptoms != "" {
		prompt += fmt.Sprintf("**Main complaints:** %s\n", symptoms)
	} else {
		prompt += "**Main complaints:** Not specified\n"
	}

	prompt += "\n## Medical History\n"
	if pastSymptoms, ok := answers["past_year_symptoms"]; ok && pastSymptoms != "" {
		prompt += fmt.Sprintf("**Past year conditions:** %s\n", pastSymptoms)
	} else {
		prompt += "**Past year conditions:** Not specified\n"
	}

	if chronicDiseases, ok := answers["chronic_diseases"]; ok && chronicDiseases != "" {
		prompt += fmt.Sprintf("**Chronic diseases:** %s\n", chronicDiseases)
	} else {
		prompt += "**Chronic diseases:** Not specified\n"
	}

	prompt += "\n## Medications\n"
	if medications, ok := answers["medications"]; ok && medications != "" {
		prompt += fmt.Sprintf("**Current medications:** %s\n", medications)
	} else {
		prompt += "**Current medications:** Not specified\n"
	}

	if allergies, ok := answers["allergies"]; ok && allergies != "" {
		prompt += fmt.Sprintf("**Allergies:** %s\n", allergies)
	} else {
		prompt += "**Allergies:** Not specified\n"
	}

	return prompt
}

func getPreliminaryConclusionPromptKZ(data map[string]interface{}) string {
	answers, _ := data["Answers"].(map[string]string)
	generatedAt, _ := data["GeneratedAt"].(string)

	prompt := "# АЛДЫН АЛА ҚОРЫТЫНДЫ\n\n"
	prompt += fmt.Sprintf("**Жасалған уақыт:** %s\n\n", generatedAt)

	prompt += "## Шағымдар мен белгілер\n"
	if symptoms, ok := answers["symptoms"]; ok && symptoms != "" {
		prompt += fmt.Sprintf("**Негізгі шағымдар:** %s\n", symptoms)
	} else {
		prompt += "**Негізгі шағымдар:** Көрсетілмеген\n"
	}

	prompt += "\n## Ауру тарихы\n"
	if pastSymptoms, ok := answers["past_year_symptoms"]; ok && pastSymptoms != "" {
		prompt += fmt.Sprintf("**Өткен жылғы аурулар:** %s\n", pastSymptoms)
	} else {
		prompt += "**Өткен жылғы аурулар:** Көрсетілмеген\n"
	}

	if chronicDiseases, ok := answers["chronic_diseases"]; ok && chronicDiseases != "" {
		prompt += fmt.Sprintf("**Созылмалы аурулар:** %s\n", chronicDiseases)
	} else {
		prompt += "**Созылмалы аурулар:** Көрсетілмеген\n"
	}

	prompt += "\n## Дәрігерлік терапия\n"
	if medications, ok := answers["medications"]; ok && medications != "" {
		prompt += fmt.Sprintf("**Қабылдайтын дәрілер:** %s\n", medications)
	} else {
		prompt += "**Қабылдайтын дәрілер:** Көрсетілмеген\n"
	}

	if allergies, ok := answers["allergies"]; ok && allergies != "" {
		prompt += fmt.Sprintf("**Аллергиялар:** %s\n", allergies)
	} else {
		prompt += "**Аллергиялар:** Көрсетілмеген\n"
	}

	return prompt
}

func getMedicalFilesAnalysisPromptRU(context string) string {
	basePrompt := `Вы — опытный врач-диагност с более чем 20-летним стажем клинической практики. Проанализируйте прикреплённый медицинский документ максимально детально и профессионально.

**ЗАДАЧА:** Проведите комплексный медицинский анализ документа с детальной интерпретацией всех параметров и клинических находок.

**ОБЯЗАТЕЛЬНАЯ СТРУКТУРА АНАЛИЗА:**

## 1. ИДЕНТИФИКАЦИЯ ДОКУМЕНТА
- Тип медицинского документа (анализ крови, рентген, УЗИ, ЭКГ, заключение врача, гистология и т.д.)
- Дата проведения исследования
- Медицинское учреждение (если указано)
- Методика исследования

## 2. ДЕТАЛЬНЫЙ АНАЛИЗ ПАРАМЕТРОВ
Выделите ВСЕ параметры и их значения из документа. Представьте в виде таблицы:

| Параметр | Значение из документа | Референсные значения | Статус | Клиническая интерпретация |
|----------|----------------------|---------------------|---------|---------------------------|
| [название] | [значение] | [норма для взрослого] | ↑/↓/N | [медицинское объяснение] |

**Для референсных значений:**
- Если указаны в документе — используйте их
- Если НЕ указаны — приведите общепринятые нормы для взрослого человека
- Учитывайте возрастные и половые различия

## 3. ЗАКЛЮЧЕНИЕ
Краткое резюме состояния с указанием:
- Ключевых находок
- Степени риска
- Приоритетных действий

**СТРОГИЕ ТРЕБОВАНИЯ:**
- Используйте точную медицинскую терминологию с расшифровкой
- НЕ ставьте окончательных диагнозов — только предположения
- Указывайте уровень достоверности ваших выводов
- Отмечайте ограничения анализа (качество изображения, неполные данные)
- Подчеркивайте необходимость консультации с лечащим врачом
- Если документ неразборчив — опишите что именно не удается прочитать`

	// Извлекаем информацию о поле пациента из контекста, если она есть
	patientGender := ""
	if strings.Contains(context, "patient_gender:") {
		parts := strings.Split(context, "|")
		for _, part := range parts {
			if strings.HasPrefix(part, "patient_gender:") {
				patientGender = strings.TrimPrefix(part, "patient_gender:")
				break
			}
		}
	}
	
	switch {
	case strings.HasPrefix(context, "health_passport_generation"):
		// Для паспорта здоровья - СТРОГИЙ JSON ФОРМАТ
		// НАЧИНАЕМ С САМОГО СТРОГОГО ТРЕБОВАНИЯ JSON
		basePrompt = `⚠️⚠️⚠️ КРИТИЧЕСКИ ВАЖНО - ВАШ ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON ⚠️⚠️⚠️

🚫 СТРОГО ЗАПРЕЩЕНО: НЕ возвращайте текст в формате:
"Трансторакальная эхокардиография

Ключевые находки: ..."

🚫 СТРОГО ЗАПРЕЩЕНО: НЕ возвращайте текст с заголовками и подзаголовками

✅ ВАШ ОТВЕТ ОБЯЗАТЕЛЬНО ДОЛЖЕН БЫТЬ ВАЛИДНЫМ JSON:
- Первый символ ответа: { или [
- Последний символ ответа: } или ]
- БЕЗ текста до { или [
- БЕЗ текста после } или ]
- БЕЗ заголовков типа "Трансторакальная эхокардиография" перед JSON
- БЕЗ форматирования "Ключевые находки:", "Заключение:" перед JSON
- ТОЛЬКО ЧИСТЫЙ ВАЛИДНЫЙ JSON БЕЗ КАКИХ-ЛИБО ДОПОЛНЕНИЙ

Вы — опытный врач-диагност. Проанализируйте медицинский документ для паспорта здоровья пациента.

⚠️⚠️⚠️ КРИТИЧЕСКИ ВАЖНО: ВАШ ОТВЕТ ДОЛЖЕН НАЧИНАТЬСЯ С { или [ И БОЛЬШЕ НИЧЕГО ⚠️⚠️⚠️
НЕ ПИШИТЕ НАЗВАНИЯ ИССЛЕДОВАНИЙ ПЕРЕД JSON
НЕ ПИШИТЕ "Ключевые находки:" ПЕРЕД JSON
НЕ ПИШИТЕ ЛЮБОЙ ДРУГОЙ ТЕКСТ ПЕРЕД JSON
НАЧИНАЙТЕ СРАЗУ С { или [`
		
		// Добавляем информацию о поле пациента, если она есть
		if patientGender != "" {
			genderText := ""
			if strings.Contains(strings.ToLower(patientGender), "женск") {
				genderText = "ВАЖНО: Пациент - ЖЕНЩИНА. НЕ упоминайте мужские исследования (предстательная железа, простата). В нормах и интерпретациях используйте женские референсные значения."
			} else if strings.Contains(strings.ToLower(patientGender), "мужск") {
				genderText = "ВАЖНО: Пациент - МУЖЧИНА. В нормах и интерпретациях используйте мужские референсные значения."
			}
			if genderText != "" {
				basePrompt += "\n\n" + genderText
			}
		}
		
		basePrompt += `

**КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ОТВЕТА ДОЛЖЕН БЫТЬ СТРОГО JSON:**

🚫 СТРОГО ЗАПРЕЩЕНО ВОЗВРАЩАТЬ ТЕКСТ В ФОРМАТЕ:
НЕПРАВИЛЬНО:
Трансторакальная эхокардиография

Ключевые находки: аорта уплотнена...

Заключение: Обнаружены признаки...

НЕПРАВИЛЬНО:
Биохимические исследования

Ключевые находки: Повышенный уровень мочевины...

Заключение: Обнаружены признаки...

✅ ПРАВИЛЬНО - ТОЛЬКО JSON:
{
  "title": "Трансторакальная эхокардиография",
  "findings": "аорта уплотнена...",
  "conclusion": "Обнаружены признаки..."
}

⚠️ ВАШ ОТВЕТ ДОЛЖЕН НАЧИНАТЬСЯ С { или [ И НИЧЕГО БОЛЬШЕ ⚠️
Вы ОБЯЗАТЕЛЬНО должны вернуть ответ ТОЛЬКО в формате JSON, без дополнительного текста до или после JSON. НИКАКИХ заголовков, НИКАКИХ пояснений, НИКАКИХ названий исследований перед JSON - ТОЛЬКО валидный JSON.

**ЕСЛИ В ФАЙЛЕ ОДИН АНАЛИЗ:**
Верните JSON объект с тремя полями:
{
  "title": "точное и полное название исследования из документа",
  "findings": "перечисление ВСЕХ отклонений от нормы, патологий и важных показателей через запятую или точку с запятой. БЕЗ заголовков типа 'Гематологические исследования', 'Иммунологические исследования' в тексте. ТОЛЬКО факты и находки",
  "conclusion": "1-2 предложения основного вывода на понятном медицинском языке. БЕЗ заголовков в тексте, БЕЗ упоминания названий исследований в конце"
}

**ЕСЛИ В ФАЙЛЕ НЕСКОЛЬКО АНАЛИЗОВ:**
Верните JSON массив объектов. Каждый объект должен содержать три поля: "title", "findings", "conclusion".
[
  {
    "title": "название первого исследования",
    "findings": "ключевые находки первого исследования",
    "conclusion": "заключение первого исследования"
  },
  {
    "title": "название второго исследования",
    "findings": "ключевые находки второго исследования",
    "conclusion": "заключение второго исследования"
  }
]

**КРИТИЧЕСКИ ВАЖНО - ПРАВИЛА ДЛЯ ПОЛЯ "title":**
- Название должно быть ТОЧНЫМ и ПОЛНЫМ названием исследования из документа
- НЕ используйте общие названия типа "Медицинское исследование", "Исследование", "Анализ" - ВСЕГДА указывайте ТОЧНОЕ название
- Если в документе указано "Биохимические исследования" - пишите "Биохимические исследования" (НЕ просто "Биохимические")
- Если в документе указано "Гематологические исследования" - пишите "Гематологические исследования"
- Если в документе указано "Иммунологические исследования" - пишите "Иммунологические исследования"
- Если в документе указано "Общеклинические исследования (общий анализ мочи)" - пишите "Общеклинические исследования (общий анализ мочи)" или "Общий анализ мочи"
- Если в документе указано "Трансторакальная эхокардиография" - пишите "Трансторакальная эхокардиография"
- Если в документе указано "Допплерэхокардиография" - пишите "Допплерэхокардиография"
- Если в документе указано "Компьютерная томография правого коленного сустава" - пишите "Компьютерная томография правого коленного сустава"
- Если в документе указано "Компьютерная томография левого коленного сустава" - пишите "Компьютерная томография левого коленного сустава"
- Если в документе указано "Мультиспиральная компьютерная томография органов грудной полости" - пишите "Мультиспиральная компьютерная томография органов грудной полости"
- НЕ включайте в название описательные слова из находок (например, НЕ пишите "аорта уплотнена и склерозирована" - это находка, не название)
- НЕ включайте в название единицы измерения, размеры, значения (например, НЕ пишите "ЭКГ 83 уд/мин" - пишите только "Электрокардиограмма")
- НЕ включайте в название текст из заключения

**КРИТИЧЕСКИ ВАЖНО - ПРАВИЛА ДЛЯ ПОЛЯ "findings":**
- Перечислите ВСЕ отклонения от нормы, патологии и важные показатели через запятую или точку с запятой
- БЕЗ таблиц, БЕЗ многоточий, БЕЗ заголовков
- СТРОГО ЗАПРЕЩЕНО: НЕ пишите в findings названия других исследований (например, НЕ пишите "Гематологические исследования", "Иммунологические исследования", "Допплерэхокардиография", "Компьютерная томография левого коленного сустава", "Мультиспиральная компьютерная томография органов грудной полости", "Общеклинические исследования" и любые другие названия исследований)
- СТРОГО ЗАПРЕЩЕНО: НЕ пишите в findings заключение другого исследования
- ТОЛЬКО факты и находки из ЭТОГО исследования
- Если все в норме - напишите "Показатели в пределах нормы"
- НЕ перечисляйте все нормальные показатели - только патологии и важные находки
- Если в документе упоминается несколько исследований, извлеките ТОЛЬКО находки для ЭТОГО исследования (которое указано в поле title)

**КРИТИЧЕСКИ ВАЖНО - ПРАВИЛА ДЛЯ ПОЛЯ "conclusion":**
- 1-2 предложения основного вывода на понятном медицинском языке
- БЕЗ многоточий
- Заключение должно заканчиваться точкой (.), после которой НИЧЕГО не должно быть
- СТРОГО ЗАПРЕЩЕНО: НЕ пишите в conclusion названия других исследований (например, НЕ пишите "Гематологические исследования", "Иммунологические исследования", "Допплерэхокардиография", "Компьютерная томография левого коленного сустава", "Мультиспиральная компьютерная томография органов грудной полости", "Общеклинические исследования", "Трансторакальная эхокардиография", "Биохимические исследования" и любые другие названия исследований)
- СТРОГО ЗАПРЕЩЕНО: НЕ заканчивайте conclusion упоминанием названия другого исследования
- СТРОГО ЗАПРЕЩЕНО: НЕ добавляйте название следующего исследования в конце conclusion (например, НЕПРАВИЛЬНО: "...Рекомендуется консультация врача. Гематологические исследования" - название следующего исследования НЕ должно быть)
- СТРОГО ЗАПРЕЩЕНО: НЕ включайте в conclusion текст, который относится к другому исследованию
- СТРОГО ЗАПРЕЩЕНО: НЕ добавляйте названия исследований после рекомендаций (например, НЕПРАВИЛЬНО: "...Рекомендуется МРТ. Компьютерная томография левого коленного сустава" - это название следующего исследования, его НЕ должно быть в conclusion)
- ТОЛЬКО заключение по ЭТОМУ исследованию (которое указано в поле title)
- Если в документе упоминается несколько исследований, напишите заключение ТОЛЬКО для ЭТОГО исследования
- После заключения должна быть ТОЛЬКО точка, никаких названий исследований, никакого дополнительного текста

**КРИТИЧЕСКИ ВАЖНО - АБСОЛЮТНЫЕ ТРЕБОВАНИЯ:**
- Ответ ДОЛЖЕН быть ВАЛИДНЫМ JSON - это обязательное требование, не текст
- НЕ добавляйте никакого текста до или после JSON - начинайте ответ сразу с { или [
- НЕ используйте markdown форматирование (блоки кода с обратными кавычками) - только чистый JSON
- НЕ добавляйте пояснения типа "Вот анализ:", "Результат:", "Анализ:", "JSON:" - только чистый JSON
- Если в документе несколько анализов - ВСЕГДА возвращайте массив, даже если анализы одного типа
- Каждый анализ должен быть ОТДЕЛЬНЫМ объектом в массиве
- НЕ объединяйте разные анализы в один объект
- КАЖДЫЙ анализ из документа должен быть ОТДЕЛЬНЫМ объектом с СВОИМ title, findings и conclusion
- НЕ включайте название одного исследования в findings или conclusion другого исследования
- СТРОГО ЗАПРЕЩЕНО: НЕ добавляйте название следующего исследования в конец conclusion после точки (например, НЕПРАВИЛЬНО: "...Рекомендуется МРТ. Компьютерная томография левого коленного сустава")
- ВАЖНО: Если документ содержит несколько исследований (например, биохимические, гематологические, иммунологические), каждое должно быть ОТДЕЛЬНЫМ объектом в массиве с СВОИМ title
- ВАЖНО: Каждое поле conclusion должно заканчиваться точкой, после которой НИЧЕГО не должно быть, особенно названий других исследований

**ПРИМЕР ПРАВИЛЬНОГО JSON ДЛЯ ОДНОГО АНАЛИЗА:**
{
  "title": "Электрокардиограмма",
  "findings": "Ритм синусовый, правильный, частота сердечных сокращений 83 уд/мин, ЭОС горизонтальная, преобладание потенциалов левого желудочка, интервалы RR, P, PQ, QRS, QT в пределах нормы, ST положительный",
  "conclusion": "Электрокардиограмма без признаков нарушений ритма и проводимости, с нормальной частотой сердечных сокращений и преобладанием электрической активности левого желудочка."
}

ВАЖНО: Обратите внимание - заключение заканчивается точкой, после которой ничего нет. НЕ добавляйте название следующего исследования.

**ПРИМЕР ПРАВИЛЬНОГО JSON ДЛЯ НЕСКОЛЬКИХ АНАЛИЗОВ:**
[
  {
    "title": "Биохимические исследования",
    "findings": "Повышенный уровень мочевины, повышенный креатинин, холестерин выше желательного уровня, повышенный общий билирубин, повышенный фосфор, повышенный калий с пометкой о возможной ошибке при заборе и необходимости повторного анализа",
    "conclusion": "Обнаружены признаки нарушения функции почек, дислипидемия, гипербилирубинемия и электролитные нарушения. Рекомендуется повторить анализ калия и провести дополнительное обследование почек и печени."
  },
  {
    "title": "Гематологические исследования",
    "findings": "Повышенный уровень моноцитов, повышенный уровень эозинофилов, пониженная относительная ширина распределения эритроцитов по объему, повышенный средний объем тромбоцитов",
    "conclusion": "Обнаружены умеренные отклонения в составе лейкоцитарной формулы и показателях тромбоцитов, что может указывать на наличие воспалительного процесса или аллергической реакции. Рекомендуется консультация врача-гематолога для дальнейшего обследования."
  }
]

ВАЖНО: Обратите внимание - каждое заключение заканчивается точкой, после которой ничего нет. НЕ добавляйте название следующего исследования после точки. Каждое заключение должно быть ИЗОЛИРОВАНО от других исследований.

**ПРИМЕР НЕПРАВИЛЬНОГО JSON (НЕ ДЕЛАЙТЕ ТАК):**
НЕПРАВИЛЬНО в findings: "Повышенный уровень мочевины. Гематологические исследования" - здесь включено название другого исследования
НЕПРАВИЛЬНО в conclusion: "Обнаружены признаки нарушения функции почек. Гематологические исследования" - здесь включено название другого исследования в конце
НЕПРАВИЛЬНО в conclusion: "Обнаружены признаки. Допплерэхокардиография" - здесь включено название другого исследования в конце
НЕПРАВИЛЬНО в conclusion: "Рекомендуется повторить анализ калия и провести дополнительное обследование почек и печени. Гематологические исследования" - НЕ добавляйте название следующего исследования после точки
НЕПРАВИЛЬНО в conclusion: "Рекомендуется консультация врача для дальнейшего обследования. Иммунологические исследования" - НЕ добавляйте название следующего исследования
НЕПРАВИЛЬНО в conclusion: "Рекомендуется проведение МРТ для оценки связочного аппарата. Компьютерная томография левого коленного сустава" - НЕ добавляйте название следующего исследования
НЕПРАВИЛЬНО в conclusion: "Рекомендуется проведение МРТ для оценки связочного аппарата. Мультиспиральная компьютерная томография органов грудной полости" - НЕ добавляйте название следующего исследования

ПРАВИЛЬНО: каждое исследование должно быть ОТДЕЛЬНЫМ объектом, без упоминания других исследований в тексте. Заключение должно заканчиваться точкой, после которой ничего нет.

**ПРИМЕР ПОЛНОГО ПРАВИЛЬНОГО JSON С НЕСКОЛЬКИМИ ИССЛЕДОВАНИЯМИ И ВИТАЛЬНЫМИ ПОКАЗАТЕЛЯМИ:**

Если документ содержит несколько исследований и витальные показатели, верните массив исследований. Витальные показатели должны быть добавлены в ОТДЕЛЬНЫЙ объект после массива исследований:

Сначала массив исследований:
[
  {
    "title": "Биохимические исследования",
    "findings": "Повышенный уровень мочевины 16.3 ммоль/л, повышенный креатинин 203 мкмоль/л, холестерин 6.10 ммоль/л выше желательного уровня, повышенный общий билирубин 45.2 мкмоль/л, повышенный фосфор 1.85 ммоль/л, повышенный калий 5.8 ммоль/л",
    "conclusion": "Обнаружены признаки нарушения функции почек, дислипидемия, гипербилирубинемия и электролитные нарушения. Рекомендуется повторить анализ калия и провести дополнительное обследование почек и печени"
  },
  {
    "title": "Гематологические исследования",
    "findings": "Повышенный уровень моноцитов 12.5%, повышенный уровень эозинофилов 6.2%, пониженная относительная ширина распределения эритроцитов по объему 12.1%, повышенный средний объем тромбоцитов 12.5 фл",
    "conclusion": "Обнаружены умеренные отклонения в составе лейкоцитарной формулы и показателях тромбоцитов, что может указывать на наличие воспалительного процесса или аллергической реакции. Рекомендуется консультация врача-гематолога для дальнейшего обследования"
  },
  {
    "title": "Электрокардиограмма",
    "findings": "Ритм синусовый, правильный, частота сердечных сокращений 83 уд/мин, ЭОС горизонтальная, преобладание потенциалов левого желудочка, интервалы RR, P, PQ, QRS, QT в пределах нормы, сегмент ST положительный",
    "conclusion": "Электрокардиограмма без признаков нарушений ритма и проводимости, с нормальной частотой сердечных сокращений и преобладанием электрической активности левого желудочка"
  }
]

Затем отдельно объект с витальными показателями:
{
  "vital_signs": {
    "temperature": 36.8,
    "systolic_bp": 125,
    "diastolic_bp": 82,
    "pulse": 78,
    "saturation": 97
  }
}

ВАЖНО О ФОРМАТЕ ОТВЕТА:
- Если в документе несколько исследований - верните массив объектов исследований: [{...}, {...}]
- Витальные показатели должны быть в ОТДЕЛЬНОМ объекте после массива: {"vital_signs": {...}}
- Оба объекта должны быть в одном ответе, но витальные показатели будут обработаны отдельно
- Если витальные показатели не найдены - НЕ добавляйте объект "vital_signs"
- Все исследования должны быть ОТДЕЛЬНЫМИ объектами в массиве

**ОБЯЗАТЕЛЬНО:**
- НЕ упоминайте названия файлов, технические детали или способ получения данных
- НЕ пишите "дата не указана", "нет данных" или подобные фразы - просто не указывайте дату если её нет
- НЕ используйте многоточия (...) - пишите полный текст
- Пишите только медицинские факты понятным языком
- ОБЯЗАТЕЛЬНО правильно определите тип исследования из содержимого документа

⚠️⚠️⚠️ ФИНАЛЬНОЕ НАПОМИНАНИЕ: ВАШ ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON ⚠️⚠️⚠️

🚫 СТРОГО ЗАПРЕЩЕНО ВОЗВРАЩАТЬ ТЕКСТОВЫЙ ФОРМАТ:
НЕПРАВИЛЬНО:
"Трансторакальная эхокардиография

Ключевые находки: ..."

НЕПРАВИЛЬНО:
"Биохимические исследования

Ключевые находки: ..."

✅ ПРАВИЛЬНО - ТОЛЬКО JSON:
{"title": "...", "findings": "...", "conclusion": "..."}

НАЧИНАЙТЕ ОТВЕТ С { или [
ЗАКАНЧИВАЙТЕ ОТВЕТ } или ]
НИКАКОГО ТЕКСТА ДО И ПОСЛЕ JSON
НИКАКИХ ЗАГОЛОВКОВ ТИПА "Биохимические исследования" ПЕРЕД JSON
НИКАКИХ ЗАГОЛОВКОВ ТИПА "Трансторакальная эхокардиография" ПЕРЕД JSON
НИКАКИХ ПОЯСНЕНИЙ ТИПА "Вот анализ:" ПЕРЕД JSON
НИКАКИХ ТЕКСТОВЫХ ФОРМАТОВ С "Ключевые находки:" ПЕРЕД JSON
ТОЛЬКО ЧИСТЫЙ ВАЛИДНЫЙ JSON

⚠️ КРИТИЧЕСКИ ВАЖНО ДЛЯ ПОЛЯ "conclusion": ⚠️
- Заключение должно заканчиваться ТОЧКОЙ (.)
- ПОСЛЕ точки НИЧЕГО не должно быть
- НЕ добавляйте название следующего исследования после точки
- НЕ добавляйте названия других исследований в конец заключения
- Каждое заключение должно быть ИЗОЛИРОВАНО от других исследований`

	case strings.Contains(context, "preliminary_conclusion"):
		basePrompt += `

**ОСОБЫЕ УКАЗАНИЯ ДЛЯ ПРЕДВАРИТЕЛЬНОГО ЗАКЛЮЧЕНИЯ:**
- Сосредоточьтесь на острых находках и отклонениях
- Укажите приоритетность дальнейших действий
- Выделите показатели, требующие немедленного внимания`
	}

	// Добавляем инструкцию для поиска витальных показателей
	basePrompt += `

**КРИТИЧЕСКИ ВАЖНО - ВИТАЛЬНЫЕ ПОКАЗАТЕЛИ:**
Если в документе найдены витальные показатели (температура, артериальное давление, ЧСС, сатурация), ОБЯЗАТЕЛЬНО добавь их в ОТДЕЛЬНЫЙ JSON объект в конце ответа в формате:

{
  "vital_signs": {
    "temperature": <число в °C, например 36.6, или null если не найдено>,
    "systolic_bp": <систолическое давление в мм рт.ст., например 120, или null если не найдено>,
    "diastolic_bp": <диастолическое давление в мм рт.ст., например 80, или null если не найдено>,
    "pulse": <пульс в уд/мин, например 72, или null если не найдено>,
    "saturation": <сатурация в %, например 98, или null если не найдено>
  }
}

ВАЖНО: 
- Витальные показатели НЕ должны быть в основном тексте анализа
- JSON объект должен быть ОТДЕЛЬНО в конце ответа
- Если витальные показатели не найдены - НЕ добавляй объект "vital_signs"`

	return basePrompt
}

func getMedicalFilesAnalysisPromptEN(context string) string {
	basePrompt := `You are an experienced diagnostic physician with over 20 years of clinical practice. Analyze the attached medical document with maximum detail and professionalism.

**TASK:** Conduct a comprehensive medical analysis of the document with detailed interpretation of all parameters and clinical findings.

**MANDATORY ANALYSIS STRUCTURE:**

## 1. DOCUMENT IDENTIFICATION
- Type of medical document (blood test, X-ray, ultrasound, ECG, physician's report, histology, etc.)
- Date of examination
- Medical institution (if specified)
- Examination methodology

## 2. DETAILED PARAMETER ANALYSIS
Extract ALL parameters and their values from the document. Present in table format:

| Parameter | Document Value | Reference Values | Status | Clinical Interpretation |
|-----------|---------------|------------------|---------|------------------------|
| [name] | [value] | [adult normal range] | ↑/↓/N | [medical explanation] |

**For reference values:**
- If specified in document — use those
- If NOT specified — provide standard adult normal ranges
- Consider age and gender differences

## 3. CONCLUSION
Brief summary of condition indicating:
- Key findings
- Risk level
- Priority actions

**STRICT REQUIREMENTS:**
- Use precise medical terminology with explanations
- DO NOT make final diagnoses — only suggestions
- Indicate confidence level of your conclusions
- Note analysis limitations (image quality, incomplete data)
- Emphasize need for consultation with treating physician
- If document is illegible — describe what exactly cannot be read`

	// Извлекаем информацию о поле пациента из контекста, если она есть
	patientGender := ""
	if strings.Contains(context, "patient_gender:") {
		parts := strings.Split(context, "|")
		for _, part := range parts {
			if strings.HasPrefix(part, "patient_gender:") {
				patientGender = strings.TrimPrefix(part, "patient_gender:")
				break
			}
		}
	}
	
	switch {
	case strings.HasPrefix(context, "health_passport_generation"):
		// For health passport - CLIENT-ORIENTED format
		basePrompt = `You are an experienced diagnostic physician. Analyze the medical document for patient health passport.`
		
		// Добавляем информацию о поле пациента, если она есть
		if patientGender != "" {
			genderText := ""
			if strings.Contains(strings.ToLower(patientGender), "женск") || strings.Contains(strings.ToLower(patientGender), "female") {
				genderText = "IMPORTANT: Patient is FEMALE. DO NOT mention male studies (prostate, prostate gland). Use female reference values in norms and interpretations."
			} else if strings.Contains(strings.ToLower(patientGender), "мужск") || strings.Contains(strings.ToLower(patientGender), "male") {
				genderText = "IMPORTANT: Patient is MALE. Use male reference values in norms and interpretations."
			}
			if genderText != "" {
				basePrompt += "\n\n" + genderText
			}
		}
		
		basePrompt += `

**CRITICALLY IMPORTANT:**
- Analysis must be MAXIMALLY COMPACT. Even for 10 files, the entire section should not exceed 1 Word page.
- Format must be CLIENT-ORIENTED and MEDICALLY QUALITY.
- DO NOT mention file names, technical details, or data acquisition methods.
- DO NOT write "date not specified", "no data" or similar phrases - simply omit date if not available.
- DO NOT use ellipsis (...) - write full text.
- Write only medical facts in understandable language.

**RESPONSE FORMAT (for each document):**

[Study type] (date ONLY if specified in document, otherwise write nothing about date)

Key findings: [only deviations from norm and important indicators, comma-separated, NO tables, NO ellipsis]

Conclusion: [1-2 sentences with main conclusion in understandable medical language, NO ellipsis]

**RULES:**
- DO NOT create tables - only brief text
- DO NOT list all normal indicators - only pathologies and important findings
- DO NOT write long interpretations - only essence
- DO NOT mention file names, file formats, or technical details
- DO NOT write "date not specified", "no data", "not indicated" - simply omit this information
- DO NOT use ellipsis - write full text
- If all indicators are normal - write "Indicators within normal range"
- Maximum 3-4 lines per document
- Use medical terms, but explain clearly
- Write in connected text, avoid bullet lists where possible`

	case strings.Contains(context, "preliminary_conclusion"):
		basePrompt += `

**SPECIAL INSTRUCTIONS FOR PRELIMINARY CONCLUSION:**
- Focus on acute findings and deviations
- Indicate priority of further actions
- Highlight parameters requiring immediate attention`
	}

	// Добавляем инструкцию для поиска витальных показателей
	basePrompt += `

**КРИТИЧЕСКИ ВАЖНО - ВИТАЛЬНЫЕ ПОКАЗАТЕЛИ:**
Если в документе найдены витальные показатели (температура, артериальное давление, ЧСС, сатурация), ОБЯЗАТЕЛЬНО добавь их в ОТДЕЛЬНЫЙ JSON объект в конце ответа в формате:

{
  "vital_signs": {
    "temperature": <число в °C, например 36.6, или null если не найдено>,
    "systolic_bp": <систолическое давление в мм рт.ст., например 120, или null если не найдено>,
    "diastolic_bp": <диастолическое давление в мм рт.ст., например 80, или null если не найдено>,
    "pulse": <пульс в уд/мин, например 72, или null если не найдено>,
    "saturation": <сатурация в %, например 98, или null если не найдено>
  }
}

ВАЖНО: 
- Витальные показатели НЕ должны быть в основном тексте анализа
- JSON объект должен быть ОТДЕЛЬНО в конце ответа
- Если витальные показатели не найдены - НЕ добавляй объект "vital_signs"`

	return basePrompt
}

func getMedicalFilesAnalysisPromptKZ(context string) string {
	basePrompt := `Сіз 20 жылдан астам клиникалық тәжірибесі бар тәжірибелі диагност дәрігерсіз. Тіркелген медициналық құжатты барынша толық және кәсіби талдаңыз.

**ТАПСЫРМА:** Барлық параметрлер мен клиникалық табылымдардың толық түсіндірмесімен құжаттың кешенді медициналық талдауын жүргізіңіз.

**МІНДЕТТІ ТАЛДАУ ҚҰРЫЛЫМЫ:**

## 1. ҚҰЖАТТЫ СӘЙКЕСТЕНДІРУ
- Медициналық құжат түрі (қан талдауы, рентген, ультрадыбыстық зерттеу, ЭКГ, дәрігер қорытындысы, гистология және т.б.)
- Зерттеу жүргізілген күні
- Медициналық мекеме (егер көрсетілсе)
- Зерттеу әдістемесі

## 2. ПАРАМЕТРЛЕРДІҢ ТОЛЫҚ ТАЛДАУЫ
Құжаттан БАРЛЫҚ параметрлер мен олардың мәндерін бөліп алыңыз. Кесте түрінде ұсыныңыз:

| Параметр | Құжаттағы мәні | Анықтамалық мәндер | Мәртебесі | Клиникалық түсіндірме |
|----------|----------------|-------------------|-----------|----------------------|
| [атауы] | [мәні] | [ересек адам нормасы] | ↑/↓/N | [медициналық түсіндірме] |

**Анықтамалық мәндер үшін:**
- Егер құжатта көрсетілсе — оларды пайдаланыңыз
- Егер көрсетілмесе — ересек адамның жалпы қабылданған нормаларын келтіріңіз
- Жас пен жыныс ерекшеліктерін ескеріңіз

## 6. ҚОРЫТЫНДЫ
Жағдайдың қысқаша резюмесі мыналарды көрсете отырып:
- Негізгі табылымдар
- Тәуекел деңгейі
- Басым іс-қимылдар

**ҚАТАҢ ТАЛАПТАР:**
- Нақты медициналық терминологияны түсіндірмелермен қолданыңыз
- Түпкілікті диагноз ҚОЙМАҢЫЗ — тек болжамдар
- Қорытындыларыңыздың сенімділік деңгейін көрсетіңіз
- Талдау шектеулерін атап өтіңіз (кескін сапасы, толымсыз деректер)
- Емдеуші дәрігермен кеңесу қажеттілігін баса назар аударыңыз
- Егер құжат оқылмаса — нақты не оқылмайтынын сипаттаңыз`

	// Извлекаем информацию о поле пациента из контекста, если она есть
	patientGender := ""
	if strings.Contains(context, "patient_gender:") {
		parts := strings.Split(context, "|")
		for _, part := range parts {
			if strings.HasPrefix(part, "patient_gender:") {
				patientGender = strings.TrimPrefix(part, "patient_gender:")
				break
			}
		}
	}
	
	switch {
	case strings.HasPrefix(context, "health_passport_generation"):
		// Денсаулық паспорты үшін - КЛИЕНТТІК формат
		basePrompt = `Сіз тәжірибелі диагност дәрігерсіз. Науқас денсаулық паспорты үшін медициналық құжатты талдаңыз.`
		
		// Добавляем информацию о поле пациента, если она есть
		if patientGender != "" {
			genderText := ""
			if strings.Contains(strings.ToLower(patientGender), "женск") || strings.Contains(strings.ToLower(patientGender), "әйел") {
				genderText = "МАҢЫЗДЫ: Науқас - ӘЙЕЛ. Еркек зерттеулерін (қалқанша безі, простата) ЕСКЕРТПЕҢІЗ. Нормалар мен түсіндірмелерде әйелдерге арналған анықтамалық мәндерді қолданыңыз."
			} else if strings.Contains(strings.ToLower(patientGender), "мужск") || strings.Contains(strings.ToLower(patientGender), "еркек") {
				genderText = "МАҢЫЗДЫ: Науқас - ЕРКЕК. Нормалар мен түсіндірмелерде еркектерге арналған анықтамалық мәндерді қолданыңыз."
			}
			if genderText != "" {
				basePrompt += "\n\n" + genderText
			}
		}
		
		basePrompt += `

**КРИТИКАЛЫҚ МАҢЫЗДЫ:**
- Талдау МАКСИМАЛДЫ ҚЫСҚА болуы керек. Тіпті 10 файл үшін бүкіл бөлім 1 Word бетін аспауы керек.
- Формат КЛИЕНТТІК және МЕДИЦИНАЛЫҚ САПАЛЫ болуы керек.
- Файл атауларын, техникалық детальдарды немесе деректерді алу әдістерін ЕСКЕРТПЕҢІЗ.
- "Күні көрсетілмеген", "деректер жоқ" немесе осындай фразаларды ЖАЗБАҢЫЗ - күн көрсетілмесе, оны жай ғана өткізіп жіберіңіз.
- Көп нүктелерді (...) ҚОЛДАНБАҢЫЗ - толық мәтін жазыңыз.
- Тек медициналық фактілерді түсінікті тілде жазыңыз.

**ЖАУАП ФОРМАТЫ (әр құжат үшін):**

[Зерттеу түрі] (күні ТЕК құжатта көрсетілсе, әйтпесе күн туралы ештеңе жазбаңыз)

Негізгі табылымдар: [тек нормадан ауытқулар мен маңызды көрсеткіштер, үтірмен бөлінген, КЕСТЕ ЖОҚ, КӨП НҮКТЕЛЕР ЖОҚ]

Қорытынды: [негізгі қорытындымен 1-2 сөйлем, түсінікті медициналық тілде, КӨП НҮКТЕЛЕР ЖОҚ]

**ЕРЕЖЕЛЕР:**
- Кестелер ЖАСАМАҢЫЗ - тек қысқа мәтін
- Барлық қалыпты көрсеткіштерді ТІЗІМДЕМЕҢІЗ - тек патологиялар мен маңызды табылымдар
- Ұзын түсіндірмелер ЖАЗБАҢЫЗ - тек мәні
- Файл атауларын, файл форматтарын немесе техникалық детальдарды ЕСКЕРТПЕҢІЗ
- "Күні көрсетілмеген", "деректер жоқ", "көрсетілмеген" деп ЖАЗБАҢЫЗ - бұл ақпаратты жай ғана өткізіп жіберіңіз
- Көп нүктелерді ҚОЛДАНБАҢЫЗ - толық мәтін жазыңыз
- Егер барлық көрсеткіштер қалыпты болса - "Көрсеткіштер норма шегінде" деп жазыңыз
- Құжатқа максимум 3-4 жол
- Медициналық терминдерді қолданыңыз, бірақ түсінікті түрде түсіндіріңіз
- Байланысты мәтінмен жазыңыз, маркерленген тізімдерден мүмкіндігінше аулақ болыңыз`

	case strings.Contains(context, "preliminary_conclusion"):
		basePrompt += `

**АЛДЫН АЛА ҚОРЫТЫНДЫ ҮШІН АРНАЙЫ НҰСҚАУЛАР:**
- Жедел табылымдар мен ауытқуларға назар аударыңыз
- Одан әрі іс-қимылдардың басымдылығын көрсетіңіз
- Дереу назар аудару қажет көрсеткіштерді бөліп көрсетіңіз`
	}

	return basePrompt
}

func getCardiologyECGPromptRU() string {
	return `Вы кардиолог с экспертизой в интерпретации ЭКГ. Проанализируйте данную электрокардиограмму:

**АНАЛИЗ ЭКГ:**

## 1. Технические параметры
- Скорость записи
- Амплитуда
- Качество сигнала

## 2. Ритм и проводимость
- Синусовый ритм
- Частота сердечных сокращений
- Регулярность
- Нарушения проводимости

## 3. Морфология зубцов
- P-зубцы
- QRS-комплексы
- T-зубцы
- Интервалы (PQ, QT, QRS)

## 4. Отклонения от нормы
- Аритмии
- Блокады
- Признаки ишемии/инфаркта
- Гипертрофия камер

## 5. Клинические рекомендации
- Неотложные состояния
- Дальнейшее обследование
- Консультации специалистов`
}

func getCardiologyGeneralPromptRU() string {
	return `Вы кардиолог. Проанализируйте кардиологический документ с фокусом на:

- Функциональное состояние сердечно-сосудистой системы
- Факторы риска сердечно-сосудистых заболеваний
- Показатели гемодинамики
- Рекомендации по профилактике и лечению`
}

func getBloodTestPromptRU() string {
	return `Вы лабораторный диагност. Проанализируйте результаты анализа крови:

**ЛАБОРАТОРНЫЙ АНАЛИЗ:**

## 1. Общий анализ крови
- Эритроциты, гемоглобин, гематокрит
- Лейкоциты и лейкоцитарная формула
- Тромбоциты, СОЭ

## 2. Биохимические показатели
- Белковый обмен
- Углеводный обмен
- Липидный спектр
- Функция печени и почек
- Электролиты

## 3. Интерпретация отклонений
- Анемии
- Воспалительные процессы
- Метаболические нарушения
- Функциональные нарушения органов

## 4. Клинические рекомендации
- Дополнительные исследования
- Консультации специалистов
- Динамическое наблюдение`
}

func getRadiologyPromptRU() string {
	return `Вы врач-рентгенолог. Проанализируйте рентгенологическое исследование:

**РЕНТГЕНОЛОГИЧЕСКОЕ ЗАКЛЮЧЕНИЕ:**

## 1. Техника исследования
- Проекции
- Качество снимков
- Укладка пациента

## 2. Анатомические структуры
- Костная система
- Мягкие ткани
- Органы (легкие, сердце, брюшная полость)

## 3. Патологические изменения
- Травматические повреждения
- Воспалительные процессы
- Новообразования
- Дегенеративные изменения

## 4. Рекомендации
- Дополнительные методы визуализации
- Динамическое наблюдение
- Консультации специалистов`
}

func getCardiologyECGPromptEN() string {
	return `You are a cardiologist with expertise in ECG interpretation. Analyze this electrocardiogram:

**ECG ANALYSIS:**

## 1. Technical Parameters
- Recording speed
- Amplitude
- Signal quality

## 2. Rhythm and Conduction
- Sinus rhythm
- Heart rate
- Regularity
- Conduction abnormalities

## 3. Wave Morphology
- P waves
- QRS complexes
- T waves
- Intervals (PR, QT, QRS)

## 4. Abnormalities
- Arrhythmias
- Blocks
- Signs of ischemia/infarction
- Chamber hypertrophy

## 5. Clinical Recommendations
- Emergency conditions
- Further evaluation
- Specialist consultations`
}

func getBloodTestPromptEN() string {
	return `You are a laboratory diagnostician. Analyze these blood test results:

**LABORATORY ANALYSIS:**

## 1. Complete Blood Count
- RBC, hemoglobin, hematocrit
- WBC and differential
- Platelets, ESR

## 2. Biochemical Parameters
- Protein metabolism
- Glucose metabolism
- Lipid profile
- Liver and kidney function
- Electrolytes

## 3. Interpretation of Abnormalities
- Anemias
- Inflammatory processes
- Metabolic disorders
- Organ dysfunction

## 4. Clinical Recommendations
- Additional studies
- Specialist consultations
- Follow-up monitoring`
}

func getCardiologyECGPromptKZ() string {
	return `Сіз ЭКГ түсіндіруде сарапшы кардиологсыз. Осы электрокардиограмманы талдаңыз:

**ЭКГ ТАЛДАУЫ:**

## 1. Техникалық параметрлер
- Жазу жылдамдығы
- Амплитуда
- Сигнал сапасы

## 2. Ырғақ және өткізгіштік
- Синус ырғағы
- Жүрек соғу жиілігі
- Ритмділік
- Өткізгіштік бұзылулары

Медициналық кардиологиялық талдау жасаңыз.`
}

func getBloodTestPromptKZ() string {
	return `Сіз зертханалық диагност дәрігерсіз. Осы қан талдауының нәтижелерін талдаңыз:

**ЗЕРТХАНАЛЫҚ ТАЛДАУ:**

## 1. Жалпы қан талдауы
- Эритроциттер, гемоглобин, гематокрит
- Лейкоциттер және формула
- Тромбоциттер, ЭҚК

## 2. Биохимиялық көрсеткіштер
- Ақуыз алмасуы
- Көмірсу алмасуы
- Липидтер спектрі

Толық медициналық талдау жасаңыз.`
}

func getCardiologyGeneralPromptEN() string { return getCardiologyECGPromptEN() }
func getCardiologyGeneralPromptKZ() string { return getCardiologyECGPromptKZ() }
func getRadiologyXRayPromptRU() string     { return getRadiologyPromptRU() }
func getRadiologyCTPromptRU() string       { return getRadiologyPromptRU() }
func getRadiologyMRIPromptRU() string      { return getRadiologyPromptRU() }
func getRadiologyXRayPromptEN() string     { return getRadiologyPromptEN() }
func getRadiologyCTPromptEN() string       { return getRadiologyPromptEN() }
func getRadiologyMRIPromptEN() string      { return getRadiologyPromptEN() }
func getRadiologyXRayPromptKZ() string     { return getRadiologyPromptKZ() }
func getRadiologyCTPromptKZ() string       { return getRadiologyPromptKZ() }
func getRadiologyMRIPromptKZ() string      { return getRadiologyPromptKZ() }
func getLaboratoryBloodPromptRU() string   { return getBloodTestPromptRU() }
func getLaboratoryGeneralPromptRU() string { return getBloodTestPromptRU() }
func getLaboratoryBloodPromptEN() string   { return getBloodTestPromptEN() }
func getLaboratoryGeneralPromptEN() string { return getBloodTestPromptEN() }
func getLaboratoryBloodPromptKZ() string   { return getBloodTestPromptKZ() }
func getLaboratoryGeneralPromptKZ() string { return getBloodTestPromptKZ() }
func getRadiologyPromptEN() string {
	return "You are a radiologist. Analyze this radiological study with focus on anatomical structures and pathological findings."
}
func getRadiologyPromptKZ() string {
	return "Сіз рентгенолог дәрігерсіз. Осы рентгенологиялық зерттеуді анатомиялық құрылымдар мен патологиялық өзгерістерге назар аудара отырып талдаңыз."
}
func getUltrasoundPromptRU() string {
	return "Вы специалист УЗИ-диагностики. Проанализируйте ультразвуковое исследование с описанием эхогенности, размеров и структурных особенностей."
}
func getUltrasoundPromptEN() string {
	return "You are an ultrasound specialist. Analyze this ultrasound study describing echogenicity, measurements, and structural features."
}
func getUltrasoundPromptKZ() string {
	return "Сіз УДЗ диагностикасының маманысыз. Осы ультрадыбыстық зерттеуді эхогенділік, өлшемдер және құрылымдық ерекшеліктерді сипаттай отырып талдаңыз."
}
func getCardiologyPromptRU() string { return getCardiologyGeneralPromptRU() }
func getCardiologyPromptEN() string {
	return "You are a cardiologist. Analyze this cardiac study focusing on cardiovascular function and risk factors."
}
func getCardiologyPromptKZ() string {
	return "Сіз кардиолог дәрігерсіз. Осы жүрек зерттеуін жүрек-қан тамырлары жүйесінің функциясы мен қауіп факторларына назар аудара отырып талдаңыз."
}
func getPrescriptionPromptRU() string {
	return "Вы клинический фармаколог. Проанализируйте рецепт на предмет правильности назначений, дозировок и возможных взаимодействий."
}
func getPrescriptionPromptEN() string {
	return "You are a clinical pharmacologist. Analyze this prescription for proper medications, dosages, and potential interactions."
}
func getPrescriptionPromptKZ() string {
	return "Сіз клиникалық фармаколог дәрігерсіз. Осы рецептті дұрыс тағайындаулар, дозалар және ықтимал өзара әрекеттесулер тұрғысынан талдаңыз."
}

func getPatientRecommendationsPromptRU(dialogue string, context string) string {
	contextBlock := "Дополнительные данные о пациенте отсутствуют."
	if strings.TrimSpace(context) != "" {
		contextBlock = context
	}

	return fmt.Sprintf(`Ты — опытный лечащий врач. На основе диалога приёма и дополнительных данных о пациенте (анкета, жалобы, профиль пациента, диагноз и план лечения — если есть) напиши РЕКОМЕНДАЦИИ ДЛЯ ПАЦИЕНТА — понятный, дружелюбный текст, который пациент будет читать сам.

ТРЕБОВАНИЯ:
- Пиши простым языком, без сложных медицинских терминов (если термин нужен — поясни его).
- Структурируй ответ в Markdown: используй заголовки "## " для разделов и списки "- " для пунктов.
- Обязательно включи разделы (если применимо): "Режим и образ жизни", "Приём лекарств", "Что делать дома", "Когда обращаться к врачу повторно" и "Тревожные симптомы — когда нужна срочная помощь".
- Основывайся на информации из диалога и дополнительных данных ниже, не придумывай новые диагнозы или препараты.
- Если диалог приёма короткий или малоинформативный, в первую очередь используй данные из анкеты, жалоб и профиля пациента.
- НЕ пиши вступления и заключения вида "Конечно, вот рекомендации" — начни сразу с первого заголовка.

Диалог приёма (врач-пациент):
%s

Дополнительные данные о пациенте:
%s

Рекомендации для пациента:`, dialogue, contextBlock)
}

func getPatientRecommendationsPromptEN(dialogue string, context string) string {
	contextBlock := "No additional patient data available."
	if strings.TrimSpace(context) != "" {
		contextBlock = context
	}

	return fmt.Sprintf(`You are an experienced attending physician. Based on the consultation dialogue and additional patient data (questionnaire, complaints, patient profile, diagnosis and treatment plan — if available), write PATIENT RECOMMENDATIONS — a clear, friendly text that the patient will read themselves.

REQUIREMENTS:
- Use simple language, avoid complex medical terms (explain any term you must use).
- Structure the answer in Markdown: use "## " headings for sections and "- " for list items.
- Include sections (where applicable): "Lifestyle and routine", "Medication", "What to do at home", "When to see a doctor again", and "Warning signs — when to seek urgent help".
- Base your answer on the information in the dialogue and additional data below — do not invent new diagnoses or medications.
- If the consultation dialogue is short or uninformative, rely primarily on the questionnaire, complaints, and patient profile data.
- Do NOT add intros or conclusions like "Sure, here are the recommendations" — start directly with the first heading.

Consultation dialogue (doctor-patient):
%s

Additional patient data:
%s

Patient recommendations:`, dialogue, contextBlock)
}

func getPatientRecommendationsPromptKZ(dialogue string, context string) string {
	contextBlock := "Емделуші туралы қосымша деректер жоқ."
	if strings.TrimSpace(context) != "" {
		contextBlock = context
	}

	return fmt.Sprintf(`Сіз тәжірибелі емдеуші дәрігерсіз. Қабылдау диалогы және емделуші туралы қосымша деректер (анкета, шағымдар, емделуші профилі, диагноз және емдеу жоспары — бар болса) негізінде ЕМДЕЛУШІГЕ АРНАЛҐАН ҰСЫНЫМДАРДЫ жазыңыз — бұл науқастың өзі оқитын түсінікті, достық мәтін болуы керек.

ТАЛАПТАР:
- Қарапайым тілде жазыңыз, күрделі медициналық терминдерден аулақ болыңыз (термин керек болса, түсіндіріңіз).
- Жауапты Markdown форматында құрылымдаңыз: бөлімдер үшін "## " тақырыптарын, тармақтар үшін "- " тізімдерін қолданыңыз.
- Қажет болса мына бөлімдерді қосыңыз: "Режим және өмір салты", "Дәрі-дәрмек қабылдау", "Үйде не істеу керек", "Қайта дәрігерге қашан келу керек" және "Қауіпті белгілер — жедел көмек қажет болғанда".
- Төмендегі диалог пен қосымша деректер негізінде жазыңыз, жаңа диагноз немесе препарат ойдан шығармаңыз.
- Егер қабылдау диалогы қысқа немесе ақпараты аз болса, ең алдымен анкета, шағымдар және емделуші профилі деректерін қолданыңыз.
- "Әрине, міне ұсынымдар" деген сияқты кіріспе немен қорытынды жазбаңыз — бірден бірінші тақырыптан бастаңыз.

Қабылдау диалогы (дәрігер-науқас):
%s

Емделуші туралы қосымша деректер:
%s

Емделушіге арналған ұсынымдар:`, dialogue, contextBlock)
}
