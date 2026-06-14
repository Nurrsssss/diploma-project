package openai

import (
	"fmt"
)

func LoadTemplates() error {

	return nil
}

func ExecuteLocalizedTemplate(lang, name string, data any) (string, error) {

	switch name {
	case "medical_prompt":
		if answers, ok := data.(map[string]string); ok {
			return GetMedicalPrompt(lang, answers), nil
		}
	case "extract_answers":
		if dataMap, ok := data.(map[string]string); ok {
			if dialogue, exists := dataMap["dialogue"]; exists {
				return GetExtractAnswersPrompt(lang, dialogue), nil
			}
		}
	case "preliminary_conclusion":
		if interfaceData, ok := data.(map[string]interface{}); ok {
			return GetPreliminaryConclusionPrompt(lang, interfaceData), nil
		}
	}

	return "", fmt.Errorf("deprecated template function - use prompt functions instead")
}
