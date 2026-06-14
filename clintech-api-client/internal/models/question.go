package models

type Question struct {
	ID         int      `json:"id" db:"id"`
	QuestionID string   `json:"question_id" db:"question_id"`
	Text       string   `json:"text" db:"text"`
	Type       string   `json:"type" db:"type"`
	Options    []string `json:"options,omitempty" db:"options"`
	Required   bool     `json:"required" db:"required"`
	Category   string   `json:"category" db:"category"`
}

type Questionnaire struct {
	Questions []Question `json:"questions"`
}
