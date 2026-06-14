package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/beereket/vitalem-api-client/internal/database"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthPassportRepository struct {
	db *pgxpool.Pool
}

func NewHealthPassportRepository() *HealthPassportRepository {
	return &HealthPassportRepository{
		db: database.DB,
	}
}

func (r *HealthPassportRepository) CreateHealthPassport(ctx context.Context, passport *models.HealthPassport) error {
	query := `
		INSERT INTO health_passports (id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, content, file_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	passport.ID = uuid.New().String()
	passport.CreatedAt = time.Now()
	passport.UpdatedAt = time.Now()

	var fileID interface{}
	if passport.FileID == nil || *passport.FileID == "" {
		fileID = nil
	} else {
		fileID = *passport.FileID
	}

	var transcriptionText interface{}
	if passport.TranscriptionText == nil || *passport.TranscriptionText == "" {
		transcriptionText = nil
	} else {
		transcriptionText = *passport.TranscriptionText
	}

	var contentJSON interface{}
	if passport.Content != nil {
		contentBytes, err := json.Marshal(passport.Content)
		if err != nil {
			return fmt.Errorf("failed to marshal content: %w", err)
		}
		contentJSON = string(contentBytes)
	}

	// Обрабатываем пустой analysis_id - сохраняем как NULL для паспортов без анкеты
	var analysisID interface{}
	if passport.AnalysisID == "" {
		analysisID = nil
	} else {
		analysisID = passport.AnalysisID
	}

	_, err := r.db.Exec(ctx, query,
		passport.ID,
		passport.PatientID,
		passport.DoctorID,
		passport.AppointmentID,
		analysisID,
		transcriptionText,
		contentJSON,
		fileID,
		passport.CreatedAt,
		passport.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create health passport: %w", err)
	}

	return nil
}

func (r *HealthPassportRepository) GetHealthPassportByID(ctx context.Context, id string) (*models.HealthPassport, error) {
	query := `
		SELECT id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, content, file_id, created_at, updated_at
		FROM health_passports
		WHERE id = $1
	`

	var passport models.HealthPassport
	var transcriptionText, contentJSON, fileID interface{}
	var analysisIDNullable interface{} // Для обработки NULL из базы данных

	err := r.db.QueryRow(ctx, query, id).Scan(
		&passport.ID,
		&passport.PatientID,
		&passport.DoctorID,
		&passport.AppointmentID,
		&analysisIDNullable,
		&transcriptionText,
		&contentJSON,
		&fileID,
		&passport.CreatedAt,
		&passport.UpdatedAt,
	)

	// Обрабатываем NULL analysis_id
	if analysisIDNullable == nil {
		passport.AnalysisID = ""
	} else {
		passport.AnalysisID = analysisIDNullable.(string)
	}

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("health passport not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}

	if transcriptionText != nil {
		text := transcriptionText.(string)
		passport.TranscriptionText = &text
	}
	if contentJSON != nil {
		var content models.HealthPassportData
		switch v := contentJSON.(type) {
		case string:
			if err := json.Unmarshal([]byte(v), &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from string: %w", err)
			}
		case []byte:
			if err := json.Unmarshal(v, &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from bytes: %w", err)
			}
		case map[string]interface{}:

			contentBytes, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal content map: %w", err)
			}
			if err := json.Unmarshal(contentBytes, &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from map: %w", err)
			}
		default:
			return nil, fmt.Errorf("unexpected content type: %T", v)
		}
		passport.Content = &content
	}
	if fileID != nil {
		fid := fileID.(string)
		passport.FileID = &fid
	}

	return &passport, nil
}

func (r *HealthPassportRepository) GetHealthPassportsByPatientID(ctx context.Context, patientID string) ([]*models.HealthPassport, error) {
	query := `
		SELECT id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, content, file_id, created_at, updated_at
		FROM health_passports
		WHERE patient_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, patientID)
	if err != nil {
		return nil, fmt.Errorf("failed to query health passports: %w", err)
	}
	defer rows.Close()

	var passports []*models.HealthPassport
	for rows.Next() {
		var passport models.HealthPassport
		var transcriptionText, contentJSON, fileID interface{}
		var analysisIDNullable interface{} // Для обработки NULL из базы данных

		err := rows.Scan(
			&passport.ID,
			&passport.PatientID,
			&passport.DoctorID,
			&passport.AppointmentID,
			&analysisIDNullable,
			&transcriptionText,
			&contentJSON,
			&fileID,
			&passport.CreatedAt,
			&passport.UpdatedAt,
		)

		// Обрабатываем NULL analysis_id
		if analysisIDNullable == nil {
			passport.AnalysisID = ""
		} else {
			passport.AnalysisID = analysisIDNullable.(string)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to scan health passport: %w", err)
		}

		if transcriptionText != nil {
			text := transcriptionText.(string)
			passport.TranscriptionText = &text
		}
		if contentJSON != nil {
			var content models.HealthPassportData

			switch v := contentJSON.(type) {
			case string:
				if err := json.Unmarshal([]byte(v), &content); err != nil {

					continue
				}
			case []byte:
				if err := json.Unmarshal(v, &content); err != nil {

					continue
				}
			case map[string]interface{}:

				contentBytes, err := json.Marshal(v)
				if err != nil {

					continue
				}
				if err := json.Unmarshal(contentBytes, &content); err != nil {

					continue
				}
			default:

				continue
			}
			passport.Content = &content
		}
		if fileID != nil {
			fid := fileID.(string)
			passport.FileID = &fid
		}

		passports = append(passports, &passport)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over health passports: %w", err)
	}

	return passports, nil
}

