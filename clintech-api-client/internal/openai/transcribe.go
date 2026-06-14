package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	"github.com/beereket/vitalem-api-client/internal/config"
	"github.com/beereket/vitalem-api-client/internal/utils/audio"
)

type AudioTranscriptionRequest struct {
	File        *os.File
	Model       string
	Language    string
	Prompt      string
	Temperature float32
}

type AudioTranscriptionResponse struct {
	Text string `json:"text"`
}

func (c *Client) TranscribeAudio(ctx context.Context, req AudioTranscriptionRequest) (*AudioTranscriptionResponse, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", req.File.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, req.File); err != nil {
		return nil, fmt.Errorf("failed to copy file content: %w", err)
	}

	if req.Model != "" {
		writer.WriteField("model", req.Model)
	} else {
		writer.WriteField("model", "whisper-1")
	}

	if req.Language != "" {
		writer.WriteField("language", req.Language)
	}

	if req.Prompt != "" {
		writer.WriteField("prompt", req.Prompt)
	}

	if req.Temperature > 0 {
		writer.WriteField("temperature", fmt.Sprintf("%f", req.Temperature))
	}

	writer.WriteField("response_format", "json")

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+audioTranscriptionPath, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	httpReq.Header.Set("User-Agent", "vitalem-api-client/1.0")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errorResp struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		json.Unmarshal(respBody, &errorResp)
		return nil, fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, errorResp.Error.Message)
	}

	var response AudioTranscriptionResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response, nil
}

func (c *Client) TranscribeAudioFile(ctx context.Context, filePath string, language string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	req := AudioTranscriptionRequest{
		File:     file,
		Model:    "whisper-1",
		Language: language,
	}

	resp, err := c.TranscribeAudio(ctx, req)
	if err != nil {
		return "", err
	}

	return resp.Text, nil
}

func TranscribeAudioWithWhisper(filePath, language string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY environment variable is not set")
	}

	cfg := &config.OpenAIConfig{
		APIKey: apiKey,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	req := AudioTranscriptionRequest{
		File:     file,
		Model:    "whisper-1",
		Language: language,
	}

	resp, err := client.TranscribeAudio(context.Background(), req)
	if err != nil {
		return "", fmt.Errorf("failed to transcribe audio: %w", err)
	}

	return resp.Text, nil
}

func TranscribeAudioWithGPT4o(filePath, language, prompt string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY environment variable is not set")
	}

	cfg := &config.OpenAIConfig{
		APIKey: apiKey,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	req := AudioTranscriptionRequest{
		File:     file,
		Model:    "gpt-4o-transcribe",
		Language: language,
		Prompt:   prompt,
	}

	resp, err := client.TranscribeAudio(context.Background(), req)
	if err != nil {
		return "", fmt.Errorf("failed to transcribe audio: %w", err)
	}

	return resp.Text, nil
}

func TranscribeAudioWithGPT4oMini(filePath, language, prompt string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY environment variable is not set")
	}

	cfg := &config.OpenAIConfig{
		APIKey: apiKey,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	req := AudioTranscriptionRequest{
		File:     file,
		Model:    "gpt-4o-mini-transcribe",
		Language: language,
		Prompt:   prompt,
	}

	resp, err := client.TranscribeAudio(context.Background(), req)
	if err != nil {
		return "", fmt.Errorf("failed to transcribe audio: %w", err)
	}

	return resp.Text, nil
}

func getFileSize(filePath string) (int64, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func TranscribeAudioWithWhisperChunked(filePath, language string) (string, error) {

	const maxFileSize = 26214400
	fileSize, err := getFileSize(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to get file size: %w", err)
	}

	if fileSize <= maxFileSize {
		return TranscribeAudioWithWhisper(filePath, language)
	}

	chunkDuration := 600
	outputDir := "/tmp"

	chunks, err := audio.SplitAudioToChunks(filePath, chunkDuration, outputDir)
	if err != nil {
		return "", fmt.Errorf("failed to split audio: %w", err)
	}

	defer func() {
		for _, chunk := range chunks {
			os.Remove(chunk)
		}
	}()

	var transcriptions []string

	for i, chunk := range chunks {
		text, err := TranscribeAudioWithWhisper(chunk, language)
		if err != nil {
			return "", fmt.Errorf("failed to transcribe chunk %d: %w", i+1, err)
		}
		if strings.TrimSpace(text) != "" {
			transcriptions = append(transcriptions, text)
		}
	}

	return strings.Join(transcriptions, " "), nil
}

func TranscribeAudioWithGPT4oChunked(filePath, language, prompt string) (string, error) {

	const maxFileSize = 26214400
	fileSize, err := getFileSize(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to get file size: %w", err)
	}

	if fileSize <= maxFileSize {
		return TranscribeAudioWithGPT4o(filePath, language, prompt)
	}

	chunkDuration := 600
	outputDir := "/tmp"

	chunks, err := audio.SplitAudioToChunks(filePath, chunkDuration, outputDir)
	if err != nil {
		return "", fmt.Errorf("failed to split audio: %w", err)
	}

	defer func() {
		for _, chunk := range chunks {
			os.Remove(chunk)
		}
	}()

	var transcriptions []string

	for i, chunk := range chunks {
		text, err := TranscribeAudioWithGPT4o(chunk, language, prompt)
		if err != nil {
			return "", fmt.Errorf("failed to transcribe chunk %d: %w", i+1, err)
		}
		if strings.TrimSpace(text) != "" {
			transcriptions = append(transcriptions, text)
		}
	}

	return strings.Join(transcriptions, " "), nil
}

func TranscribeAudioWithGPT4oMiniChunked(filePath, language, prompt string) (string, error) {

	const maxFileSize = 26214400
	fileSize, err := getFileSize(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to get file size: %w", err)
	}

	if fileSize <= maxFileSize {
		return TranscribeAudioWithGPT4oMini(filePath, language, prompt)
	}

	chunkDuration := 600
	outputDir := "/tmp"

	chunks, err := audio.SplitAudioToChunks(filePath, chunkDuration, outputDir)
	if err != nil {
		return "", fmt.Errorf("failed to split audio: %w", err)
	}

	defer func() {
		for _, chunk := range chunks {
			os.Remove(chunk)
		}
	}()

	var transcriptions []string

	for i, chunk := range chunks {
		text, err := TranscribeAudioWithGPT4oMini(chunk, language, prompt)
		if err != nil {
			return "", fmt.Errorf("failed to transcribe chunk %d: %w", i+1, err)
		}
		if strings.TrimSpace(text) != "" {
			transcriptions = append(transcriptions, text)
		}
	}

	return strings.Join(transcriptions, " "), nil
}
