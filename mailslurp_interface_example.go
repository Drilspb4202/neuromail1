package main

import (
	"fmt"
	"log"
	"time"
)

// Пример использования интерфейса MailSlurpClient
func ExampleMailSlurpClient() {
	// Создаем клиент MailSlurp
	client := NewMailSlurpClient("YOUR_API_KEY")
	
	// Создаем новый почтовый ящик
	inbox, err := client.CreateInbox()
	if err != nil {
		log.Fatalf("Ошибка при создании почтового ящика: %v", err)
	}
	
	fmt.Printf("Создан новый почтовый ящик: %s\n", inbox.EmailAddress)
	
	// Отправляем письмо самому себе
	err = client.SendEmail(inbox.ID, inbox.EmailAddress, "Тестовое письмо", "Привет, это тестовое письмо!")
	if err != nil {
		log.Fatalf("Ошибка при отправке письма: %v", err)
	}
	
	fmt.Println("Письмо отправлено. Ожидаем его получения...")
	
	// Ждем и получаем письмо
	email, err := client.WaitForLatestEmail(inbox.ID, 30*time.Second)
	if err != nil {
		log.Fatalf("Ошибка при ожидании письма: %v", err)
	}
	
	fmt.Printf("Получено письмо с темой: %s\n", email.Subject)
	fmt.Printf("Содержимое письма: %s\n", email.Body)
	
	// Получаем все письма в ящике
	emails, err := client.GetEmails(inbox.ID)
	if err != nil {
		log.Fatalf("Ошибка при получении писем: %v", err)
	}
	
	fmt.Printf("Всего писем в ящике: %d\n", len(emails))
	
	// Удаляем почтовый ящик
	err = client.DeleteInbox(inbox.ID)
	if err != nil {
		log.Fatalf("Ошибка при удалении почтового ящика: %v", err)
	}
	
	fmt.Println("Почтовый ящик успешно удален")
}

// Пример создания нескольких почтовых ящиков
func ExampleCreateMultipleInboxes() {
	// Создаем клиент MailSlurp
	client := NewMailSlurpClient("YOUR_API_KEY")
	
	// Создаем несколько почтовых ящиков
	inboxes := make([]*Inbox, 3)
	for i := 0; i < 3; i++ {
		inbox, err := client.CreateInbox()
		if err != nil {
			log.Fatalf("Ошибка при создании почтового ящика %d: %v", i+1, err)
		}
		inboxes[i] = inbox
		fmt.Printf("Создан почтовый ящик %d: %s\n", i+1, inbox.EmailAddress)
	}
	
	// Отправляем письмо из первого ящика во второй
	err := client.SendEmail(inboxes[0].ID, inboxes[1].EmailAddress, "Письмо из ящика 1 в ящик 2", "Привет из ящика 1!")
	if err != nil {
		log.Fatalf("Ошибка при отправке письма: %v", err)
	}
	
	fmt.Println("Письмо отправлено из ящика 1 в ящик 2. Ожидаем его получения...")
	
	// Ждем и получаем письмо во втором ящике
	email, err := client.WaitForLatestEmail(inboxes[1].ID, 30*time.Second)
	if err != nil {
		log.Fatalf("Ошибка при ожидании письма: %v", err)
	}
	
	fmt.Printf("Получено письмо в ящике 2 с темой: %s\n", email.Subject)
	
	// Удаляем все созданные почтовые ящики
	for i, inbox := range inboxes {
		err := client.DeleteInbox(inbox.ID)
		if err != nil {
			log.Printf("Предупреждение: не удалось удалить почтовый ящик %d: %v", i+1, err)
		} else {
			fmt.Printf("Почтовый ящик %d успешно удален\n", i+1)
		}
	}
}

// Пример использования интерфейса для тестирования регистрации
func ExampleTestRegistration() {
	// Создаем клиент MailSlurp
	client := NewMailSlurpClient("YOUR_API_KEY")
	
	// Создаем временный почтовый ящик для тестирования
	inbox, err := client.CreateInbox()
	if err != nil {
		log.Fatalf("Ошибка при создании почтового ящика: %v", err)
	}
	
	fmt.Printf("Создан временный почтовый ящик: %s\n", inbox.EmailAddress)
	
	// Здесь должен быть код, который использует этот адрес для регистрации на вашем сайте
	// Например:
	// registerUser(inbox.EmailAddress, "password123")
	
	fmt.Println("Пользователь зарегистрирован. Ожидаем письмо с подтверждением...")
	
	// Ждем письмо с подтверждением
	email, err := client.WaitForLatestEmail(inbox.ID, 60*time.Second)
	if err != nil {
		log.Fatalf("Ошибка при ожидании письма с подтверждением: %v", err)
	}
	
	fmt.Printf("Получено письмо с подтверждением: %s\n", email.Subject)
	
	// Здесь должен быть код для извлечения ссылки подтверждения из письма
	// и выполнения запроса для подтверждения регистрации
	// Например:
	// confirmationLink := extractConfirmationLink(email.Body)
	// confirmRegistration(confirmationLink)
	
	fmt.Println("Регистрация успешно подтверждена")
	
	// Удаляем временный почтовый ящик
	err = client.DeleteInbox(inbox.ID)
	if err != nil {
		log.Printf("Предупреждение: не удалось удалить почтовый ящик: %v", err)
	} else {
		fmt.Println("Временный почтовый ящик успешно удален")
	}
} 