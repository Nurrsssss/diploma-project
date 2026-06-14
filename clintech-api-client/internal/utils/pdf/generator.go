package pdf

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"log"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"baliance.com/gooxml/document"
	"baliance.com/gooxml/measurement"
	"baliance.com/gooxml/schema/soo/wml"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"
)

type PreliminaryConclusionData struct {
	Patient           *client.PatientProfile
	Answers           map[string]string
	Files             []string
	GeneratedAt       string
	Complaints        string
	MedicalHistory    string
	Lifestyle         string
	UploadedDocuments string
	GeneralConclusion string
	CurrentState      string // <<< НОВОЕ
}

type HealthPassportData struct {
	Patient           *models.PatientInfo
	Doctor            *models.DoctorInfo
	Answers           map[string]string
	Complaints        string
	MedicalHistory    string
	Lifestyle         string
	FilesAnalysis     string
	GeneralConclusion string
	// Дополнительные поля для шаблона
	CurrentState      string
	ObjectiveStatus   string
	DiagnosisMain     string
	DiagnosisComorbid []string
	PlanExam          string
	PlanTreatment     string
	PlanGeneral       string
	GeneratedAt       string
}

type HealthPassportHTMLData struct {
	Patient                *models.PatientInfo
	Doctor                 *models.DoctorInfo
	Answers                map[string]string
	Complaints             template.HTML
	MedicalHistory         template.HTML
	MedicalHistoryDynamics template.HTML
	TreatmentEffect        template.HTML
	Lifestyle              template.HTML
	FilesAnalysis          template.HTML
	GeneralConclusion      template.HTML
	CurrentState           template.HTML
	ObjectiveStatus        template.HTML
	DiagnosisMain          string
	DiagnosisComorbid      []string
	PlanExam               template.HTML
	PlanTreatment          template.HTML
	PlanGeneral            template.HTML
	GeneratedAt            string
}

type HTMLTemplateData struct {
	Patient           *client.PatientProfile
	Answers           map[string]string
	Files             []string
	GeneratedAt       string
	Complaints        template.HTML
	MedicalHistory    template.HTML
	Lifestyle         template.HTML
	UploadedDocuments template.HTML
	GeneralConclusion template.HTML
	CurrentState      template.HTML // <<< НОВОЕ
}

type PDFGenerator struct {
	templatesPath string
	outputPath    string
}

func NewPDFGenerator(templatesPath, outputPath string) *PDFGenerator {

	projectRoot := findProjectRoot()
	if projectRoot == "" {

		wd, err := os.Getwd()
		if err != nil {

			return &PDFGenerator{
				templatesPath: templatesPath,
				outputPath:    outputPath,
			}
		}
		projectRoot = wd
	}

	absTemplatesPath := filepath.Join(projectRoot, templatesPath)
	absOutputPath := filepath.Join(projectRoot, outputPath)

	os.MkdirAll(absOutputPath, 0755)

	return &PDFGenerator{
		templatesPath: absTemplatesPath,
		outputPath:    absOutputPath,
	}
}

func findProjectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	if dir == "/app" {
		if _, err := os.Stat("/app/internal/utils/pdf/templates"); err == nil {
			return "/app"
		}
	}

	for {

		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}

		if _, err := os.Stat(filepath.Join(dir, "internal/utils/pdf/templates")); err == nil {
			return dir
		}

		parent := filepath.Dir(dir)
		if parent == dir {

			break
		}
		dir = parent
	}

	return ""
}

func (g *PDFGenerator) GeneratePreliminaryConclusion(data *PreliminaryConclusionData) (string, error) {
	htmlFile, err := g.generateHTML(data)
	if err != nil {
		return "", fmt.Errorf("failed to generate HTML: %w", err)
	}
	defer os.Remove(htmlFile)

	timestamp := time.Now().Format("20060102_150405")
	contentPdfFileName := fmt.Sprintf("preliminary_conclusion_content_%s.pdf", timestamp)
	contentPdfPath := filepath.Join(g.outputPath, contentPdfFileName)

	err = g.convertHTMLToPDF(htmlFile, contentPdfPath)
	if err != nil {
		return "", fmt.Errorf("failed to convert HTML to PDF: %w", err)
	}

	finalPdfPath, err := g.addCoverPage(contentPdfPath, timestamp)
	if err != nil {


		finalName := fmt.Sprintf("Preliminary_Conclusion_%s.pdf", timestamp)
		finalPath := filepath.Join(g.outputPath, finalName)

		if err := g.copyFile(contentPdfPath, finalPath); err == nil {
			os.Remove(contentPdfPath)
			return finalPath, nil
		}

		return contentPdfPath, nil
	}

	os.Remove(contentPdfPath)

	return finalPdfPath, nil
}

func (g *PDFGenerator) generateHTML(data *PreliminaryConclusionData) (string, error) {
	templatePath := filepath.Join(g.templatesPath, "preliminary_conclusion.html")

	if _, err := os.Stat(templatePath); os.IsNotExist(err) {
		return "", fmt.Errorf("template file does not exist: %s", templatePath)
	}

	funcMap := template.FuncMap{
		"replace":  func(old, new, s string) string { return strings.Replace(s, old, new, -1) },
		"dateOnly": dateOnly,
	}

	tmpl, err := template.New("preliminary_conclusion.html").
		Funcs(funcMap).
		ParseFiles(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to parse template at %s: %w", templatePath, err)
	}

	htmlData := &HTMLTemplateData{
		Patient:           data.Patient,
		Answers:           data.Answers,
		Files:             data.Files,
		GeneratedAt:       data.GeneratedAt,
		Complaints:        g.markdownToHTML(data.Complaints),
		MedicalHistory:    g.markdownToHTML(data.MedicalHistory),
		Lifestyle:         g.markdownToHTML(data.Lifestyle),
		UploadedDocuments: g.markdownToHTML(data.UploadedDocuments),
		GeneralConclusion: g.markdownToHTML(data.GeneralConclusion),
		CurrentState:      g.markdownToHTML(data.CurrentState),
	}

	htmlFile := filepath.Join(g.outputPath, fmt.Sprintf("temp_%d.html", time.Now().UnixNano()))
	file, err := os.Create(htmlFile)
	if err != nil {
		return "", fmt.Errorf("failed to create HTML file at %s: %w", htmlFile, err)
	}
	defer file.Close()

	err = tmpl.Execute(file, htmlData)
	if err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return htmlFile, nil
}

func (g *PDFGenerator) convertHTMLToPDF(htmlFile, pdfPath string) error {
	cmd := exec.Command("wkhtmltopdf",
		"--page-size", "A4",
		"--margin-top", "1cm",
		"--margin-bottom", "1cm",
		"--margin-left", "1cm",
		"--margin-right", "1cm",
		"--encoding", "UTF-8",
		"--enable-local-file-access",
		"--disable-smart-shrinking",
		"--print-media-type",
		htmlFile,
		pdfPath)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("wkhtmltopdf failed: %w, stderr: %s", err, stderr.String())
	}

	return nil
}

func (g *PDFGenerator) convertHTMLToDOCX(htmlFile, docxPath string) error {
	// Используем pandoc для конвертации HTML в DOCX

	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем, что pandoc установлен
	pandocCheck := exec.Command("pandoc", "--version")
	if err := pandocCheck.Run(); err != nil {
		return fmt.Errorf("pandoc is not installed or not in PATH: %w. Please install pandoc: apt-get install pandoc (Debian) or brew install pandoc (macOS)", err)
	}

	cmd := exec.Command("pandoc",
		"--from", "html",
		"--to", "docx",
		"--output", docxPath,
		"--standalone",
		htmlFile)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("pandoc failed: %w, stderr: %s", err, stderr.String())
	}

	// Проверяем, что файл создан и имеет правильное расширение
	if fileInfo, err := os.Stat(docxPath); err != nil {
		return fmt.Errorf("DOCX file was not created: %w", err)
	} else {
		// Проверяем расширение
		if !strings.HasSuffix(strings.ToLower(docxPath), ".docx") {
			return fmt.Errorf("generated file does not have .docx extension: %s", docxPath)
		}
		// Проверяем, что файл не пустой
		if fileInfo.Size() == 0 {
			return fmt.Errorf("generated DOCX file is empty")
		}
		// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем магические байты DOCX (ZIP формат: PK\x03\x04)
		file, err := os.Open(docxPath)
		if err == nil {
			defer file.Close()
			header := make([]byte, 4)
			if n, _ := file.Read(header); n == 4 {
				isDocx := (header[0] == 0x50 && header[1] == 0x4B &&
					(header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07) &&
					(header[3] == 0x04 || header[3] == 0x06 || header[3] == 0x08))
				isPdf := string(header) == "%PDF"

				if isPdf {
					return fmt.Errorf("CRITICAL: pandoc created PDF instead of DOCX (header: %x). Check pandoc installation", header)
				} else if isDocx {
				} else {
				}
			}
		}
	}

	return nil
}

func (g *PDFGenerator) CleanupFile(filePath string) error {
	return os.Remove(filePath)
}

func (g *PDFGenerator) addCoverPage(contentPdfPath, timestamp string) (string, error) {

	coverPath := filepath.Join(g.templatesPath, "..", "covers", "preliminary_conclusion_cover.pdf")

	if _, err := os.Stat(coverPath); os.IsNotExist(err) {
		return "", fmt.Errorf("cover file not found: %s", coverPath)
	}

	finalPdfName := fmt.Sprintf("Preliminary_Conclusion_%s.pdf", timestamp)
	finalPdfPath := filepath.Join(g.outputPath, finalPdfName)


	if err := g.mergeWithPdftk(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	if err := g.mergeWithQpdf(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	if err := g.mergeWithPdfunite(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	return "", fmt.Errorf("no PDF merging tools available (tried pdftk, qpdf, pdfunite)")
}

func (g *PDFGenerator) mergeWithPdftk(coverPath, contentPath, outputPath string) error {
	cmd := exec.Command("pdftk", coverPath, contentPath, "cat", "output", outputPath)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("pdftk failed: %w, stderr: %s", err, stderr.String())
	}

	return nil
}

func (g *PDFGenerator) mergeWithQpdf(coverPath, contentPath, outputPath string) error {
	cmd := exec.Command("qpdf", "--empty", "--pages", coverPath, contentPath, "--", outputPath)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("qpdf failed: %w, stderr: %s", err, stderr.String())
	}

	return nil
}

func (g *PDFGenerator) mergeWithPdfunite(coverPath, contentPath, outputPath string) error {
	cmd := exec.Command("pdfunite", coverPath, contentPath, outputPath)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("pdfunite failed: %w, stderr: %s", err, stderr.String())
	}

	return nil
}

func (g *PDFGenerator) copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

func (g *PDFGenerator) markdownToHTML(markdownText string) template.HTML {

	extensions := parser.CommonExtensions | parser.AutoHeadingIDs | parser.NoEmptyLineBeforeBlock
	p := parser.NewWithExtensions(extensions)
	doc := p.Parse([]byte(markdownText))

	htmlFlags := html.CommonFlags | html.HrefTargetBlank
	opts := html.RendererOptions{Flags: htmlFlags}
	renderer := html.NewRenderer(opts)

	htmlContent := markdown.Render(doc, renderer)
	return template.HTML(htmlContent)
}

// GetOutputPath возвращает путь к директории вывода
func (g *PDFGenerator) GetOutputPath() string {
	return g.outputPath
}

// GenerateHealthPassportToFile генерирует DOCX в указанный файл
func (g *PDFGenerator) GenerateHealthPassportToFile(data *HealthPassportData, docxPath string) error {
	return g.generateHealthPassportDOCXDirect(data, docxPath)
}

func (g *PDFGenerator) GenerateHealthPassport(data *HealthPassportData) (string, error) {

	timestampDocx := time.Now().Format("20060102_150405")
	// Генерируем рандомный 5-значный ID для различения версий
	randomID := rand.Intn(90000) + 10000 // Генерирует число от 10000 до 99999
	// Используем название файла с рандомным ID для различения версий
	filename := fmt.Sprintf("Медицинский_документ_пациента_%05d_%s.docx", randomID, timestampDocx)
	docxPath := filepath.Join(g.outputPath, filename)


	if data.Patient != nil {
	}
	if data.Doctor != nil {
	}

	if err := g.generateHealthPassportDOCXDirect(data, docxPath); err != nil {
		return "", fmt.Errorf("failed to generate DOCX: %w", err)
	}

	// Финальная проверка перед возвратом
	if _, err := os.Stat(docxPath); err != nil {
		return "", fmt.Errorf("DOCX file not found after generation: %w", err)
	} else {
		// Проверяем магические байты DOCX
		file, err := os.Open(docxPath)
		if err == nil {
			defer file.Close()
			header := make([]byte, 4)
			if n, _ := file.Read(header); n == 4 {
				isDocx := (header[0] == 0x50 && header[1] == 0x4B &&
					(header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07) &&
					(header[3] == 0x04 || header[3] == 0x06 || header[3] == 0x08))
				if isDocx {
				} else {
				}
			}
		}
	}

	return docxPath, nil
}

// generateHealthPassportDOCXDirect создает DOCX файл напрямую без использования HTML и pandoc
func (g *PDFGenerator) generateHealthPassportDOCXDirect(data *HealthPassportData, docxPath string) error {
	// Создаем новый документ
	doc := document.New()

	// Брендированная шапка клиники намеренно убрана из Word-документа.

	// Добавляем заголовок документа
	para := doc.AddParagraph()
	// Используем правильный API для выравнивания по центру
	para.Properties().SetAlignment(wml.ST_JcCenter)
	run := para.AddRun()
	run.AddText("Медицинское заключение")
	run.Properties().SetBold(true)
	run.Properties().SetSize(18 * measurement.Point)
	// Устанавливаем шрифт Arial для заголовка
	titleProps := run.Properties().X()
	if titleProps.RFonts == nil {
		titleProps.RFonts = wml.NewCT_Fonts()
	}
	titleAsciiVal := "Arial"
	titleProps.RFonts.AsciiAttr = &titleAsciiVal
	titleHAnsiVal := "Arial"
	titleProps.RFonts.HAnsiAttr = &titleHAnsiVal
	doc.AddParagraph() // Пустая строка после заголовка

	// Добавляем идентификационную информацию (включая дату и врача)
	g.addPatientInfo(doc, data)

	// Добавляем жалобы
	if data.Complaints != "" && !isEmptyString(data.Complaints) {
		g.addSection(doc, "Жалобы", data.Complaints)
	} else {
	}

	// Добавляем анамнез заболевания
	if data.MedicalHistory != "" && !isEmptyString(data.MedicalHistory) {
		g.addSection(doc, "Анамнез заболевания", data.MedicalHistory)
	} else {
	}
	g.addLifestyleSection(doc, data)

	// Добавляем объективный статус (всегда показываем)
	g.addObjectiveStatusSection(doc, data)

	// Добавляем анализ медицинских файлов
	g.addFilesAnalysisSection(doc, data)

	// Добавляем диагноз (всегда показываем) - после "Интерпретация данных исследований"
	g.addDiagnosisSection(doc, data)

	// Добавляем план обследования
	if data.PlanExam != "" && !isEmptyString(data.PlanExam) {
		g.addListSection(doc, "План обследования", data.PlanExam)
	} else {
	}

	// Добавляем план лечения
	if data.PlanTreatment != "" && !isEmptyString(data.PlanTreatment) {
		g.addListSection(doc, "План лечения", data.PlanTreatment)
	} else {
	}

	// Добавляем общие рекомендации
	if data.PlanGeneral != "" && !isEmptyString(data.PlanGeneral) {
		g.addListSection(doc, "Общие рекомендации", data.PlanGeneral)
	} else {
	}

	// Добавляем секцию "Контрольная явка:" (пустая, для ручного заполнения)
	para = doc.AddParagraph()
	run = para.AddRun()
	run.AddText("Контрольная явка:")
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)
	doc.AddParagraph() // Пустая строка после заголовка

	// Добавляем футер
	g.addFooter(doc, data.GeneratedAt)

	// Сохраняем документ
	if err := doc.SaveToFile(docxPath); err != nil {
		return fmt.Errorf("failed to save document: %w", err)
	}

	// Проверяем, что файл действительно создан
	if _, err := os.Stat(docxPath); err != nil {
		return fmt.Errorf("file not found after save: %w", err)
	} else {
	}

	return nil
}

