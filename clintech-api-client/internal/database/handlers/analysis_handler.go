package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/middleware"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/repository"
	"github.com/beereket/vitalem-api-client/internal/services"
	"github.com/beereket/vitalem-api-client/internal/utils/text"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"strings"
	"time"
)

var (
	reTempText  = regexp.MustCompile(`(?i)(?:t(?:emp)?|темп(?:ература)?)[^\d]*([34]\d(?:[.,]\d)?)`)
	reBPText    = regexp.MustCompile(`(?i)(\d{2,3})\s*/\s*(\d{2,3})`)
	rePulseText = regexp.MustCompile(`(?i)(?:pulse|пульс|hr|heart\s*rate)[^\d]*([4-9]\d|1\d{2})`)
	reSatText   = regexp.MustCompile(`(?i)(?:spo2|sp\\s*o2|saturation|сатурац(?:ия)?)[^\\d]*([7-9]\\d|100)`)
)

func extractVitalSignsFromDialogue(dialogue string) map[string]any {
	d := " " + dialogue + " "
	vs := map[string]any{}

	if m := reTempText.FindStringSubmatch(d); len(m) == 2 {
		val := strings.ReplaceAll(m[1], ",", ".")
		// оставляем как строку, чтобы фронт мог показать даже при локальном fallback
		vs["temperature"] = val
	}

	if m := reBPText.FindStringSubmatch(d); len(m) == 3 {
		vs["systolic_bp"] = m[1]
		vs["diastolic_bp"] = m[2]
	}

	if m := rePulseText.FindStringSubmatch(d); len(m) == 2 {
		vs["pulse"] = m[1]
	}

	if m := reSatText.FindStringSubmatch(d); len(m) == 2 {
		vs["saturation"] = m[1]
	}

	if len(vs) == 0 {
		return nil
	}
	return vs
}

type AnalysisHandler struct {
	analysisService *services.AnalysisService
}

func NewAnalysisHandler(analysisService *services.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{analysisService: analysisService}
}

func (h *AnalysisHandler) ListMyAnalysis(c *gin.Context) {
	user, ok := c.Request.Context().Value(middleware.UserContextKey).(*client.UserInfo)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	records, err := repository.GetRecordsByUser(c.Request.Context(), user.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *AnalysisHandler) SubmitAnalysisWithAI(c *gin.Context) {
	user, ok := c.Request.Context().Value(middleware.UserContextKey).(*client.UserInfo)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	contentType := c.GetHeader("Content-Type")
	var requestData struct {
		Answers map[string]string `json:"answers"`
		Lang    string            `json:"lang"`
	}
	var fileIDs []string

	if strings.Contains(contentType, "multipart/form-data") {
		answersStr := c.PostForm("answers")
		lang := c.DefaultPostForm("lang", "ru")

		var answers map[string]string
		if err := json.Unmarshal([]byte(answersStr), &answers); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные ответы"})
			return
		}

		requestData.Answers = answers
		requestData.Lang = lang

		form, err := c.MultipartForm()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Не удалось обработать файлы"})
			return
		}

		files := form.File["attachments"]
		if len(files) > 0 {
			token := c.GetHeader("Authorization")
			fileIDs, err = h.analysisService.GetFileServerClient().UploadFiles(files, token)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка загрузки файлов в FileServer"})
				return
			}
		}
	} else {
		if err := c.ShouldBindJSON(&requestData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные"})
			return
		}
	}

	if requestData.Lang == "" {
		requestData.Lang = "ru"
	}

	req := &services.AnalysisRequest{
		Answers: requestData.Answers,
		Lang:    requestData.Lang,
	}

	resp, err := h.analysisService.AnalyzeWithAI(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	record := &models.AnalysisRecord{
		ID:              uuid.New().String(),
		UserID:          user.UserID,
		Answers:         requestData.Answers,
		Recommendations: resp.Recommendations,
		Files:           fileIDs,
		CreatedAt:       time.Now(),
	}

	if err := repository.SaveAnalysisRecord(c.Request.Context(), record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить анализ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"analysis_id":     record.ID,
		"recommendations": resp.Recommendations,
		"files":           fileIDs,
	})
}

func (h *AnalysisHandler) GeneratePreliminaryConclusion(c *gin.Context) {
	user, ok := c.Request.Context().Value(middleware.UserContextKey).(*client.UserInfo)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var requestData struct {
		AnalysisID string `json:"analysis_id"`
		Lang       string `json:"lang"`
	}

	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные"})
		return
	}

	if requestData.Lang == "" {
		requestData.Lang = "ru"
	}

	token := c.GetHeader("Authorization")
	req := &services.PreliminaryConclusionRequest{
		AnalysisID: requestData.AnalysisID,
		UserID:     user.UserID,
		Lang:       requestData.Lang,
	}

	resp, err := h.analysisService.GeneratePreliminaryConclusion(req, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	err = repository.UpdatePreliminaryConclusionFileID(c.Request.Context(), requestData.AnalysisID, resp.ConclusionFileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить предварительное заключение"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AnalysisHandler) ListAnalysisRecordsByUser(c *gin.Context) {
	userID := c.Param("user_id")
	records, err := repository.GetRecordsByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении записей"})
		return
	}
	c.JSON(http.StatusOK, records)
}

