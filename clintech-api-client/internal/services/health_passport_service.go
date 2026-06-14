package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/repository"
	"github.com/beereket/vitalem-api-client/internal/utils/pdf"
	"github.com/beereket/vitalem-api-client/internal/utils/text"
)

var (
	reTemp  = regexp.MustCompile(`(?i)(?:t(?:emp)?|темп(?:ература)?)[^\d]*([34]\d(?:[.,]\d)?)`)
	reBP    = regexp.MustCompile(`(?i)(\d{2,3})\s*/\s*(\d{2,3})`)
	rePulse = regexp.MustCompile(`(?i)(?:pulse|пульс|hr|heart\s*rate)[^\d]*([4-9]\d|1\d{2})`)
)

// -----------------------------
// Вытягивание витальных из ответов анкеты
// -----------------------------
func parseVitals(answers map[string]string) (temp *float64, sys *int, dia *int, pulse *int, saturation *int, bpStr *string) {
	if answers == nil {
		return
	}

	// Сначала проверяем, есть ли витальные показатели в формате vital_signs (из extract-answers)
	// Это может быть строка JSON или уже распарсенный объект
	if vsStr, ok := answers["vital_signs"]; ok && vsStr != "" {
		// Пытаемся распарсить JSON
		var vitalSigns map[string]interface{}
		if err := json.Unmarshal([]byte(vsStr), &vitalSigns); err == nil {
			// Успешно распарсили JSON
			if t, ok := vitalSigns["temperature"].(float64); ok && t >= 34 && t <= 45 {
				tempVal := t
				temp = &tempVal
			} else {
			}
			if s, ok := vitalSigns["systolic_bp"].(float64); ok {
				sysInt := int(s)
				if sysInt > 0 {
					sys = &sysInt
				}
			} else {
			}
			if d, ok := vitalSigns["diastolic_bp"].(float64); ok {
				diaInt := int(d)
				if diaInt > 0 {
					dia = &diaInt
				}
			} else {
			}
			if p, ok := vitalSigns["pulse"].(float64); ok {
				pulseInt := int(p)
				if pulseInt >= 40 && pulseInt <= 200 {
					pulse = &pulseInt
				} else {
				}
			} else {
			}
			if s, ok := vitalSigns["saturation"].(float64); ok {
				satInt := int(s)
				if satInt >= 70 && satInt <= 100 {
					saturation = &satInt
				} else {
				}
			} else {
			}
			// Если нашли витальные показатели в vital_signs, возвращаем их (они имеют приоритет)
			if temp != nil || sys != nil || pulse != nil || saturation != nil {
				if sys != nil && dia != nil {
					vv := fmt.Sprintf("%d/%d", *sys, *dia)
					bpStr = &vv
				}
				return
			} else {
			}
		} else {
		}
	} else {
	}

	// Температура
	for _, k := range []string{"temperature", "temp", "температура"} {
		if v, ok := answers[k]; ok && v != "" {
			if m := reTemp.FindStringSubmatch("temp " + v); len(m) == 2 {
				s := strings.ReplaceAll(m[1], ",", ".")
				if f, err := strconv.ParseFloat(s, 64); err == nil && f >= 34 && f <= 45 {
					temp = &f
					break
				}
			}
			if f, err := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64); err == nil && f >= 34 && f <= 45 {
				temp = &f
				break
			} else {
			}
		}
	}

	// Артериальное давление
	for _, k := range []string{"bp", "blood_pressure", "ад"} {
		if v, ok := answers[k]; ok && v != "" {
			if m := reBP.FindStringSubmatch(v); len(m) == 3 {
				if s, err1 := strconv.Atoi(m[1]); err1 == nil {
					if d, err2 := strconv.Atoi(m[2]); err2 == nil {
						sys, dia = &s, &d
						vv := m[1] + "/" + m[2]
						bpStr = &vv
						break
					} else {
					}
				} else {
				}
			} else {
			}
		}
	}

	// Пульс
	for _, k := range []string{"pulse", "heart_rate", "пульс"} {
		if v, ok := answers[k]; ok && v != "" {
			if m := rePulse.FindStringSubmatch("pulse " + v); len(m) == 2 {
				if p, err := strconv.Atoi(m[1]); err == nil && p >= 40 && p <= 200 {
					pulse = &p
					break
				} else {
				}
			}
			if p, err := strconv.Atoi(v); err == nil && p >= 40 && p <= 200 {
				pulse = &p
				break
			} else {
			}
		}
	}

	// Сатурация
	for _, k := range []string{"saturation", "spo2", "sp_o2", "сатурация"} {
		if v, ok := answers[k]; ok && v != "" {
			if s, err := strconv.Atoi(v); err == nil && s >= 70 && s <= 100 {
				saturation = &s
				break
			} else {
			}
		}
	}

	return
}

// -----------------------------
// Сервис
// -----------------------------
type HealthPassportService struct {
	repository          *repository.HealthPassportRepository
	patientClient       *client.PatientClient
	appointmentService  *client.AppointmentClient
	doctorService       *client.DoctorService
	fileServerClient    *client.FileServerClient
	contentGenerator    *pdf.ContentGenerator
	pdfGenerator        *pdf.PDFGenerator
	openaiClient        *openai.Client
	fileAnalysisService *FileAnalysisService
}

func NewHealthPassportService(
	patientClient *client.PatientClient,
	appointmentService *client.AppointmentClient,
	doctorService *client.DoctorService,
	fileServerClient *client.FileServerClient,
	contentGenerator *pdf.ContentGenerator,
	pdfGenerator *pdf.PDFGenerator,
	openaiClient *openai.Client,
) *HealthPassportService {
	fileAnalysisConfig := DefaultFileAnalysisConfig()
	fileAnalysisService := NewFileAnalysisService(
		fileServerClient,
		appointmentService,
		openaiClient,
		fileAnalysisConfig,
	)

	return &HealthPassportService{
		repository:          repository.NewHealthPassportRepository(),
		patientClient:       patientClient,
		appointmentService:  appointmentService,
		doctorService:       doctorService,
		fileServerClient:    fileServerClient,
		contentGenerator:    contentGenerator,
		pdfGenerator:        pdfGenerator,
		openaiClient:        openaiClient,
		fileAnalysisService: fileAnalysisService,
	}
}

// -----------------------------
// Публичные методы
// -----------------------------

