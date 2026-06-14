package pdf

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"baliance.com/gooxml/document"
	"baliance.com/gooxml/measurement"
	"baliance.com/gooxml/schema/soo/wml"
)

// PatientRecommendationsData содержит данные для генерации DOCX с рекомендациями для пациента.
type PatientRecommendationsData struct {
	PatientName     string
	DoctorName      string
	GeneratedAt     string
	DiagnosisMain   string
	Complaint       string
	Recommendations string
	Lang            string
}

// GeneratePatientRecommendations создаёт DOCX с рекомендациями для пациента и возвращает путь к файлу.
func (g *PDFGenerator) GeneratePatientRecommendations(data *PatientRecommendationsData) (string, error) {
	timestamp := time.Now().Format("20060102_150405")
	randomID := rand.Intn(90000) + 10000
	filename := fmt.Sprintf("Рекомендации_пациенту_%05d_%s.docx", randomID, timestamp)
	docxPath := filepath.Join(g.outputPath, filename)

	if err := g.generatePatientRecommendationsDOCX(data, docxPath); err != nil {
		return "", fmt.Errorf("failed to generate DOCX: %w", err)
	}

	if _, err := os.Stat(docxPath); err != nil {
		return "", fmt.Errorf("DOCX file not found after generation: %w", err)
	}

	return docxPath, nil
}

func (g *PDFGenerator) generatePatientRecommendationsDOCX(data *PatientRecommendationsData, docxPath string) error {
	doc := document.New()

	// Заголовок документа
	para := doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcCenter)
	run := para.AddRun()
	run.AddText(patientRecommendationsTitle(data.Lang))
	run.Properties().SetBold(true)
	run.Properties().SetSize(18 * measurement.Point)
	titleProps := run.Properties().X()
	if titleProps.RFonts == nil {
		titleProps.RFonts = wml.NewCT_Fonts()
	}
	titleAsciiVal := "Arial"
	titleProps.RFonts.AsciiAttr = &titleAsciiVal
	titleHAnsiVal := "Arial"
	titleProps.RFonts.HAnsiAttr = &titleHAnsiVal
	doc.AddParagraph()

	// Блок с информацией о пациенте, враче и дате
	infoPara := doc.AddParagraph()
	infoRun := infoPara.AddRun()
	g.setArialFont11(infoRun)

	infoRun.AddText(fmt.Sprintf("%s: %s", patientRecommendationsLabel("date", data.Lang), data.GeneratedAt))

	if data.PatientName != "" {
		infoRun.AddBreak()
		infoRun.AddText(fmt.Sprintf("%s: %s", patientRecommendationsLabel("patient", data.Lang), data.PatientName))
	}
	if data.DoctorName != "" {
		infoRun.AddBreak()
		infoRun.AddText(fmt.Sprintf("%s: %s", patientRecommendationsLabel("doctor", data.Lang), data.DoctorName))
	}
	if data.DiagnosisMain != "" {
		infoRun.AddBreak()
		infoRun.AddText(fmt.Sprintf("%s: %s", patientRecommendationsLabel("diagnosis", data.Lang), data.DiagnosisMain))
	}
	if data.Complaint != "" {
		infoRun.AddBreak()
		infoRun.AddText(fmt.Sprintf("%s: %s", patientRecommendationsLabel("complaint", data.Lang), data.Complaint))
	}
	doc.AddParagraph() // Пустая строка после информации

	// Основной текст рекомендаций (Markdown от ИИ)
	g.parseAndAddMarkdownContent(doc, data.Recommendations)

	// Футер с датой создания
	g.addFooter(doc, data.GeneratedAt)

	if err := doc.SaveToFile(docxPath); err != nil {
		return fmt.Errorf("failed to save document: %w", err)
	}

	return nil
}

func patientRecommendationsTitle(lang string) string {
	switch lang {
	case "en":
		return "Patient Recommendations"
	case "kz":
		return "Емделушіге арналған ұсынымдар"
	default:
		return "Рекомендации для пациента"
	}
}

func patientRecommendationsLabel(key, lang string) string {
	labels := map[string]map[string]string{
		"ru": {"date": "Дата", "patient": "Пациент", "doctor": "Врач", "diagnosis": "Диагноз", "complaint": "Жалоба"},
		"en": {"date": "Date", "patient": "Patient", "doctor": "Doctor", "diagnosis": "Diagnosis", "complaint": "Complaint"},
		"kz": {"date": "Күні", "patient": "Емделуші", "doctor": "Дәрігер", "diagnosis": "Диагноз", "complaint": "Шағым"},
	}
	if l, ok := labels[lang]; ok {
		if v, ok := l[key]; ok {
			return v
		}
	}
	return labels["ru"][key]
}