// getMapKeys возвращает список ключей из map
func getMapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func extractJSONPayload(raw string) string {
	s := strings.TrimSpace(raw)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		if len(lines) >= 2 {
			lines = lines[1:]
			if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "```" {
				lines = lines[:len(lines)-1]
			}
			s = strings.Join(lines, "\n")
		}
	}
	s = strings.TrimSpace(s)
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func stringifyAnswerValue(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(x)
	case float64, bool, int, int64:
		b, _ := json.Marshal(x)
		return string(b)
	case []any:
		parts := make([]string, 0, len(x))
		for _, item := range x {
			s := stringifyAnswerValue(item)
			if s != "" {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, "; ")
	case map[string]any:
		parts := make([]string, 0, len(x))
		for key, val := range x {
			s := stringifyAnswerValue(val)
			if s != "" {
				parts = append(parts, key+": "+s)
			}
		}
		return strings.Join(parts, ", ")
	default:
		b, err := json.Marshal(x)
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(b))
	}
}

func normalizeAnswersMap(input map[string]any) map[string]string {
	out := make(map[string]string, len(input))
	for key, val := range input {
		if key == "vital_signs" {
			continue
		}
		s := stringifyAnswerValue(val)
		if s != "" {
			out[key] = s
		}
	}
	return out
}

func (h *AnalysisHandler) ExtractAnswersFromDialogue(c *gin.Context) {
	var request struct {
		Dialogue string `json:"dialogue"`
		Lang     string `json:"lang"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный JSON"})
		return
	}

	if strings.TrimSpace(request.Dialogue) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Поле 'dialogue' не может быть пустым"})
		return
	}

	lang := request.Lang
	if lang == "" {
		lang = "ru"
	}

	prompt := openai.GetExtractAnswersPrompt(lang, request.Dialogue)

	aiResp, err := openai.AskOpenAI(prompt, lang)
	if err != nil {
		// Fallback: если ключа нет/AI недоступен — не ломаем UX, возвращаем пустые ответы + попытку извлечь vital_signs regex'ами
		vitalSigns := extractVitalSignsFromDialogue(request.Dialogue)
		resp := gin.H{
			"answers": gin.H{},
			"fallback": true,
		}
		if vitalSigns != nil {
			resp["vital_signs"] = vitalSigns
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	cleaned := extractJSONPayload(text.FormatMedicalText(aiResp))
	
	var answers map[string]any
	if err := json.Unmarshal([]byte(cleaned), &answers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Невозможно распарсить JSON от OpenAI",
			"raw_ai":  aiResp,
			"details": err.Error(),
		})
		return
	}


	// Извлекаем витальные показатели из ответа
	var vitalSigns map[string]any
	if vs, ok := answers["vital_signs"]; ok {
		if vsMap, ok := vs.(map[string]any); ok {
			vitalSigns = vsMap
			// Удаляем vital_signs из answers, чтобы они не попали в другие поля
			delete(answers, "vital_signs")
		}
	}

	response := gin.H{"answers": normalizeAnswersMap(answers)}
	if vitalSigns != nil {
		response["vital_signs"] = vitalSigns
	}

	c.JSON(http.StatusOK, response)
}


func (h *AnalysisHandler) UpdateAnswersByUser(c *gin.Context) {
    userID := c.Param("user_id")
    if strings.TrimSpace(userID) == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
        return
    }

    var req struct {
        Answers     map[string]string `json:"answers"`
        VitalSigns  map[string]any    `json:"vital_signs,omitempty"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
        return
    }
    if len(req.Answers) == 0 && req.VitalSigns == nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "answers is empty and no vital_signs provided"})
        return
    }

    // Берём все записи анализа пользователя и выбираем самую свежую
    records, err := repository.GetRecordsByUser(c.Request.Context(), userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if len(records) == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "no analysis records for user"})
        return
    }

    latest := records[0]
    for _, r := range records {
        if r.CreatedAt.After(latest.CreatedAt) {
            latest = r
        }
    }

    // Мержим поля (канонические 13 ключей) в JSON answers
    if latest.Answers == nil {
        latest.Answers = map[string]string{}
    }
    for k, v := range req.Answers {
        latest.Answers[k] = v
    }
    
    // Если есть vital_signs, сохраняем их в answers как JSON строку
        if req.VitalSigns != nil {
            vitalSignsJSON, err := json.Marshal(req.VitalSigns)
            if err == nil {
                latest.Answers["vital_signs"] = string(vitalSignsJSON)
            }
        }

    if err := repository.UpdateAnalysisAnswers(c.Request.Context(), latest.ID, latest.Answers); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update answers"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "status":      "ok",
        "analysis_id": latest.ID,
        "user_id":     userID,
        "updated":     len(req.Answers),
    })
}
