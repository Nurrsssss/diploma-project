package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type IdentityClient struct {
	BaseURL string
}

type UserInfo struct {
	UserID string `json:"user_id"`
	Phone  string `json:"phone"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Exp    int64  `json:"exp"`
}

type ValidateResponse struct {
	UserID string `json:"user_id"`
	Phone  string `json:"phone"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Exp    int64  `json:"exp"`
}

func NewIdentityClient(baseURL string) *IdentityClient {
	return &IdentityClient{
		BaseURL: baseURL,
	}
}

func (c *IdentityClient) ValidateToken(token string) (*UserInfo, error) {
	body := []byte(`{}`)

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/auth/validate", c.BaseURL), bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("identity service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token invalid, status: %d", resp.StatusCode)
	}

	var result ValidateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode validate response: %w", err)
	}

	userInfo := &UserInfo{
		UserID: result.UserID,
		Phone:  result.Phone,
		Email:  result.Email,
		Role:   result.Role,
		Exp:    result.Exp,
	}

	return userInfo, nil
}