// stripHTML удаляет HTML теги из текста (простая версия для извлечения витальных показателей)
func stripHTML(htmlContent string) string {
	if htmlContent == "" {
		return ""
	}
	// Удаляем HTML теги
	text := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(htmlContent, "")
	// Заменяем HTML entities
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&quot;", "\"")
	text = strings.ReplaceAll(text, "&#39;", "'")
	text = strings.ReplaceAll(text, "&apos;", "'")
	// Нормализуем пробелы
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

// extractVitalsFromText извлекает витальные показатели из текста (Complaints, FilesAnalysis, ObjectiveStatus, CurrentState)
func extractVitalsFromText(text string) (temp *float64, sysBP *int, diaBP *int, bmi *float64, hr *int, spo2 *int) {
	if text == "" {
		return
	}

	// Регулярные выражения для извлечения
	// Температура: учитываем "Температура тела 37.1°C", "температура 36.6", "temp 37.1"
	reTemp := regexp.MustCompile(`(?i)(?:t(?:emp)?|темп(?:ература)?(?:\s*тела)?)[^\d]*([34]\d(?:[.,]\d)?)(?:\s*°?C)?`)
	// Артериальное давление: учитываем "Артериальное давление 134/86 мм рт. ст.", "АД 120/80"
	reBP := regexp.MustCompile(`(?i)(?:ад|артериальное\s*давление|давление|blood\s*pressure|bp)[^\d]*(\d{2,3})\s*[/\s]\s*(\d{2,3})(?:\s*мм\s*рт\.?\s*ст\.?)?`)
	reBMI := regexp.MustCompile(`(?i)(?:имт|bmi|индекс\s*массы\s*тела)[^\d]*(\d{1,2}(?:[.,]\d)?)`)
	// ЧСС: ищем "ЧСС", "пульс", "частота сердечных сокращений" и т.д., затем число
	// Улучшенный паттерн: учитываем "82 уд/мин", "82 уд. в мин", "пульс 82", "ЧСС 82"
	reHR := regexp.MustCompile(`(?i)(?:чсс|чдс|пульс(?:\s*на\s*обеих\s*руках)?|частота\s*сердечных\s*сокращений|hr|heart\s*rate)[^\d]*?(\d{2,3})(?:\s*(?:уд|уд\.|уд/мин|bpm))?`)
	// Сатурация: ищем "Сатурация", "SpO2" и т.д., затем число с возможным %
	// Улучшенный паттерн: учитываем "Сатурация 96%", "Сатурация 96", "SpO2 96"
	reSpO2 := regexp.MustCompile(`(?i)(?:сатурация(?:\s*кислорода)?|saturation|spo2|sp\s*o2)[^\d]*?(\d{2,3})(?:\s*%)?`)

	// Извлекаем температуру
	if matches := reTemp.FindStringSubmatch(text); len(matches) >= 2 {
		if f, err := strconv.ParseFloat(strings.ReplaceAll(matches[1], ",", "."), 64); err == nil && f >= 34 && f <= 45 {
			temp = &f
		}
	}

	// Извлекаем артериальное давление
	if matches := reBP.FindStringSubmatch(text); len(matches) >= 3 {
		if s, err1 := strconv.Atoi(matches[1]); err1 == nil {
			if d, err2 := strconv.Atoi(matches[2]); err2 == nil && s >= 60 && s <= 250 && d >= 40 && d <= 150 {
				sysBP = &s
				diaBP = &d
			}
		}
	}

	// Извлекаем ИМТ
	if matches := reBMI.FindStringSubmatch(text); len(matches) >= 2 {
		if f, err := strconv.ParseFloat(strings.ReplaceAll(matches[1], ",", "."), 64); err == nil && f >= 10 && f <= 60 {
			bmi = &f
		}
	}

	// Извлекаем ЧСС (частота сердечных сокращений)
	if matches := reHR.FindStringSubmatch(text); len(matches) >= 2 {
		if h, err := strconv.Atoi(matches[1]); err == nil && h >= 40 && h <= 200 {
			hr = &h
		} else {
		}
	} else {
	}

	// Извлекаем Сатурацию
	if matches := reSpO2.FindStringSubmatch(text); len(matches) >= 2 {
		if s, err := strconv.Atoi(matches[1]); err == nil && s >= 70 && s <= 100 {
			spo2 = &s
		} else {
		}
	} else {
	}

	return
}

// getVitalSigns получает витальные показатели из различных источников
// Приоритет: FilesAnalysis > Complaints > ObjectiveStatus/CurrentState > Answers > Patient > нормальные значения
func getVitalSigns(data *HealthPassportData) (temp *float64, sysBP *int, diaBP *int, bmi *float64, hr *int, spo2 *int) {
	// ПРИОРИТЕТ 1: Ищем в FilesAnalysis (медицинские файлы имеют наивысший приоритет)
	if data.FilesAnalysis != "" && !isEmptyString(data.FilesAnalysis) {
		// Конвертируем HTML в текст перед извлечением (может содержать HTML-теги)
		filesText := stripHTML(data.FilesAnalysis)
		ftemp, fsysBP, fdiaBP, fbmi, fhr, fspo2 := extractVitalsFromText(filesText)
		if ftemp != nil {
			temp = ftemp
		}
		if fsysBP != nil {
			sysBP = fsysBP
			diaBP = fdiaBP
		}
		if fbmi != nil {
			bmi = fbmi
		}
		if fhr != nil {
			hr = fhr
		}
		if fspo2 != nil {
			spo2 = fspo2
		}
	}

	// ПРИОРИТЕТ 2: Если нет в FilesAnalysis, ищем в Complaints
	// Проверяем каждое значение отдельно, чтобы не пропустить поиск, если некоторые уже найдены
	if temp == nil || sysBP == nil || bmi == nil || hr == nil || spo2 == nil {
		if data.Complaints != "" && !isEmptyString(data.Complaints) {
			// Конвертируем HTML в текст перед извлечением (может содержать HTML-теги)
			complaintsText := stripHTML(data.Complaints)
			ctemp, csysBP, cdiaBP, cbmi, chr, cspo2 := extractVitalsFromText(complaintsText)
			if temp == nil && ctemp != nil {
				temp = ctemp
			}
			if sysBP == nil && csysBP != nil {
				sysBP = csysBP
				diaBP = cdiaBP
			}
			if bmi == nil && cbmi != nil {
				bmi = cbmi
			}
			if hr == nil && chr != nil {
				hr = chr
			}
			if spo2 == nil && cspo2 != nil {
				spo2 = cspo2
			}
		}
	}

	// ПРИОРИТЕТ 2.5: Если нет, ищем в ObjectiveStatus (объективный статус содержит данные осмотра)
	// Проверяем каждое значение отдельно, чтобы не пропустить поиск, если некоторые уже найдены
	if temp == nil || sysBP == nil || bmi == nil || hr == nil || spo2 == nil {
		// Объединяем ObjectiveStatus и CurrentState для поиска витальных показателей
		objectiveText := data.ObjectiveStatus
		if data.CurrentState != "" && !isEmptyString(data.CurrentState) {
			objectiveText = data.CurrentState + " " + objectiveText
		}
		if objectiveText != "" && !isEmptyString(objectiveText) {
			// Конвертируем HTML в текст перед извлечением (может содержать HTML-теги)
			objectiveText = stripHTML(objectiveText)
			// Логируем для отладки (первые 200 символов)
			previewLen := 200
			if len(objectiveText) < previewLen {
				previewLen = len(objectiveText)
			}
			if previewLen > 0 {
			}
			otemp, osysBP, odiaBP, obmi, ohr, ospo2 := extractVitalsFromText(objectiveText)
			if ohr != nil {
			} else {
			}
			if ospo2 != nil {
			} else {
			}
			if temp == nil && otemp != nil {
				temp = otemp
			}
			if sysBP == nil && osysBP != nil {
				sysBP = osysBP
				diaBP = odiaBP
			}
			if bmi == nil && obmi != nil {
				bmi = obmi
			}
			if hr == nil && ohr != nil {
				hr = ohr
			}
			if spo2 == nil && ospo2 != nil {
				spo2 = ospo2
			}
		} else {
		}
	}

	// ПРИОРИТЕТ 3: Если нет, ищем в Answers (анкета)
	if temp == nil || sysBP == nil || bmi == nil || hr == nil || spo2 == nil {
		for k, v := range data.Answers {
			key := strings.ToLower(k)
			if temp == nil && (key == "temperature" || key == "temp" || key == "температура") && v != "" {
				if f, err := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64); err == nil && f >= 34 && f <= 45 {
					temp = &f
				}
			}
			if sysBP == nil && (key == "bp" || key == "blood_pressure" || key == "ад" || key == "артериальное давление") && v != "" {
				if matches := regexp.MustCompile(`(\d{2,3})\s*[/\s]\s*(\d{2,3})`).FindStringSubmatch(v); len(matches) >= 3 {
					if s, err1 := strconv.Atoi(matches[1]); err1 == nil {
						if d, err2 := strconv.Atoi(matches[2]); err2 == nil && s >= 60 && s <= 250 && d >= 40 && d <= 150 {
							sysBP = &s
							diaBP = &d
						}
					}
				}
			}
			if bmi == nil && (key == "bmi" || key == "имт" || key == "индекс массы тела") && v != "" {
				if f, err := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64); err == nil && f >= 10 && f <= 60 {
					bmi = &f
				}
			}
			if hr == nil && (key == "hr" || key == "heart_rate" || key == "чсс" || key == "чдс" || key == "пульс" || key == "частота сердечных сокращений") && v != "" {
				if h, err := strconv.Atoi(v); err == nil && h >= 40 && h <= 200 {
					hr = &h
				}
			}
			if spo2 == nil && (key == "spo2" || key == "sp_o2" || key == "saturation" || key == "сатурация" || key == "сатурация кислорода") && v != "" {
				if s, err := strconv.Atoi(v); err == nil && s >= 70 && s <= 100 {
					spo2 = &s
				}
			}
		}
	}

	// ПРИОРИТЕТ 4: Если нет, используем данные пациента
	if temp == nil {
		if data.Patient.Temperature != nil && *data.Patient.Temperature > 0 {
			temp = data.Patient.Temperature
		}
	}
	if sysBP == nil {
		if data.Patient.SystolicBP != nil && data.Patient.DiastolicBP != nil &&
			*data.Patient.SystolicBP > 0 && *data.Patient.DiastolicBP > 0 {
			sysBP = data.Patient.SystolicBP
			diaBP = data.Patient.DiastolicBP
		}
	}
	if bmi == nil {
		if data.Patient.BMI > 0 {
			bmi = &data.Patient.BMI
		}
	}
	if hr == nil {
		if data.Patient.Pulse != nil && *data.Patient.Pulse > 0 {
			hr = data.Patient.Pulse
		}
	}
	if spo2 == nil {
		if data.Patient.Saturation != nil && *data.Patient.Saturation > 0 {
			spo2 = data.Patient.Saturation
		}
	}

	// Если данных нет, используем нормальные значения здорового человека
	normalTemp := 36.6
	normalSysBP := 120
	normalDiaBP := 80
	var normalBMI float64
	if data.Patient.Height > 0 && data.Patient.Weight > 0 {
		normalBMI = data.Patient.Weight / ((data.Patient.Height / 100) * (data.Patient.Height / 100))
	} else {
		normalBMI = 22.0 // среднее нормальное значение
	}

	if temp == nil {
		temp = &normalTemp
	}
	if sysBP == nil {
		sysBP = &normalSysBP
		diaBP = &normalDiaBP
	}
	if bmi == nil {
		bmi = &normalBMI
	}
	// Для ЧСС и Сатурации не устанавливаем нормальные значения, оставляем nil
	// Если данных нет, в addPatientInfo будет выведено 0

	return
}

// addPatientInfo добавляет идентификационную информацию пациента, дату и врача
func (g *PDFGenerator) addPatientInfo(doc *document.Document, data *HealthPassportData) {
	// Получаем витальные показатели
	temp, sysBP, diaBP, bmi, hr, spo2 := getVitalSigns(data)
	if data.Patient.Saturation != nil {
	}

	// Создаем один параграф для всей информации
	// НЕ выравниваем по ширине - оставляем по левому краю
	para := doc.AddParagraph()
	run := para.AddRun()
	g.setArialFont11(run)

	// Дата (сначала)
	run.AddText(fmt.Sprintf("Дата: %s", data.GeneratedAt))
	run.AddBreak()
	run.AddBreak() // Пустая строка после даты

	// ФИО
	run.AddText(fmt.Sprintf("Пациент: %s %s %s",
		data.Patient.LastName, data.Patient.FirstName, data.Patient.MiddleName))
	run.AddBreak()

	// Пол
	run.AddText(fmt.Sprintf("Пол: %s", data.Patient.Gender))
	run.AddBreak()

	// Дата рождения
	birthDate := dateOnly(data.Patient.BirthDate)
	run.AddText(fmt.Sprintf("Дата рождения: %s (%d лет)", birthDate, data.Patient.Age))
	run.AddBreak()

	// Телефон
	if data.Patient.Phone != "" {
		run.AddText(fmt.Sprintf("Телефон: %s", data.Patient.Phone))
		run.AddBreak()
	}

	// Адрес
	if data.Patient.Address != "" {
		run.AddText(fmt.Sprintf("Адрес: %s", data.Patient.Address))
		run.AddBreak()
	}

	// Температура
	if temp != nil {
		run.AddText(fmt.Sprintf("Температура: %.1f °C", *temp))
		run.AddBreak()
	}

	// Артериальное давление, ЧСС и Сатурация в одной строке
	var bpText string
	if sysBP != nil && diaBP != nil {
		bpText = fmt.Sprintf("Артериальное давление: %d / %d мм рт. ст.", *sysBP, *diaBP)
	} else {
		bpText = "Артериальное давление: —"
	}

	hrValue := 0
	if hr != nil {
		hrValue = *hr
	}

	spo2Value := 0
	if spo2 != nil {
		spo2Value = *spo2
	}

	run.AddText(fmt.Sprintf("%s; ЧСС: %d; Сатурация: %d", bpText, hrValue, spo2Value))
	run.AddBreak()

	// ИМТ
	if bmi != nil {
		run.AddText(fmt.Sprintf("ИМТ: %.1f", *bmi))
		run.AddBreak()
	}

	// Врач (в конце)
	doctorName := fmt.Sprintf("%s %s %s",
		data.Doctor.FirstName, data.Doctor.MiddleName, data.Doctor.LastName)

	// Используем первую роль, если есть, иначе "Врач"
	role := "Врач"
	if len(data.Doctor.Roles) > 0 && data.Doctor.Roles[0] != "" {
		role = data.Doctor.Roles[0]
	}

	run.AddText(fmt.Sprintf("%s: %s", role, doctorName))

	doc.AddParagraph() // Пустая строка после информации
}