func (s *HealthPassportService) GenerateHealthPassport(ctx context.Context, req *models.HealthPassportRequest, token string) (*models.HealthPassport, error) {
	if err := s.validateRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	if err := s.doctorService.ValidateDoctorRole(req.DoctorID, token); err != nil {
		return nil, fmt.Errorf("doctor validation failed: %w", err)
	}

	appointment, err := s.appointmentService.GetAppointment(req.AppointmentID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get appointment: %w", err)
	}

	if appointment.DoctorID != req.DoctorID {
		return nil, fmt.Errorf("appointment does not belong to doctor")
	}

	// Проверяем, существует ли уже health passport для этого appointment и analysis
	// Если analysis_id пустой, используем пустую строку для поиска паспорта без анкеты
	analysisIDForSearch := req.AnalysisID
	if analysisIDForSearch == "" {
		analysisIDForSearch = "" // Явно используем пустую строку для паспортов без анкеты
	}
	existingPassport, err := s.repository.GetHealthPassportByAppointmentAndAnalysis(ctx, req.AppointmentID, analysisIDForSearch)
	if err == nil && existingPassport != nil {
		// Если health passport уже существует, проверяем наличие file_id
		if existingPassport.FileID == nil || *existingPassport.FileID == "" {
			// Если file_id отсутствует, нужно сгенерировать DOCX
			if existingPassport.Content == nil {
				// Если контент отсутствует, нужно обновить существующий паспорт новым контентом
				// Продолжаем выполнение ниже для генерации контента и обновления
			} else {
				// Генерируем DOCX из существующего контента
				pdfData := &pdf.HealthPassportData{
					Patient:           existingPassport.Content.Patient,
					Doctor:            existingPassport.Content.Doctor,
					Answers:           existingPassport.Content.Answers,
					Complaints:        existingPassport.Content.Complaints,
					MedicalHistory:    existingPassport.Content.MedicalHistory,
					Lifestyle:         existingPassport.Content.Lifestyle,
					FilesAnalysis:     existingPassport.Content.FilesAnalysis,
					GeneralConclusion: existingPassport.Content.GeneralConclusion,
					CurrentState:      existingPassport.Content.CurrentState,
					ObjectiveStatus:   existingPassport.Content.ObjectiveStatus,
					DiagnosisMain:     existingPassport.Content.DiagnosisMain,
					DiagnosisComorbid: existingPassport.Content.DiagnosisComorbid,
					PlanExam:          existingPassport.Content.PlanExam,
					PlanTreatment:     existingPassport.Content.PlanTreatment,
					PlanGeneral:       existingPassport.Content.PlanGeneral,
					GeneratedAt:       existingPassport.Content.GeneratedAt,
				}

				docxPath, err := s.pdfGenerator.GenerateHealthPassport(pdfData)
				if err != nil {
					return nil, fmt.Errorf("failed to generate DOCX: %w", err)
				}

				fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
				if err != nil {
					_ = s.pdfGenerator.CleanupFile(docxPath)
					return nil, fmt.Errorf("failed to upload DOCX: %w", err)
				}
				_ = s.pdfGenerator.CleanupFile(docxPath)

				if err := s.repository.UpdateHealthPassportFileID(ctx, existingPassport.ID, fileID); err != nil {
					return nil, fmt.Errorf("failed to update file_id: %w", err)
				}
				existingPassport.FileID = &fileID
			}
		}
		// Если file_id есть, перегенерируем DOCX (на случай, если был старый PDF)
		if existingPassport.FileID != nil && *existingPassport.FileID != "" {
			// Перегенерируем DOCX из существующего контента
			if existingPassport.Content != nil {
				pdfData := &pdf.HealthPassportData{
					Patient:           existingPassport.Content.Patient,
					Doctor:            existingPassport.Content.Doctor,
					Answers:           existingPassport.Content.Answers,
					Complaints:        existingPassport.Content.Complaints,
					MedicalHistory:    existingPassport.Content.MedicalHistory,
					Lifestyle:         existingPassport.Content.Lifestyle,
					FilesAnalysis:     existingPassport.Content.FilesAnalysis,
					GeneralConclusion: existingPassport.Content.GeneralConclusion,
					CurrentState:      existingPassport.Content.CurrentState,
					ObjectiveStatus:   existingPassport.Content.ObjectiveStatus,
					DiagnosisMain:     existingPassport.Content.DiagnosisMain,
					DiagnosisComorbid: existingPassport.Content.DiagnosisComorbid,
					PlanExam:          existingPassport.Content.PlanExam,
					PlanTreatment:     existingPassport.Content.PlanTreatment,
					PlanGeneral:       existingPassport.Content.PlanGeneral,
					GeneratedAt:       existingPassport.Content.GeneratedAt,
				}

				docxPath, err := s.pdfGenerator.GenerateHealthPassport(pdfData)
				if err != nil {
					// Если не удалось перегенерировать, возвращаем существующий
					return existingPassport, nil
				}

				fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
				if err != nil {
					_ = s.pdfGenerator.CleanupFile(docxPath)
					// Если не удалось загрузить, возвращаем существующий
					return existingPassport, nil
				}
				_ = s.pdfGenerator.CleanupFile(docxPath)

				if err := s.repository.UpdateHealthPassportFileID(ctx, existingPassport.ID, fileID); err != nil {
					return existingPassport, nil
				}
				existingPassport.FileID = &fileID
			}
			return existingPassport, nil
		}
		// Если паспорт существует, но нет контента или file_id, нужно обновить его
		// Это обрабатывается ниже, где генерируется контент
		if existingPassport.Content == nil || (existingPassport.FileID == nil || *existingPassport.FileID == "") {
			// Продолжаем выполнение для генерации контента и обновления существующего паспорта
		} else {
			// Паспорт существует и имеет контент и file_id, возвращаем его
			return existingPassport, nil
		}
	}
	// Если ошибка не связана с отсутствием записи, возвращаем её
	if err != nil && !strings.Contains(err.Error(), "health passport not found") {
		return nil, fmt.Errorf("failed to check passport existence: %w", err)
	}
	
	// Определяем, нужно ли создавать новый паспорт или обновлять существующий
	var existingPassportToUpdate *models.HealthPassport
	if err == nil && existingPassport != nil {
		existingPassportToUpdate = existingPassport
	} else {
	}

	// Запись анализа: сначала по id строки analysis_records; часто с фронта приходит user_id пациента — тогда id не находится
	var analysisRecord *models.AnalysisRecord
	if req.AnalysisID != "" {
		rec, err := repository.GetAnalysisRecordByID(ctx, req.AnalysisID)
		if err == nil {
			if rec.UserID != appointment.PatientID {
				return nil, fmt.Errorf("analysis record does not belong to this appointment patient")
			}
			analysisRecord = rec
		} else if errors.Is(err, repository.ErrAnalysisRecordNotFound) {
			byPatient, pErr := repository.GetRecordsByUser(ctx, appointment.PatientID)
			if pErr != nil {
				return nil, fmt.Errorf("failed to list analysis records for patient: %w", pErr)
			}
			if len(byPatient) > 0 {
				analysisRecord = &byPatient[0]
			}
		} else {
			return nil, fmt.Errorf("failed to get analysis record: %w", err)
		}
	}

	patientProfile, err := s.patientClient.GetPatientProfile(appointment.PatientID, token)
	if err != nil {
		if errors.Is(err, client.ErrPatientProfileNotFound) {
			log.Printf("health passport: patient profile 404 for user_id=%s, using stub profile", appointment.PatientID)
			patientProfile = stubPatientProfile(appointment.PatientID)
		} else {
			return nil, fmt.Errorf("failed to get patient profile: %w", err)
		}
	}

	doctor, err := s.doctorService.GetDoctor(req.DoctorID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get doctor data: %w", err)
	}

	// Источник ответов — приоритет req.Answers, иначе из анализа (если есть)
	var answersToUse map[string]string
	if len(req.Answers) > 0 {
		answersToUse = req.Answers
	} else if analysisRecord != nil && analysisRecord.Answers != nil {
		answersToUse = analysisRecord.Answers
	} else {
		// Если нет ни req.Answers, ни analysisRecord, используем пустую карту
		answersToUse = make(map[string]string)
	}

	// Парсим текстовую транскрипцию, если пришла
	if req.TranscriptionText != nil && *req.TranscriptionText != "" {
		if extractedAnswers, err := s.extractAnswersFromTranscription(*req.TranscriptionText, req.Lang); err == nil {
			// Проверяем, есть ли vital_signs в извлеченных ответах
			if vsStr, ok := extractedAnswers["vital_signs"]; ok && vsStr != "" {
			}
			for key, value := range extractedAnswers {
				if value != "" && (answersToUse == nil || answersToUse[key] == "") {
					if answersToUse == nil {
						answersToUse = make(map[string]string)
					}
					answersToUse[key] = value
				}
			}
		} else {
		}
	}
	

	// Генерация основного контента
	passportData, err := s.generatePassportContent(ctx, patientProfile, doctor, answersToUse, req.AppointmentID, req.Lang, token)
	if err != nil {
		return nil, fmt.Errorf("failed to generate passport content: %w", err)
	}

	// Сохраняем запись (создаем новый или обновляем существующий)
	var healthPassport *models.HealthPassport
	if existingPassportToUpdate != nil {
		// Обновляем существующий паспорт
		existingPassportToUpdate.Content = passportData
		if req.TranscriptionText != nil {
			existingPassportToUpdate.TranscriptionText = req.TranscriptionText
		}
		if err := s.repository.UpdateHealthPassportContent(ctx, existingPassportToUpdate.ID, passportData); err != nil {
			return nil, fmt.Errorf("failed to update health passport content: %w", err)
		}
		healthPassport = existingPassportToUpdate
	} else {
		// Создаем новый паспорт
		healthPassport = &models.HealthPassport{
			PatientID:         appointment.PatientID,
			DoctorID:          req.DoctorID,
			AppointmentID:     req.AppointmentID,
			AnalysisID:        req.AnalysisID,
			TranscriptionText: req.TranscriptionText,
			Content:           passportData,
		}
		if err := s.repository.CreateHealthPassport(ctx, healthPassport); err != nil {
			// Если ошибка связана с дубликатом, пытаемся получить существующий и обновить
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
				analysisIDForSearch := req.AnalysisID
				if analysisIDForSearch == "" {
					analysisIDForSearch = ""
				}
				existingPassport, getErr := s.repository.GetHealthPassportByAppointmentAndAnalysis(ctx, req.AppointmentID, analysisIDForSearch)
				if getErr == nil && existingPassport != nil {
					existingPassport.Content = passportData
					if req.TranscriptionText != nil {
						existingPassport.TranscriptionText = req.TranscriptionText
					}
					if updateErr := s.repository.UpdateHealthPassportContent(ctx, existingPassport.ID, passportData); updateErr != nil {
						return nil, fmt.Errorf("failed to update existing health passport: %w", updateErr)
					}
					// ВАЖНО: Используем existingPassport, но убедимся, что file_id будет обновлен позже
					// Не останавливаемся здесь - продолжаем генерацию DOCX и обновление file_id
					healthPassport = existingPassport
				} else {
					return nil, fmt.Errorf("failed to create health passport record: %w", err)
				}
			} else {
				return nil, fmt.Errorf("failed to create health passport record: %w", err)
			}
		} else {
		}
	}

	// Трёхфазный процесс генерации DOCX
	
	// Фаза 1: Генерируем DOCX до "Интерпретация данных исследований" (без диагноза и планов)
	pdfDataPhase1 := &pdf.HealthPassportData{
		Patient:           passportData.Patient,
		Doctor:            passportData.Doctor,
		Answers:           passportData.Answers,
		Complaints:        passportData.Complaints,
		MedicalHistory:    passportData.MedicalHistory,
		Lifestyle:         passportData.Lifestyle,
		FilesAnalysis:     passportData.FilesAnalysis,
		GeneralConclusion: passportData.GeneralConclusion,
		CurrentState:      passportData.CurrentState,
		ObjectiveStatus:   passportData.ObjectiveStatus,
		DiagnosisMain:     "", // Пусто для фазы 1
		DiagnosisComorbid: []string{}, // Пусто для фазы 1
		PlanExam:          "", // Пусто для фазы 1
		PlanTreatment:     "", // Пусто для фазы 1
		PlanGeneral:       "", // Пусто для фазы 1
		GeneratedAt:       passportData.GeneratedAt,
	}
	
	// Генерируем временный файл для фазы 1
	timestampDocx := time.Now().Format("20060102_150405")
	randomID := rand.Intn(90000) + 10000
	phase1Filename := fmt.Sprintf("Медицинский_документ_пациента_%05d_%s_phase1.docx", randomID, timestampDocx)
	phase1Path := filepath.Join(s.pdfGenerator.GetOutputPath(), phase1Filename)
	
	if err := s.pdfGenerator.GenerateHealthPassportToFile(pdfDataPhase1, phase1Path); err != nil {
		return nil, fmt.Errorf("phase 1 failed: %w", err)
	}
	
	// Извлекаем текст из Phase 1 DOCX
	docxText, err := text.ExtractTextFromDOCX(phase1Path)
	if err != nil {
		os.Remove(phase1Path)
		return nil, fmt.Errorf("failed to extract text from phase 1 DOCX: %w", err)
	}
	
	// Фаза 2: Генерируем диагноз на основе Phase 1 DOCX
	diagnosisResult, err := s.contentGenerator.GenerateDiagnosisFromDOCX(docxText, req.Lang)
	if err != nil {
		// Fallback на существующий диагноз
		diagnosisResult = &pdf.DiagnosisResult{
			DiagnosisMain:     passportData.DiagnosisMain,
			DiagnosisComorbid: passportData.DiagnosisComorbid,
		}
	}
	
	// Обновляем данные с диагнозом
	pdfDataPhase2 := &pdf.HealthPassportData{
		Patient:           passportData.Patient,
		Doctor:            passportData.Doctor,
		Answers:           passportData.Answers,
		Complaints:        passportData.Complaints,
		MedicalHistory:    passportData.MedicalHistory,
		Lifestyle:         passportData.Lifestyle,
		FilesAnalysis:     passportData.FilesAnalysis,
		GeneralConclusion: passportData.GeneralConclusion,
		CurrentState:      passportData.CurrentState,
		ObjectiveStatus:   passportData.ObjectiveStatus,
		DiagnosisMain:     diagnosisResult.DiagnosisMain,
		DiagnosisComorbid: diagnosisResult.DiagnosisComorbid,
		PlanExam:          "", // Пусто для фазы 2
		PlanTreatment:     "", // Пусто для фазы 2
		PlanGeneral:       "", // Пусто для фазы 2
		GeneratedAt:       passportData.GeneratedAt,
	}
	
	// Генерируем Phase 2 DOCX (с диагнозом, без планов)
	phase2Filename := fmt.Sprintf("Медицинский_документ_пациента_%05d_%s_phase2.docx", randomID, timestampDocx)
	phase2Path := filepath.Join(s.pdfGenerator.GetOutputPath(), phase2Filename)
	
	if err := s.pdfGenerator.GenerateHealthPassportToFile(pdfDataPhase2, phase2Path); err != nil {
		os.Remove(phase1Path)
		return nil, fmt.Errorf("phase 2 failed: %w", err)
	}
	
	// Извлекаем текст из Phase 2 DOCX (с диагнозом)
	docxText2, err := text.ExtractTextFromDOCX(phase2Path)
	if err != nil {
		os.Remove(phase1Path)
		os.Remove(phase2Path)
		return nil, fmt.Errorf("failed to extract text from phase 2 DOCX: %w", err)
	}
	
	// Фаза 3: Генерируем планы на основе Phase 2 DOCX (с диагнозом)
	plansResult, err := s.contentGenerator.GeneratePlansFromDOCX(docxText2, req.Lang)
	if err != nil {
		// Fallback на существующие планы
		plansResult = &pdf.PlansResult{
			PlanExam:      passportData.PlanExam,
			PlanTreatment: passportData.PlanTreatment,
			PlanGeneral:   passportData.PlanGeneral,
		}
	}
	
	// Финальный DOCX с диагнозом и планами
	finalFilename := fmt.Sprintf("Медицинский_документ_пациента_%05d_%s.docx", randomID, timestampDocx)
	finalPath := filepath.Join(s.pdfGenerator.GetOutputPath(), finalFilename)
	
	pdfDataFinal := &pdf.HealthPassportData{
		Patient:           passportData.Patient,
		Doctor:            passportData.Doctor,
		Answers:           passportData.Answers,
		Complaints:        passportData.Complaints,
		MedicalHistory:    passportData.MedicalHistory,
		Lifestyle:         passportData.Lifestyle,
		FilesAnalysis:     passportData.FilesAnalysis,
		GeneralConclusion: passportData.GeneralConclusion,
		CurrentState:      passportData.CurrentState,
		ObjectiveStatus:   passportData.ObjectiveStatus,
		DiagnosisMain:     diagnosisResult.DiagnosisMain,
		DiagnosisComorbid: diagnosisResult.DiagnosisComorbid,
		PlanExam:          plansResult.PlanExam,
		PlanTreatment:     plansResult.PlanTreatment,
		PlanGeneral:       plansResult.PlanGeneral,
		GeneratedAt:       passportData.GeneratedAt,
	}
	
	if err := s.pdfGenerator.GenerateHealthPassportToFile(pdfDataFinal, finalPath); err != nil {
		os.Remove(phase1Path)
		os.Remove(phase2Path)
		return nil, fmt.Errorf("phase 3 failed: %w", err)
	}
	
	// Удаляем временные файлы
	os.Remove(phase1Path)
	os.Remove(phase2Path)
	
	docxPath := finalPath

	// Проверяем, что файл действительно DOCX перед загрузкой
	if _, err := os.Stat(docxPath); err != nil {
		_ = s.pdfGenerator.CleanupFile(docxPath)
		return nil, fmt.Errorf("DOCX file not found before upload: %w", err)
	} else {
		// Проверяем магические байты DOCX (ZIP формат)
		file, err := os.Open(docxPath)
		if err == nil {
			header := make([]byte, 4)
			if n, _ := file.Read(header); n == 4 {
				if header[0] == 0x50 && header[1] == 0x4B && (header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07) {
				} else {
				}
			}
			file.Close()
		}
	}

	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем содержимое файла ПЕРЕД загрузкой
	preUploadFile, err := os.Open(docxPath)
	if err == nil {
		defer preUploadFile.Close()
		preHeader := make([]byte, 4)
		if n, _ := preUploadFile.Read(preHeader); n == 4 {
			isDocxBeforeUpload := (preHeader[0] == 0x50 && preHeader[1] == 0x4B && 
			                      (preHeader[2] == 0x03 || preHeader[2] == 0x05 || preHeader[2] == 0x07))
			isPdfBeforeUpload := string(preHeader) == "%PDF"
			
			if isPdfBeforeUpload {
				_ = s.pdfGenerator.CleanupFile(docxPath)
				return nil, fmt.Errorf("CRITICAL: generated file is PDF instead of DOCX (header: %x). Check pandoc installation and configuration", preHeader)
			} else if isDocxBeforeUpload {
			} else {
			}
		}
	}

	fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
	if err != nil {
		_ = s.pdfGenerator.CleanupFile(docxPath)
		return nil, fmt.Errorf("failed to upload DOCX: %w", err)
	}
	
	// КРИТИЧЕСКАЯ ПРОВЕРКА: Скачиваем файл обратно и проверяем его содержимое
	downloadedData, downloadErr := s.fileServerClient.DownloadFile(fileID, token)
	if downloadErr != nil {
		// НЕ возвращаем ошибку здесь, так как файл может быть OK, просто файл-сервер недоступен для проверки
	} else {
		if len(downloadedData) >= 4 {
			downloadedHeader := downloadedData[:4]
			isPdfDownloaded := string(downloadedHeader) == "%PDF"
			isDocxDownloaded := (downloadedHeader[0] == 0x50 && downloadedHeader[1] == 0x4B && 
			                    (downloadedHeader[2] == 0x03 || downloadedHeader[2] == 0x05 || downloadedHeader[2] == 0x07))
			
			if isPdfDownloaded {
				_ = s.pdfGenerator.CleanupFile(docxPath)
				return nil, fmt.Errorf("CRITICAL: file server returned PDF instead of DOCX after upload (header: %x, size: %d bytes). Check file server configuration", downloadedHeader, len(downloadedData))
			} else if isDocxDownloaded {
			} else {
			}
		} else {
		}
	}
	
	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем метаданные загруженного файла
	var fileMetadata *client.FileMetadata
		if metadata, err := s.fileServerClient.GetFileMetadata(fileID, token); err == nil {
			fileMetadata = metadata
		
		// Проверяем формат файла
		isDocx := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".docx") ||
		         strings.Contains(strings.ToLower(metadata.MimeType), "word") ||
		         strings.Contains(strings.ToLower(metadata.MimeType), "docx") ||
		         strings.Contains(strings.ToLower(metadata.MimeType), "officedocument")
		
		isPdf := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".pdf") ||
		         strings.Contains(strings.ToLower(metadata.MimeType), "pdf")
		
		// КРИТИЧЕСКАЯ ПРОВЕРКА: MIME-тип должен быть правильным
		expectedMimeTypes := []string{
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/msword",
			"application/x-msword",
		}
		hasCorrectMimeType := false
		for _, expectedMime := range expectedMimeTypes {
			if strings.EqualFold(metadata.MimeType, expectedMime) {
				hasCorrectMimeType = true
				break
			}
		}
		
		if isPdf {
			_ = s.pdfGenerator.CleanupFile(docxPath)
			return nil, fmt.Errorf("CRITICAL: file server metadata shows PDF instead of DOCX (MIME: %s, Name: %s)", metadata.MimeType, metadata.OriginalName)
		} else if !hasCorrectMimeType && metadata.MimeType == "application/octet-stream" {
		} else if !isDocx {
		} else {
		}
	} else {
	}
	
	_ = s.pdfGenerator.CleanupFile(docxPath)
	
	// Сохраняем метаданные для возврата в ответе
	if fileMetadata != nil {
		// Добавляем метаданные в контекст для использования в handler
		// (это будет использовано в handler для добавления в ответ)
	}

	if err := s.repository.UpdateHealthPassportFileID(ctx, healthPassport.ID, fileID); err != nil {
		return nil, fmt.Errorf("failed to update file_id in database: %w", err)
	}
	healthPassport.FileID = &fileID
	
	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем, что file_id действительно сохранился в БД
	verifyPassport, verifyErr := s.repository.GetHealthPassportByID(ctx, healthPassport.ID)
	if verifyErr != nil {
	} else if verifyPassport.FileID == nil || *verifyPassport.FileID != fileID {
		if verifyPassport.FileID == nil {
		} else {
		}
		return nil, fmt.Errorf("CRITICAL: file_id was not saved correctly in database. Expected: %s, Got: %v", fileID, verifyPassport.FileID)
	} else {
		// ВАЖНО: Обновляем healthPassport из проверенного объекта, чтобы гарантировать актуальные данные
		healthPassport.FileID = verifyPassport.FileID
	}

	// Финальная проверка перед возвратом
	if healthPassport.FileID == nil || *healthPassport.FileID == "" {
		return nil, fmt.Errorf("CRITICAL: healthPassport.FileID is empty before return. This should not happen after verification")
	}

	// Мягко связываем с приёмом
	_ = s.appointmentService.UpdateAppointmentHealthPassport(req.AppointmentID, healthPassport.ID, token)

	return healthPassport, nil
}

