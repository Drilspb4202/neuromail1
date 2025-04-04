package main

import (
	"fmt"
	"testing"
	"time"
)

// Тестовый API ключ - замените на свой
const testAPIKey = "fac5b6d2020a14edc74b54e9f1b09513df1c2ca3fc1901ec9e5933df11052d5a"

// TestCreateInbox тестирует создание почтового ящика
func TestCreateInbox(t *testing.T) {
	client := NewMailSlurpClient(testAPIKey)
	
	inbox, err := client.CreateInbox()
	if err != nil {
		t.Fatalf("Ошибка при создании почтового ящика: %v", err)
	}
	
	if inbox.ID == "" {
		t.Error("ID почтового ящика пустой")
	}
	
	if inbox.EmailAddress == "" {
		t.Error("Email адрес почтового ящика пустой")
	}
	
	fmt.Printf("Создан тестовый почтовый ящик: %s\n", inbox.EmailAddress)
	
	// Удаляем созданный ящик
	err = client.DeleteInbox(inbox.ID)
	if err != nil {
		t.Logf("Предупреждение: не удалось удалить почтовый ящик: %v", err)
	}
}

// TestSendAndReceiveEmail тестирует отправку и получение письма
func TestSendAndReceiveEmail(t *testing.T) {
	client := NewMailSlurpClient(testAPIKey)
	
	// Создаем почтовый ящик
	inbox, err := client.CreateInbox()
	if err != nil {
		t.Fatalf("Ошибка при создании почтового ящика: %v", err)
	}
	
	defer func() {
		// Удаляем почтовый ящик после теста
		err := client.DeleteInbox(inbox.ID)
		if err != nil {
			t.Logf("Предупреждение: не удалось удалить почтовый ящик: %v", err)
		}
	}()
	
	// Отправляем письмо
	subject := "Тестовое письмо"
	body := "Это тестовое письмо для проверки API"
	
	err = client.SendEmail(inbox.ID, inbox.EmailAddress, subject, body)
	if err != nil {
		t.Fatalf("Ошибка при отправке письма: %v", err)
	}
	
	// Ждем и получаем письмо
	email, err := client.WaitForLatestEmail(inbox.ID, 30*time.Second)
	if err != nil {
		t.Fatalf("Ошибка при ожидании письма: %v", err)
	}
	
	// Проверяем содержимое письма
	if email.Subject != subject {
		t.Errorf("Тема письма не совпадает: ожидалось '%s', получено '%s'", subject, email.Subject)
	}
	
	if email.Body != body {
		t.Errorf("Тело письма не совпадает: ожидалось '%s', получено '%s'", body, email.Body)
	}
	
	// Получаем список писем
	emails, err := client.GetEmails(inbox.ID)
	if err != nil {
		t.Fatalf("Ошибка при получении списка писем: %v", err)
	}
	
	if len(emails) == 0 {
		t.Error("Список писем пуст")
	}
}

// TestMockMailSlurpClient демонстрирует использование интерфейса с моком
func TestMockMailSlurpClient(t *testing.T) {
	// Создаем мок клиента
	mockClient := &MockMailSlurpClient{
		inboxes: []Inbox{
			{
				ID:           "mock-inbox-id",
				EmailAddress: "mock@example.com",
				CreatedAt:    time.Now(),
			},
		},
		emails: map[string][]Email{
			"mock-inbox-id": {
				{
					ID:      "mock-email-id",
					Subject: "Mock Subject",
					Body:    "Mock Body",
					From:    "sender@example.com",
					To:      []string{"mock@example.com"},
					Created: time.Now(),
				},
			},
		},
	}
	
	// Получаем список почтовых ящиков
	inboxes, err := mockClient.GetInboxes()
	if err != nil {
		t.Fatalf("Ошибка при получении списка почтовых ящиков: %v", err)
	}
	
	if len(inboxes) != 1 {
		t.Errorf("Неверное количество почтовых ящиков: ожидалось 1, получено %d", len(inboxes))
	}
	
	// Получаем список писем
	emails, err := mockClient.GetEmails("mock-inbox-id")
	if err != nil {
		t.Fatalf("Ошибка при получении списка писем: %v", err)
	}
	
	if len(emails) != 1 {
		t.Errorf("Неверное количество писем: ожидалось 1, получено %d", len(emails))
	}
	
	if emails[0].Subject != "Mock Subject" {
		t.Errorf("Неверная тема письма: ожидалось 'Mock Subject', получено '%s'", emails[0].Subject)
	}
}

// MockMailSlurpClient представляет собой мок реализацию интерфейса MailSlurpClient для тестирования
type MockMailSlurpClient struct {
	inboxes []Inbox
	emails  map[string][]Email
}

func (m *MockMailSlurpClient) GetInboxes() ([]Inbox, error) {
	return m.inboxes, nil
}

func (m *MockMailSlurpClient) CreateInbox() (*Inbox, error) {
	inbox := &Inbox{
		ID:           fmt.Sprintf("mock-inbox-%d", len(m.inboxes)+1),
		EmailAddress: fmt.Sprintf("mock%d@example.com", len(m.inboxes)+1),
		CreatedAt:    time.Now(),
	}
	m.inboxes = append(m.inboxes, *inbox)
	return inbox, nil
}

func (m *MockMailSlurpClient) DeleteInbox(inboxID string) error {
	for i, inbox := range m.inboxes {
		if inbox.ID == inboxID {
			m.inboxes = append(m.inboxes[:i], m.inboxes[i+1:]...)
			delete(m.emails, inboxID)
			return nil
		}
	}
	return fmt.Errorf("почтовый ящик с ID %s не найден", inboxID)
}

func (m *MockMailSlurpClient) SendEmail(inboxID, to, subject, body string) error {
	email := Email{
		ID:      fmt.Sprintf("mock-email-%d", len(m.emails[inboxID])+1),
		Subject: subject,
		Body:    body,
		From:    "sender@example.com",
		To:      []string{to},
		Created: time.Now(),
	}
	
	if m.emails == nil {
		m.emails = make(map[string][]Email)
	}
	
	m.emails[inboxID] = append(m.emails[inboxID], email)
	return nil
}

func (m *MockMailSlurpClient) WaitForLatestEmail(inboxID string, timeout time.Duration) (*Email, error) {
	if emails, ok := m.emails[inboxID]; ok && len(emails) > 0 {
		return &emails[len(emails)-1], nil
	}
	return nil, fmt.Errorf("письма не найдены для почтового ящика с ID %s", inboxID)
}

func (m *MockMailSlurpClient) GetEmails(inboxID string) ([]Email, error) {
	if emails, ok := m.emails[inboxID]; ok {
		return emails, nil
	}
	return []Email{}, nil
}

func (m *MockMailSlurpClient) GetAPIKey() string {
	return "mock-api-key"
}

func (m *MockMailSlurpClient) GetBaseURL() string {
	return "https://mock-api.mailslurp.com"
} 