// addDoctorInfoInline добавляет информацию о враче и дату генерации после таблицы пациента
func (g *PDFGenerator) addDoctorInfoInline(doc *document.Document, data *HealthPassportData) {
	// Врач - формат: Роль: ФИО
	para := doc.AddParagraph()
	run := para.AddRun()
	doctorName := fmt.Sprintf("%s %s %s",
		data.Doctor.FirstName, data.Doctor.MiddleName, data.Doctor.LastName)

	// Используем первую роль, если есть, иначе "Врач"
	role := "Врач"
	if len(data.Doctor.Roles) > 0 && data.Doctor.Roles[0] != "" {
		role = data.Doctor.Roles[0]
	}

	run.AddText(fmt.Sprintf("%s: %s", role, doctorName))
	run.Properties().SetSize(11 * measurement.Point)

	// Дата генерации
	para = doc.AddParagraph()
	run = para.AddRun()
	run.AddText(fmt.Sprintf("Дата: %s", data.GeneratedAt))
	run.Properties().SetSize(11 * measurement.Point)

	doc.AddParagraph() // Пустая строка
}

// setArialFont11 устанавливает шрифт Arial размером 11 для run
func (g *PDFGenerator) setArialFont11(run document.Run) {
	run.Properties().SetSize(11 * measurement.Point)
	// Устанавливаем шрифт через RFonts
	props := run.Properties().X()
	if props.RFonts == nil {
		props.RFonts = wml.NewCT_Fonts()
	}
	asciiVal := "Arial"
	props.RFonts.AsciiAttr = &asciiVal
	hAnsiVal := "Arial"
	props.RFonts.HAnsiAttr = &hAnsiVal
}

// addSection добавляет секцию с заголовком и содержимым
func (g *PDFGenerator) addSection(doc *document.Document, title, content string) {
	// Заголовок секции
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText(title)
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)

	// Содержимое (конвертируем HTML в текст, если нужно)
	contentText := g.htmlToText(content)

	// Для анамнеза заболевания убираем повторяющийся заголовок из начала текста
	if title == "Анамнез заболевания" {
		contentText = regexp.MustCompile(`(?i)^\s*Анамнез\s+заболевания[:\s]*`).ReplaceAllString(contentText, "")
		contentText = strings.TrimSpace(contentText)
	}

	lines := strings.Split(contentText, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			para = doc.AddParagraph()
			para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
			run = para.AddRun()
			run.AddText(line)
			g.setArialFont11(run)
		}
	}

	doc.AddParagraph() // Пустая строка после секции
}

// addListSection добавляет секцию со списком (каждый элемент на отдельной строке с маркером)
func (g *PDFGenerator) addListSection(doc *document.Document, title, content string) {
	// Заголовок секции
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText(title)
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)

	// Конвертируем HTML в текст, если нужно
	contentText := g.htmlToText(content)

	// Парсим список элементов
	items := g.parseListItems(contentText)

	// Выводим каждый элемент списка на отдельной строке с маркером
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			para = doc.AddParagraph()
			para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
			run = para.AddRun()
			run.AddText("  • " + strings.TrimSpace(item))
			g.setArialFont11(run)
		}
	}

	doc.AddParagraph() // Пустая строка после секции
}

// parseListItems парсит текст и извлекает элементы списка
func (g *PDFGenerator) parseListItems(content string) []string {
	var items []string

	// Сначала проверяем, есть ли явные маркеры списка в начале строк
	// Если есть, парсим по строкам
	lines := strings.Split(content, "\n")
	hasListMarkers := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Проверяем, есть ли явные маркеры списка
		if strings.HasPrefix(line, "- ") ||
			strings.HasPrefix(line, "* ") ||
			strings.HasPrefix(line, "• ") ||
			strings.HasPrefix(line, "· ") ||
			regexp.MustCompile(`^\d+\.\s+`).MatchString(line) {
			hasListMarkers = true
			break
		}
	}

	// Если есть явные маркеры списка, парсим по строкам
	if hasListMarkers {
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			// Проверяем различные форматы маркеров списка
			if strings.HasPrefix(line, "- ") {
				item := strings.TrimPrefix(line, "- ")
				item = strings.TrimSpace(item)
				if item != "" {
					items = append(items, item)
				}
			} else if strings.HasPrefix(line, "* ") {
				item := strings.TrimPrefix(line, "* ")
				item = strings.TrimSpace(item)
				if item != "" {
					items = append(items, item)
				}
			} else if regexp.MustCompile(`^\d+\.\s+`).MatchString(line) {
				item := regexp.MustCompile(`^\d+\.\s+`).ReplaceAllString(line, "")
				item = strings.TrimSpace(item)
				if item != "" {
					items = append(items, item)
				}
			} else if strings.HasPrefix(line, "• ") {
				item := strings.TrimPrefix(line, "• ")
				item = strings.TrimSpace(item)
				if item != "" {
					items = append(items, item)
				}
			} else if strings.HasPrefix(line, "· ") {
				item := strings.TrimPrefix(line, "· ")
				item = strings.TrimSpace(item)
				if item != "" {
					items = append(items, item)
				}
			} else {
				// Строка без маркера - может быть продолжением предыдущего элемента или отдельным элементом
				// Если предыдущий элемент есть, добавляем к нему, иначе добавляем как новый элемент
				if len(items) > 0 {
					items[len(items)-1] += " " + line
				} else {
					items = append(items, line)
				}
			}
		}
	} else {
		// Нет явных маркеров списка - пытаемся разбить по разделителям или строкам
		// Сначала пробуем разбить по точкам с запятой (если есть)
		if strings.Contains(content, ";") {
			parts := strings.Split(content, ";")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				// Убираем возможные переносы строк внутри элемента
				part = strings.ReplaceAll(part, "\n", " ")
				part = regexp.MustCompile(`\s+`).ReplaceAllString(part, " ")
				part = strings.TrimSpace(part)
				if part != "" {
					items = append(items, part)
				}
			}
		} else {
			// Нет точек с запятой - разбиваем по переносам строк
			// Но сначала проверяем, не все ли в одной строке
			trimmedContent := strings.TrimSpace(content)
			if strings.Contains(trimmedContent, "\n") {
				// Есть переносы строк - разбиваем по ним
				for _, line := range lines {
					line = strings.TrimSpace(line)
					line = regexp.MustCompile(`\s+`).ReplaceAllString(line, " ")
					if line != "" {
						items = append(items, line)
					}
				}
			} else {
				// Все в одной строке - пытаемся разбить по запятым (если они есть)
				if strings.Contains(trimmedContent, ",") {
					parts := strings.Split(trimmedContent, ",")
					for _, part := range parts {
						part = strings.TrimSpace(part)
						part = regexp.MustCompile(`\s+`).ReplaceAllString(part, " ")
						if part != "" {
							items = append(items, part)
						}
					}
				} else {
					// Нет разделителей - добавляем весь контент как один элемент
					trimmedContent = regexp.MustCompile(`\s+`).ReplaceAllString(trimmedContent, " ")
					if trimmedContent != "" {
						items = append(items, trimmedContent)
					}
				}
			}
		}
	}

	return items
}

// parseLifestyleItems парсит текст анамнеза жизни и возвращает map с пунктами
func (g *PDFGenerator) parseLifestyleItems(content string) map[string]string {
	items := make(map[string]string)

	// Конвертируем HTML в текст
	contentText := g.htmlToText(content)

	// Нормализуем текст - заменяем множественные пробелы на один
	contentText = regexp.MustCompile(`\s+`).ReplaceAllString(contentText, " ")
	contentText = strings.TrimSpace(contentText)

	// Парсим нумерованные пункты (1. ... 2. ... 3. ...)
	// Разбиваем текст по нумерации пунктов, так как Go regexp не поддерживает lookahead
	// Ищем все вхождения паттерна "число. название: значение"
	// Более строгий паттерн: число, точка, пробел, название (без двоеточия до двоеточия), двоеточие, пробел
	re := regexp.MustCompile(`(\d+)\.\s+([^:\n]+?):\s+`)
	matches := re.FindAllStringSubmatchIndex(contentText, -1)

	// Определяем соответствие номеров пунктов их названиям
	itemLabels := map[int]string{
		1: "Перенесенные заболевания",
		2: "Операции",
		3: "Аллергии",
		4: "Наследственность",
		5: "Вредные привычки",
		6: "Гинекологический анамнез",
		7: "Какие препараты принимает в данное время",
	}

	// Извлекаем значения для каждого пункта
	for i, match := range matches {
		if len(match) >= 6 {
			// match[0] и match[1] - начало и конец всего совпадения
			// match[2] и match[3] - начало и конец номера
			// match[4] и match[5] - начало и конец названия
			numStr := contentText[match[2]:match[3]]
			startPos := match[1] // Конец совпадения (после ": ")

			// Определяем конец значения - либо начало следующего пункта, либо конец текста
			endPos := len(contentText)
			if i+1 < len(matches) {
				// Следующий пункт начинается с match[i+1][0]
				nextItemStart := matches[i+1][0]
				// Берем весь текст до следующего пункта
				endPos = nextItemStart
			}

			value := strings.TrimSpace(contentText[startPos:endPos])

			// Логируем для отладки (первые 100 символов)
			if len(value) > 0 {
				previewLen := 100
				if len(value) < previewLen {
					previewLen = len(value)
				}
			}

			// Убираем только явные упоминания следующего пункта в конце значения
			// Ищем паттерн "число. название:" в самом конце значения
			// Это должно быть отдельное предложение, а не часть текста
			reNextItem := regexp.MustCompile(`\s+\d+\.\s+[А-Яа-яЁёA-Za-z\s]+:\s*$`)
			if reNextItem.MatchString(value) {
				value = reNextItem.ReplaceAllString(value, "")
				value = strings.TrimSpace(value)
			}

			// Убираем только непечатаемые символы в конце, но НЕ обрезаем нормальный текст
			value = regexp.MustCompile(`[\x00-\x1F\x7F-\x9F]+$`).ReplaceAllString(value, "")
			value = strings.TrimSpace(value)

			// НЕ обрезаем текст по длине - оставляем полный текст

			// Преобразуем номер в int
			if num, err := strconv.Atoi(numStr); err == nil {
				if itemLabel, ok := itemLabels[num]; ok {
					// Очищаем значение от дублирования
					cleanedValue := g.cleanLifestyleItem(value)
					if cleanedValue != "" {
						items[itemLabel] = cleanedValue
					}
				}
			}
		}
	}

	// Если не нашли пункты с нумерацией, пытаемся найти по названиям пунктов
	if len(items) == 0 {
		itemPatterns := map[string][]string{
			"Перенесенные заболевания": []string{"перенесенные заболевания", "перенесенные болезни", "хронические заболевания"},
			"Операции":                 []string{"операции", "оперативное вмешательство"},
			"Аллергии":                 []string{"аллергии", "аллергические реакции"},
			"Наследственность":         []string{"наследственность", "наследственные заболевания"},
			"Вредные привычки":         []string{"вредные привычки", "курение", "алкоголь"},
			"Гинекологический анамнез": []string{"гинекологический анамнез", "гинекология"},
			"Какие препараты принимает в данное время": []string{"препараты", "лекарства", "медикаменты", "принимает"},
		}

		for itemLabel, patterns := range itemPatterns {
			for _, pattern := range patterns {
				// Ищем паттерн в тексте, за которым следует двоеточие и значение
				// Используем FindStringSubmatchIndex для получения позиций, так как Go regexp не поддерживает lookahead
				re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(pattern) + `[:\s]*([^0-9]+)`)
				match := re.FindStringSubmatchIndex(contentText)
				if len(match) >= 4 {
					// match[2] и match[3] - начало и конец значения
					valueStart := match[2]
					valueEnd := match[3]

					// Ищем конец значения - либо начало следующего пункта с нумерацией, либо конец текста
					nextItemRe := regexp.MustCompile(`\s+\d+\.\s+`)
					nextMatch := nextItemRe.FindStringIndex(contentText[valueEnd:])
					if nextMatch != nil {
						valueEnd = valueStart + nextMatch[0]
					}

					value := strings.TrimSpace(contentText[valueStart:valueEnd])

					// Убираем только явные упоминания следующего пункта в конце значения
					// Ищем паттерн "число. название:" в самом конце значения (после точки или запятой)
					reNextItem := regexp.MustCompile(`[\.\s]+\d+\.\s+[А-Яа-яЁёA-Za-z\s]+:\s*$`)
					if reNextItem.MatchString(value) {
						value = reNextItem.ReplaceAllString(value, "")
						value = strings.TrimSpace(value)
					}

					// Убираем только непечатаемые символы в конце, но НЕ обрезаем нормальный текст
					value = regexp.MustCompile(`[\x00-\x1F\x7F-\x9F]+$`).ReplaceAllString(value, "")
					value = strings.TrimSpace(value)

					cleanedValue := g.cleanLifestyleItem(value)
					if cleanedValue != "" {
						items[itemLabel] = cleanedValue
						break
					}
				}
			}
		}
	}

	return items
}

