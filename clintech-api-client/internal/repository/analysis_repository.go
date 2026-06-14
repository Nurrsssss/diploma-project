package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"

	"github.com/beereket/vitalem-api-client/internal/database"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/jackc/pgx/v5"
)

// ErrAnalysisRecordNotFound — нет строки с таким id в analysis_records (sentinel для обработки на сервисе).
var ErrAnalysisRecordNotFound = errors.New("analysis record not found")

func isValidUUIDFormat(uuid string) bool {
	uuidRegex := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	return uuidRegex.MatchString(uuid)
}

func SaveAnalysisRecord(ctx context.Context, record *models.AnalysisRecord) error {
	answersJSON, err := json.Marshal(record.Answers)
	if err != nil {
		return err
	}

	_, err = database.DB.Exec(ctx, `
		INSERT INTO analysis_records (
			id, user_id, answers, recommendations, preliminary_conclusion, preliminary_conclusion_file_id, files, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`,
		record.ID,
		record.UserID,
		answersJSON,
		record.Recommendations,
		record.PreliminaryConclusion,
		record.PreliminaryConclusionFileID,
		record.Files,
	)

	return err
}

func GetRecordsByUser(ctx context.Context, userID string) ([]models.AnalysisRecord, error) {
	rows, err := database.DB.Query(ctx, `
		SELECT id, user_id, answers, recommendations, preliminary_conclusion, preliminary_conclusion_file_id, files, created_at
		FROM analysis_records
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []models.AnalysisRecord{}
	for rows.Next() {
		record := models.AnalysisRecord{}
		var answersJSON []byte

		err := rows.Scan(
			&record.ID,
			&record.UserID,
			&answersJSON,
			&record.Recommendations,
			&record.PreliminaryConclusion,
			&record.PreliminaryConclusionFileID,
			&record.Files,
			&record.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(answersJSON, &record.Answers)
		if err != nil {
			return nil, err
		}

		records = append(records, record)
	}

	return records, nil
}

func UpdatePreliminaryConclusion(ctx context.Context, recordID, conclusionText string) error {
	_, err := database.DB.Exec(ctx, `
		UPDATE analysis_records
		SET preliminary_conclusion = $2
		WHERE id = $1
	`, recordID, conclusionText)
	return err
}

func UpdatePreliminaryConclusionFileID(ctx context.Context, recordID, fileID string) error {
	_, err := database.DB.Exec(ctx, `
		UPDATE analysis_records
		SET preliminary_conclusion_file_id = $2
		WHERE id = $1
	`, recordID, fileID)
	return err
}

func GetAnalysisRecordByID(ctx context.Context, recordID string) (*models.AnalysisRecord, error) {
	if recordID == "" || recordID == "null" || recordID == "undefined" {
		return nil, fmt.Errorf("invalid analysis_id: received '%s' - must be a valid UUID", recordID)
	}

	if len(recordID) != 36 || !isValidUUIDFormat(recordID) {
		return nil, fmt.Errorf("invalid UUID format for analysis_id: '%s' - expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", recordID)
	}

	row := database.DB.QueryRow(ctx, `
		SELECT id, user_id, answers, recommendations, preliminary_conclusion, preliminary_conclusion_file_id, files, created_at
		FROM analysis_records
		WHERE id = $1
	`, recordID)

	record := &models.AnalysisRecord{}
	var answersJSON []byte

	err := row.Scan(
		&record.ID,
		&record.UserID,
		&answersJSON,
		&record.Recommendations,
		&record.PreliminaryConclusion,
		&record.PreliminaryConclusionFileID,
		&record.Files,
		&record.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || err.Error() == "no rows in result set" {
			return nil, ErrAnalysisRecordNotFound
		}
		return nil, err
	}

	err = json.Unmarshal(answersJSON, &record.Answers)
	if err != nil {
		return nil, err
	}

	return record, nil
}


func UpdateAnalysisAnswers(ctx context.Context, analysisID string, answers map[string]string) error {
    answersJSON, err := json.Marshal(answers)
    if err != nil {
        return err
    }

    _, err = database.DB.Exec(ctx, `
        UPDATE analysis_records
        SET answers = $2
        WHERE id = $1
    `, analysisID, answersJSON)
    return err
}