func (s *HealthPassportService) GetHealthPassport(ctx context.Context, id string) (*models.HealthPassport, error) {
	return s.repository.GetHealthPassportByID(ctx, id)
}

func (s *HealthPassportService) GetHealthPassportsByPatient(ctx context.Context, patientID string) ([]*models.HealthPassport, error) {
	return s.repository.GetHealthPassportsByPatientID(ctx, patientID)
}

func (s *HealthPassportService) DeleteHealthPassport(ctx context.Context, id, doctorID string) error {
	return s.repository.DeleteHealthPassport(ctx, id, doctorID)
}

func (s *HealthPassportService) GetFileMetadata(ctx context.Context, fileID, token string) (*client.FileMetadata, error) {
	return s.fileServerClient.GetFileMetadata(fileID, token)
}

func (s *HealthPassportService) DownloadHealthPassportFile(ctx context.Context, id string, token string) ([]byte, *client.FileMetadata, error) {
	
	passport, err := s.repository.GetHealthPassportByID(ctx, id)
	if err != nil {
		return nil, nil, fmt.Errorf("health passport not found: %w", err)
	}

	if passport.FileID == nil || *passport.FileID == "" {
		return nil, nil, fmt.Errorf("file not found: health passport file has not been generated yet")
	}


	// Получаем метаданные файла
	metadata, err := s.fileServerClient.GetFileMetadata(*passport.FileID, token)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get file metadata: %w", err)
	}

	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем, что файл не PDF по метаданным
	isPdfByMetadata := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".pdf") ||
	                   strings.Contains(strings.ToLower(metadata.MimeType), "pdf")
	if isPdfByMetadata {
	}

	// Скачиваем файл
	fileData, err := s.fileServerClient.DownloadFile(*passport.FileID, token)
	if err != nil {
		return nil, metadata, fmt.Errorf("failed to download file: %w", err)
	}


	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем содержимое скачанного файла
	if len(fileData) >= 4 {
		header := fileData[:4]
		isPdfContent := string(header) == "%PDF"
		isDocxContent := (header[0] == 0x50 && header[1] == 0x4B && 
		                 (header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07))
		
		if isPdfContent {
			return nil, metadata, fmt.Errorf("CRITICAL: downloaded file is PDF instead of DOCX (header: %x). Please regenerate the health passport", header)
		} else if isDocxContent {
		} else {
		}
	}

	return fileData, metadata, nil
}