// cleanLifestyleItem убирает дублирование и лишний текст из пункта анамнеза
func (g *PDFGenerator) cleanLifestyleItem(item string) string {
	if item == "" {
		return ""
	}

	item = strings.TrimSpace(item)
	itemLower := strings.ToLower(item)

	// Паттерны для определения "отсутствует" (в порядке приоритета - более специфичные первыми)
	absentPatterns := []string{
		"не принимает постоянных препаратов",
		"не принимает",
		"отсутствуют",
		"отсутствует",
		"не указаны",
		"не указана",
		"не указано",
		"чистая",
	}

	// Паттерны для лишнего текста, который нужно убрать (в порядке приоритета)
	redundantPatterns := []string{
		"нет сведений о болезнях, операциях, травмах или госпитализациях за последний год",
		"хронических заболеваний не отмечает",
		"не отмечает",
		"отмечает",
		"нет сведений о",
		"нет сведений",
		"сведения о",
		"нет данных о",
		"нет данных",
		"данных о",
		"информация о",
		"информация отсутствует",
		"сведения отсутствуют",
		"данные отсутствуют",
	}

	// Сначала убираем лишние паттерны, но только если они в начале текста
	// НЕ удаляем паттерны из середины или конца, чтобы не обрезать важную информацию
	for _, pattern := range redundantPatterns {
		// Удаляем только если паттерн в начале текста
		re := regexp.MustCompile(`(?i)^\s*` + regexp.QuoteMeta(pattern) + `[^\.]*?\.?\s*`)
		item = re.ReplaceAllString(item, "")
	}

	item = strings.TrimSpace(item)
	itemLower = strings.ToLower(item)

	// Ищем паттерн "отсутствует" в тексте
	var foundAbsentPattern string
	for _, pattern := range absentPatterns {
		if strings.Contains(itemLower, pattern) {
			foundAbsentPattern = pattern
			break
		}
	}

	// Если нашли паттерн "отсутствует", проверяем, не является ли весь текст только этим паттерном
	// Если текст содержит только паттерн или очень короткий контекст, заменяем на "без особенностей"
	if foundAbsentPattern != "" {
		// Проверяем, является ли текст только паттерном или очень коротким
		itemLower = strings.ToLower(item)
		// Если текст состоит ТОЛЬКО из паттерна (без дополнительного контекста), заменяем
		// Но если есть дополнительный контекст (больше 20 символов), оставляем текст как есть
		if len(item) <= len(foundAbsentPattern)+20 {
			// Проверяем, что паттерн является основной частью текста
			// Убираем паттерн из текста и смотрим, что осталось
			textWithoutPattern := strings.ReplaceAll(itemLower, foundAbsentPattern, "")
			textWithoutPattern = regexp.MustCompile(`\s+`).ReplaceAllString(textWithoutPattern, " ")
			textWithoutPattern = strings.TrimSpace(textWithoutPattern)
			// Если после удаления паттерна осталось мало текста (меньше 10 символов), заменяем
			if len(textWithoutPattern) < 10 {
				return "без особенностей"
			}
		}
		// Если текст длинный и содержит паттерн, но также содержит другую информацию, НЕ заменяем
		// Просто продолжаем обработку текста
	}

	// Если не нашли паттерн "отсутствует", возвращаем очищенный текст
	// Нормализуем пробелы
	item = regexp.MustCompile(`\s+`).ReplaceAllString(item, " ")
	item = strings.TrimSpace(item)

	// Убираем лишние символы в начале (запятые, точки, пробелы)
	item = regexp.MustCompile(`^[,\s\.]+`).ReplaceAllString(item, "")

	// Убираем точки с запятой и точки в конце
	item = strings.TrimSuffix(item, ";")
	item = strings.TrimSuffix(item, ".")
	item = strings.TrimSpace(item)

	// Если после очистки текст пустой, возвращаем пустую строку
	if item == "" {
		return ""
	}

	return item
}

// addLifestyleSection добавляет секцию "Анамнез жизни" (всегда показываем)
func (g *PDFGenerator) addLifestyleSection(doc *document.Document, data *HealthPassportData) {
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText("Анамнез жизни")
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)

	// Определяем структуру пунктов анамнеза жизни (всегда показываем все 7 пунктов)
	lifestyleItems := []struct {
		label string
		value string
	}{
		{"Перенесенные заболевания", "без особенностей"},
		{"Операции", "без особенностей"},
		{"Аллергии", "без особенностей"},
		{"Наследственность", "без особенностей"},
		{"Вредные привычки", "без особенностей"},
		{"Гинекологический анамнез", "без особенностей"},
		{"Какие препараты принимает в данное время", "без особенностей"},
	}

	if data.Lifestyle != "" && !isEmptyString(data.Lifestyle) {
		// Парсим пункты из текста
		parsedItems := g.parseLifestyleItems(data.Lifestyle)

		// Обновляем значения пунктов на основе распарсенных данных
		for i := range lifestyleItems {
			itemLabel := lifestyleItems[i].label
			// Убираем номер из метки для поиска
			labelWithoutNum := regexp.MustCompile(`^\d+\.\s+`).ReplaceAllString(itemLabel, "")

			// Ищем соответствующее значение в распарсенных данных
			if value, ok := parsedItems[labelWithoutNum]; ok && value != "" {
				// Заменяем "отсутствует"/"отсутствуют"/"не указаны"/"не указана"/"чистая" на "без особенностей"
				valueLower := strings.ToLower(value)
				valueTrimmed := strings.TrimSpace(valueLower)
				if strings.Contains(valueLower, "отсутствует") ||
					strings.Contains(valueLower, "отсутствуют") ||
					strings.Contains(valueLower, "не указаны") ||
					strings.Contains(valueLower, "не указана") ||
					strings.Contains(valueLower, "не указано") ||
					valueTrimmed == "чистая" {
					lifestyleItems[i].value = "без особенностей"
				} else {
					lifestyleItems[i].value = value
				}
			}
		}
	}

	// Выводим все пункты (каждый на отдельной строке)
	for _, item := range lifestyleItems {
		para = doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run = para.AddRun()
		run.AddText(fmt.Sprintf("%s: %s", item.label, item.value))
		g.setArialFont11(run)
	}

	doc.AddParagraph() // Пустая строка
}

// parseObjectiveStatusLine парсит строку объективного статуса и определяет, является ли она заголовком
func parseObjectiveStatusLine(line string) (isHeader bool, headerName string, content string) {
	line = strings.TrimSpace(line)
	if line == "" {
		return false, "", ""
	}

	// Паттерны для определения заголовков подразделов
	// НЕ включаем "Текущее состояние" и "Объективное состояние" - они обрабатываются отдельно
	headerPatterns := []string{
		"Кожные покровы и ногти:",
		"Язык:",
		"Зев, нос и уши:",
		"Региональные лимфатические узлы:",
		"Щитовидная железа:",
		"Грудная клетка:",
		"Область сердца:",
		"Обследование живота:",
		"Симптом поколачивания:",
		"Опорно-двигательный аппарат:",
		"Неврологический статус:",
		"Отеки:",
		"Стул:",
		"Диурез:",
		"Status localis:",
		"Кожные покровы и ногти",
		"Язык",
		"Зев, нос и уши",
		"Региональные лимфатические узлы",
		"Щитовидная железа",
		"Грудная клетка",
		"Область сердца",
		"Обследование живота",
		"Симптом поколачивания",
		"Опорно-двигательный аппарат",
		"Неврологический статус",
		"Отеки",
		"Стул",
		"Диурез",
		"Status localis",
	}

	// Проверяем, начинается ли строка с заголовка
	for _, pattern := range headerPatterns {
		if strings.HasPrefix(line, pattern) {
			headerName = strings.TrimSuffix(pattern, ":")
			content = strings.TrimPrefix(line, pattern)
			content = strings.TrimSpace(strings.TrimPrefix(content, ":"))
			return true, headerName, content
		}
	}

	return false, "", line
}

// addObjectiveStatusSection добавляет секцию "Объективный статус" (всегда показываем)
func (g *PDFGenerator) addObjectiveStatusSection(doc *document.Document, data *HealthPassportData) {
	// Заголовок секции "Объективный статус"
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText("Объективный статус")
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)
	doc.AddParagraph() // Пустая строка после заголовка

	// Текущее состояние - БЕЗ заголовка, просто текст (идет первым)
	if data.CurrentState != "" && !isEmptyString(data.CurrentState) {
		contentText := g.htmlToText(data.CurrentState)
		// Убираем возможные заголовки "Текущее состояние:" или "Текущее состояние" из начала текста
		contentText = strings.TrimSpace(contentText)
		contentText = regexp.MustCompile(`(?i)^(?:текущее\s+состояние[:\s]*)?`).ReplaceAllString(contentText, "")
		contentText = strings.TrimSpace(contentText)

		if contentText != "" {
			lines := strings.Split(contentText, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" {
					para = doc.AddParagraph()
					para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
					run = para.AddRun()
					run.AddText(line)
					g.setArialFont11(run)
				}
			}
			doc.AddParagraph() // Пустая строка после текущего состояния
		}
	}

	// Объективный статус - парсим и форматируем с подзаголовками
	objectiveStatusContent := data.ObjectiveStatus
	if objectiveStatusContent == "" || isEmptyString(objectiveStatusContent) {
		objectiveStatusContent = data.GeneralConclusion
	}

	// Определяем структуру пунктов объективного статуса (всегда показываем все пункты)
	// НЕ включаем "Объективное состояние" и "Текущее состояние" - они обрабатываются отдельно
	objectiveStatusItems := []struct {
		label string
		value string
	}{
		{"Кожные покровы и ногти", "Без особенностей"},
		{"Язык", "Без особенностей"},
		{"Зев, нос и уши", "Без особенностей"},
		{"Региональные лимфатические узлы", "Без особенностей"},
		{"Щитовидная железа", "Без особенностей"},
		{"Грудная клетка", "Без особенностей"},
		{"Область сердца", "Без особенностей"},
		{"Обследование живота", "Без особенностей"},
		{"Симптом поколачивания", "Без особенностей"},
		{"Опорно-двигательный аппарат", "Без особенностей"},
		{"Неврологический статус", "Без особенностей"},
		{"Отеки", "Без особенностей"},
		{"Стул", "Без особенностей"},
		{"Диурез", "Без особенностей"},
		{"Status localis", "Без особенностей"},
	}

	if objectiveStatusContent != "" && !isEmptyString(objectiveStatusContent) {
		contentText := g.htmlToText(objectiveStatusContent)

		// Убираем возможный заголовок "Объективный статус:" из начала
		contentText = regexp.MustCompile(`(?i)^(?:объективный\s+статус[:\s]*)?`).ReplaceAllString(contentText, "")
		contentText = strings.TrimSpace(contentText)

		// Убираем возможное дублирование "Текущее состояние" и "Объективное состояние" из ObjectiveStatus
		// (они обрабатываются отдельно)
		contentText = regexp.MustCompile(`(?i)^(?:текущее\s+состояние[:\s]*)?`).ReplaceAllString(contentText, "")
		contentText = regexp.MustCompile(`(?i)^(?:объективное\s+состояние[:\s]*)?`).ReplaceAllString(contentText, "")
		contentText = strings.TrimSpace(contentText)

		// Парсим пункты из текста
		lines := strings.Split(contentText, "\n")
		var currentHeader string
		var currentContent []string

		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			isHeader, headerName, content := parseObjectiveStatusLine(line)

			if isHeader {
				// Сохраняем предыдущий блок, если есть
				if currentHeader != "" {
					// Ищем соответствующий пункт в структуре и обновляем значение
					for i := range objectiveStatusItems {
						if strings.EqualFold(objectiveStatusItems[i].label, currentHeader) {
							value := strings.TrimSpace(strings.Join(currentContent, " "))
							// Заменяем "норма", "в норме", "нормальный" на "Без особенностей"
							value = g.cleanObjectiveStatusValue(value)
							if value != "" {
								objectiveStatusItems[i].value = value
							}
							break
						}
					}
				}
				// Начинаем новый блок
				currentHeader = headerName
				currentContent = []string{}
				if content != "" {
					currentContent = append(currentContent, content)
				}
			} else {
				// Это содержимое текущего блока
				if currentHeader != "" {
					currentContent = append(currentContent, line)
				} else {
					// Если нет текущего заголовка, это может быть продолжение предыдущего контента
					if len(currentContent) > 0 {
						currentContent = append(currentContent, line)
					}
				}
			}
		}

		// Сохраняем последний блок
		if currentHeader != "" {
			for i := range objectiveStatusItems {
				if strings.EqualFold(objectiveStatusItems[i].label, currentHeader) {
					value := strings.TrimSpace(strings.Join(currentContent, " "))
					value = g.cleanObjectiveStatusValue(value)
					if value != "" {
						objectiveStatusItems[i].value = value
					}
					break
				}
			}
		}
	}

	// Выводим все пункты (каждый на отдельной строке)
	for _, item := range objectiveStatusItems {
		g.addObjectiveStatusSubsection(doc, item.label, item.value)
	}

	doc.AddParagraph() // Пустая строка
}

// cleanObjectiveStatusValue очищает значение объективного статуса
func (g *PDFGenerator) cleanObjectiveStatusValue(value string) string {
	if value == "" {
		return "Без особенностей"
	}

	value = strings.TrimSpace(value)

	// Заменяем слова "норма", "в норме", "нормальный" на "Без особенностей" или другие подходящие фразы
	normalPatterns := []string{
		"норма",
		"в норме",
		"нормальный",
		"норме",
		"нормально",
		"normal",
		"в пределах нормы",
		"в пределах индивидуальной нормы",
	}

	for _, pattern := range normalPatterns {
		// Заменяем только если это отдельное слово или фраза
		re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(pattern) + `\b`)
		value = re.ReplaceAllString(value, "без особенностей")
	}

	// Если после очистки осталось только "без особенностей" или пусто, возвращаем "Без особенностей"
	value = strings.TrimSpace(value)
	if value == "" || strings.ToLower(value) == "без особенностей" {
		return "Без особенностей"
	}

	return value
}

// addDiagnosisSection добавляет секцию "Диагноз" (всегда показываем)
func (g *PDFGenerator) addDiagnosisSection(doc *document.Document, data *HealthPassportData) {
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText("Диагноз")
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)

	para = doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
	run = para.AddRun()
	if data.DiagnosisMain != "" && !isEmptyString(data.DiagnosisMain) {
		// Убираем "Предварительный:" или "Заключительный:" из начала диагноза, если они там есть
		diagnosisText := strings.TrimSpace(data.DiagnosisMain)
		// Убираем "диагноз:" в начале (с учетом регистра и возможных пробелов)
		diagnosisText = regexp.MustCompile(`(?i)^(?:диагноз|diagnosis)[:\s]+`).ReplaceAllString(diagnosisText, "")
		// Убираем "Предварительный диагноз:" или "Заключительный диагноз:" из начала
		diagnosisText = regexp.MustCompile(`(?i)^(?:Предварительный|Заключительный)[:\s]*(?:диагноз|diagnosis)[:\s]+`).ReplaceAllString(diagnosisText, "")
		// Убираем "Предварительный:" или "Заключительный:" из начала (если остались)
		diagnosisText = regexp.MustCompile(`(?i)^(?:Предварительный|Заключительный)[:\s]+`).ReplaceAllString(diagnosisText, "")
		diagnosisText = strings.TrimSpace(diagnosisText)
		run.AddText(fmt.Sprintf("Основной: %s", diagnosisText))
	} else {
		run.AddText("Основной: не установлен")
	}
	g.setArialFont11(run)

	para = doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
	run = para.AddRun()
	if len(data.DiagnosisComorbid) > 0 {
		run.AddText("Сопутствующие:")
		g.setArialFont11(run)
		for _, diag := range data.DiagnosisComorbid {
			para = doc.AddParagraph()
			para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
			run = para.AddRun()
			run.AddText(fmt.Sprintf("  • %s", diag))
			g.setArialFont11(run)
		}
	} else {
		run.AddText("Сопутствующие: отсутствуют")
	}
	g.setArialFont11(run)

	doc.AddParagraph() // Пустая строка
}

