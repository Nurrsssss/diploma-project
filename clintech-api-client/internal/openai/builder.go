package openai

import (
	"fmt"
)

func ExecuteTemplate(name string, data any) (string, error) {
	switch name {
	case "medical_prompt":
		if answers, ok := data.(map[string]string); ok {
			return GetMedicalPrompt("ru", answers), nil
		}
	case "extract_answers":
		if dataMap, ok := data.(map[string]string); ok {
			if dialogue, exists := dataMap["dialogue"]; exists {
				return GetExtractAnswersPrompt("ru", dialogue), nil
			}
		}
	case "preliminary_conclusion":
		if interfaceData, ok := data.(map[string]interface{}); ok {
			return GetPreliminaryConclusionPrompt("ru", interfaceData), nil
		}
	}

	return "", fmt.Errorf("template %q not found, use specific prompt functions instead", name)
}