// -----------------------------
// Генерация контента
// -----------------------------
func (s *HealthPassportService) generatePassportContent(
	ctx context.Context,
	patientProfile *client.PatientProfile,
	doctor *client.Doctor,
	answers map[string]string,
	appointmentID string,
	lang string,
	token string,
) (*models.HealthPassportData, error) {
	// Вытянуть витальные из ответов
	t, sBP, dBP, p, sat, bp := parseVitals(answers)

	// Пациент
	patientInfo := &models.PatientInfo{
		ID:         patientProfile.ID,
		FirstName:  patientProfile.FirstName,
		MiddleName: patientProfile.MiddleName,
		LastName:   patientProfile.LastName,
		BirthDate:  patientProfile.DateOfBirth,
		Age:        calculateAge(patientProfile.DateOfBirth),
		Gender:     genderRu(patientProfile.Gender),
		IIN:        patientProfile.IIN,
		Phone:      patientProfile.Phone,
		Email:      patientProfile.Email,
		Address:    patientProfile.Address,
		Height:     float64(patientProfile.Height),
		Weight:     float64(patientProfile.Weight),
		BMI:        calculateBMI(float64(patientProfile.Height), float64(patientProfile.Weight)),

		Temperature: t,
		SystolicBP:  sBP,
		DiastolicBP: dBP,
		Pulse:       p,
		Saturation:  sat,
		BPString:    bp,

		ChronicDiseases: patientProfile.Diagnoses,
		Allergies:       patientProfile.Allergens,
		Diets:           patientProfile.Diet,
	}

	// Доктор
	doctorInfo := &models.DoctorInfo{
		ID:          doctor.ID,
		FirstName:   doctor.FirstName,
		MiddleName:  doctor.MiddleName,
		LastName:    doctor.LastName,
		Roles:       doctor.Roles,
		Email:       doctor.Email,
		Phone:       doctor.Phone,
		Description: doctor.Description,
	}

	// Текстовые разделы
	complaints, err := s.contentGenerator.GenerateComplaints(answers, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate complaints: %w", err)
	}
	medicalHistory, err := s.contentGenerator.GenerateMedicalHistory(patientProfile, answers, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate medical history: %w", err)
	}
	lifestyle, err := s.contentGenerator.GenerateLifestyleWithProfile(patientProfile, answers, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate lifestyle: %w", err)
	}

	// Анализ файлов (до 5 штук) - ОПЦИОНАЛЬНЫЙ ПРОЦЕСС
	// Файлы могут отсутствовать - это нормально, продолжаем генерацию без них
	var filesAnalysis string
	appointmentFiles, err := s.appointmentService.GetAppointmentFiles(appointmentID, token)
	if err != nil {
		// Обрабатываем различные типы ошибок
		if strings.Contains(err.Error(), "500") || strings.Contains(err.Error(), "Internal Server Error") {
		}
		filesAnalysis = getLocalizedMessage("files_not_found", lang)
		// НЕ возвращаем ошибку - продолжаем генерацию паспорта без анализа файлов
	} else if len(appointmentFiles) == 0 {
		filesAnalysis = getLocalizedMessage("no_files", lang)
	} else {
		fileReferences := convertAppointmentFilesToReferences(appointmentFiles, appointmentID)
		
		// Добавляем информацию о поле пациента в контекст для улучшения анализа
		contextWithGender := "health_passport_generation"
		if patientProfile.Gender != "" {
			genderInfo := genderRu(patientProfile.Gender)
			if genderInfo != "—" {
				contextWithGender = fmt.Sprintf("health_passport_generation|patient_gender:%s", strings.ToLower(genderInfo))
			}
		}
		
		analysisReq := &FileAnalysisRequest{
			AppointmentID: appointmentID,
			Files:         fileReferences,
			Language:      lang,
			Context:       contextWithGender,
			MaxFiles:      11,
		}
		
		// Используем AnalyzeFilesEnhanced для получения результатов с витальными показателями
		enhancedReq := &EnhancedFileAnalysisRequest{
			AppointmentID: analysisReq.AppointmentID,
			Files:         analysisReq.Files,
			Language:      analysisReq.Language,
			Context:       analysisReq.Context,
			MaxFiles:      analysisReq.MaxFiles,
			EnableOCR:     false,
			OCRFirst:      false,
			BatchSize:      8,
		}
		progress, progressErr := s.fileAnalysisService.AnalyzeFilesEnhanced(ctx, enhancedReq, token)
		
		if progressErr != nil {
			filesAnalysis = fmt.Sprintf("%s %d %s: %v",
				getLocalizedMessage("found_files", lang),
				len(appointmentFiles),
				getLocalizedMessage("files_but_analysis_failed", lang),
				progressErr)
		} else if progress != nil {
			// Собираем витальные показатели из всех результатов
			for _, result := range progress.Results {
				if result.VitalSigns != nil {
					// Обновляем витальные показатели пациента (приоритет у данных из файлов)
					if result.VitalSigns.Temperature != nil && t == nil {
						t = result.VitalSigns.Temperature
					}
					if result.VitalSigns.SystolicBP != nil && sBP == nil {
						sBP = result.VitalSigns.SystolicBP
					}
					if result.VitalSigns.DiastolicBP != nil && dBP == nil {
						dBP = result.VitalSigns.DiastolicBP
					}
					if result.VitalSigns.Pulse != nil && p == nil {
						p = result.VitalSigns.Pulse
					}
					if result.VitalSigns.Saturation != nil && sat == nil {
						sat = result.VitalSigns.Saturation
					}
				}
			}
			if t != nil || sBP != nil || p != nil || sat != nil {
			}
			
			// Форматируем результаты анализа
			// Используем AnalyzeFiles для форматирования (он вызывает formatAnalysisResults внутри)
			// Это означает двойной анализ, но витальные показатели уже собраны из progress выше
			filesAnalysis, _ = s.fileAnalysisService.AnalyzeFiles(ctx, analysisReq, token)
			if len(filesAnalysis) == 0 {
				filesAnalysis = getLocalizedMessage("no_files", lang)
			} else {
				previewLen := 200
				if len(filesAnalysis) < previewLen {
					previewLen = len(filesAnalysis)
				}
			}
		} else {
			filesAnalysis = getLocalizedMessage("no_files", lang)
		}
		
		// Обновляем данные пациента с витальными показателями из файлов
		if t != nil || sBP != nil || p != nil || sat != nil {
			patientInfo.Temperature = t
			patientInfo.SystolicBP = sBP
			patientInfo.DiastolicBP = dBP
			patientInfo.Pulse = p
			patientInfo.Saturation = sat
			if sBP != nil && dBP != nil {
				bpStr := fmt.Sprintf("%d/%d", *sBP, *dBP)
				patientInfo.BPString = &bpStr
			}
		} else {
		}
		
		// Старый код для обратной совместимости (если AnalyzeFiles все еще используется)
		if false {
			filesAnalysis, err = s.fileAnalysisService.AnalyzeFiles(ctx, analysisReq, token)
		}
		if false {
			// Файлы есть, но анализ не удался - продолжаем без результатов анализа
			// НЕ ОСТАНАВЛИВАЕМ процесс - анализ файлов является опциональным
			filesAnalysis = fmt.Sprintf("%s %d %s: %v",
				getLocalizedMessage("found_files", lang),
				len(appointmentFiles),
				getLocalizedMessage("files_but_analysis_failed", lang),
				err)
		} else {
			if len(filesAnalysis) == 0 {
				filesAnalysis = getLocalizedMessage("no_files", lang)
			}
		}
	}
	
	// Убеждаемся, что filesAnalysis всегда имеет значение (даже если это сообщение об ошибке)
	if filesAnalysis == "" {
		filesAnalysis = getLocalizedMessage("no_files", lang)
	}
	
	previewLen := 50
	if len(filesAnalysis) < previewLen {
		previewLen = len(filesAnalysis)
	}

	// Получаем структурированное заключение (JSON)
	structuredConclusion, rawConclusion, err := s.contentGenerator.GenerateDoctorConclusionStructured(patientProfile, answers, complaints, filesAnalysis, lang)
	
	var currentState, obj, dMain string
	var dCom []string
	var pExam, pTreat, pGen string
	var generalConclusion string
	
	if err != nil {
		// Fallback на Markdown, если JSON не получился
		docConclusion, fallbackErr := s.contentGenerator.GenerateDoctorConclusion(patientProfile, answers, complaints, filesAnalysis, lang)
		if fallbackErr != nil {
			return nil, fmt.Errorf("failed to generate doctor conclusion (both structured and markdown failed): %w, fallback: %w", err, fallbackErr)
		}
		generalConclusion = docConclusion
		// Пытаемся распарсить из Markdown структурированные поля
		currentState, obj, dMain, dCom, pExam, pTreat, pGen = parseStructuredFromMarkdown(generalConclusion, lang)
	} else {
		// Используем структурированные данные напрямую
		currentState = structuredConclusion.CurrentState
		obj = structuredConclusion.ObjectiveStatus
		dMain = structuredConclusion.DiagnosisMain
		dCom = structuredConclusion.DiagnosisComorbid
		pExam = structuredConclusion.PlanExam
		pTreat = structuredConclusion.PlanTreatment
		pGen = structuredConclusion.PlanGeneral
		
		// Создаем Markdown fallback для совместимости
		generalConclusion = rawConclusion
		
	}

	// Полный объект данных
	passportData := &models.HealthPassportData{
		Patient:        patientInfo,
		Doctor:         doctorInfo,
		Answers:        answers,
		Complaints:     complaints,
		MedicalHistory: medicalHistory,
		Lifestyle:      lifestyle,
		FilesAnalysis:  filesAnalysis, // Это должно содержать либо анализ, либо сообщение об ошибке

		// Новые явные поля для фронта
		CurrentState:      currentState,
		ObjectiveStatus:   obj,
		DiagnosisMain:     dMain,
		DiagnosisComorbid: dCom,
		PlanExam:          pExam,
		PlanTreatment:     pTreat,
		PlanGeneral:       pGen,

		// Fallback-строка (совместимость)
		GeneralConclusion: generalConclusion,

		GeneratedAt: time.Now().Format("02.01.2006 15:04"),
	}

	if len(filesAnalysis) > 0 {
		previewLen := 200
		if len(filesAnalysis) < previewLen {
			previewLen = len(filesAnalysis)
		}
	}

	return passportData, nil
}