// addObjectiveStatusSubsection добавляет подраздел объективного статуса с правильным форматированием
func (g *PDFGenerator) addObjectiveStatusSubsection(doc *document.Document, headerName string, content string) {
	if headerName == "" {
		return
	}

	content = strings.TrimSpace(content)
	if content == "" {
		content = "Без особенностей"
	}

	// Убираем точку в конце, если это "Без особенностей"
	content = strings.TrimSuffix(content, ".")
	content = strings.TrimSpace(content)
	if content == "" || strings.ToLower(content) == "без особенностей" {
		content = "Без особенностей"
	}

	// Подразделы, которые должны быть в одну строку через ; (все подпункты в одной строке)
	singleLineSections := map[string]bool{
		"Грудная клетка":      true,
		"Область сердца":      true,
		"Обследование живота": true,
	}

	// Форматируем содержимое в зависимости от типа подраздела
	if singleLineSections[headerName] {
		// Для "Грудная клетка", "Область сердца", "Обследование живота" - все подпункты в одну строку через ;
		// Если в content уже есть ;, оставляем как есть (в одну строку)
		// Если нет ;, но есть переносы строк, объединяем через ;
		if !strings.Contains(content, ";") {
			// Объединяем строки через ;
			lines := strings.Split(content, "\n")
			var parts []string
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" {
					parts = append(parts, line)
				}
			}
			if len(parts) > 0 {
				content = strings.Join(parts, "; ")
			}
		}

		// Выводим заголовок и содержимое в одну строку
		para := doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run := para.AddRun()
		run.AddText(headerName + ": " + content)
		g.setArialFont11(run)
	} else {
		// Для остальных - заголовок и значение в одну строку
		// Объединяем все строки содержимого в одну
		lines := strings.Split(content, "\n")
		var parts []string
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				parts = append(parts, line)
			}
		}
		content = strings.Join(parts, " ")

		// Выводим заголовок и содержимое в одну строку
		para := doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run := para.AddRun()
		run.AddText(headerName + ": " + content)
		g.setArialFont11(run)
	}
}

// addFilesAnalysisSection добавляет секцию "Интерпретация данных исследований"
// Парсит структурированный формат: Название исследования, Ключевые находки, Заключение
func (g *PDFGenerator) addFilesAnalysisSection(doc *document.Document, data *HealthPassportData) {
	para := doc.AddParagraph()
	run := para.AddRun()
	run.AddText("Интерпретация данных исследований")
	run.Properties().SetBold(true)
	run.Properties().SetSize(13 * measurement.Point)
	g.setArialFont11(run)

	if data.FilesAnalysis != "" && !isEmptyString(data.FilesAnalysis) {
		contentText := g.htmlToText(data.FilesAnalysis)
		log.Printf("[Интерпретация данных исследований] DOCX: Начало обработки раздела, длина контента=%d символов", len(contentText))
		g.parseAndAddStructuredResearchContent(doc, contentText)
	} else {
		para = doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run = para.AddRun()
		run.AddText("Файлы для анализа не найдены.")
		g.setArialFont11(run)
		run.Properties().SetItalic(true)
	}

	doc.AddParagraph() // Пустая строка
}

// parseAndAddStructuredResearchContent парсит структурированный формат исследований
// Формат: Название исследования\n\nКлючевые находки: ...\n\nЗаключение: ...
// Упрощенная версия - формат теперь более структурированный благодаря JSON
func (g *PDFGenerator) parseAndAddStructuredResearchContent(doc *document.Document, content string) {
	content = regexp.MustCompile(`\n\s*---\s*\n`).ReplaceAllString(content, "\n\n")

	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimSpace(content)

	if content == "" {
		return
	}

	// УПРОЩЕННЫЙ ПАРСИНГ: Используем основной паттерн для структурированного формата
	// Формат теперь более предсказуемый благодаря JSON, поэтому можем упростить
	studyPattern := regexp.MustCompile(`(?i)([^\n]+(?:\([^)]+\))?)\s*\n\s*(?:Ключевые находки:|Key findings:)\s*([^\n]+(?:\n[^\n]+)*?)\s*\n\s*(?:Заключение:|Conclusion:)\s*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n|$)`)
	matches := studyPattern.FindAllStringSubmatch(content, -1)
	matchIndices := studyPattern.FindAllStringSubmatchIndex(content, -1)
	

	var studies []string
	var regexFoundIndices []int // Индексы найденных через regex исследований

	if len(matches) > 0 {
		// Нашли структурированные исследования через regex
		for i, match := range matches {
			if len(match) >= 4 && i < len(matchIndices) && len(matchIndices[i]) >= 2 {
				rawStudyName := strings.TrimSpace(match[1])
				findings := strings.TrimSpace(match[2])
				conclusion := strings.TrimSpace(match[3])

				
				// ОЧИЩАЕМ название исследования
				// Сначала убираем даты в скобках в конце
				cleanedStudyName := regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(rawStudyName, "")
				cleanedStudyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(cleanedStudyName, "")
				cleanedStudyName = strings.TrimSpace(cleanedStudyName)
				
				// Проверяем, не содержит ли название текст после "Ключевые находки:" или похожих маркеров
				if idx := strings.Index(strings.ToLower(cleanedStudyName), "ключевые находки"); idx > 0 {
					cleanedStudyName = strings.TrimSpace(cleanedStudyName[:idx])
				}
				
				// Проверяем, что название не пустое и не слишком короткое (не одна буква)
				// Если название слишком короткое - используем весь rawStudyName (но без даты)
				if cleanedStudyName == "" || len(cleanedStudyName) < 2 {
					// Убираем только дату из rawStudyName
					cleanedStudyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(rawStudyName, "")
					cleanedStudyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(cleanedStudyName, "")
					cleanedStudyName = strings.TrimSpace(cleanedStudyName)
					
					// Если все еще слишком короткое - используем весь rawStudyName
					if cleanedStudyName == "" || len(cleanedStudyName) < 2 {
						cleanedStudyName = rawStudyName
					}
				}
				

				// Убираем лишние переносы строк, но сохраняем структуру
				findings = regexp.MustCompile(`\s+`).ReplaceAllString(findings, " ")
				conclusion = regexp.MustCompile(`\s+`).ReplaceAllString(conclusion, " ")

				studyText := cleanedStudyName + "\n\nКлючевые находки: " + findings + "\n\nЗаключение: " + conclusion
				studies = append(studies, studyText)
				regexFoundIndices = append(regexFoundIndices, matchIndices[i][0])
			}
		}
	}
	
	// Продолжаем искать остальные исследования, даже если regex что-то нашел
	// formatAnalysisResultsForHealthPassport объединяет через \n\n, поэтому это основной разделитель
	if len(studies) == 0 || len(regexFoundIndices) < 4 { // Если нашли меньше 4, продолжаем поиск
		// Сначала пытаемся найти исследования по названиям (ЭКГ, КТ, МРТ, ЭхоКГ, УЗИ и т.д.)
		// Это более надежный способ, чем разбиение по \n\n
		
		// Паттерны названий исследований (в начале строки или после \n\n)
		studyNamePatterns := []string{
			`(?i)(?:^|\n\n)(Электрокардиограмма|ЭКГ|EKG|ECG)(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Компьютерная томография|КТ|CT|КТ\s|КТ\s+[^\n]{0,50})(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Магнитно-резонансная томография|МРТ|MRI|МРТ\s|МРТ\s+[^\n]{0,50})(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Эхокардиография|ЭхоКГ|EchoCG|ЭхоКГ\s|ЭхоКГ\s+[^\n]{0,50})(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Ультразвуковое исследование|УЗИ|Ultrasound|УЗИ\s|УЗИ\s+[^\n]{0,50})(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Анализ крови|Общий анализ крови|Биохимический анализ|Анализ мочи)(?:\s|\(|$)`,
			`(?i)(?:^|\n\n)(Рентгенография|Рентген|X-ray|X-Ray)(?:\s|\(|$)`,
		}
		
		// Находим все позиции названий исследований
		var studyStartIndices []int
		for _, pattern := range studyNamePatterns {
			regex := regexp.MustCompile(pattern)
			matches := regex.FindAllStringIndex(content, -1)
			for _, match := range matches {
				// match[0] - начало совпадения, match[1] - конец
				// Используем начало совпадения как начало исследования
				studyStartIndices = append(studyStartIndices, match[0])
			}
		}
		
		// Убираем дубликаты и сортируем
		if len(studyStartIndices) > 0 {
			// Убираем дубликаты
			uniqueIndices := make(map[int]bool)
			var sortedIndices []int
			for _, idx := range studyStartIndices {
				if !uniqueIndices[idx] {
					uniqueIndices[idx] = true
					sortedIndices = append(sortedIndices, idx)
				}
			}
			sort.Ints(sortedIndices)
			
			
			// Разделяем по найденным индексам
			if len(sortedIndices) > 0 {
				var newStudies []string
				for i := 0; i < len(sortedIndices); i++ {
					start := sortedIndices[i]
					var end int
					if i < len(sortedIndices)-1 {
						end = sortedIndices[i+1]
	} else {
						end = len(content)
					}
					
					studyText := strings.TrimSpace(content[start:end])
					if studyText != "" && len(studyText) > 100 {
						newStudies = append(newStudies, studyText)
						previewLen := 100
						if len(studyText) < previewLen {
							previewLen = len(studyText)
						}
					}
				}
				
				if len(newStudies) > 0 {
					studies = newStudies
				}
			}
		}
		
		// Если не нашли через названия, пробуем разделить по тройным пустым строкам
		if len(studies) == 0 {
			doubleNewlineRegex := regexp.MustCompile(`\n\n\n+`)
			parts := doubleNewlineRegex.Split(content, -1)
			
			// Если нашли несколько частей через двойные пустые строки
			if len(parts) > 1 {
				for _, part := range parts {
					part = strings.TrimSpace(part)
					if part != "" && len(part) > 50 { // Минимальная длина исследования
						studies = append(studies, part)
					}
				}
			}
		}
		
		// Если не нашли через двойные пустые строки, пробуем разделить по паттерну:
		// Пустая строка + короткая строка (название исследования) + не "Ключевые находки" и не "Заключение"
		if len(studies) == 0 {
			// Ищем паттерн: \n\n + короткая строка (до 100 символов) + \n
			// Это может быть название исследования
			// Исключаем строки, которые начинаются с "Ключевые находки" или "Заключение"
			studyNamePattern := regexp.MustCompile(`\n\n+([^\n]{1,100})(?:\n|$)`)
			matches := studyNamePattern.FindAllStringSubmatchIndex(content, -1)
			
			// Фильтруем совпадения - исключаем те, где название начинается с "Ключевые находки" или "Заключение"
			var validMatches [][]int
			for _, match := range matches {
				if len(match) >= 4 {
					nameStart := match[2]
					nameEnd := match[3]
					name := strings.ToLower(strings.TrimSpace(content[nameStart:nameEnd]))
					if !strings.HasPrefix(name, "ключевые находки") && 
					   !strings.HasPrefix(name, "заключение") &&
					   !strings.HasPrefix(name, "key findings") &&
					   !strings.HasPrefix(name, "conclusion") {
						validMatches = append(validMatches, match)
					}
				}
			}
			
			if len(validMatches) > 1 {
				var lastIndex int
				for i, match := range validMatches {
					start := lastIndex
					end := match[0] // Начало паттерна (перед \n\n)
					if i == len(validMatches)-1 {
						end = len(content)
					}
					
					studyText := strings.TrimSpace(content[start:end])
					if studyText != "" && len(studyText) > 50 {
						studies = append(studies, studyText)
					}
					lastIndex = match[0] + 2 // Пропускаем \n\n
				}
				
				// Добавляем последнее исследование
				if lastIndex < len(content) {
					studyText := strings.TrimSpace(content[lastIndex:])
					if studyText != "" && len(studyText) > 50 {
						studies = append(studies, studyText)
					}
				}
			}
		}
		
		// Если все еще не нашли, используем построчный парсинг
		// Разбиваем по вхождениям "Заключение:" - это надежный маркер конца исследования
		if len(studies) == 0 {
		conclusionRegex := regexp.MustCompile(`(?i)(?:^|\n)(?:Заключение:|Conclusion:)\s*`)
		conclusionIndices := conclusionRegex.FindAllStringIndex(content, -1)

		if len(conclusionIndices) > 0 {
			// Разбиваем по заключениям
			var lastIndex int
			for i, idx := range conclusionIndices {
				start := lastIndex
				end := idx[0]
				if i == len(conclusionIndices)-1 {
					// Последнее исследование - берем до конца
					end = len(content)
				}

				studyText := strings.TrimSpace(content[start:end])
				if studyText != "" {
					studies = append(studies, studyText)
				}
				lastIndex = idx[1]
			}
		} else {
			// Если не нашли "Заключение:", пробуем построчный парсинг
			lines := strings.Split(content, "\n")
			var currentStudy strings.Builder
			var hasConclusion bool

			for i, line := range lines {
				lineTrimmed := strings.TrimSpace(line)
				if lineTrimmed == "" {
					if currentStudy.Len() > 0 {
						currentStudy.WriteString("\n")
					}
					continue
				}

				lineLower := strings.ToLower(lineTrimmed)
				isFindings := strings.HasPrefix(lineLower, "ключевые находки:") || strings.HasPrefix(lineLower, "key findings:")
				isConclusion := strings.HasPrefix(lineLower, "заключение:") || strings.HasPrefix(lineLower, "conclusion:")

				// Если это начало нового исследования (не findings и не conclusion)
				if !isFindings && !isConclusion {
					// Если предыдущее исследование завершено - сохраняем его
					if currentStudy.Len() > 0 && hasConclusion {
						studies = append(studies, strings.TrimSpace(currentStudy.String()))
						currentStudy.Reset()
						hasConclusion = false
					}
				}

				if isConclusion {
					hasConclusion = true
				}

				if currentStudy.Len() > 0 {
					currentStudy.WriteString("\n")
				}
				currentStudy.WriteString(line)

				// Если это последняя строка - сохраняем исследование
				if i == len(lines)-1 {
					studyStr := strings.TrimSpace(currentStudy.String())
					if studyStr != "" {
						studies = append(studies, studyStr)
						}
					}
				}
			}
		}
	}

	// Если все еще не нашли структурированные исследования, пробуем разделить по типам исследований
	// Ищем паттерны начала исследований: ЭКГ, КТ, УЗИ, Анализ крови и т.д.
	if len(studies) == 0 {
		// Паттерны для типов исследований (в начале строки после пустой строки)
		studyTypePatterns := []string{
			`(?i)\n\n+(ЭКГ|Электрокардиограмма|ECG|EKG)`,
			`(?i)\n\n+(КТ|Компьютерная томография|CT)`,
			`(?i)\n\n+(МРТ|Магнитно-резонансная томография|MRI)`,
			`(?i)\n\n+(УЗИ|Ультразвуковое исследование|Ultrasound)`,
			`(?i)\n\n+(Анализ крови|Общий анализ крови|Blood test)`,
			`(?i)\n\n+(Медицинское исследование|Комплексный анализ)`,
		}
		
		var splitIndices []int
		for _, pattern := range studyTypePatterns {
			re := regexp.MustCompile(pattern)
			matches := re.FindAllStringIndex(content, -1)
			for _, match := range matches {
				splitIndices = append(splitIndices, match[0])
			}
		}
		
		// Сортируем индексы
		sort.Ints(splitIndices)
		
		if len(splitIndices) > 0 {
			var lastIndex int
			for i, idx := range splitIndices {
				start := lastIndex
				end := idx
				if i == len(splitIndices)-1 {
					end = len(content)
				}
				
				studyText := strings.TrimSpace(content[start:end])
				if studyText != "" && len(studyText) > 50 {
					studies = append(studies, studyText)
				}
				lastIndex = idx
			}
			
			// Добавляем последнее исследование
			if lastIndex < len(content) {
				studyText := strings.TrimSpace(content[lastIndex:])
				if studyText != "" && len(studyText) > 50 {
					studies = append(studies, studyText)
				}
			}
		}
	}

	// Если все еще не нашли структурированные исследования, обрабатываем весь текст как одно
	if len(studies) == 0 {
		studies = []string{strings.TrimSpace(content)}
	}

	
	studies = g.removeDuplicateStudies(studies)
	log.Printf("[Интерпретация данных исследований] DOCX: Найдено уникальных исследований=%d", len(studies))
	
	for i, study := range studies {
		if study != "" {
			studyPreview := study
			if len(studyPreview) > 150 {
				studyPreview = studyPreview[:150] + "..."
			}
			log.Printf("[Интерпретация данных исследований] DOCX: Обработка исследования #%d (длина=%d символов, превью=%s)", i+1, len(study), studyPreview)
			g.parseSingleStudy(doc, study)
		}
	}
	
}

