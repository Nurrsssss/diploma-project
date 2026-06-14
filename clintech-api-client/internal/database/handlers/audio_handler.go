package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/beereket/vitalem-api-client/internal/openai"

	"github.com/gin-gonic/gin"
)

func TranscribeAudioWithWhisper(c *gin.Context) {
	file, err := c.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file is required"})
		return
	}

	language := c.DefaultPostForm("language", "ru")

	validLanguages := map[string]bool{
		"kz": true,
		"ru": true,
		"en": true,
	}
	if !validLanguages[language] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported language. Supported languages: kz, ru, en"})
		return
	}

	savePath := filepath.Join("/tmp", file.Filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	defer func() {
		os.Remove(savePath)
	}()

	text, err := openai.TranscribeAudioWithWhisperChunked(savePath, language)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transcription failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transcription": text, "language": language})
}

func TranscribeAudioWithGPT4o(c *gin.Context) {
	file, err := c.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file is required"})
		return
	}

	language := c.DefaultPostForm("language", "ru")
	prompt := c.DefaultPostForm("prompt", "Аудиозапись — это прием у врача, диалог между доктором и пациентом. Сохраняй оригинальную формулировку, включая паузы и слова-паразиты. Используй правильную пунктуацию.")

	validLanguages := map[string]bool{
		"kz": true,
		"ru": true,
		"en": true,
	}
	if !validLanguages[language] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported language. Supported languages: kz, ru, en"})
		return
	}

	savePath := filepath.Join("/tmp", file.Filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	defer func() {
		os.Remove(savePath)
	}()

	text, err := openai.TranscribeAudioWithGPT4oChunked(savePath, language, prompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transcription failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transcription": text,
		"language":      language,
		"model":         "gpt-4o-transcribe",
		"prompt":        prompt,
	})
}

func TranscribeAudioWithGPT4oMini(c *gin.Context) {
	file, err := c.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file is required"})
		return
	}

	language := c.DefaultPostForm("language", "ru")
	prompt := c.DefaultPostForm("prompt", "")

	validLanguages := map[string]bool{
		"kz": true,
		"ru": true,
		"en": true,
	}
	if !validLanguages[language] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported language. Supported languages: kz, ru, en"})
		return
	}

	savePath := filepath.Join("/tmp", file.Filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	defer func() {
		os.Remove(savePath)
	}()

	text, err := openai.TranscribeAudioWithGPT4oMiniChunked(savePath, language, prompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transcription failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transcription": text,
		"language":      language,
		"model":         "gpt-4o-mini-transcribe",
		"prompt":        prompt,
	})
}
