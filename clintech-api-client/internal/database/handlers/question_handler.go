package handlers

import (
	"net/http"

	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/repository"

	"github.com/beereket/vitalem-api-client/internal/services"
	"github.com/gin-gonic/gin"
)

type QuestionnaireHandler struct {
	questionnaireService *services.QuestionnaireService
}

func NewQuestionnaireHandler(questionnaireService *services.QuestionnaireService) *QuestionnaireHandler {
	return &QuestionnaireHandler{
		questionnaireService: questionnaireService,
	}
}

func (h *QuestionnaireHandler) GetQuestionnaire(c *gin.Context) {
	questionnaire := h.questionnaireService.GetQuestionnaire()
	c.JSON(http.StatusOK, questionnaire)
}

func (h *QuestionnaireHandler) CreateQuestion(c *gin.Context) {
	var q models.Question
	if err := c.ShouldBindJSON(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := repository.CreateQuestion(c.Request.Context(), q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create question"})
		return
	}
	c.Status(http.StatusCreated)
}

func (h *QuestionnaireHandler) UpdateQuestion(c *gin.Context) {
	questionID := c.Param("id")
	var q models.Question
	if err := c.ShouldBindJSON(&q); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	q.QuestionID = questionID
	if err := repository.UpdateQuestion(c.Request.Context(), q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update question"})
		return
	}
	c.Status(http.StatusOK)
}

func (h *QuestionnaireHandler) DeleteQuestion(c *gin.Context) {
	questionID := c.Param("id")
	if err := repository.DeleteQuestion(c.Request.Context(), questionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete question"})
		return
	}
	c.Status(http.StatusOK)
}
