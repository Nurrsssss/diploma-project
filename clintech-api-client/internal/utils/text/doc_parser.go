package text

import (
	"fmt"
	"os"
	"strings"

	"baliance.com/gooxml/document"
	"github.com/unidoc/unipdf/v3/extractor"
	"github.com/unidoc/unipdf/v3/model"
)

func ExtractTextFromPDF(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	pdfReader, err := model.NewPdfReader(f)
	if err != nil {
		return "", err
	}
	numPages, err := pdfReader.GetNumPages()
	if err != nil {
		return "", err
	}
	var sb strings.Builder
	for i := 1; i <= numPages; i++ {
		page, err := pdfReader.GetPage(i)
		if err != nil {
			continue
		}
		ex, err := extractor.New(page)
		if err != nil {
			continue
		}
		text, err := ex.ExtractText()
		if err == nil {
			sb.WriteString(text)
		}
	}
	return sb.String(), nil
}

func ExtractTextFromDOCX(filePath string) (string, error) {
	doc, err := document.Open(filePath)
	if err != nil {
		return "", err
	}
	var sb strings.Builder
	for _, para := range doc.Paragraphs() {
		for _, run := range para.Runs() {
			sb.WriteString(run.Text())
		}
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

func ExtractTextFromTXT(filePath string) (string, error) {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func ExtractTextFromCSV(filePath string) (string, error) {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	content := string(bytes)
	lines := strings.Split(content, "\n")

	var sb strings.Builder
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		if i == 0 {
			sb.WriteString("Header: ")
		} else {
			sb.WriteString(fmt.Sprintf("Row %d: ", i))
		}

		fields := strings.Split(line, ",")
		for j, field := range fields {
			field = strings.TrimSpace(field)

			field = strings.Trim(field, "\"")
			sb.WriteString(field)
			if j < len(fields)-1 {
				sb.WriteString(" | ")
			}
		}
		sb.WriteString("\n")
	}

	return sb.String(), nil
}