// isFindingsText проверяет, выглядит ли текст как находки (описание результатов)
func (g *PDFGenerator) isFindingsText(text string) bool {
	if len(text) == 0 {
		return false
	}
	
	textLower := strings.ToLower(strings.TrimSpace(text))
	
	// Если текст начинается с маленькой буквы (после пробелов) - это находки
	firstRune := []rune(textLower)[0]
	if unicode.IsLower(firstRune) {
		return true
	}
	
	// Медицинские термины, указывающие на находки
	findingsIndicators := []string{
		"выявлен", "обнаружен", "отмечается", "определяется", "наблюдается",
		"выявлены", "обнаружены", "отмечаются", "определяются", "наблюдаются",
		"увеличен", "уменьшен", "расширен", "сужен", "утолщен", "истончен",
		"повышен", "понижен", "снижен", "усилен", "ослаблен",
		"аорта", "желудочек", "предсердие", "клапан", "стенка", "полость",
		"сужение", "расширение", "утолщение", "истончение",
		"неравномерное", "единичные", "множественные",
	}
	
	for _, indicator := range findingsIndicators {
		if strings.Contains(textLower, indicator) {
			return true
		}
	}
	
	return false
}

// extractStudyNameFromLine извлекает название исследования из строки, останавливаясь при обнаружении находок
func (g *PDFGenerator) extractStudyNameFromLine(line string, maxLength int) (name string, remaining string) {
	line = strings.TrimSpace(line)
	if line == "" {
		return "", ""
	}
	
	// Убираем markdown заголовки
	cleanLine := regexp.MustCompile(`^#{1,6}\s+`).ReplaceAllString(line, "")
	cleanLine = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(cleanLine, "$1")
	cleanLine = strings.TrimSpace(cleanLine)
	
	// Паттерны названий исследований (более строгие - останавливаются на скобках, запятых, точках)
	studyNamePatterns := []string{
		`(?i)^(Электрокардиограмма|ЭКГ|EKG|ECG)(?:\s|\(|$|,|\.)`,
		`(?i)^(Компьютерная томография(?:\s+[^,\.\(]{0,80})?)(?:\s*\(|$|,|\.)`,
		`(?i)^(Магнитно-резонансная томография(?:\s+[^,\.\(]{0,80})?)(?:\s*\(|$|,|\.)`,
		`(?i)^(Эхокардиография|ЭхоКГ|EchoCG|Трансторакальная эхокардиография|Допплерэхокардиография)(?:\s|\(|$|,|\.)`,
		`(?i)^(Ультразвуковое исследование(?:\s+[^,\.\(]{0,80})?)(?:\s*\(|$|,|\.)`,
		`(?i)^(Анализ крови|Общий анализ крови|Биохимический анализ крови|Анализ мочи|Общеклинические исследования|Гематологические исследования|Иммунологические исследования|Биохимические исследования)(?:\s|\(|$|,|\.)`,
		`(?i)^(Протокол(?:\s+[^,\.\(]{0,120})?)(?:\s*\(|$|,|\.)`,
		`(?i)^(Рентгенография|Рентген|X-ray|X-Ray)(?:\s|\(|$|,|\.)`,
		`(?i)^(Мультиспиральная компьютерная томография(?:\s+[^,\.\(]{0,80})?)(?:\s*\(|$|,|\.)`,
		`(?i)^(Медицинское исследование)(?:\s|\(|$|,|\.)`,
	}
	
	for _, pattern := range studyNamePatterns {
		re := regexp.MustCompile(pattern)
		match := re.FindStringSubmatch(cleanLine)
		if len(match) > 1 {
			potentialName := strings.TrimSpace(match[1])
			
			// Останавливаемся на скобках с датой или без
			if idx := strings.Index(potentialName, "("); idx > 0 {
				potentialName = strings.TrimSpace(potentialName[:idx])
			}
			
			// Останавливаемся на точке, если после неё идут находки
			if dotIdx := strings.Index(cleanLine, "."); dotIdx > 0 && dotIdx < len(match[0]) {
				afterDot := strings.TrimSpace(cleanLine[dotIdx+1:])
				if g.isFindingsText(afterDot) {
					potentialName = strings.TrimSpace(cleanLine[:dotIdx])
					remaining = afterDot
					
					// Проверяем, содержит ли название ключевые слова исследований
					hasStudyKeywordsInName := false
					studyKeywords := []string{
						"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
						"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
						"гематолог", "биохимическ", "иммунолог", "общеклиническ",
						"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
					}
					potentialNameLower := strings.ToLower(potentialName)
					for _, keyword := range studyKeywords {
						if strings.Contains(potentialNameLower, keyword) {
							hasStudyKeywordsInName = true
							break
						}
					}
					
					// Если название содержит ключевые слова исследований - увеличиваем лимит до 150
					effectiveMaxLength := maxLength
					if hasStudyKeywordsInName {
						effectiveMaxLength = 150
					}
					
					if len(potentialName) > effectiveMaxLength {
						// Пытаемся обрезать по слову
						trimmed := strings.TrimSpace(potentialName[:effectiveMaxLength])
						if lastSpace := strings.LastIndex(trimmed, " "); lastSpace > effectiveMaxLength*2/3 {
							potentialName = trimmed[:lastSpace]
						} else {
							potentialName = trimmed
						}
					}
					return potentialName, remaining
				}
			}
			
			// Проверяем, содержит ли название ключевые слова исследований
			hasStudyKeywords := false
			studyKeywords := []string{
				"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
				"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
				"гематолог", "биохимическ", "иммунолог", "общеклиническ",
				"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
			}
			potentialNameLower := strings.ToLower(potentialName)
			for _, keyword := range studyKeywords {
				if strings.Contains(potentialNameLower, keyword) {
					hasStudyKeywords = true
					break
				}
			}
			
			// Если название содержит ключевые слова исследований - увеличиваем лимит до 150
			effectiveMaxLength := maxLength
			if hasStudyKeywords {
				effectiveMaxLength = 150
			}
			
			// Ограничиваем длину только если превышает эффективный лимит
			if len(potentialName) > effectiveMaxLength {
				// Пытаемся обрезать по слову
				trimmed := strings.TrimSpace(potentialName[:effectiveMaxLength])
				if lastSpace := strings.LastIndex(trimmed, " "); lastSpace > effectiveMaxLength*2/3 {
					potentialName = trimmed[:lastSpace]
				} else {
					potentialName = trimmed
				}
			}
			
			// Остальное после совпадения паттерна
			matchEnd := len(match[0])
			if matchEnd < len(cleanLine) {
				remaining = strings.TrimSpace(cleanLine[matchEnd:])
				// Если остаток выглядит как находки, останавливаемся
				if g.isFindingsText(remaining) {
					return potentialName, remaining
				}
			}
			
			return potentialName, remaining
		}
	}
	
	// Если паттерн не найден, пытаемся извлечь название до первого признака находок
	// Ищем точку, запятую или переход к маленькой букве
	for i, r := range []rune(cleanLine) {
		if i >= maxLength {
			break
		}
		
		// Останавливаемся на точке, если после неё находки
		if r == '.' && i+1 < len([]rune(cleanLine)) {
			afterDot := strings.TrimSpace(string([]rune(cleanLine)[i+1:]))
			if g.isFindingsText(afterDot) {
				name = strings.TrimSpace(string([]rune(cleanLine)[:i]))
				remaining = afterDot
				return name, remaining
			}
		}
		
		// Останавливаемся на запятой, если после неё находки
		if r == ',' && i+1 < len([]rune(cleanLine)) {
			afterComma := strings.TrimSpace(string([]rune(cleanLine)[i+1:]))
			if g.isFindingsText(afterComma) && len(afterComma) > 10 {
				name = strings.TrimSpace(string([]rune(cleanLine)[:i]))
				remaining = afterComma
				return name, remaining
			}
		}
		
		// НЕ обрезаем по маленькой букве - это слишком агрессивно и обрезает правильные заголовки
		// Вместо этого проверяем остаток текста через isFindingsText
	}
	
	// Если ничего не найдено, проверяем, не является ли весь текст находками
	// Если нет - используем весь текст как название (но ограничиваем длину)
	isFindings := g.isFindingsText(cleanLine)
	
	if isFindings && len(cleanLine) > 50 {
		// Это находки, пытаемся найти начало
		// Ищем первое слово (до пробела) как потенциальное название
		firstSpace := strings.Index(cleanLine, " ")
		if firstSpace > 0 && firstSpace < 50 {
			name = cleanLine[:firstSpace]
			remaining = strings.TrimSpace(cleanLine[firstSpace:])
		} else {
			// Если нет пробела или слишком длинное - ограничиваем длину
			if len(cleanLine) > maxLength {
				name = cleanLine[:maxLength]
				remaining = strings.TrimSpace(cleanLine[maxLength:])
			} else {
				name = cleanLine
				remaining = ""
			}
		}
	} else {
		// Не находки - используем весь текст как название (но ограничиваем длину)
		if len(cleanLine) > maxLength {
			name = cleanLine[:maxLength]
			remaining = strings.TrimSpace(cleanLine[maxLength:])
		} else {
			name = cleanLine
			remaining = ""
		}
	}
	
	return name, remaining
}

