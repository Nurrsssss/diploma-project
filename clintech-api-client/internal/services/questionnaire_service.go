package services

import (
	"context"

	"github.com/beereket/vitalem-api-client/internal/config"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/repository"
)

type QuestionnaireService struct {
	config *config.Config
}

func NewQuestionnaireService(cfg *config.Config) *QuestionnaireService {
	return &QuestionnaireService{config: cfg}
}

func (s *QuestionnaireService) GetQuestionnaire() *models.Questionnaire {
	questions, err := repository.GetAllQuestions(context.Background())
	if err != nil {
		return &models.Questionnaire{Questions: []models.Question{}}
	}
	return &models.Questionnaire{Questions: questions}
}