func genderRu(g string) string {
   gs := strings.ToLower(strings.TrimSpace(g))
    switch gs {
    case "male", "m", "м", "муж", "мужской":
        return "Мужской"
    case "female", "f", "ж", "жен", "женский":
        return "Женский"
    default:
        return "—"
    }
}

// -----------------------------
// Парсер структурированных разделов из Markdown GeneralConclusion
// -----------------------------
func parseStructuredFromMarkdown(md, lang string) (currentState, objectiveStatus, diagMain string, diagCom []string, planExam, planTreatment, planGeneral string) {
	// Нормализуем переносы/пробелы
	s := "\n" + strings.ReplaceAll(md, "\r\n", "\n") + "\n"

	// Заголовки по языкам
	hCurrentState := map[string][]string{
		"ru": {"### Текущее состояние", "## Текущее состояние"},
		"kz": {"### Текущее состояние", "## Текущее состояние"},
		"en": {"### Current State", "## Current State"},
	}[lang]
	hObj := map[string][]string{
		"ru": {"### ОБЪЕКТИВНЫЙ СТАТУС", "## ОБЪЕКТИВНЫЙ СТАТУС"},
		"kz": {"### ОБЪЕКТИВТІК СТАТУС", "## ОБЪЕКТИВТІК СТАТУС"},
		"en": {"### OBJECTIVE STATUS", "## OBJECTIVE STATUS"},
	}[lang]
	hDiag := map[string][]string{
		"ru": {"### Диагноз", "## Диагноз"},
		"kz": {"### Диагноз", "## Диагноз"},
		"en": {"### Diagnosis", "## Diagnosis"},
	}[lang]
	hPlanExam := map[string][]string{
		"ru": {"### План обследования", "## План обследования"},
		"kz": {"### План обследования", "## План обследования"},
		"en": {"### Plan of examinations", "## Plan of examinations"},
	}[lang]
	hPlanTreat := map[string][]string{
		"ru": {"### План лечения", "## План лечения"},
		"kz": {"### План лечения", "## План лечения"},
		"en": {"### Treatment plan", "## Treatment plan"},
	}[lang]
	hPlanGen := map[string][]string{
		"ru": {"### Общие рекомендации", "## Общие рекомендации"},
		"kz": {"### Жалпы ұсыныстар", "## Жалпы ұсыныстар"},
		"en": {"### General recommendations", "## General recommendations"},
	}[lang]

	cut := func(src string, heads []string) string {
		start := -1
		for _, h := range heads {
			if idx := strings.Index(src, "\n"+h+"\n"); idx >= 0 {
				start = idx + len("\n"+h+"\n")
				break
			}
		}
		if start < 0 {
			return ""
		}
		rest := src[start:]
		next := len(rest)
		for _, mark := range []string{"\n### ", "\n## "} {
			if i := strings.Index(rest, mark); i >= 0 && i < next {
				next = i
			}
		}
		return strings.TrimSpace(rest[:next])
	}

	currentState = cut(s, hCurrentState)
	objectiveStatus = cut(s, hObj)
	diagBlock := cut(s, hDiag)
	planExam = cut(s, hPlanExam)
	planTreatment = cut(s, hPlanTreat)
	planGeneral = cut(s, hPlanGen)

	// Извлечь основной и сопутствующие из блока «Диагноз»
	inComorbidSection := false
	if diagBlock != "" {
		lines := strings.Split(diagBlock, "\n")
		for _, ln := range lines {
			line := strings.TrimSpace(ln)
			// Основной диагноз
			if strings.HasPrefix(line, "- **Основной:**") || strings.HasPrefix(strings.ToLower(line), "- **main:**") {
				diagMain = strings.TrimSpace(stripPrefixAny(line, []string{"- **Основной:**", "- **Main:**", "- **main:**"}))
				inComorbidSection = false
				continue
			}
			// Начало секции сопутствующих
			if strings.HasPrefix(line, "- **Сопутствующие:**") || strings.HasPrefix(strings.ToLower(line), "- **comorbid:**") {
				inComorbidSection = true
				// Проверяем, есть ли значение сразу после двоеточия
				val := strings.TrimSpace(stripPrefixAny(line, []string{"- **Сопутствующие:**", "- **Comorbid:**", "- **comorbid:**"}))
				if val != "" && val != "отсутствуют" && val != "отсутствует" && !strings.EqualFold(val, "none") && !strings.EqualFold(val, "absent") {
					diagCom = append(diagCom, val)
				}
				continue
			}
			// Если мы в секции сопутствующих, собираем элементы списка
			if inComorbidSection {
				if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") || strings.HasPrefix(line, "• ") || strings.HasPrefix(line, "  - ") {
					val := strings.TrimLeft(line, "-*• ")
					val = strings.TrimSpace(val)
					if val != "" && val != "отсутствуют" && val != "отсутствует" && !strings.EqualFold(val, "none") && !strings.EqualFold(val, "absent") {
						diagCom = append(diagCom, val)
					}
				}
			}
		}
	}

	return
}

