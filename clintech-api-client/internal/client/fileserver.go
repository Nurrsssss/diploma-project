package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FileServerClient struct {
	BaseURL string
}

type FileMetadata struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	Size         int64  `json:"size"`
	Bucket       string `json:"bucket"`
	Path         string `json:"path"`
	UserID       string `json:"user_id"`
	IsPublic     bool   `json:"is_public"`
}

func NewFileServerClient(baseURL string) *FileServerClient {
	return &FileServerClient{
		BaseURL: baseURL,
	}
}

func (c *FileServerClient) setAuthHeader(req *http.Request, token string) {
	authHeader := token
	if !strings.HasPrefix(token, "Bearer ") {
		authHeader = "Bearer " + token
	}
	req.Header.Set("Authorization", authHeader)
}

func (c *FileServerClient) UploadFiles(fileHeaders []*multipart.FileHeader, token string) ([]string, error) {

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for _, fh := range fileHeaders {

		file, err := fh.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open file %s: %w", fh.Filename, err)
		}
		defer file.Close()

		part, err := writer.CreateFormFile("file", fh.Filename)
		if err != nil {
			return nil, err
		}
		if _, err := io.Copy(part, file); err != nil {
			return nil, err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	url := c.BaseURL + "/files"

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("FileServer unreachable at %s: %w\nCheck if FileServer is running and accessible", url, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		switch resp.StatusCode {
		case 401:
			return nil, fmt.Errorf("Authentication failed (401): Invalid or expired token\nResponse: %s\nURL: %s\nSolution: Check if your JWT token is valid and not expired", string(respBody), url)
		case 403:
			return nil, fmt.Errorf("Access forbidden (403): Insufficient permissions\nResponse: %s\nURL: %s", string(respBody), url)
		case 413:
			return nil, fmt.Errorf("File too large (413): Reduce file size\nResponse: %s\nURL: %s", string(respBody), url)
		default:
			return nil, fmt.Errorf("FileServer error (status %d): %s\nURL: %s", resp.StatusCode, string(respBody), url)
		}
	}

	var fileMetas []FileMetadata
	if err := json.Unmarshal(respBody, &fileMetas); err != nil {
		return nil, fmt.Errorf("failed to decode FileServer response: %w\nResponse: %s", err, string(respBody))
	}

	var ids []string
	for _, meta := range fileMetas {
		ids = append(ids, meta.ID)
	}

	return ids, nil
}

func (c *FileServerClient) UploadLocalFile(filePath, token string) (string, error) {


	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open local file: %w", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Используем имя файла с расширением для правильного определения MIME-типа
	fileName := filepath.Base(filePath)
	
	// Определяем MIME-тип на основе расширения
	mimeType := "application/octet-stream"
	if strings.HasSuffix(strings.ToLower(fileName), ".docx") {
		mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	} else if strings.HasSuffix(strings.ToLower(fileName), ".pdf") {
		mimeType = "application/pdf"
	} else {
	}
	
	// Проверяем формат файла перед загрузкой
	if strings.HasSuffix(strings.ToLower(fileName), ".docx") {
		// Проверяем, что файл действительно DOCX (ZIP формат)
		header := make([]byte, 4)
		if n, _ := file.ReadAt(header, 0); n == 4 {
			if header[0] == 0x50 && header[1] == 0x4B && (header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07) {
				// Файл действительно DOCX формата
			}
		}
		// Возвращаемся в начало файла для копирования
		file.Seek(0, 0)
	}
	
	// Создаем part с явным указанием MIME-типа
	// Используем CreatePart вместо CreateFormFile для возможности установки Content-Type
	part, err := writer.CreatePart(map[string][]string{
		"Content-Disposition": {fmt.Sprintf(`form-data; name="file"; filename="%s"`, fileName)},
		"Content-Type":        {mimeType},
	})
	if err != nil {
		// Fallback: если CreatePart не работает, используем стандартный CreateFormFile
		part, err = writer.CreateFormFile("file", fileName)
		if err != nil {
			return "", fmt.Errorf("failed to create form file: %w", err)
		}
	}

	if _, err := io.Copy(part, file); err != nil {
		return "", fmt.Errorf("failed to copy file: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %w", err)
	}

	uploadURL := c.BaseURL + "/files"

	req, err := http.NewRequest("POST", uploadURL, body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	c.setAuthHeader(req, token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	
	// Добавляем заголовок с ожидаемым MIME-типом для файл-сервера (если поддерживается)
	if strings.HasSuffix(strings.ToLower(fileName), ".docx") {
		req.Header.Set("X-Expected-Mime-Type", mimeType)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		// Проверяем тип ошибки для более понятного сообщения
		if err.Error() == "fetch failed" || err.Error() == "context deadline exceeded" {
			return "", fmt.Errorf("file server недоступен: таймаут соединения (30 сек). Проверьте доступность сервиса по адресу %s", c.BaseURL)
		}
		return "", fmt.Errorf("ошибка сети при загрузке файла на file server: %w. URL: %s", err, uploadURL)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		switch resp.StatusCode {
		case 401:
			return "", fmt.Errorf("❌ Authentication failed (401): Invalid or expired token\nResponse: %s\nURL: %s\nSolution: Check if your JWT token is valid and not expired", string(respBody), uploadURL)
		case 403:
			return "", fmt.Errorf("❌ Access forbidden (403): Insufficient permissions\nResponse: %s\nURL: %s", string(respBody), uploadURL)
		case 413:
			return "", fmt.Errorf("❌ File too large (413): Reduce file size\nResponse: %s\nURL: %s", string(respBody), uploadURL)
		default:
			return "", fmt.Errorf("❌ FileServer error (status %d): %s\nURL: %s", resp.StatusCode, string(respBody), uploadURL)
		}
	}

	var fileMetas []FileMetadata
	if err := json.NewDecoder(bytes.NewReader(respBody)).Decode(&fileMetas); err != nil {
		return "", fmt.Errorf("failed to decode FileServer response: %w\nResponse: %s", err, string(respBody))
	}
	if len(fileMetas) == 0 {
		return "", fmt.Errorf("FileServer returned empty response\nResponse: %s", string(respBody))
	}

	return fileMetas[0].ID, nil
}

func (c *FileServerClient) GetFileMetadata(fileID, token string) (*FileMetadata, error) {
	req, err := http.NewRequest("GET", c.BaseURL+"/files/"+fileID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setAuthHeader(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("file server unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get file metadata: status %d, body: %s", resp.StatusCode, string(respBody))
	}

	var metadata FileMetadata
	if err := json.NewDecoder(resp.Body).Decode(&metadata); err != nil {
		return nil, fmt.Errorf("failed to decode metadata response: %w", err)
	}

	return &metadata, nil
}

func (c *FileServerClient) DownloadFile(fileID, token string) ([]byte, error) {

	downloadURLs := []string{
		c.BaseURL + "/files/" + fileID + "/download",
		c.BaseURL + "/files/" + fileID + "/preview",
	}

	var lastErr error
	for _, downloadURL := range downloadURLs {
		req, err := http.NewRequest("GET", downloadURL, nil)
		if err != nil {
			lastErr = fmt.Errorf("failed to create request: %w", err)
			continue
		}
		c.setAuthHeader(req, token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("file server unreachable: %w", err)
			continue
		}
		defer resp.Body.Close()


		if resp.StatusCode == http.StatusOK {
			fileData, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, fmt.Errorf("failed to read file data: %w", err)
			}
			
			// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем формат скачанного файла
			if len(fileData) >= 4 {
				header := fileData[:4]
				contentType := resp.Header.Get("Content-Type")
				
				// Проверяем PDF (начинается с %PDF)
				isPdf := len(fileData) >= 4 && string(fileData[:4]) == "%PDF"
				
				if isPdf {
					return nil, fmt.Errorf("CRITICAL: file server returned PDF instead of DOCX (header: %x, Content-Type: %s)", header, contentType)
				}
			}
			
			return fileData, nil
		} else {
			respBody, _ := io.ReadAll(resp.Body)
			lastErr = fmt.Errorf("failed to download file: status %d, body: %s", resp.StatusCode, string(respBody))
		}
	}

	return nil, fmt.Errorf("all download URLs failed, last error: %w", lastErr)
}

func (c *FileServerClient) GetFilePreview(fileID, token string) ([]byte, error) {
	req, err := http.NewRequest("GET", c.BaseURL+"/public/"+fileID+"/preview", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setAuthHeader(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("file server unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get file preview: status %d, body: %s", resp.StatusCode, string(respBody))
	}

	previewData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read preview data: %w", err)
	}

	return previewData, nil
}