func (r *HealthPassportRepository) GetHealthPassportsByDoctorID(ctx context.Context, doctorID string) ([]*models.HealthPassport, error) {
	query := `
		SELECT id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, file_id, created_at, updated_at
		FROM health_passports
		WHERE doctor_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, doctorID)
	if err != nil {
		return nil, fmt.Errorf("failed to query health passports: %w", err)
	}
	defer rows.Close()

	var passports []*models.HealthPassport
	for rows.Next() {
		var passport models.HealthPassport
		var transcriptionText, fileID interface{}

		err := rows.Scan(
			&passport.ID,
			&passport.PatientID,
			&passport.DoctorID,
			&passport.AppointmentID,
			&passport.AnalysisID,
			&transcriptionText,
			&fileID,
			&passport.CreatedAt,
			&passport.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan health passport: %w", err)
		}

		if transcriptionText != nil {
			text := transcriptionText.(string)
			passport.TranscriptionText = &text
		}
		if fileID != nil {
			fid := fileID.(string)
			passport.FileID = &fid
		}

		passports = append(passports, &passport)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over health passports: %w", err)
	}

	return passports, nil
}

func (r *HealthPassportRepository) UpdateHealthPassportFileID(ctx context.Context, id, fileID string) error {
	query := `
		UPDATE health_passports
		SET file_id = $1, updated_at = $2
		WHERE id = $3
	`

	result, err := r.db.Exec(ctx, query, fileID, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update health passport file_id: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("health passport not found: %s", id)
	}

	return nil
}

func (r *HealthPassportRepository) DeleteHealthPassport(ctx context.Context, id, doctorID string) error {
	query := `
		DELETE FROM health_passports
		WHERE id = $1 AND doctor_id = $2
	`

	result, err := r.db.Exec(ctx, query, id, doctorID)
	if err != nil {
		return fmt.Errorf("failed to delete health passport: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("health passport not found or access denied: %s", id)
	}

	return nil
}

func (r *HealthPassportRepository) CheckHealthPassportExists(ctx context.Context, appointmentID, analysisID string) (bool, error) {
	// Обрабатываем случай, когда analysis_id пустой (для паспортов без анкеты)
	var query string
	if analysisID == "" {
		query = `
			SELECT EXISTS(
				SELECT 1 FROM health_passports
				WHERE appointment_id = $1 AND analysis_id IS NULL
			)
		`
	} else {
		query = `
			SELECT EXISTS(
				SELECT 1 FROM health_passports
				WHERE appointment_id = $1 AND analysis_id = $2
			)
		`
	}

	var exists bool
	var err error
	if analysisID == "" {
		err = r.db.QueryRow(ctx, query, appointmentID).Scan(&exists)
	} else {
		err = r.db.QueryRow(ctx, query, appointmentID, analysisID).Scan(&exists)
	}
	if err != nil {
		return false, fmt.Errorf("failed to check health passport existence: %w", err)
	}

	return exists, nil
}

func (r *HealthPassportRepository) GetHealthPassportByAppointmentAndAnalysis(ctx context.Context, appointmentID, analysisID string) (*models.HealthPassport, error) {
	// Обрабатываем случай, когда analysis_id пустой (для паспортов без анкеты)
	// Используем COALESCE для сравнения NULL и пустой строки
	var query string
	if analysisID == "" {
		query = `
			SELECT id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, content, file_id, created_at, updated_at
			FROM health_passports
			WHERE appointment_id = $1 AND analysis_id IS NULL
			LIMIT 1
		`
	} else {
		query = `
			SELECT id, patient_id, doctor_id, appointment_id, analysis_id, transcription_text, content, file_id, created_at, updated_at
			FROM health_passports
			WHERE appointment_id = $1 AND analysis_id = $2
			LIMIT 1
		`
	}

	var passport models.HealthPassport
	var transcriptionText, contentJSON, fileID interface{}
	var analysisIDNullable interface{} // Для обработки NULL из базы данных

	var err error
	if analysisID == "" {
		err = r.db.QueryRow(ctx, query, appointmentID).Scan(
			&passport.ID,
			&passport.PatientID,
			&passport.DoctorID,
			&passport.AppointmentID,
			&analysisIDNullable,
			&transcriptionText,
			&contentJSON,
			&fileID,
			&passport.CreatedAt,
			&passport.UpdatedAt,
		)
	} else {
		err = r.db.QueryRow(ctx, query, appointmentID, analysisID).Scan(
			&passport.ID,
			&passport.PatientID,
			&passport.DoctorID,
			&passport.AppointmentID,
			&analysisIDNullable,
			&transcriptionText,
			&contentJSON,
			&fileID,
			&passport.CreatedAt,
			&passport.UpdatedAt,
		)
	}

	// Обрабатываем NULL analysis_id
	if analysisIDNullable == nil {
		passport.AnalysisID = ""
	} else {
		passport.AnalysisID = analysisIDNullable.(string)
	}

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("health passport not found")
		}
		return nil, fmt.Errorf("failed to get health passport: %w", err)
	}

	if transcriptionText != nil {
		text := transcriptionText.(string)
		passport.TranscriptionText = &text
	}
	if contentJSON != nil {
		var content models.HealthPassportData
		switch v := contentJSON.(type) {
		case string:
			if err := json.Unmarshal([]byte(v), &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from string: %w", err)
			}
		case []byte:
			if err := json.Unmarshal(v, &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from bytes: %w", err)
			}
		case map[string]interface{}:
			contentBytes, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal content map: %w", err)
			}
			if err := json.Unmarshal(contentBytes, &content); err != nil {
				return nil, fmt.Errorf("failed to unmarshal content from map: %w", err)
			}
		default:
			return nil, fmt.Errorf("unexpected content type: %T", v)
		}
		passport.Content = &content
	}
	if fileID != nil {
		fid := fileID.(string)
		passport.FileID = &fid
	}

	return &passport, nil
}

func (r *HealthPassportRepository) UpdateHealthPassportContent(ctx context.Context, id string, content *models.HealthPassportData) error {
	query := `
		UPDATE health_passports 
		SET content = $1, updated_at = $2
		WHERE id = $3
	`

	contentBytes, err := json.Marshal(content)
	if err != nil {
		return fmt.Errorf("failed to marshal content: %w", err)
	}

	result, err := r.db.Exec(ctx, query, string(contentBytes), time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update health passport content: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("health passport not found: %s", id)
	}

	return nil
}

func (r *HealthPassportRepository) GetHealthPassportContent(ctx context.Context, id string) (*models.HealthPassportData, error) {
	query := `
		SELECT content
		FROM health_passports
		WHERE id = $1
	`

	var contentJSON interface{}
	err := r.db.QueryRow(ctx, query, id).Scan(&contentJSON)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("health passport not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get health passport content: %w", err)
	}

	if contentJSON == nil {
		return nil, fmt.Errorf("health passport content is empty: %s", id)
	}

	var content models.HealthPassportData

	switch v := contentJSON.(type) {
	case string:
		if err := json.Unmarshal([]byte(v), &content); err != nil {
			return nil, fmt.Errorf("failed to unmarshal content from string: %w", err)
		}
	case []byte:
		if err := json.Unmarshal(v, &content); err != nil {
			return nil, fmt.Errorf("failed to unmarshal content from bytes: %w", err)
		}
	case map[string]interface{}:

		contentBytes, err := json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal content map: %w", err)
		}
		if err := json.Unmarshal(contentBytes, &content); err != nil {
			return nil, fmt.Errorf("failed to unmarshal content from map: %w", err)
		}
	default:
		return nil, fmt.Errorf("unexpected content type: %T", v)
	}

	return &content, nil
}