// parseSingleStudy парсит одно исследование в формате:
// Название исследования
// Ключевые находки: ...
// Заключение: ...
func (g *PDFGenerator) parseSingleStudy(doc *document.Document, studyText string) {
	lines := strings.Split(studyText, "\n")
	var studyName string
	var findings string
	var conclusion string
	var currentSection string
	var studyNameLines []string // Для накопления строк названия

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			// Если накопили строки названия и встретили пустую строку - это конец названия
			if len(studyNameLines) > 0 && studyName == "" && currentSection == "" {
				studyName = strings.Join(studyNameLines, " ")
				studyNameLines = []string{}
			}
			continue
		}

		lineLower := strings.ToLower(line)

		// Определяем секцию
		if strings.HasPrefix(lineLower, "ключевые находки:") || strings.HasPrefix(lineLower, "key findings:") {
			// Если накопили строки названия - сохраняем их
			if len(studyNameLines) > 0 && studyName == "" {
				studyName = strings.Join(studyNameLines, " ")
				studyNameLines = []string{}
			}
			currentSection = "findings"
			if idx := strings.Index(line, ":"); idx >= 0 {
				findings = strings.TrimSpace(line[idx+1:])
			}
			continue
		}

		if strings.HasPrefix(lineLower, "заключение:") || strings.HasPrefix(lineLower, "conclusion:") {
			// Если накопили строки названия - сохраняем их
			if len(studyNameLines) > 0 && studyName == "" {
				studyName = strings.Join(studyNameLines, " ")
				studyNameLines = []string{}
			}
			currentSection = "conclusion"
			if idx := strings.Index(line, ":"); idx >= 0 {
				conclusion = strings.TrimSpace(line[idx+1:])
			}
			continue
		}

		// Если это не секция и нет названия исследования - это может быть название
		if studyName == "" && currentSection == "" {
			// Проверяем, не является ли это уже правильным заголовком исследования
			// Если строка короткая (до 100 символов) и не содержит признаков находок - это заголовок
			cleanLine := regexp.MustCompile(`^#{1,6}\s+`).ReplaceAllString(line, "")
			cleanLine = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(cleanLine, "$1")
			cleanLine = strings.TrimSpace(cleanLine)
			
			// Проверяем, содержит ли строка ключевые слова исследований
			hasStudyKeywords := false
			studyKeywords := []string{
				"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
				"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
				"гематолог", "биохимическ", "иммунолог", "общеклиническ",
				"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
			}
			cleanLineLower := strings.ToLower(cleanLine)
			for _, keyword := range studyKeywords {
				if strings.Contains(cleanLineLower, keyword) {
					hasStudyKeywords = true
					break
				}
			}
			
			// Если строка содержит ключевые слова исследований и не содержит признаков находок - используем как заголовок
			// Увеличиваем лимит до 150 символов для длинных названий
			if hasStudyKeywords && len(cleanLine) <= 150 && !g.isFindingsText(cleanLine) {
				// Убираем дату в скобках в конце
				studyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(cleanLine, "")
				studyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(studyName, "")
				studyName = strings.TrimSpace(studyName)
				log.Printf("[Интерпретация данных исследований] DOCX: Название извлечено из первой строки (с ключевыми словами): '%s'", studyName)
				continue
			}
			
			// Если строка короткая и не содержит признаков находок - используем как заголовок
			if len(cleanLine) <= 150 && !g.isFindingsText(cleanLine) {
				// Убираем дату в скобках в конце
				studyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(cleanLine, "")
				studyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(studyName, "")
				studyName = strings.TrimSpace(studyName)
				continue
			}
			
			// Если строка длинная или содержит признаки находок - используем extractStudyNameFromLine
			extractedName, remainingText := g.extractStudyNameFromLine(line, 150)
			
			if extractedName != "" && len(extractedName) >= 2 {
				studyName = extractedName
				if remainingText != "" && g.isFindingsText(remainingText) {
					// Остаток - это находки
					if findings != "" {
						findings += " " + remainingText
					} else {
						findings = remainingText
					}
					currentSection = "findings"
				} else if remainingText != "" {
					// Остаток может быть продолжением названия (например, дата в скобках)
					// Проверяем, не выглядит ли он как находки
					// Проверяем, содержит ли название ключевые слова исследований
					hasStudyKeywordsInName := false
					studyKeywords := []string{
						"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
						"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
						"гематолог", "биохимическ", "иммунолог", "общеклиническ",
						"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
					}
					studyNameLower := strings.ToLower(studyName)
					for _, keyword := range studyKeywords {
						if strings.Contains(studyNameLower, keyword) {
							hasStudyKeywordsInName = true
							break
						}
					}
					
					// Если название содержит ключевые слова исследований - увеличиваем лимит до 150
					maxTitleLength := 100
					if hasStudyKeywordsInName {
						maxTitleLength = 150
					}
					
					if !g.isFindingsText(remainingText) && len(studyName)+len(remainingText) <= maxTitleLength {
						studyName += " " + remainingText
					} else {
						// Если выглядит как находки, добавляем в findings
						if findings != "" {
							findings += " " + remainingText
						} else {
							findings = remainingText
						}
						currentSection = "findings"
					}
				}
				continue
			}
			
			// Если не удалось извлечь через паттерны, проверяем длину и содержимое
			// cleanLine уже объявлен выше, используем его
			if cleanLine == "" {
				cleanLine = regexp.MustCompile(`^#{1,6}\s+`).ReplaceAllString(line, "")
				cleanLine = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(cleanLine, "$1")
				cleanLine = strings.TrimSpace(cleanLine)
			}
			
			// Проверяем, содержит ли строка ключевые слова исследований перед тем, как считать её находками
			hasStudyKeywordsInLine := false
			studyKeywordsCheck := []string{
				"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
				"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
				"гематолог", "биохимическ", "иммунолог", "общеклиническ",
				"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
			}
			cleanLineLower = strings.ToLower(cleanLine)
			for _, keyword := range studyKeywordsCheck {
				if strings.Contains(cleanLineLower, keyword) {
					hasStudyKeywordsInLine = true
					break
				}
			}
			
			// Если строка содержит ключевые слова исследований - увеличиваем лимит
			maxLineLengthForTitle := 80
			if hasStudyKeywordsInLine {
				maxLineLengthForTitle = 150
			}
			
			// Если строка слишком длинная (без ключевых слов) или содержит признаки находок - это находки
			if (!hasStudyKeywordsInLine && len(cleanLine) > 80) || (hasStudyKeywordsInLine && len(cleanLine) > 150) || g.isFindingsText(cleanLine) {
				// Это не название, а находки
				if len(studyNameLines) > 0 {
					studyName = strings.Join(studyNameLines, " ")
					studyNameLines = []string{}
				}
				// Если название все еще пустое, пытаемся извлечь короткое название из начала строки
				if studyName == "" {
					// Берем первые символы или до первого признака находок
					nameEnd := maxLineLengthForTitle
					if len(cleanLine) < nameEnd {
						nameEnd = len(cleanLine)
					}
					
					// Ищем точку, запятую или переход к маленькой букве
					for i := 0; i < nameEnd && i < len([]rune(cleanLine)); i++ {
						r := []rune(cleanLine)[i]
						if r == '.' || r == ',' {
							afterPunct := strings.TrimSpace(string([]rune(cleanLine)[i+1:]))
							if g.isFindingsText(afterPunct) {
								nameEnd = i
								break
							}
						}
					}
					
					studyName = strings.TrimSpace(string([]rune(cleanLine)[:nameEnd]))
					findings = strings.TrimSpace(string([]rune(cleanLine)[nameEnd:]))
					if findings == "" {
						findings = cleanLine
					}
				} else {
					// Если название уже есть, остальное идет в findings
					if findings != "" {
						findings += " " + cleanLine
					} else {
						findings = cleanLine
					}
				}
				currentSection = "findings"
				continue
			}
			
			// Добавляем строку к названию (максимум 1 строка для названия)
			// Названия исследований обычно короткие (до 150 символов), но не обрезаем автоматически
			if len(studyNameLines) == 0 {
				potentialName := cleanLine
				// Проверяем, выглядит ли строка как название исследования (короткая, не содержит описательных паттернов)
				potentialNameLower := strings.ToLower(potentialName)
				
				// Ключевые слова исследований
				hasStudyKeywords := false
				studyKeywords := []string{
					"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
					"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
					"гематолог", "биохимическ", "иммунолог", "общеклиническ",
					"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
				}
				for _, keyword := range studyKeywords {
					if strings.Contains(potentialNameLower, keyword) {
						hasStudyKeywords = true
						break
					}
				}
				
				// Описательные паттерны из findings (если есть - вероятно, это findings, а не заголовок)
				hasDescriptivePattern := false
				descriptivePatterns := []string{
					"повышенный", "пониженный", "уровень", "мг/л", "ммоль", "мкмоль",
					"уплотнена", "расширена", "увеличен", "16.3", "203", "17.0",
					"мочевины", "креатинин", "билирубин", "холестерин",
				}
				for _, pattern := range descriptivePatterns {
					if strings.Contains(potentialNameLower, pattern) {
						hasDescriptivePattern = true
						break
					}
				}
				
				// Если строка содержит ключевые слова исследований и не содержит описательных паттернов - это заголовок
				// Если строка длинная (более 150 символов) и содержит описательные паттерны - это findings
				if hasStudyKeywords && !hasDescriptivePattern {
					// Это заголовок исследования - берем всю строку, даже если она длинная
					studyNameLines = append(studyNameLines, cleanLine)
				} else if len(potentialName) > 150 && hasDescriptivePattern {
					// Это findings, не заголовок - пытаемся найти начало заголовка
					// Ищем короткое название в начале строки (до первого описательного паттерна)
					titleEnd := len(potentialName)
					for _, pattern := range descriptivePatterns {
						if idx := strings.Index(potentialNameLower, pattern); idx > 0 && idx < titleEnd {
							titleEnd = idx
						}
					}
					
					if titleEnd < 150 && titleEnd > 0 {
						studyName = strings.TrimSpace(potentialName[:titleEnd])
						findings = strings.TrimSpace(potentialName[titleEnd:])
						currentSection = "findings"
					} else {
						// Не удалось найти заголовок - используем всю строку как findings
						studyName = ""
						findings = cleanLine
						currentSection = "findings"
					}
				} else if len(potentialName) <= 150 && !hasDescriptivePattern {
					// Короткая строка без описательных паттернов - возможно заголовок
					studyNameLines = append(studyNameLines, cleanLine)
				} else {
					// В остальных случаях используем всю строку как заголовок
					studyNameLines = append(studyNameLines, cleanLine)
				}
			} else {
				// Если уже есть строка названия, остальное идет в findings
				studyName = strings.Join(studyNameLines, " ")
				studyNameLines = []string{}
				if findings != "" {
					findings += " " + cleanLine
				} else {
					findings = cleanLine
				}
				currentSection = "findings"
			}
			continue
		}

		// Добавляем к текущей секции
		if currentSection == "findings" {
			if findings != "" {
				findings += " " + line
			} else {
				findings = line
			}
		} else if currentSection == "conclusion" {
			if conclusion != "" {
				conclusion += " " + line
			} else {
				conclusion = line
			}
		}
	}

	// Если накопили строки названия, но не сохранили - сохраняем их
	if len(studyNameLines) > 0 && studyName == "" {
		studyName = strings.Join(studyNameLines, " ")
	}

	// Если не нашли структурированный формат, используем весь текст
	// ВАЖНО: Если нет "Ключевые находки:" и "Заключение:", добавляем весь текст как есть
	if studyName == "" && findings == "" && conclusion == "" {
		// Пытаемся определить название исследования из первой строки
		firstLine := strings.TrimSpace(strings.Split(studyText, "\n")[0])
		
		// Убираем markdown из первой строки
		cleanFirstLine := regexp.MustCompile(`^#{1,6}\s+`).ReplaceAllString(firstLine, "")
		cleanFirstLine = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(cleanFirstLine, "$1")
		cleanFirstLine = strings.TrimSpace(cleanFirstLine)
		
		// Если первая строка короткая (до 150 символов) и не содержит признаков находок - используем как заголовок
		if len(cleanFirstLine) <= 150 && !g.isFindingsText(cleanFirstLine) {
			// Убираем дату в скобках в конце
			studyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(cleanFirstLine, "")
			studyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(studyName, "")
			studyName = strings.TrimSpace(studyName)
			
			lines := strings.Split(studyText, "\n")
			if len(lines) > 1 {
				findings = strings.TrimSpace(strings.Join(lines[1:], "\n"))
			}
		} else {
			// Если строка длинная или содержит признаки находок - используем extractStudyNameFromLine
			extractedName, remainingText := g.extractStudyNameFromLine(firstLine, 150)
			
			if extractedName != "" && len(extractedName) >= 2 {
				studyName = extractedName
				lines := strings.Split(studyText, "\n")
				if len(lines) > 1 {
					// Если есть остаток в первой строке, добавляем его к findings
					if remainingText != "" {
						findings = remainingText + "\n" + strings.TrimSpace(strings.Join(lines[1:], "\n"))
					} else {
						findings = strings.TrimSpace(strings.Join(lines[1:], "\n"))
					}
				} else if remainingText != "" {
					findings = remainingText
				} else {
					findings = strings.TrimSpace(studyText)
				}
			} else {
				// Если не удалось извлечь или извлечено слишком короткое - используем всю первую строку как заголовок
				studyName = cleanFirstLine
				// Убираем дату в скобках в конце
				studyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(studyName, "")
				studyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(studyName, "")
				studyName = strings.TrimSpace(studyName)
				
				lines := strings.Split(studyText, "\n")
				if len(lines) > 1 {
					findings = strings.TrimSpace(strings.Join(lines[1:], "\n"))
				} else {
					findings = ""
				}
			}
		}
	}

	// Проверяем, содержит ли название ключевые слова исследований перед обрезанием
	hasStudyKeywords := false
	studyKeywords := []string{
		"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
		"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
		"гематолог", "биохимическ", "иммунолог", "общеклиническ",
		"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
	}
	studyNameLower := strings.ToLower(studyName)
	for _, keyword := range studyKeywords {
		if strings.Contains(studyNameLower, keyword) {
			hasStudyKeywords = true
			break
		}
	}
	
	// Ограничиваем длину названия только если оно очень длинное (больше 150 символов)
	// И если оно содержит ключевые слова исследований - НЕ обрезаем агрессивно
	if len(studyName) > 150 {
		// Если содержит ключевые слова исследований - обрезаем только если очень длинное (больше 200)
		if hasStudyKeywords && len(studyName) <= 200 {
			// Не обрезаем названия с ключевыми словами до 200 символов
		} else {
			// Обрезаем только если очень длинное или не содержит ключевых слов
			if hasStudyKeywords {
				// Обрезаем по слову только если очень длинное
				trimmed := strings.TrimSpace(studyName[:200])
				if lastSpace := strings.LastIndex(trimmed, " "); lastSpace > 150 {
					studyName = trimmed[:lastSpace]
				} else {
					studyName = trimmed
				}
			} else {
				// Для названий без ключевых слов обрезаем до 150
				trimmed := strings.TrimSpace(studyName[:150])
				if lastSpace := strings.LastIndex(trimmed, " "); lastSpace > 100 {
					studyName = trimmed[:lastSpace]
				} else {
					studyName = trimmed
				}
			}
		}
	}

	// Убираем дату из названия, если она уже есть в скобках
	studyNameBeforeDate := studyName
	studyName = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(studyName, "")
	studyName = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(studyName, "")
	studyName = strings.TrimSpace(studyName)
	if studyName != studyNameBeforeDate {
	}

	// Логируем результат парсинга перед добавлением в DOCX
	findingsPreview := findings
	if len(findingsPreview) > 100 {
		findingsPreview = findingsPreview[:100] + "..."
	}
	conclusionPreview := conclusion
	if len(conclusionPreview) > 100 {
		conclusionPreview = conclusionPreview[:100] + "..."
	}
	log.Printf("[Интерпретация данных исследований] DOCX: Парсинг завершен -> title='%s' (длина=%d) | findings_len=%d (превью='%s') | conclusion_len=%d (превью='%s')", 
		studyName, len(studyName), len(findings), findingsPreview, len(conclusion), conclusionPreview)

	// Добавляем в документ
	if studyName != "" {
		para := doc.AddParagraph()
		run := para.AddRun()
		run.AddText(studyName)
		run.Properties().SetBold(true)
		run.Properties().SetSize(12 * measurement.Point)
		g.setArialFont11(run)
	}

	para := doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcBoth)
	run := para.AddRun()
	if findings != "" {
		findings = regexp.MustCompile(`\s+`).ReplaceAllString(findings, " ")
		findings = strings.TrimSpace(findings)
		run.AddText("Ключевые находки: " + findings)
	} else {
		run.AddText("Ключевые находки: не выявлено")
	}
	g.setArialFont11(run)

	para = doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcBoth)
	run = para.AddRun()
	if conclusion != "" {
		conclusion = regexp.MustCompile(`\s+`).ReplaceAllString(conclusion, " ")
		conclusion = strings.TrimSpace(conclusion)
		run.AddText("Заключение: " + conclusion)
	} else {
		run.AddText("Заключение: требуется дополнительное обследование")
	}
	g.setArialFont11(run)

	doc.AddParagraph()
	log.Printf("[Интерпретация данных исследований] DOCX: Исследование добавлено в документ -> title='%s'", studyName)
}

// min возвращает минимальное из двух чисел
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// removeDuplicateStudies удаляет дубликаты исследований, сравнивая названия
func (g *PDFGenerator) removeDuplicateStudies(studies []string) []string {
	if len(studies) <= 1 {
		return studies
	}
	
	
	var uniqueStudies []string
	seenTitles := make(map[string]bool)
	
	for i, study := range studies {
		// Извлекаем первую строку как название
		lines := strings.Split(study, "\n")
		title := ""
		if len(lines) > 0 {
			title = strings.TrimSpace(lines[0])
		}
		
		// Нормализуем заголовок для сравнения
		titleNormalized := strings.ToLower(strings.TrimSpace(title))
		
		// Убираем даты из заголовка для сравнения
		titleNormalized = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(titleNormalized, "")
		titleNormalized = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(titleNormalized, "")
		titleNormalized = strings.TrimSpace(titleNormalized)
		
		if titleNormalized == "" {
			titleNormalized = fmt.Sprintf("study_%d", i)
		}
		
		if !seenTitles[titleNormalized] {
			seenTitles[titleNormalized] = true
			uniqueStudies = append(uniqueStudies, study)
		} else {
		}
	}
	
	return uniqueStudies
}