func stripPrefixAny(s string, prefixes []string) string {
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return strings.TrimSpace(strings.TrimPrefix(s, p))
		}
	}
	return s
}

// -----------------------------
// Вспомогательные функции (репозитории/пайплайн)
// -----------------------------

func convertAppointmentFilesToReferences(appointmentFiles []client.AppointmentFile, appointmentID string) []FileReference {
	fileReferences := make([]FileReference, len(appointmentFiles))
	for i, file := range appointmentFiles {
		// Используем ID записи файла для скачивания через appointment service
		// API endpoint: /appointments/{appointment_id}/files/{file_id}/download
		// где file_id - это ID записи файла в appointment (file.ID), а не file.FileID
		fileReferences[i] = FileReference{
			ID:            file.ID, // ID записи файла в appointment
			FileName:      file.OriginalName,
			OriginalName:  file.OriginalName,
			MimeType:      file.MimeType,
			Size:          file.Size,
			Source:        "appointment",
			AppointmentID: appointmentID,
		}
	}
	return fileReferences
}

// stubPatientProfile — если в gateway/patient-сервисе нет карточки (404), всё равно строим паспорт по приёму и анкете.
func stubPatientProfile(userID string) *client.PatientProfile {
	return &client.PatientProfile{
		ID:        userID,
		UserID:    userID,
		FirstName: "Пациент",
		LastName:  "(профиль в сервисе не заведён)",
	}
}

