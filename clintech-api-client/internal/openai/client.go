package openai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"sync"

	"github.com/beereket/vitalem-api-client/internal/config"
)

// ErrLLMUnavailable — нет OPENAI_API_KEY и Ollama недоступен (сеть, порт, таймаут). Вызывающий код может дать fallback.
var ErrLLMUnavailable = errors.New("llm unavailable")

const (
	baseURL                = "https://api.openai.com/v1"
	chatCompletionsPath    = "/chat/completions"
	imagesGenerationPath   = "/images/generations"
	audioTranscriptionPath = "/audio/transcriptions"
)

type Client struct {
	httpClient *http.Client
	config     *config.OpenAIConfig
	baseURL    string
}

func NewClient(cfg *config.OpenAIConfig) (*Client, error) {
	if cfg.APIKey == "" {
		return nil, errors.New("OPENAI_API_KEY is required")
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: 400 * time.Second,
		},
		config:  cfg,
		baseURL: baseURL,
	}, nil
}

type ChatCompletionMessage struct {
	Role         string                  `json:"role"`
	Content      string                  `json:"content,omitempty"`
	MultiContent []ChatCompletionContent `json:"-"`
}

func (m ChatCompletionMessage) MarshalJSON() ([]byte, error) {
	type Alias ChatCompletionMessage

	if len(m.MultiContent) > 0 {
		return json.Marshal(&struct {
			Role    string                  `json:"role"`
			Content []ChatCompletionContent `json:"content"`
		}{
			Role:    m.Role,
			Content: m.MultiContent,
		})
	}

	return json.Marshal((Alias)(m))
}

type ChatCompletionContent struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

type ImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"`
}

type ChatCompletionRequest struct {
	Model       string                  `json:"model"`
	Messages    []ChatCompletionMessage `json:"messages"`
	MaxTokens   int                     `json:"max_tokens,omitempty"`
	Temperature float64                 `json:"temperature,omitempty"`
	Stream      bool                    `json:"stream,omitempty"`
}

type ChatCompletionResponse struct {
	ID      string                 `json:"id"`
	Object  string                 `json:"object"`
	Created int64                  `json:"created"`
	Model   string                 `json:"model"`
	Choices []ChatCompletionChoice `json:"choices"`
	Usage   ChatCompletionUsage    `json:"usage"`
}

type ChatCompletionChoice struct {
	Index        int                   `json:"index"`
	Message      ChatCompletionMessage `json:"message"`
	FinishReason string                `json:"finish_reason"`
}

type ChatCompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type ImageGenerationAPIRequest struct {
	Prompt            string `json:"prompt"`
	Model             string `json:"model,omitempty"`
	N                 int    `json:"n,omitempty"`
	Quality           string `json:"quality,omitempty"`
	ResponseFormat    string `json:"response_format,omitempty"`
	Size              string `json:"size,omitempty"`
	Style             string `json:"style,omitempty"`
	Background        string `json:"background,omitempty"`
	OutputFormat      string `json:"output_format,omitempty"`
	OutputCompression *int   `json:"output_compression,omitempty"`
	InputFidelity     string `json:"input_fidelity,omitempty"`
	Moderation        string `json:"moderation,omitempty"`
}

type ImageGenerationAPIResponse struct {
	Created int64                 `json:"created"`
	Data    []ImageGenerationData `json:"data"`
}

