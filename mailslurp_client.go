package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

// InboxResponse представляет собой структуру для парсинга ответа при создании почтового ящика
type InboxResponse struct {
	ID           string `json:"id"`
	EmailAddress string `json:"emailAddress"`
	CreatedAt    string `json:"createdAt"`
	Name         string `json:"name,omitempty"`
	Description  string `json:"description,omitempty"`
}

// ErrorResponse представляет собой структуру для парсинга ответа с ошибкой
type ErrorResponse struct {
	Status     string `json:"status"`
	Message    string `json:"message,omitempty"`
	ErrorCode  string `json:"errorCode,omitempty"`
	CaseNumber string `json:"caseNumber,omitempty"`
}

// Email представляет собой структуру для работы с электронными письмами
type Email struct {
	ID      string `json:"id"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
	From    string `json:"from"`
	To      []string `json:"to"`
	Created time.Time `json:"createdAt"`
	Read    bool `json:"read"`
}

// Inbox представляет собой структуру для работы с почтовыми ящиками
type Inbox struct {
	ID           string `json:"id"`
	EmailAddress string `json:"emailAddress"`
	CreatedAt    time.Time `json:"createdAt"`
	Name         string `json:"name,omitempty"`
	Description  string `json:"description,omitempty"`
}

// MailSlurpClient определяет интерфейс для работы с API MailSlurp
type MailSlurpClient interface {
	// Методы для работы с почтовыми ящиками
	GetInboxes() ([]Inbox, error)
	CreateInbox() (*Inbox, error)
	DeleteInbox(inboxID string) error
	
	// Методы для работы с письмами
	SendEmail(inboxID, to, subject, body string) error
	WaitForLatestEmail(inboxID string, timeout time.Duration) (*Email, error)
	GetEmails(inboxID string) ([]Email, error)
	
	// Вспомогательные методы
	GetAPIKey() string
	GetBaseURL() string
}

// DefaultMailSlurpClient представляет собой реализацию интерфейса MailSlurpClient
type DefaultMailSlurpClient struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// NewMailSlurpClient создает новый экземпляр клиента MailSlurp
func NewMailSlurpClient(apiKey string) MailSlurpClient {
	return &DefaultMailSlurpClient{
		apiKey:  apiKey,
		baseURL: "https://api.mailslurp.com",
		client:  &http.Client{},
	}
}

// GetAPIKey возвращает API ключ
func (c *DefaultMailSlurpClient) GetAPIKey() string {
	return c.apiKey
}

// GetBaseURL возвращает базовый URL API
func (c *DefaultMailSlurpClient) GetBaseURL() string {
	return c.baseURL
}

// GetInboxes получает список почтовых ящиков
func (c *DefaultMailSlurpClient) GetInboxes() ([]Inbox, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/inboxes", nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Add("x-api-key", c.apiKey)
	req.Header.Add("Accept", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ошибка API: %s, код: %d", string(body), resp.StatusCode)
	}
	
	// Парсим ответ как массив
	var inboxResponses []InboxResponse
	if err := json.Unmarshal(body, &inboxResponses); err != nil {
		return nil, fmt.Errorf("не удалось распарсить ответ API: %v", err)
	}
	
	// Преобразуем InboxResponse в Inbox
	inboxes := make([]Inbox, len(inboxResponses))
	for i, resp := range inboxResponses {
		createdAt, _ := time.Parse(time.RFC3339, resp.CreatedAt)
		inboxes[i] = Inbox{
			ID:           resp.ID,
			EmailAddress: resp.EmailAddress,
			CreatedAt:    createdAt,
			Name:         resp.Name,
			Description:  resp.Description,
		}
	}
	
	return inboxes, nil
}

// CreateInbox создает новый временный почтовый ящик
func (c *DefaultMailSlurpClient) CreateInbox() (*Inbox, error) {
	req, err := http.NewRequest("POST", c.baseURL+"/inboxes", nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Add("x-api-key", c.apiKey)
	req.Header.Add("Accept", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errorResp ErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return nil, fmt.Errorf("ошибка API: %s - %s, код: %d", 
				errorResp.ErrorCode, errorResp.Message, resp.StatusCode)
		}
		return nil, fmt.Errorf("ошибка API: %s, код: %d", string(body), resp.StatusCode)
	}
	
	// Парсим ответ
	var inboxResp InboxResponse
	if err := json.Unmarshal(body, &inboxResp); err != nil {
		return nil, fmt.Errorf("не удалось распарсить ответ API: %v", err)
	}
	
	createdAt, _ := time.Parse(time.RFC3339, inboxResp.CreatedAt)
	inbox := &Inbox{
		ID:           inboxResp.ID,
		EmailAddress: inboxResp.EmailAddress,
		CreatedAt:    createdAt,
		Name:         inboxResp.Name,
		Description:  inboxResp.Description,
	}
	
	return inbox, nil
}

// DeleteInbox удаляет почтовый ящик
func (c *DefaultMailSlurpClient) DeleteInbox(inboxID string) error {
	req, err := http.NewRequest("DELETE", c.baseURL+"/inboxes/"+inboxID, nil)
	if err != nil {
		return err
	}
	
	req.Header.Add("x-api-key", c.apiKey)
	
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := ioutil.ReadAll(resp.Body)
		var errorResp ErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return fmt.Errorf("ошибка API: %s - %s, код: %d", 
				errorResp.ErrorCode, errorResp.Message, resp.StatusCode)
		}
		return fmt.Errorf("ошибка API: %s, код: %d", string(body), resp.StatusCode)
	}
	
	return nil
}

// SendEmail отправляет электронное письмо
func (c *DefaultMailSlurpClient) SendEmail(inboxID, to, subject, body string) error {
	payload := strings.NewReader(fmt.Sprintf(`{
		"to": ["%s"],
		"subject": "%s",
		"body": "%s"
	}`, to, subject, body))
	
	req, err := http.NewRequest("POST", c.baseURL+"/inboxes/"+inboxID, payload)
	if err != nil {
		return err
	}
	
	req.Header.Add("x-api-key", c.apiKey)
	req.Header.Add("Content-Type", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errorResp ErrorResponse
		if err := json.Unmarshal(respBody, &errorResp); err == nil && errorResp.Message != "" {
			return fmt.Errorf("ошибка API: %s - %s, код: %d", 
				errorResp.ErrorCode, errorResp.Message, resp.StatusCode)
		}
		return fmt.Errorf("ошибка API: %s, код: %d", string(respBody), resp.StatusCode)
	}
	
	return nil
}

// WaitForLatestEmail ожидает и получает последнее входящее письмо
func (c *DefaultMailSlurpClient) WaitForLatestEmail(inboxID string, timeout time.Duration) (*Email, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/waitForLatestEmail", nil)
	if err != nil {
		return nil, err
	}
	
	// Добавляем параметры в URL запроса
	q := req.URL.Query()
	q.Add("inboxId", inboxID)
	q.Add("timeout", fmt.Sprintf("%d", int(timeout.Milliseconds())))
	q.Add("unreadOnly", "true")
	req.URL.RawQuery = q.Encode()
	
	req.Header.Add("x-api-key", c.apiKey)
	req.Header.Add("Accept", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK {
		var errorResp ErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return nil, fmt.Errorf("ошибка API: %s - %s, код: %d", 
				errorResp.ErrorCode, errorResp.Message, resp.StatusCode)
		}
		return nil, fmt.Errorf("ошибка API: %s, код: %d", string(body), resp.StatusCode)
	}
	
	// Парсим ответ в структуру Email
	var emailData map[string]interface{}
	if err := json.Unmarshal(body, &emailData); err != nil {
		return nil, fmt.Errorf("не удалось распарсить ответ API: %v", err)
	}
	
	// Извлекаем нужные поля из ответа
	email := &Email{
		ID:      getStringValue(emailData, "id"),
		Subject: getStringValue(emailData, "subject"),
		Body:    getStringValue(emailData, "body"),
		From:    getStringValue(emailData, "from"),
		Read:    getBoolValue(emailData, "read"),
	}
	
	// Извлекаем получателей
	if to, ok := emailData["to"].([]interface{}); ok {
		email.To = make([]string, len(to))
		for i, t := range to {
			if str, ok := t.(string); ok {
				email.To[i] = str
			}
		}
	}
	
	// Парсим время создания
	if createdAtStr, ok := emailData["createdAt"].(string); ok {
		if createdAt, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
			email.Created = createdAt
		}
	}
	
	return email, nil
}

// GetEmails получает список писем в почтовом ящике
func (c *DefaultMailSlurpClient) GetEmails(inboxID string) ([]Email, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/emails", nil)
	if err != nil {
		return nil, err
	}
	
	// Добавляем параметры в URL запроса
	q := req.URL.Query()
	q.Add("inboxId", inboxID)
	req.URL.RawQuery = q.Encode()
	
	req.Header.Add("x-api-key", c.apiKey)
	req.Header.Add("Accept", "application/json")
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK {
		var errorResp ErrorResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Message != "" {
			return nil, fmt.Errorf("ошибка API: %s - %s, код: %d", 
				errorResp.ErrorCode, errorResp.Message, resp.StatusCode)
		}
		return nil, fmt.Errorf("ошибка API: %s, код: %d", string(body), resp.StatusCode)
	}
	
	// Парсим ответ
	var emailsData map[string]interface{}
	if err := json.Unmarshal(body, &emailsData); err != nil {
		return nil, fmt.Errorf("не удалось распарсить ответ API: %v", err)
	}
	
	// Извлекаем содержимое
	var emails []Email
	if content, ok := emailsData["content"].([]interface{}); ok {
		emails = make([]Email, len(content))
		for i, item := range content {
			if emailData, ok := item.(map[string]interface{}); ok {
				email := Email{
					ID:      getStringValue(emailData, "id"),
					Subject: getStringValue(emailData, "subject"),
					Body:    getStringValue(emailData, "body"),
					From:    getStringValue(emailData, "from"),
					Read:    getBoolValue(emailData, "read"),
				}
				
				// Извлекаем получателей
				if to, ok := emailData["to"].([]interface{}); ok {
					email.To = make([]string, len(to))
					for j, t := range to {
						if str, ok := t.(string); ok {
							email.To[j] = str
						}
					}
				}
				
				// Парсим время создания
				if createdAtStr, ok := emailData["createdAt"].(string); ok {
					if createdAt, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
						email.Created = createdAt
					}
				}
				
				emails[i] = email
			}
		}
	}
	
	return emails, nil
}

// Вспомогательные функции для извлечения значений из map[string]interface{}
func getStringValue(data map[string]interface{}, key string) string {
	if value, ok := data[key].(string); ok {
		return value
	}
	return ""
}

func getBoolValue(data map[string]interface{}, key string) bool {
	if value, ok := data[key].(bool); ok {
		return value
	}
	return false
} 