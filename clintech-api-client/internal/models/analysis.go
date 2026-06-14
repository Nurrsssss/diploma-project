package models

import "time"

type AnalysisRecord struct {
	ID                          string            `json:"id" db:"id"`
	UserID                      string            `json:"user_id" db:"user_id"`
	Answers                     map[string]string `json:"answers" db:"answers"`
	Recommendations             string            `json:"recommendations" db:"recommendations"`
	PreliminaryConclusion       string            `json:"preliminary_conclusion" db:"preliminary_conclusion"`
	PreliminaryConclusionFileID string            `json:"preliminary_conclusion_file_id" db:"preliminary_conclusion_file_id"`
	Files                       []string          `json:"files" db:"files"`
	CreatedAt                   time.Time         `json:"created_at" db:"created_at"`
}