func calculateAge(birthDate string) int {
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

func calculateBMI(height, weight float64) float64 {
	if height <= 0 || weight <= 0 {
		return 0
	}
	heightInMeters := height / 100.0
	bmi := weight / (heightInMeters * heightInMeters)
	return math.Round(bmi*10) / 10
}

// -----------------------------
// Чтение/обновление контента
// -----------------------------

func (s *HealthPassportService) GetHealthPassportContent(ctx context.Context, id string, token string) (*models.HealthPassportData, error) {
	passport, err := s.repository.GetHealthPassportByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}
	if err := s.doctorService.ValidateDoctorRole(passport.DoctorID, token); err != nil {
		return nil, fmt.Errorf("access denied: %w", err)
	}
	content, err := s.repository.GetHealthPassportContent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get health passport content: %w", err)
	}
	return content, nil
}

func (s *HealthPassportService) UpdateHealthPassportContent(ctx context.Context, id string, updateReq *models.HealthPassportContentUpdateRequest, token string) (*models.HealthPassportData, error) {
	if updateReq.Lang != nil && *updateReq.Lang != "" {
		if *updateReq.Lang != "ru" && *updateReq.Lang != "en" && *updateReq.Lang != "kz" {
			return nil, fmt.Errorf("invalid language: %s. Supported languages: ru, en, kz", *updateReq.Lang)
		}
	}
	passport, err := s.repository.GetHealthPassportByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}
	if err := s.doctorService.ValidateDoctorRole(passport.DoctorID, token); err != nil {
		return nil, fmt.Errorf("access denied: %w", err)
	}

	currentContent, err := s.repository.GetHealthPassportContent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get current content: %w", err)
	}

	updatedContent := s.applyContentUpdates(currentContent, updateReq)
	if err := s.repository.UpdateHealthPassportContent(ctx, id, updatedContent); err != nil {
		return nil, fmt.Errorf("failed to update content: %w", err)
	}
	return updatedContent, nil
}

