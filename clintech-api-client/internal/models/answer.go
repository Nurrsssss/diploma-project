package models

import "time"

// Храним в БД в "раздельных" полях (универсально под типы вопросов)
type Answer struct {
	ID          int64      `json:"id"           db:"id"`
	PatientID   int64      `json:"patient_id"   db:"patient_id"`
	QuestionID  string     `json:"question_id"  db:"question_id"`
	TextValue   *string    `json:"text_value"   db:"text_value"`
	NumberValue *float64   `json:"number_value" db:"number_value"`
	DateValue   *time.Time `json:"date_value"   db:"date_value"`
	OptionValue *string    `json:"option_value" db:"option_value"`
	CreatedAt   time.Time  `json:"created_at"   db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"   db:"updated_at"`
}

// Пакетный апдейт/апсерт с сырой строкой "value" — сервис сам приведёт тип
type AnswerUpdate struct {
	QuestionID string `json:"question_id" binding:"required"`
	Value      string `json:"value"` // строка с данными; парсим по Question.Type
}

// Для ответа эндпоинта "список вопросов с ответами"
type QuestionWithAnswer struct {
	Question Question `json:"question"`
	Answer   *Answer  `json:"answer,omitempty"`
}
