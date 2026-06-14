package repository

import (
	"context"

	"github.com/beereket/vitalem-api-client/internal/database"
	"github.com/beereket/vitalem-api-client/internal/models"
)

func GetAllQuestions(ctx context.Context) ([]models.Question, error) {
	rows, err := database.DB.Query(ctx, `
		SELECT id, question_id, text, type, options, required, category
		FROM survey_questions ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var q models.Question
		err := rows.Scan(&q.ID, &q.QuestionID, &q.Text, &q.Type, &q.Options, &q.Required, &q.Category)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	return questions, nil
}

func CreateQuestion(ctx context.Context, q models.Question) error {
	_, err := database.DB.Exec(ctx, `
		INSERT INTO survey_questions (question_id, text, type, options, required, category)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, q.QuestionID, q.Text, q.Type, q.Options, q.Required, q.Category)
	return err
}

func UpdateQuestion(ctx context.Context, q models.Question) error {
	_, err := database.DB.Exec(ctx, `
		UPDATE survey_questions
		SET text=$2, type=$3, options=$4, required=$5, category=$6
		WHERE question_id=$1
	`, q.QuestionID, q.Text, q.Type, q.Options, q.Required, q.Category)
	return err
}

func DeleteQuestion(ctx context.Context, questionID string) error {
	_, err := database.DB.Exec(ctx, `DELETE FROM survey_questions WHERE question_id=$1`, questionID)
	return err
}