// parseAndAddMarkdownContent парсит markdown и добавляет в документ с правильным форматированием
func (g *PDFGenerator) parseAndAddMarkdownContent(doc *document.Document, content string) {
	lines := strings.Split(content, "\n")
	var currentListItems []string
	inTable := false
	var tableRows [][]string
	var tableHeaders []string

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Пропускаем пустые строки (кроме случаев, когда они нужны для разделения)
		if line == "" {
			// Если есть накопленные элементы списка, выводим их
			if len(currentListItems) > 0 {
				g.addListItems(doc, currentListItems)
				currentListItems = []string{}
			}
			// Если была таблица, выводим её
			if inTable && len(tableRows) > 0 {
				g.addTable(doc, tableHeaders, tableRows)
				tableRows = [][]string{}
				tableHeaders = []string{}
				inTable = false
			}
			continue
		}

		// Проверяем заголовки markdown (##, ###, ####)
		if strings.HasPrefix(line, "##") {
			// Если есть накопленные элементы списка, выводим их
			if len(currentListItems) > 0 {
				g.addListItems(doc, currentListItems)
				currentListItems = []string{}
			}
			// Если была таблица, выводим её
			if inTable && len(tableRows) > 0 {
				g.addTable(doc, tableHeaders, tableRows)
				tableRows = [][]string{}
				tableHeaders = []string{}
				inTable = false
			}

			// Определяем уровень заголовка
			level := 0
			for _, char := range line {
				if char == '#' {
					level++
				} else {
					break
				}
			}

			// Убираем # и пробелы
			headerText := strings.TrimSpace(line[level:])
			if headerText != "" {
				para := doc.AddParagraph()
				run := para.AddRun()
				run.AddText(headerText)
				run.Properties().SetBold(true)
				// Устанавливаем шрифт Arial для заголовков
				props := run.Properties().X()
				if props.RFonts == nil {
					props.RFonts = wml.NewCT_Fonts()
				}
				asciiVal := "Arial"
				props.RFonts.AsciiAttr = &asciiVal
				hAnsiVal := "Arial"
				props.RFonts.HAnsiAttr = &hAnsiVal
				if level == 1 {
					run.Properties().SetSize(12 * measurement.Point)
				} else {
					run.Properties().SetSize(11.5 * measurement.Point)
				}
			}
			continue
		}

		// Проверяем таблицы markdown (| ... |)
		if strings.Contains(line, "|") {
			// Если это первая строка таблицы или разделитель
			if !inTable {
				inTable = true
				// Парсим заголовки
				parts := strings.Split(line, "|")
				tableHeaders = []string{}
				for _, part := range parts {
					part = strings.TrimSpace(part)
					if part != "" && !strings.Contains(part, "---") {
						tableHeaders = append(tableHeaders, part)
					}
				}
			} else {
				// Парсим строку таблицы
				parts := strings.Split(line, "|")
				row := []string{}
				for _, part := range parts {
					part = strings.TrimSpace(part)
					if part != "" && !strings.Contains(part, "---") {
						row = append(row, part)
					}
				}
				if len(row) > 0 {
					tableRows = append(tableRows, row)
				}
			}
			continue
		}

		// Проверяем списки (начинаются с -, *, • или цифры)
		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") || strings.HasPrefix(line, "• ") {
			// Если была таблица, выводим её
			if inTable && len(tableRows) > 0 {
				g.addTable(doc, tableHeaders, tableRows)
				tableRows = [][]string{}
				tableHeaders = []string{}
				inTable = false
			}

			itemText := strings.TrimPrefix(line, "- ")
			itemText = strings.TrimPrefix(itemText, "* ")
			itemText = strings.TrimPrefix(itemText, "• ")
			itemText = strings.TrimSpace(itemText)
			if itemText != "" {
				currentListItems = append(currentListItems, itemText)
			}
			continue
		}

		// Проверяем нумерованные списки
		if matched, _ := regexp.MatchString(`^\d+\.\s+`, line); matched {
			// Если была таблица, выводим её
			if inTable && len(tableRows) > 0 {
				g.addTable(doc, tableHeaders, tableRows)
				tableRows = [][]string{}
				tableHeaders = []string{}
				inTable = false
			}

			itemText := regexp.MustCompile(`^\d+\.\s+`).ReplaceAllString(line, "")
			itemText = strings.TrimSpace(itemText)
			if itemText != "" {
				currentListItems = append(currentListItems, itemText)
			}
			continue
		}

		// Если была таблица, но текущая строка не таблица - выводим таблицу
		if inTable && len(tableRows) > 0 {
			g.addTable(doc, tableHeaders, tableRows)
			tableRows = [][]string{}
			tableHeaders = []string{}
			inTable = false
		}

		// Если есть накопленные элементы списка, выводим их
		if len(currentListItems) > 0 {
			g.addListItems(doc, currentListItems)
			currentListItems = []string{}
		}

		// Обычный текст
		// Убираем разделители markdown (---)
		if strings.HasPrefix(line, "---") {
			continue
		}

		para := doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run := para.AddRun()
		run.AddText(line)
		g.setArialFont11(run)
	}

	// Выводим оставшиеся элементы
	if len(currentListItems) > 0 {
		g.addListItems(doc, currentListItems)
	}
	if inTable && len(tableRows) > 0 {
		g.addTable(doc, tableHeaders, tableRows)
	}
}

// addListItems добавляет элементы списка в документ
func (g *PDFGenerator) addListItems(doc *document.Document, items []string) {
	for _, item := range items {
		para := doc.AddParagraph()
		para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
		run := para.AddRun()
		run.AddText("  • " + item)
		g.setArialFont11(run)
	}
}

// addTable добавляет таблицу в документ
func (g *PDFGenerator) addTable(doc *document.Document, headers []string, rows [][]string) {
	if len(headers) == 0 {
		return
	}

	// Создаем таблицу
	table := doc.AddTable()

	// Добавляем заголовки
	headerRow := table.AddRow()
	for _, header := range headers {
		cell := headerRow.AddCell()
		run := cell.AddParagraph().AddRun()
		run.AddText(header)
		run.Properties().SetBold(true)
		run.Properties().SetSize(10.5 * measurement.Point)
		// Устанавливаем шрифт Arial для заголовков таблицы
		props := run.Properties().X()
		if props.RFonts == nil {
			props.RFonts = wml.NewCT_Fonts()
		}
		asciiVal := "Arial"
		props.RFonts.AsciiAttr = &asciiVal
		hAnsiVal := "Arial"
		props.RFonts.HAnsiAttr = &hAnsiVal
	}

	// Добавляем строки
	for _, row := range rows {
		tableRow := table.AddRow()
		for _, cellText := range row {
			cell := tableRow.AddCell()
			run := cell.AddParagraph().AddRun()
			run.AddText(cellText)
			run.Properties().SetSize(10.5 * measurement.Point)
			// Устанавливаем шрифт Arial для ячеек таблицы
			props := run.Properties().X()
			if props.RFonts == nil {
				props.RFonts = wml.NewCT_Fonts()
			}
			asciiVal := "Arial"
			props.RFonts.AsciiAttr = &asciiVal
			hAnsiVal := "Arial"
			props.RFonts.HAnsiAttr = &hAnsiVal
		}
	}

	// Добавляем пустую строку после таблицы
	doc.AddParagraph()
}

// addFooter добавляет футер с датой создания
func (g *PDFGenerator) addFooter(doc *document.Document, generatedAt string) {
	doc.AddParagraph() // Пустая строка

	para := doc.AddParagraph()
	para.Properties().SetAlignment(wml.ST_JcBoth) // Выравнивание по ширине
	run := para.AddRun()
	run.AddText(fmt.Sprintf("Дата создания документа: %s", generatedAt))
	run.Properties().SetBold(true)
	run.Properties().SetSize(9 * measurement.Point)
	// Устанавливаем шрифт Arial для футера
	props := run.Properties().X()
	if props.RFonts == nil {
		props.RFonts = wml.NewCT_Fonts()
	}
	asciiVal := "Arial"
	props.RFonts.AsciiAttr = &asciiVal
	hAnsiVal := "Arial"
	props.RFonts.HAnsiAttr = &hAnsiVal
}

// htmlToText конвертирует HTML в простой текст
func (g *PDFGenerator) htmlToText(htmlContent string) string {
	if htmlContent == "" {
		return ""
	}

	// Сначала сохраняем разделения между элементами списка
	// Заменяем закрывающие теги списков на переносы строк
	text := strings.ReplaceAll(htmlContent, "</li>", "\n")
	text = strings.ReplaceAll(text, "</ul>", "\n")
	text = strings.ReplaceAll(text, "</ol>", "\n")
	text = strings.ReplaceAll(text, "</p>", "\n")
	text = strings.ReplaceAll(text, "<br>", "\n")
	text = strings.ReplaceAll(text, "<br/>", "\n")
	text = strings.ReplaceAll(text, "<br />", "\n")

	// Удаляем HTML теги
	text = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(text, "")

	// Заменяем HTML entities
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&quot;", "\"")
	text = strings.ReplaceAll(text, "&#39;", "'")
	text = strings.ReplaceAll(text, "&apos;", "'")

	// Нормализуем множественные переносы строк до одного
	text = regexp.MustCompile(`\n\s*\n+`).ReplaceAllString(text, "\n")

	// Нормализуем пробелы в строках (но сохраняем переносы строк)
	lines := strings.Split(text, "\n")
	var normalizedLines []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		line = regexp.MustCompile(`\s+`).ReplaceAllString(line, " ")
		if line != "" {
			normalizedLines = append(normalizedLines, line)
		}
	}

	text = strings.Join(normalizedLines, "\n")
	return strings.TrimSpace(text)
}

// isEmptyString проверяет, является ли строка пустой
func isEmptyString(s string) bool {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return true
	}
	trimmedLower := strings.ToLower(trimmed)
	emptyValues := []string{"—", "-", "<p></p>", "<p>—</p>", "отсутствует", "отсутствуют", "нет данных", "информация отсутствует"}
	for _, v := range emptyValues {
		if trimmedLower == strings.ToLower(v) {
			return true
		}
	}
	return false
}

func (g *PDFGenerator) generateHealthPassportHTML(data *HealthPassportData) (string, error) {
	templatePath := filepath.Join(g.templatesPath, "health_passport.html")

	tmpl, err := template.New("health_passport.html").
		Option("missingkey=zero").
		Funcs(template.FuncMap{
			"dateOnly": dateOnly,
			"trim":     strings.TrimSpace,
			"trimHTML": func(htmlContent template.HTML) string {
				// Удаляем HTML-теги для проверки содержимого
				contentStr := string(htmlContent)
				contentOnly := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(contentStr, "")
				return strings.TrimSpace(contentOnly)
			},
			"isEmptyHTML": func(htmlContent template.HTML) bool {
				// Удаляем HTML-теги для проверки содержимого
				contentStr := string(htmlContent)
				if contentStr == "" {
					return true
				}
				contentOnly := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(contentStr, "")
				trimmed := strings.TrimSpace(contentOnly)
				if trimmed == "" {
					return true
				}
				trimmedLower := strings.ToLower(trimmed)
				// Проверяем на пустые значения, но НЕ на сообщения об ошибках, которые должны отображаться
				// Сообщения типа "Файлы для анализа не найдены" должны отображаться
				emptyValues := []string{"—", "-", "<p></p>", "<p>—</p>"}
				for _, v := range emptyValues {
					if trimmedLower == strings.ToLower(v) {
						return true
					}
				}
				// Не считаем пустым, если есть текст (даже если это сообщение об ошибке)
				// Сообщения об ошибках должны отображаться пользователю
				return false
			},
			"isEmpty": func(s string) bool {
				trimmed := strings.TrimSpace(s)
				return trimmed == "" || trimmed == "—" || trimmed == "<p></p>" || trimmed == "<p>—</p>"
			},
		}).
		ParseFiles(templatePath)

	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	// Sanitize sections: hide if explicitly marked as no info or empty
	isEmptySection := func(s string) bool {
		if s == "" {
			return true
		}
		trimmed := strings.TrimSpace(strings.ToLower(s))
		if trimmed == "" {
			return true
		}
		// Проверяем на пустые HTML-теги
		if trimmed == "<p></p>" || trimmed == "<p>—</p>" || trimmed == "<p>-</p>" {
			return true
		}
		// Удаляем HTML-теги для проверки содержимого
		contentOnly := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(trimmed, "")
		contentOnly = strings.TrimSpace(contentOnly)
		if contentOnly == "" || contentOnly == "—" || contentOnly == "-" {
			return true
		}
		noInfos := []string{
			"информация отсутствует",
			"информация отсутствует.",
			"(информация отсутствует)",
			"(информация отсутствует.)",
			"данных нет",
			"данных нет.",
			"нет данных",
			"нет данных.",
			"отсутствует",
			"отсутствует.",
			"no information",
			"no information.",
			"information is not available",
			"information is not available.",
			"no data",
			"no data.",
			"absent",
			"ақпарат жоқ",
			"деректер жоқ",
		}
		for _, v := range noInfos {
			if strings.Contains(trimmed, v) {
				return true
			}
		}
		return false
	}

	// Очищаем разделы от пустых значений
	complaints := data.Complaints
	if isEmptySection(complaints) {
		complaints = ""
	}

	medicalHistory := data.MedicalHistory
	if isEmptySection(medicalHistory) {
		medicalHistory = ""
	}

	lifestyle := data.Lifestyle
	if isEmptySection(lifestyle) {
		lifestyle = ""
	}

	currentState := data.CurrentState
	if isEmptySection(currentState) {
		currentState = ""
	}

	objectiveStatus := data.ObjectiveStatus
	if isEmptySection(objectiveStatus) {
		objectiveStatus = ""
	}

	generalConclusion := data.GeneralConclusion
	if isEmptySection(generalConclusion) {
		generalConclusion = ""
	}

	diagnosisMain := data.DiagnosisMain
	if isEmptySection(diagnosisMain) {
		diagnosisMain = ""
	}

	planExam := data.PlanExam
	if isEmptySection(planExam) {
		planExam = ""
	}

	planTreatment := data.PlanTreatment
	if isEmptySection(planTreatment) {
		planTreatment = ""
	}

	planGeneral := data.PlanGeneral
	if isEmptySection(planGeneral) {
		planGeneral = ""
	}

	// Для FilesAnalysis всегда устанавливаем значение - даже если пустое, раздел должен отображаться
	// Если filesAnalysis действительно пустое, шаблон покажет сообщение по умолчанию
	filesAnalysis := data.FilesAnalysis
	if filesAnalysis == "" {
		// Если файлыAnalysis пустое, устанавливаем сообщение по умолчанию
		filesAnalysis = "Файлы для анализа не найдены."
	}

	htmlData := &HealthPassportHTMLData{
		Patient:                data.Patient,
		Doctor:                 data.Doctor,
		GeneratedAt:            data.GeneratedAt,
		Answers:                data.Answers,
		Complaints:             g.markdownToHTML(complaints),
		MedicalHistory:         g.markdownToHTML(medicalHistory),
		MedicalHistoryDynamics: template.HTML(""), // Пустое поле, если не используется
		TreatmentEffect:        template.HTML(""), // Пустое поле, если не используется
		Lifestyle:              g.markdownToHTML(lifestyle),
		FilesAnalysis:          g.markdownToHTML(filesAnalysis),
		GeneralConclusion:      g.markdownToHTML(generalConclusion),
		CurrentState:           g.markdownToHTML(currentState),
		ObjectiveStatus:        g.markdownToHTML(objectiveStatus),
		DiagnosisMain:          diagnosisMain,
		DiagnosisComorbid:      data.DiagnosisComorbid,
		PlanExam:               g.markdownToHTML(planExam),
		PlanTreatment:          g.markdownToHTML(planTreatment),
		PlanGeneral:            g.markdownToHTML(planGeneral),
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, htmlData); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

func (g *PDFGenerator) addHealthPassportCover(contentPdfPath, timestamp string) (string, error) {
	coverPath := filepath.Join(g.templatesPath, "..", "covers", "health_passport_cover.pdf")

	if _, err := os.Stat(coverPath); err != nil {
		return "", fmt.Errorf("cover file not found: %w", err)
	}

	finalPdfName := fmt.Sprintf("ПаспортЗдоровья_With_Cover_%s.pdf", timestamp)
	finalPdfPath := filepath.Join(g.outputPath, finalPdfName)


	if err := g.mergeWithPdftk(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	if err := g.mergeWithQpdf(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	if err := g.mergeWithPdfunite(coverPath, contentPdfPath, finalPdfPath); err == nil {
		return finalPdfPath, nil
	}

	return "", fmt.Errorf("no PDF merging tools available (tried pdftk, qpdf, pdfunite)")
}