type ImageGenerationData struct {
	URL           string `json:"url,omitempty"`
	B64JSON       string `json:"b64_json,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

type TextGenerationRequest struct {
	Input        string
	Instructions string
	Language     string
	Model        string
	Temperature  *float64
	MaxTokens    *int
}

type TextGenerationResponse struct {
	Text   string
	Model  string
	Tokens int
}

type VisionRequest struct {
	ImageURL    string
	ImageBase64 string
	ImagePath   string
	Prompt      string
	Language    string
	DetailLevel string
	Model       string
}

type VisionResponse struct {
	Description string
	Model       string
	Tokens      int
}

type ImageGenerationRequest struct {
	Prompt            string
	Model             string
	Size              string
	Quality           string
	Style             string
	Background        string
	OutputFormat      string
	OutputCompression *int
	InputFidelity     string
	Moderation        string
	N                 int
}

type ImageGenerationResponse struct {
	Images []GeneratedImage
	Model  string
}

type GeneratedImage struct {
	URL           string
	Base64        string
	RevisedPrompt string
}

func (c *Client) makeRequest(ctx context.Context, method, path string, body interface{}, response interface{}) error {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "vitalem-api-client/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
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
		return fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, errorResp.Error.Message)
	}

	if response != nil {
		if err := json.Unmarshal(respBody, response); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

func (c *Client) createChatCompletion(ctx context.Context, req ChatCompletionRequest) (*ChatCompletionResponse, error) {
	var response ChatCompletionResponse
	err := c.makeRequest(ctx, "POST", chatCompletionsPath, req, &response)
	if err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GenerateText(ctx context.Context, req TextGenerationRequest) (*TextGenerationResponse, error) {
	model := req.Model
	if model == "" {
		model = c.config.Model
	}

	temperature := c.config.Temperature
	if req.Temperature != nil {
		temperature = *req.Temperature
	}

	maxTokens := c.config.MaxTokens
	if req.MaxTokens != nil {
		maxTokens = *req.MaxTokens
	}

	systemPrompt := c.buildSystemPrompt(req.Language, req.Instructions)

	messages := []ChatCompletionMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: req.Input},
	}

	chatReq := ChatCompletionRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	resp, err := c.createChatCompletion(ctx, chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate text: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response choices returned")
	}

	result := &TextGenerationResponse{
		Text:   resp.Choices[0].Message.Content,
		Model:  resp.Model,
		Tokens: resp.Usage.TotalTokens,
	}
	
	responsePreview := result.Text
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("[Интерпретация данных исследований] Метод: GenerateText | Ответ OpenAI: длина=%d, превью=%s", len(result.Text), responsePreview)
	
	return result, nil
}

func (c *Client) AnalyzeImage(ctx context.Context, req VisionRequest) (*VisionResponse, error) {
	model := req.Model
	if model == "" {
		model = c.config.VisionModel
	}

	detailLevel := req.DetailLevel
	if detailLevel == "" {
		detailLevel = c.config.ImageDetailLevel
	}

	imageContent, err := c.prepareImageContent(req)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare image content: %w", err)
	}

	systemPrompt := c.buildSystemPrompt(req.Language, "You are an expert at analyzing images. Provide detailed, accurate descriptions.")

	message := ChatCompletionMessage{
		Role: "user",
		MultiContent: []ChatCompletionContent{
			{
				Type: "text",
				Text: req.Prompt,
			},
			{
				Type: "image_url",
				ImageURL: &ImageURL{
					URL:    imageContent,
					Detail: detailLevel,
				},
			},
		},
	}

	messages := []ChatCompletionMessage{
		{Role: "system", Content: systemPrompt},
		message,
	}

	chatReq := ChatCompletionRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   c.config.MaxTokens,
		Temperature: c.config.Temperature,
	}

	resp, err := c.createChatCompletion(ctx, chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze image: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response choices returned")
	}

	result := &VisionResponse{
		Description: resp.Choices[0].Message.Content,
		Model:       resp.Model,
		Tokens:      resp.Usage.TotalTokens,
	}
	
	responsePreview := result.Description
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("[Интерпретация данных исследований] Метод: AnalyzeMedicalImage | Ответ OpenAI: длина=%d, превью=%s", len(result.Description), responsePreview)
	
	return result, nil
}

func (c *Client) GenerateImage(ctx context.Context, req ImageGenerationRequest) (*ImageGenerationResponse, error) {
	model := req.Model
	if model == "" {
		model = c.config.ImageModel
	}

	size := req.Size
	if size == "" {
		size = "1024x1024"
	}

	quality := req.Quality
	if quality == "" {
		quality = "standard"
	}

	n := req.N
	if n == 0 {
		n = 1
	}

	responseFormat := "url"
	if req.OutputFormat != "" {
		responseFormat = "b64_json"
	}

	imageReq := ImageGenerationAPIRequest{
		Prompt:            req.Prompt,
		Model:             model,
		N:                 n,
		Quality:           quality,
		Size:              size,
		Style:             req.Style,
		ResponseFormat:    responseFormat,
		Background:        req.Background,
		OutputFormat:      req.OutputFormat,
		OutputCompression: req.OutputCompression,
		InputFidelity:     req.InputFidelity,
		Moderation:        req.Moderation,
	}

	var response ImageGenerationAPIResponse
	err := c.makeRequest(ctx, "POST", imagesGenerationPath, imageReq, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to generate image: %w", err)
	}

	var images []GeneratedImage
	for _, data := range response.Data {
		images = append(images, GeneratedImage{
			URL:           data.URL,
			Base64:        data.B64JSON,
			RevisedPrompt: data.RevisedPrompt,
		})
	}

	return &ImageGenerationResponse{
		Images: images,
		Model:  model,
	}, nil
}

func (c *Client) buildSystemPrompt(language, instructions string) string {
	var basePrompt string
	switch language {
	case "en":
		basePrompt = "You are a senior medical expert. Follow the formatting strictly. Output in English."
	case "kz":
		basePrompt = "Сіз — тәжірибелі медициналық сарапшысыз. Жауапты қазақ тілінде беріңіз, тек құрылымға сәйкес болсын."
	default:
		basePrompt = "Ты — опытный медицинский эксперт. Строго следуй шаблону ответа. Ответ на русском языке."
	}

	if instructions != "" {
		return fmt.Sprintf("%s\n\nAdditional instructions: %s", basePrompt, instructions)
	}
	return basePrompt
}

func (c *Client) prepareImageContent(req VisionRequest) (string, error) {
	if req.ImageURL != "" {
		return req.ImageURL, nil
	}

	if req.ImageBase64 != "" {
		return fmt.Sprintf("data:image/jpeg;base64,%s", req.ImageBase64), nil
	}

	if req.ImagePath != "" {
		imageData, err := os.ReadFile(req.ImagePath)
		if err != nil {
			return "", fmt.Errorf("failed to read image file: %w", err)
		}
		base64Data := base64.StdEncoding.EncodeToString(imageData)
		return fmt.Sprintf("data:image/jpeg;base64,%s", base64Data), nil
	}

	return "", errors.New("no image source provided")
}

func AskOpenAI(prompt, lang string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		// Fallback: local free LLM via Ollama (no API key required)
		ollamaBase := strings.TrimRight(os.Getenv("OLLAMA_BASE_URL"), "/")
		if ollamaBase == "" {
			return "", errors.New("OPENAI_API_KEY environment variable is not set")
		}

		model := os.Getenv("OLLAMA_MODEL")
		if strings.TrimSpace(model) == "" {
			model = "llama3.1"
		}

		ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
		defer cancel()

		type ollamaGenerateRequest struct {
			Model  string `json:"model"`
			Prompt string `json:"prompt"`
			Stream bool   `json:"stream"`
		}
		type ollamaGenerateResponse struct {
			Response string `json:"response"`
			Error    string `json:"error"`
		}

		reqBody, _ := json.Marshal(ollamaGenerateRequest{
			Model:  model,
			Prompt: prompt,
			Stream: false,
		})

		req, err := http.NewRequestWithContext(ctx, "POST", ollamaBase+"/api/generate", bytes.NewBuffer(reqBody))
		if err != nil {
			return "", fmt.Errorf("ollama request build failed: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", fmt.Errorf("%w: ollama: %v", ErrLLMUnavailable, err)
		}
		defer resp.Body.Close()

		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode >= 400 {
			return "", fmt.Errorf("ollama error (%d): %s", resp.StatusCode, strings.TrimSpace(string(raw)))
		}

		var parsed ollamaGenerateResponse
		if err := json.Unmarshal(raw, &parsed); err != nil {
			// Sometimes people run an older/newer Ollama that can return a stream-like payload;
			// as a safe fallback just return the raw text.
			return strings.TrimSpace(string(raw)), nil
		}
		if strings.TrimSpace(parsed.Error) != "" {
			return "", fmt.Errorf("ollama error: %s", parsed.Error)
		}
		return strings.TrimSpace(parsed.Response), nil
	}

	maxTokens := 16000 // Увеличено с 10000 для предотвращения обрезки длинных рекомендаций
	if v := os.Getenv("OPENAI_MAX_TOKENS"); v != "" {
		if iv, err := strconv.Atoi(v); err == nil {
			maxTokens = iv
		}
	}

	cfg := &config.OpenAIConfig{
		APIKey:      apiKey,
		Model:       "gpt-4.1",
		Temperature: 0.3,
		MaxTokens:   maxTokens,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "ask openai error: " + err.Error(), err
	}

	resp, err := client.GenerateText(context.Background(), TextGenerationRequest{
		Input:    prompt,
		Language: lang,
	})
	if err != nil {
		return "ask openai error: " + err.Error(), err
	}

	return resp.Text, nil
}

func (c *Client) AnalyzeMedicalImage(ctx context.Context, req VisionRequest) (*VisionResponse, error) {
	medicalInstructions := `You are a medical imaging expert. Analyze this medical image carefully and provide:
1. A detailed description of what you observe
2. Any notable findings or abnormalities
3. Recommendations for further evaluation if needed
Note: This is for educational/informational purposes only and should not replace professional medical diagnosis.`

	req.Prompt = fmt.Sprintf("%s\n\nImage analysis request: %s", medicalInstructions, req.Prompt)
	return c.AnalyzeImage(ctx, req)
}

func (c *Client) GenerateMedicalIllustration(ctx context.Context, description, style string) (*ImageGenerationResponse, error) {
	prompt := fmt.Sprintf("Medical illustration: %s. Style: %s. Professional, accurate, educational diagram with clear labeling and anatomical precision.", description, style)

	return c.GenerateImage(ctx, ImageGenerationRequest{
		Prompt:        prompt,
		Model:         "gpt-image-1",
		Quality:       "high",
		Size:          "1024x1024",
		Background:    "auto",
		OutputFormat:  "png",
		InputFidelity: "high",
		Moderation:    "low",
		N:             1,
	})
}

func (c *Client) ProcessMedicalReport(ctx context.Context, reportText, language, instructions string) (*TextGenerationResponse, error) {
	enhancedInstructions := fmt.Sprintf(`You are a medical expert analyzing a patient report. %s

Please follow these guidelines:
1. Maintain medical accuracy and professional terminology
2. Structure your response clearly with sections
3. Highlight key findings and recommendations
4. Note any red flags or urgent concerns
5. Suggest appropriate follow-up actions`, instructions)

	return c.GenerateText(ctx, TextGenerationRequest{
		Input:        reportText,
		Instructions: enhancedInstructions,
		Language:     language,
	})
}

func (c *Client) BatchAnalyzeImages(ctx context.Context, requests []VisionRequest) ([]*VisionResponse, error) {
	responses := make([]*VisionResponse, len(requests))

	for i, req := range requests {
		resp, err := c.AnalyzeImage(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("failed to analyze image %d: %w", i, err)
		}
		responses[i] = resp
	}

	return responses, nil
}

func (c *Client) GenerateMultipleImages(ctx context.Context, requests []ImageGenerationRequest) ([]*ImageGenerationResponse, error) {
	responses := make([]*ImageGenerationResponse, len(requests))

	for i, req := range requests {
		resp, err := c.GenerateImage(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("failed to generate image %d: %w", i, err)
		}
		responses[i] = resp
	}

	return responses, nil
}

func CreateClientFromConfig(cfg *config.Config) (*Client, error) {
	return NewClient(&cfg.OpenAI)
}

func (c *Client) ProcessTemplateWithGPT41(ctx context.Context, templateName, language string, data map[string]string) (*TextGenerationResponse, error) {
	var prompt string

	switch templateName {
	case "medical_prompt":
		prompt = GetMedicalPrompt(language, data)
	case "extract_answers":
		if dialogue, ok := data["dialogue"]; ok {
			prompt = GetExtractAnswersPrompt(language, dialogue)
		} else {
			return nil, fmt.Errorf("dialogue parameter required for extract_answers template")
		}
	case "preliminary_conclusion":

		interfaceData := make(map[string]interface{})
		for k, v := range data {
			interfaceData[k] = v
		}
		prompt = GetPreliminaryConclusionPrompt(language, interfaceData)
	default:
		return nil, fmt.Errorf("unknown template: %s", templateName)
	}

	return c.GenerateText(ctx, TextGenerationRequest{
		Input:    prompt,
		Language: language,
		Model:    "gpt-4.1",
	})
}

type StreamingRequest struct {
	TextGenerationRequest
	OnChunk func(chunk string) error
}

func (c *Client) GenerateTextStreaming(ctx context.Context, req StreamingRequest) error {
	resp, err := c.GenerateText(ctx, req.TextGenerationRequest)
	if err != nil {
		return err
	}

	return req.OnChunk(resp.Text)
}

func (c *Client) AnalyzeImageFromFile(ctx context.Context, filePath, prompt, language string) (*VisionResponse, error) {
	return c.AnalyzeImage(ctx, VisionRequest{
		ImagePath: filePath,
		Prompt:    prompt,
		Language:  language,
	})
}

func (c *Client) AnalyzeImageFromURL(ctx context.Context, imageURL, prompt, language string) (*VisionResponse, error) {
	return c.AnalyzeImage(ctx, VisionRequest{
		ImageURL: imageURL,
		Prompt:   prompt,
		Language: language,
	})
}

func (c *Client) AnalyzeImageFromReader(ctx context.Context, reader io.Reader, prompt, language string) (*VisionResponse, error) {
	imageData, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read image data: %w", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(imageData)
	return c.AnalyzeImage(ctx, VisionRequest{
		ImageBase64: base64Data,
		Prompt:      prompt,
		Language:    language,
	})
}

func (c *Client) AnalyzeMedicalImageFromReader(ctx context.Context, reader io.Reader, prompt, language string) (*VisionResponse, error) {
	imageData, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read image data: %w", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(imageData)
	return c.AnalyzeMedicalImage(ctx, VisionRequest{
		ImageBase64: base64Data,
		Prompt:      prompt,
		Language:    language,
	})
}

type MedicalFileData struct {
	Name     string `json:"name"`
	Data     []byte `json:"data"`
	FileType string `json:"file_type"`
}

type MedicalAnalysisOptions struct {
	Language   string  `json:"language"`
	Context    string  `json:"context"`
	Detailed   bool    `json:"detailed"`
	MaxPages   int     `json:"max_pages"`
	Confidence float64 `json:"confidence"`
}

func (c *Client) AnalyzeMedicalFile(ctx context.Context, fileData []byte, fileName string, options MedicalAnalysisOptions) (*VisionResponse, error) {
	if len(fileData) == 0 {
		return nil, fmt.Errorf("file data is empty")
	}

	fileType := GetFileType(fileName)

	switch fileType {
	case "pdf":
		return c.analyzePDFDocument(ctx, fileData, fileName, options)
	case "image":
		return c.analyzeSingleImage(ctx, fileData, fileName, options)
	case "document":
		return c.analyzeDocument(ctx, fileData, fileName, options)
	default:
		return nil, fmt.Errorf("unsupported file type: %s", fileType)
	}
}

func (c *Client) BatchAnalyzeMedicalFiles(ctx context.Context, files []MedicalFileData, options MedicalAnalysisOptions) ([]*VisionResponse, error) {
	if len(files) == 0 {
		return nil, fmt.Errorf("no files provided for analysis")
	}

	results := make([]*VisionResponse, len(files))
	errors := make([]error, len(files))
	successCount := 0

	const maxConcurrent = 3
	sem := make(chan struct{}, maxConcurrent)

	var wg sync.WaitGroup

	for i, file := range files {
		wg.Add(1)

		go func(index int, fileData MedicalFileData) {
			defer wg.Done()

			sem <- struct{}{}
			defer func() { <-sem }()

			fileCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
			defer cancel()

			result, err := c.AnalyzeMedicalFile(fileCtx, fileData.Data, fileData.Name, options)
			if err != nil {
				errors[index] = err

				results[index] = &VisionResponse{
					Description: fmt.Sprintf("Analysis failed for file '%s': %v", fileData.Name, err),
					Model:       "error",
					Tokens:      0,
				}
			} else {
				results[index] = result
				successCount++
			}
		}(i, file)
	}

	wg.Wait()

	if successCount == 0 {
		return nil, fmt.Errorf("failed to analyze all %d files", len(files))
	}

	return results, nil
}

func (c *Client) analyzePDFDocument(ctx context.Context, pdfData []byte, fileName string, options MedicalAnalysisOptions) (*VisionResponse, error) {

	images, err := ConvertPDFToImages(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to convert PDF to images: %w", err)
	}

	if len(images) == 0 {
		return nil, fmt.Errorf("no images extracted from PDF")
	}

	maxPages := options.MaxPages
	if maxPages <= 0 || maxPages > len(images) {
		maxPages = len(images)
	}

	if maxPages > 15 {
		maxPages = 15
	}

	prompt := GetMedicalFilesAnalysisPrompt(options.Language, options.Context)

	var pageAnalyses []string

	for pageNum := 0; pageNum < maxPages; pageNum++ {
		base64Data := base64.StdEncoding.EncodeToString(images[pageNum])

		pagePrompt := fmt.Sprintf("%s\n\nАнализируя страницу %d из %d документа '%s':",
			prompt, pageNum+1, len(images), fileName)

		resp, err := c.AnalyzeMedicalImage(ctx, VisionRequest{
			ImageBase64: base64Data,
			Prompt:      pagePrompt,
			Language:    options.Language,
		})

		if err != nil {
			pageAnalyses = append(pageAnalyses, fmt.Sprintf("Страница %d: Ошибка анализа - %v", pageNum+1, err))
			continue
		}

		pageAnalyses = append(pageAnalyses, resp.Description)
	}

	var combinedAnalysis string
	if len(pageAnalyses) > 1 {
		unificationPrompt := c.buildUnificationPrompt(pageAnalyses, fileName, options.Language)

		unifiedResp, err := c.GenerateText(ctx, TextGenerationRequest{
			Input:       unificationPrompt,
			Language:    options.Language,
			Temperature: &[]float64{0.3}[0],
		})

		if err != nil {
			combinedAnalysis = strings.Join(pageAnalyses, "\n\n")
		} else {
			combinedAnalysis = unifiedResp.Text
		}
	} else {
		combinedAnalysis = strings.Join(pageAnalyses, "\n\n")
	}

	return &VisionResponse{
		Description: combinedAnalysis,
		Model:       "gpt-4-vision-preview",
		Tokens:      len(combinedAnalysis) / 4,
	}, nil
}

func (c *Client) buildUnificationPrompt(pageAnalyses []string, fileName string, language string) string {
	var basePrompt string

	switch language {
	case "ru":
		basePrompt = `Вы — опытный врач с более чем 20-летним стажем. У вас есть результаты анализа всех страниц медицинского документа "%s". 

ЗАДАЧА: Создайте ЕДИНЫЙ КОМПЛЕКСНЫЙ АНАЛИЗ всего документа, объединив информацию со всех страниц.

**КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ОТВЕТА:**
Вы ОБЯЗАТЕЛЬНО должны использовать СТРОГИЙ формат для каждого исследования:

[Тип исследования] (дата ТОЛЬКО если указана в документе)

Ключевые находки: [перечислите ВСЕ отклонения от нормы, патологии и важные показатели, через запятую или точку с запятой. БЕЗ таблиц, БЕЗ многоточий]

Заключение: [1-2 предложения с основным выводом, БЕЗ многоточий]

**ЕСЛИ В ДОКУМЕНТЕ НЕСКОЛЬКО АНАЛИЗОВ:**
- Если документ содержит НЕСКОЛЬКО разных анализов или исследований (например, несколько анализов крови, несколько КТ разных органов, или комбинация анализов), ОБЯЗАТЕЛЬНО представьте КАЖДЫЙ анализ ОТДЕЛЬНО в формате выше.
- Каждый анализ должен иметь СВОЕ название, СВОИ ключевые находки и СВОЕ заключение.
- Разделяйте разные анализы пустой строкой.

**ЕСЛИ В ДОКУМЕНТЕ ТОЛЬКО ЗАКЛЮЧЕНИЕ:**
- Если в документе нет сырых данных анализа, а есть только заключение врача или описание исследования, ВСЕ РАВНО используйте формат выше.
- Определите тип исследования из заключения.
- В "Ключевые находки" извлеките все патологии и отклонения из заключения.
- В "Заключение" используйте основное заключение из документа.

ТРЕБОВАНИЯ:
- НЕ упоминайте номера страниц в итоговом анализе
- НЕ создавайте таблицы - только краткий текст
- НЕ используйте многоточия - пишите полный текст
- НЕ пишите "дата не указана", "нет данных" - просто пропускайте эту информацию
- Объедините информацию со всех страниц в единый анализ
- Устраните дублирование информации
- Если в документе несколько анализов - каждый должен быть отдельно

АНАЛИЗЫ ОТДЕЛЬНЫХ СТРАНИЦ:
%s

Создайте единый структурированный медицинский анализ всего документа в формате выше:`
	case "en":
		basePrompt = `You are an experienced physician with over 20 years of clinical practice. You have analysis results from all pages of the medical document "%s".

TASK: Create a UNIFIED COMPREHENSIVE ANALYSIS of the entire document by combining information from all pages.

REQUIREMENTS:
- DO NOT mention page numbers in the final analysis
- Create a cohesive conclusion as if you analyzed the entire document at once
- Use the 6-section structure (as in the original prompt)
- Combine all parameters and deviations into unified tables
- Eliminate information duplication
- Formulate unified conclusions and recommendations

INDIVIDUAL PAGE ANALYSES:
%s

Create a unified structured medical analysis of the entire document:`
	case "kz":
		basePrompt = `Сіз 20 жылдан астам клиникалық тәжірибесі бар тәжірибелі дәрігерсіз. Сізде "%s" медициналық құжаттың барлық беттерінен талдау нәтижелері бар.

ТАПСЫРМА: Барлық беттердегі ақпаратты біріктіре отырып, бүкіл құжаттың БІРЫҢҒАЙ КЕШЕНДІ ТАЛДАУЫН жасаңыз.

ТАЛАПТАР:
- Түпкілікті талдауда бет нөмірлерін атамаңыз
- Бүкіл құжатты бір мезгілде талдағандай тұтас қорытынды жасаңыз
- 6 бөлім құрылымын пайдаланыңыз (бастапқы промпттегідей)
- Барлық параметрлер мен ауытқуларды бірыңғай кестелерге біріктіріңыз
- Ақпарат қайталануын жойыңыз
- Бірыңғай қорытындылар мен ұсыныстарды тұжырымдаңыз

ЖЕКЕ БЕТЕРДІҢ ТАЛДАУЛАРЫ:
%s

Бүкіл құжаттың бірыңғай құрылымдалған медициналық талдауын жасаңыз:`
	default:
		basePrompt = `You are an experienced physician with over 20 years of clinical practice. You have analysis results from all pages of the medical document "%s".

TASK: Create a UNIFIED COMPREHENSIVE ANALYSIS of the entire document by combining information from all pages.

REQUIREMENTS:
- DO NOT mention page numbers in the final analysis
- Create a cohesive conclusion as if you analyzed the entire document at once
- Use the 6-section structure (as in the original prompt)
- Combine all parameters and deviations into unified tables
- Eliminate information duplication
- Formulate unified conclusions and recommendations

INDIVIDUAL PAGE ANALYSES:
%s

Create a unified structured medical analysis of the entire document:`
	}

	allAnalyses := strings.Join(pageAnalyses, "\n\n---\n\n")

	return fmt.Sprintf(basePrompt, fileName, allAnalyses)
}

func (c *Client) analyzeSingleImage(ctx context.Context, imageData []byte, fileName string, options MedicalAnalysisOptions) (*VisionResponse, error) {

	base64Data := base64.StdEncoding.EncodeToString(imageData)

	prompt := GetMedicalFilesAnalysisPrompt(options.Language, options.Context)

	imagePrompt := fmt.Sprintf("%s\n\nАнализируя изображение '%s':", prompt, fileName)

	return c.AnalyzeMedicalImage(ctx, VisionRequest{
		ImageBase64: base64Data,
		Prompt:      imagePrompt,
		Language:    options.Language,
	})
}

func (c *Client) analyzeDocument(ctx context.Context, documentData []byte, fileName string, options MedicalAnalysisOptions) (*VisionResponse, error) {

	return &VisionResponse{
		Description: fmt.Sprintf("Document analysis not yet implemented for file: %s", fileName),
		Model:       "placeholder",
		Tokens:      0,
	}, nil
}

func GetFileType(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".pdf":
		return "pdf"
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp":
		return "image"
	case ".txt", ".doc", ".docx", ".rtf":
		return "document"
	default:
		return "unknown"
	}
}

func ConvertPDFToImage(pdfData []byte) ([]byte, error) {

	tempDir := os.TempDir()
	tempPDF, err := os.CreateTemp(tempDir, "pdf_*.pdf")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp PDF file: %w", err)
	}
	defer os.Remove(tempPDF.Name())
	defer tempPDF.Close()

	if _, err := tempPDF.Write(pdfData); err != nil {
		return nil, fmt.Errorf("failed to write PDF data to temp file: %w", err)
	}
	tempPDF.Close()

	tempImage, err := os.CreateTemp(tempDir, "img_*.jpg")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp image file: %w", err)
	}
	defer os.Remove(tempImage.Name())
	defer tempImage.Close()
	tempImage.Close()

	outputBase := strings.TrimSuffix(tempImage.Name(), ".jpg")

	cmd := exec.Command("pdftoppm", "-jpeg", "-singlefile", "-f", "1", "-l", "1", tempPDF.Name(), outputBase)
	if err := cmd.Run(); err != nil {

		cmd = exec.Command("convert", "-density", "150", "-quality", "85", tempPDF.Name()+"[0]", tempImage.Name())
		if err := cmd.Run(); err != nil {
			return nil, fmt.Errorf("failed to convert PDF to image using pdftoppm or convert: %w", err)
		}
	} else {

		if _, err := os.Stat(outputBase + ".jpg"); err == nil {

			tempImage.Close()
			tempImage, err = os.Open(outputBase + ".jpg")
			if err != nil {
				return nil, fmt.Errorf("failed to open converted image: %w", err)
			}
			defer tempImage.Close()
		}
	}

	imageData, err := os.ReadFile(tempImage.Name())
	if err != nil {

		altPath := outputBase + ".jpg"
		imageData, err = os.ReadFile(altPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read converted image from %s or %s: %w", tempImage.Name(), altPath, err)
		}
	}

	return imageData, nil
}

func optimizeImageForAnalysis(img image.Image, maxWidth, maxHeight int) (image.Image, error) {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width <= maxWidth && height <= maxHeight {
		return img, nil
	}

	var newWidth, newHeight int
	if width > height {
		newWidth = maxWidth
		newHeight = (height * maxWidth) / width
	} else {
		newHeight = maxHeight
		newWidth = (width * maxHeight) / height
	}

	optimized := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))

	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			srcX := (x * width) / newWidth
			srcY := (y * height) / newHeight
			optimized.Set(x, y, img.At(srcX, srcY))
		}
	}

	return optimized, nil
}

func ConvertPDFToImages(pdfData []byte) ([][]byte, error) {

	tempDir := os.TempDir()
	tempPDF, err := os.CreateTemp(tempDir, "pdf_*.pdf")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp PDF file: %w", err)
	}
	defer os.Remove(tempPDF.Name())
	defer tempPDF.Close()

	if _, err := tempPDF.Write(pdfData); err != nil {
		return nil, fmt.Errorf("failed to write PDF data to temp file: %w", err)
	}
	tempPDF.Close()

	tempImageDir, err := os.MkdirTemp(tempDir, "pdf_images_*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp image directory: %w", err)
	}
	defer os.RemoveAll(tempImageDir)

	outputPrefix := filepath.Join(tempImageDir, "page")

	cmd := exec.Command("pdftoppm",
		"-jpeg",
		"-jpegopt", "quality=75",
		"-r", "120",
		"-scale-to", "1024",
		tempPDF.Name(),
		outputPrefix)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {

		cmd = exec.Command("pdftoppm", "-jpeg", "-jpegopt", "quality=75", "-r", "120", tempPDF.Name(), outputPrefix)
		cmd.Stderr = &stderr

		if err := cmd.Run(); err != nil {

			cmd = exec.Command("pdftoppm", "-jpeg", "-r", "120", tempPDF.Name(), outputPrefix)
			cmd.Stderr = &stderr

			if err := cmd.Run(); err != nil {

				cmd = exec.Command("convert", "-density", "120", "-quality", "75", "-resize", "1024x1024>", tempPDF.Name(), filepath.Join(tempImageDir, "page.jpg"))
				cmd.Stderr = &stderr

				if err := cmd.Run(); err != nil {
					return nil, fmt.Errorf("failed to convert PDF to images with pdftoppm and ImageMagick. PDF may be corrupted or dependencies missing. pdftoppm error: %w (stderr: %s)", err, stderr.String())
				}
			}
		}
	}

	var images [][]byte
	files, err := os.ReadDir(tempImageDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read temp image directory: %w", err)
	}

	var imageFiles []string
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".jpg") || strings.HasSuffix(file.Name(), ".jpeg") {
			imageFiles = append(imageFiles, file.Name())
		}
	}

	sort.Strings(imageFiles)

	for _, fileName := range imageFiles {
		imagePath := filepath.Join(tempImageDir, fileName)
		imageData, err := os.ReadFile(imagePath)
		if err != nil {
			continue
		}
		images = append(images, imageData)
	}

	if len(images) == 0 {
		return nil, fmt.Errorf("no images were created from PDF. Checked %d files in %s. This may indicate a corrupted PDF or missing dependencies", len(files), tempImageDir)
	}

	return images, nil
}

func QuickTextGeneration(prompt, language string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", errors.New("OPENAI_API_KEY environment variable is not set")
	}

	maxTokens := 10000
	if v := os.Getenv("OPENAI_MAX_TOKENS"); v != "" {
		if iv, err := strconv.Atoi(v); err == nil {
			maxTokens = iv
		}
	}
	cfg := &config.OpenAIConfig{
		APIKey:      apiKey,
		Model:       "gpt-4.1",
		Temperature: 0.3,
		MaxTokens:   maxTokens,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", err
	}

	resp, err := client.GenerateText(context.Background(), TextGenerationRequest{
		Input:    prompt,
		Language: language,
	})
	if err != nil {
		return "", err
	}

	return resp.Text, nil
}

func QuickImageAnalysis(imageURL, prompt, language string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", errors.New("OPENAI_API_KEY environment variable is not set")
	}

	maxTokens := 12000
	if v := os.Getenv("OPENAI_MAX_TOKENS"); v != "" {
		if iv, err := strconv.Atoi(v); err == nil {
			maxTokens = iv
		}
	}
	cfg := &config.OpenAIConfig{
		APIKey:           apiKey,
		VisionModel:      "gpt-4.1-mini",
		ImageDetailLevel: "auto",
		MaxTokens:        maxTokens,
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", err
	}

	resp, err := client.AnalyzeImageFromURL(context.Background(), imageURL, prompt, language)
	if err != nil {
		return "", err
	}

	return resp.Description, nil
}

func QuickImageGeneration(prompt string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", errors.New("OPENAI_API_KEY environment variable is not set")
	}

	cfg := &config.OpenAIConfig{
		APIKey:     apiKey,
		ImageModel: "gpt-image-1",
	}

	client, err := NewClient(cfg)
	if err != nil {
		return "", err
	}

	resp, err := client.GenerateImage(context.Background(), ImageGenerationRequest{
		Prompt:       prompt,
		Model:        "gpt-image-1",
		Size:         "1024x1024",
		Quality:      "auto",
		Background:   "auto",
		OutputFormat: "png",
		Moderation:   "auto",
		N:            1,
	})
	if err != nil {
		return "", err
	}

	if len(resp.Images) == 0 {
		return "", errors.New("no images generated")
	}

	return resp.Images[0].URL, nil
}

type OCROptions struct {
	Language    string  `json:"language"`
	EnableOCR   bool    `json:"enable_ocr"`
	TextOnly    bool    `json:"text_only"`
	Confidence  float64 `json:"confidence"`
	PreAnalysis bool    `json:"pre_analysis"`
}

type OCRResult struct {
	ExtractedText string  `json:"extracted_text"`
	Confidence    float64 `json:"confidence"`
	Language      string  `json:"language"`
	Error         string  `json:"error,omitempty"`
}

type DocumentType string

const (
	DocTypeBloodTest    DocumentType = "blood_test"
	DocTypeRadiology    DocumentType = "radiology"
	DocTypePathology    DocumentType = "pathology"
	DocTypeCardiology   DocumentType = "cardiology"
	DocTypeUltrasound   DocumentType = "ultrasound"
	DocTypePrescription DocumentType = "prescription"
	DocTypeGeneral      DocumentType = "general"
	DocTypeUnknown      DocumentType = "unknown"
)

type EnhancedMedicalAnalysisOptions struct {
	Language     string       `json:"language"`
	Context      string       `json:"context"`
	DocumentType DocumentType `json:"document_type"`
	Specialty    string       `json:"specialty"`
	Detailed     bool         `json:"detailed"`
	MaxPages     int          `json:"max_pages"`
	Confidence   float64      `json:"confidence"`
	EnableOCR    bool         `json:"enable_ocr"`
	OCRFirst     bool         `json:"ocr_first"`
	CustomPrompt string       `json:"custom_prompt"`
}

func (c *Client) PerformOCR(ctx context.Context, imageData []byte, options OCROptions) (*OCRResult, error) {
	if len(imageData) == 0 {
		return nil, fmt.Errorf("image data is empty")
	}

	base64Data := base64.StdEncoding.EncodeToString(imageData)

	ocrPrompt := getOCRPrompt(options.Language)

	resp, err := c.AnalyzeMedicalImage(ctx, VisionRequest{
		ImageBase64: base64Data,
		Prompt:      ocrPrompt,
		Language:    options.Language,
	})

	if err != nil {
		return &OCRResult{
			Error: fmt.Sprintf("OCR failed: %v", err),
		}, err
	}

	confidence := 0.8
	if resp.Tokens > 100 {
		confidence = 0.9
	}
	if resp.Tokens < 50 {
		confidence = 0.6
	}

	return &OCRResult{
		ExtractedText: resp.Description,
		Confidence:    confidence,
		Language:      options.Language,
	}, nil
}

func (c *Client) AnalyzeMedicalFileEnhanced(ctx context.Context, fileData []byte, fileName string, options EnhancedMedicalAnalysisOptions) (*VisionResponse, error) {
	
	if len(fileData) == 0 {
		return nil, fmt.Errorf("file data is empty")
	}

	fileType := GetFileType(fileName)

	if options.DocumentType == DocTypeUnknown {
		options.DocumentType = detectDocumentType(fileName, fileData)
	} else {
	}


	switch fileType {
	case "pdf":
		return c.analyzePDFDocumentEnhanced(ctx, fileData, fileName, options)
	case "image":
		return c.analyzeImageEnhanced(ctx, fileData, fileName, options)
	case "document":
		return c.analyzeDocumentEnhanced(ctx, fileData, fileName, options)
	default:
		return nil, fmt.Errorf("unsupported file type: %s", fileType)
	}
}

func (c *Client) analyzePDFDocumentEnhanced(ctx context.Context, pdfData []byte, fileName string, options EnhancedMedicalAnalysisOptions) (*VisionResponse, error) {

	images, err := ConvertPDFToImages(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to convert PDF to images: %w", err)
	}

	if len(images) == 0 {
		return nil, fmt.Errorf("no images extracted from PDF")
	}


	maxPages := options.MaxPages
	if maxPages <= 0 || maxPages > len(images) {
		maxPages = len(images)
	}
	if maxPages > 15 {
		maxPages = 15
	}

	var pageAnalyses []string
	var extractedTexts []string

	for pageNum := 0; pageNum < maxPages; pageNum++ {
		pageAnalysis := ""

		if options.EnableOCR || options.OCRFirst {
			ocrResult, err := c.PerformOCR(ctx, images[pageNum], OCROptions{
				Language:   options.Language,
				EnableOCR:  true,
				Confidence: options.Confidence,
			})

			if err == nil && ocrResult.ExtractedText != "" {
				extractedTexts = append(extractedTexts, ocrResult.ExtractedText)
				if options.OCRFirst {

					pageAnalysis = ocrResult.ExtractedText
				}
			}
		}

		if !options.OCRFirst || pageAnalysis == "" {
			base64Data := base64.StdEncoding.EncodeToString(images[pageNum])

			prompt := c.getCustomAnalysisPrompt(options)

			pagePrompt := fmt.Sprintf("%s\n\nАнализируя страницу %d из %d документа '%s':",
				prompt, pageNum+1, len(images), fileName)

			resp, err := c.AnalyzeMedicalImage(ctx, VisionRequest{
				ImageBase64: base64Data,
				Prompt:      pagePrompt,
				Language:    options.Language,
			})

			if err != nil {
				pageAnalysis = fmt.Sprintf("Страница %d: Ошибка анализа - %v", pageNum+1, err)
			} else {
				pageAnalysis = resp.Description
			}
		}

		pageAnalyses = append(pageAnalyses, pageAnalysis)
	}

	var combinedAnalysis string
	if len(pageAnalyses) > 1 {

		unificationPrompt := c.buildUnificationPrompt(pageAnalyses, fileName, options.Language)

		unifiedResp, err := c.GenerateText(ctx, TextGenerationRequest{
			Input:       unificationPrompt,
			Language:    options.Language,
			Temperature: &[]float64{0.3}[0],
		})

		if err != nil {
			combinedAnalysis = strings.Join(pageAnalyses, "\n\n")
		} else {
			combinedAnalysis = unifiedResp.Text
		}
	} else {
		combinedAnalysis = strings.Join(pageAnalyses, "\n\n")
	}

	if len(extractedTexts) > 0 {
		ocrSummary := strings.Join(extractedTexts, "\n\n")

		if !strings.Contains(combinedAnalysis, ocrSummary) {
			combinedAnalysis += "\n\n**Дополнительный извлеченный текст:**\n" + ocrSummary
		}
	}

	result := &VisionResponse{
		Description: combinedAnalysis,
		Model:       "gpt-4-vision-preview",
		Tokens:      len(combinedAnalysis) / 4,
	}
	
	responsePreview := result.Description
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("[Интерпретация данных исследований] Метод: AnalyzeMedicalPDFEnhanced | Ответ OpenAI: длина=%d, превью=%s", len(result.Description), responsePreview)
	
	return result, nil
}

func (c *Client) analyzeImageEnhanced(ctx context.Context, imageData []byte, fileName string, options EnhancedMedicalAnalysisOptions) (*VisionResponse, error) {
	
	var analysis string
	var ocrText string

	if options.EnableOCR {
		ocrResult, err := c.PerformOCR(ctx, imageData, OCROptions{
			Language:   options.Language,
			EnableOCR:  true,
			Confidence: options.Confidence,
		})

		if err == nil && ocrResult.ExtractedText != "" {
			ocrText = ocrResult.ExtractedText
		} else if err != nil {
		} else {
		}
	} else {
	}

	base64Data := base64.StdEncoding.EncodeToString(imageData)
	prompt := c.getCustomAnalysisPrompt(options)

	imagePrompt := fmt.Sprintf("%s\n\nАнализируя изображение '%s':", prompt, fileName)

	if ocrText != "" {
		imagePrompt += fmt.Sprintf("\n\nИзвлеченный текст: %s", ocrText)
	}

	resp, err := c.AnalyzeMedicalImage(ctx, VisionRequest{
		ImageBase64: base64Data,
		Prompt:      imagePrompt,
		Language:    options.Language,
	})

	if err != nil {
		return nil, err
	}

	analysis = resp.Description

	if ocrText != "" {
		analysis += "\n\n**Извлеченный текст (OCR):**\n" + ocrText
	}

	result := &VisionResponse{
		Description: analysis,
		Model:       resp.Model,
		Tokens:      len(analysis) / 4,
	}
	
	responsePreview := result.Description
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	log.Printf("[Интерпретация данных исследований] Метод: analyzeImageEnhanced | Ответ OpenAI: длина=%d, превью=%s", len(result.Description), responsePreview)
	
	return result, nil
}

func (c *Client) analyzeDocumentEnhanced(ctx context.Context, documentData []byte, fileName string, options EnhancedMedicalAnalysisOptions) (*VisionResponse, error) {

	textContent := string(documentData)

	prompt := c.getCustomAnalysisPrompt(options)

	analysisPrompt := fmt.Sprintf("%s\n\nАнализируя текстовый документ '%s':\n\n%s", prompt, fileName, textContent)

	analysis := fmt.Sprintf("**Анализ текстового документа: %s**\n\nОбнаружен текстовый документ размером %d символов.\n\nСодержимое документа:\n%s\n\nДля полного анализа рекомендуется загрузить документ в формате PDF или изображения.\n\n(Промпт для анализа готов: %d символов)",
		fileName, len(textContent), textContent[:min(len(textContent), 500)], len(analysisPrompt))

	return &VisionResponse{
		Description: analysis,
		Model:       "text-analysis",
		Tokens:      len(analysis) / 4,
	}, nil
}

func (c *Client) getCustomAnalysisPrompt(options EnhancedMedicalAnalysisOptions) string {
	if options.CustomPrompt != "" {
		return options.CustomPrompt
	}

	if options.Specialty != "" {
		if prompt := GetSpecialtyPrompt(options.Language, options.Specialty, string(options.DocumentType)); prompt != "" {
			return prompt
		}
	}

	if options.DocumentType != DocTypeUnknown {
		if prompt := GetDocumentTypePrompt(options.Language, string(options.DocumentType)); prompt != "" {
			return prompt
		}
	}

	return GetMedicalFilesAnalysisPrompt(options.Language, options.Context)
}

func detectDocumentType(fileName string, fileData []byte) DocumentType {
	fileNameLower := strings.ToLower(fileName)

	if strings.Contains(fileNameLower, "кров") || strings.Contains(fileNameLower, "blood") ||
		strings.Contains(fileNameLower, "анализ") || strings.Contains(fileNameLower, "lab") {
		return DocTypeBloodTest
	}

	if strings.Contains(fileNameLower, "рентген") || strings.Contains(fileNameLower, "xray") ||
		strings.Contains(fileNameLower, "кт") || strings.Contains(fileNameLower, "ct") ||
		strings.Contains(fileNameLower, "мрт") || strings.Contains(fileNameLower, "mri") {
		return DocTypeRadiology
	}

	if strings.Contains(fileNameLower, "узи") || strings.Contains(fileNameLower, "ultrasound") ||
		strings.Contains(fileNameLower, "usg") || strings.Contains(fileNameLower, "эхо") {
		return DocTypeUltrasound
	}

	if strings.Contains(fileNameLower, "экг") || strings.Contains(fileNameLower, "ecg") ||
		strings.Contains(fileNameLower, "кардио") || strings.Contains(fileNameLower, "cardio") ||
		strings.Contains(fileNameLower, "сердце") || strings.Contains(fileNameLower, "heart") {
		return DocTypeCardiology
	}

	if strings.Contains(fileNameLower, "рецепт") || strings.Contains(fileNameLower, "prescription") ||
		strings.Contains(fileNameLower, "лекарств") || strings.Contains(fileNameLower, "medication") {
		return DocTypePrescription
	}

	return DocTypeGeneral
}

func getOCRPrompt(language string) string {
	switch language {
	case "en":
		return "Extract all text from this medical document image. Preserve formatting, numbers, and medical terminology exactly as shown. Include all visible text including headers, values, units, and references ranges."
	case "kz":
		return "Осы медициналық құжат кескінінен барлық мәтінді шығарыңыз. Форматтауды, сандарды және медициналық терминологияны дәл көрсетілгендей сақтаңыз. Тақырыптар, мәндер, өлшем бірліктері және анықтамалық диапазондар сияқты барлық көрінетін мәтінді қосыңыз."
	default:
		return "Извлеките весь текст из этого изображения медицинского документа. Сохраните форматирование, числа и медицинскую терминологию точно как показано. Включите весь видимый текст, включая заголовки, значения, единицы измерения и референсные диапазоны."
	}
}