func (s *HealthPassportService) UpdateHealthPassportContentAndRegenerateDOCX(ctx context.Context, id string, updateReq *models.HealthPassportContentUpdateRequest, token string) (*models.HealthPassport, error) {
	if updateReq.Lang != nil && *updateReq.Lang != "" {
		if *updateReq.Lang != "ru" && *updateReq.Lang != "en" && *updateReq.Lang != "kz" {
			return nil, fmt.Errorf("invalid language: %s. Supported languages: ru, en, kz", *updateReq.Lang)
		}
	}
	passport, err := s.repository.GetHealthPassportByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}
	if err := s.doctorService.ValidateDoctorRole(passport.DoctorID, token); err != nil {
		return nil, fmt.Errorf("access denied: %w", err)
	}

	currentContent, err := s.repository.GetHealthPassportContent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get current content: %w", err)
	}

	updatedContent := s.applyContentUpdates(currentContent, updateReq)
	if err := s.repository.UpdateHealthPassportContent(ctx, id, updatedContent); err != nil {
		return nil, fmt.Errorf("failed to update content: %w", err)
	}

	// DOCX только с полями pdf.HealthPassportData
	pdfData := &pdf.HealthPassportData{
		Patient:           updatedContent.Patient,
		Doctor:            updatedContent.Doctor,
		Answers:           updatedContent.Answers,
		Complaints:        updatedContent.Complaints,
		MedicalHistory:    updatedContent.MedicalHistory,
		Lifestyle:         updatedContent.Lifestyle,
		FilesAnalysis:     updatedContent.FilesAnalysis,
		GeneralConclusion: updatedContent.GeneralConclusion,
		CurrentState:      updatedContent.CurrentState,
		ObjectiveStatus:   updatedContent.ObjectiveStatus,
		DiagnosisMain:     updatedContent.DiagnosisMain,
		DiagnosisComorbid: updatedContent.DiagnosisComorbid,
		PlanExam:          updatedContent.PlanExam,
		PlanTreatment:     updatedContent.PlanTreatment,
		PlanGeneral:       updatedContent.PlanGeneral,
		GeneratedAt:       time.Now().Format("02.01.2006 15:04"),
	}

	docxPath, err := s.pdfGenerator.GenerateHealthPassport(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate DOCX: %w", err)
	}
	fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
	if err != nil {
		_ = s.pdfGenerator.CleanupFile(docxPath)
		return nil, fmt.Errorf("failed to upload DOCX: %w", err)
	}
	_ = s.pdfGenerator.CleanupFile(docxPath)

	if err := s.repository.UpdateHealthPassportFileID(ctx, id, fileID); err != nil {
		return nil, fmt.Errorf("failed to update file_id: %w", err)
	}

	passport.FileID = &fileID
	passport.UpdatedAt = time.Now()
	passport.Content = updatedContent
	return passport, nil
}

func (s *HealthPassportService) RegenerateHealthPassportDOCX(ctx context.Context, id string, lang string, token string) (*models.HealthPassport, error) {
	passport, err := s.repository.GetHealthPassportByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}
	if err := s.doctorService.ValidateDoctorRole(passport.DoctorID, token); err != nil {
		return nil, fmt.Errorf("access denied: %w", err)
	}

	content, err := s.repository.GetHealthPassportContent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get content: %w", err)
	}

	pdfData := &pdf.HealthPassportData{
		Patient:           content.Patient,
		Doctor:            content.Doctor,
		Answers:           content.Answers,
		Complaints:        content.Complaints,
		MedicalHistory:    content.MedicalHistory,
		Lifestyle:         content.Lifestyle,
		FilesAnalysis:     content.FilesAnalysis,
		GeneralConclusion: content.GeneralConclusion,
		CurrentState:      content.CurrentState,
		ObjectiveStatus:   content.ObjectiveStatus,
		DiagnosisMain:     content.DiagnosisMain,
		DiagnosisComorbid: content.DiagnosisComorbid,
		PlanExam:          content.PlanExam,
		PlanTreatment:     content.PlanTreatment,
		PlanGeneral:       content.PlanGeneral,
		GeneratedAt:       time.Now().Format("02.01.2006 15:04"),
	}

	docxPath, err := s.pdfGenerator.GenerateHealthPassport(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate DOCX: %w", err)
	}
	fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
	if err != nil {
		_ = s.pdfGenerator.CleanupFile(docxPath)
		return nil, fmt.Errorf("failed to upload DOCX: %w", err)
	}
	_ = s.pdfGenerator.CleanupFile(docxPath)

	if err := s.repository.UpdateHealthPassportFileID(ctx, id, fileID); err != nil {
		return nil, fmt.Errorf("failed to update file_id: %w", err)
	}

	passport.FileID = &fileID
	passport.UpdatedAt = time.Now()
	return passport, nil
}

// -----------------------------
// Применение частичных обновлений контента
// -----------------------------
func (s *HealthPassportService) applyContentUpdates(current *models.HealthPassportData, updates *models.HealthPassportContentUpdateRequest) *models.HealthPassportData {
	updated := *current

	// Базовые текстовые поля
	if updates.Complaints != nil {
		updated.Complaints = *updates.Complaints
	}
	if updates.MedicalHistory != nil {
		updated.MedicalHistory = *updates.MedicalHistory
	}
	if updates.Lifestyle != nil {
		updated.Lifestyle = *updates.Lifestyle
	}
	if updates.FilesAnalysis != nil {
		updated.FilesAnalysis = *updates.FilesAnalysis
	}
	if updates.GeneralConclusion != nil {
		updated.GeneralConclusion = *updates.GeneralConclusion
	}

	// Новые структурные поля заключения (для фронта)
	if updates.ObjectiveStatus != nil {
		updated.ObjectiveStatus = *updates.ObjectiveStatus
	}
	if updates.DiagnosisMain != nil {
		updated.DiagnosisMain = *updates.DiagnosisMain
	}
	if updates.DiagnosisComorbid != nil {
		updated.DiagnosisComorbid = append([]string(nil), (*updates.DiagnosisComorbid)...)
	}
	if updates.PlanExam != nil {
		updated.PlanExam = *updates.PlanExam
	}
	if updates.PlanTreatment != nil {
		updated.PlanTreatment = *updates.PlanTreatment
	}
	if updates.PlanGeneral != nil {
		updated.PlanGeneral = *updates.PlanGeneral
	}

	return &updated
}

// -----------------------------
// Парсинг ответов из транскрипции (LLM -> JSON)
// -----------------------------
func (s *HealthPassportService) extractAnswersFromTranscription(transcription, lang string) (map[string]string, error) {
	prompt := openai.GetExtractAnswersPrompt(lang, transcription)

	aiResp, err := openai.AskOpenAI(prompt, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to extract answers from transcription: %w", err)
	}

	cleaned := text.FormatMedicalText(aiResp)
	var answers map[string]interface{}
	if err := json.Unmarshal([]byte(cleaned), &answers); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	result := make(map[string]string)
	
	// Обрабатываем vital_signs отдельно, так как это объект, а не строка
	if vs, ok := answers["vital_signs"]; ok {
		if vsMap, ok := vs.(map[string]interface{}); ok {
			// Сериализуем vital_signs в JSON строку
			vsJSON, err := json.Marshal(vsMap)
			if err == nil {
				result["vital_signs"] = string(vsJSON)
			} else {
			}
		}
		// Удаляем vital_signs из answers, чтобы не обрабатывать его как строку
		delete(answers, "vital_signs")
	}
	
	// Обрабатываем остальные поля как строки
	for key, value := range answers {
		if str, ok := value.(string); ok && str != "" {
			result[key] = str
		}
	}
	return result, nil
}

// -----------------------------
// Валидация входа
// -----------------------------
func (s *HealthPassportService) validateRequest(req *models.HealthPassportRequest) error {
	if req.AppointmentID == "" {
		return fmt.Errorf("appointment_id is required")
	}
	// AnalysisID теперь опционален - можно генерировать паспорт без анкеты
	if req.DoctorID == "" {
		return fmt.Errorf("doctor_id is required")
	}
	if req.Lang == "" {
		return fmt.Errorf("lang is required")
	}
	if req.Lang != "ru" && req.Lang != "en" && req.Lang != "kz" {
		return fmt.Errorf("lang must be 'ru', 'en', or 'kz'")
	}
	return nil
}
