package main

import (
	"fmt"
	"log"
	"time"
)

func main() {
	// Ваш API ключ MailSlurp
	apiKey := "fac5b6d2020a14edc74b54e9f1b09513df1c2ca3fc1901ec9e5933df11052d5a"
	
	// Создаем клиент MailSlurp
	client := NewMailSlurpClient(apiKey)
	
	fmt.Println("Начинаем работу с MailSlurp API...")
	
	// 1. Получаем список существующих почтовых ящиков
	fmt.Println("\nПолучаем список существующих почтовых ящиков...")
	inboxes, err := client.GetInboxes()
	if err != nil {
		log.Printf("Ошибка при получении списка почтовых ящиков: %v", err)
		
		// Если не удалось получить список ящиков, пробуем создать новый
		fmt.Println("\nПробуем создать новый временный почтовый ящик...")
		inbox, err := client.CreateInbox()
		if err != nil {
			log.Printf("Ошибка при создании почтового ящика: %v", err)
			
			if err.Error() == "ошибка API: ограничение бесплатного плана" || 
			   err.Error() == "ошибка API: PLAN_LIMIT_EXCEEDED" {
				fmt.Println("\nПохоже, что вы достигли лимита бесплатного плана MailSlurp.")
				fmt.Println("Бесплатный план имеет ограничения на количество почтовых ящиков и операций.")
				fmt.Println("Для продолжения работы вы можете:")
				fmt.Println("1. Удалить неиспользуемые почтовые ящики через веб-интерфейс MailSlurp (https://app.mailslurp.com)")
				fmt.Println("2. Обновить ваш план до платного на сайте MailSlurp (https://www.mailslurp.com/pricing/)")
			}
			
			return
		}
		
		fmt.Printf("Создан новый почтовый ящик: %s\n", inbox.EmailAddress)
		fmt.Printf("ID ящика: %s\n", inbox.ID)
		
		// Отправляем тестовое письмо
		sendAndReceiveEmail(client, inbox.ID, inbox.EmailAddress)
		return
	}
	
	// Проверяем, есть ли у нас доступные почтовые ящики
	if len(inboxes) > 0 {
		// Используем первый доступный почтовый ящик
		inbox := inboxes[0]
		fmt.Printf("\nНайден существующий почтовый ящик: %s\n", inbox.EmailAddress)
		fmt.Printf("ID ящика: %s\n", inbox.ID)
		
		// Отправляем тестовое письмо
		sendAndReceiveEmail(client, inbox.ID, inbox.EmailAddress)
	} else {
		// Если нет существующих ящиков, пытаемся создать новый
		fmt.Println("\nНе найдено существующих почтовых ящиков. Создаем новый временный почтовый ящик...")
		inbox, err := client.CreateInbox()
		if err != nil {
			log.Printf("Ошибка при создании почтового ящика: %v", err)
			
			if err.Error() == "ошибка API: ограничение бесплатного плана" || 
			   err.Error() == "ошибка API: PLAN_LIMIT_EXCEEDED" {
				fmt.Println("\nПохоже, что вы достигли лимита бесплатного плана MailSlurp.")
				fmt.Println("Бесплатный план имеет ограничения на количество почтовых ящиков и операций.")
				fmt.Println("Для продолжения работы вы можете:")
				fmt.Println("1. Удалить неиспользуемые почтовые ящики через веб-интерфейс MailSlurp (https://app.mailslurp.com)")
				fmt.Println("2. Обновить ваш план до платного на сайте MailSlurp (https://www.mailslurp.com/pricing/)")
			}
			
			return
		}
		
		fmt.Printf("Создан новый почтовый ящик: %s\n", inbox.EmailAddress)
		fmt.Printf("ID ящика: %s\n", inbox.ID)
		
		// Отправляем тестовое письмо
		sendAndReceiveEmail(client, inbox.ID, inbox.EmailAddress)
	}
	
	fmt.Println("\nПример завершен. Спасибо за использование MailSlurp!")
}

// Функция для отправки и получения тестового письма
func sendAndReceiveEmail(client MailSlurpClient, inboxID, emailAddress string) {
	// Отправляем тестовое письмо
	fmt.Println("\nОтправляем тестовое письмо...")
	err := client.SendEmail(inboxID, emailAddress, "Тестовое письмо", "Это тестовое письмо, отправленное через MailSlurp API")
	if err != nil {
		log.Printf("Ошибка при отправке письма: %v", err)
		return
	}
	
	fmt.Println("Письмо отправлено. Ожидаем его получения...")
	
	// Ждем и получаем письмо
	fmt.Println("\nОжидаем получения письма (до 30 секунд)...")
	time.Sleep(5 * time.Second) // Даем время на доставку письма
	
	email, err := client.WaitForLatestEmail(inboxID, 30*time.Second)
	if err != nil {
		log.Printf("Ошибка при ожидании письма: %v", err)
		return
	}
	
	fmt.Printf("\nПолучено письмо:\n")
	fmt.Printf("ID: %s\n", email.ID)
	fmt.Printf("От: %s\n", email.From)
	fmt.Printf("Кому: %v\n", email.To)
	fmt.Printf("Тема: %s\n", email.Subject)
	fmt.Printf("Тело: %s\n", email.Body)
	fmt.Printf("Дата создания: %s\n", email.Created.Format(time.RFC3339))
	
	// Удаляем почтовый ящик после использования (опционально)
	fmt.Println("\nХотите ли вы удалить почтовый ящик? (Это может быть полезно, если вы достигли лимита)")
	fmt.Println("Для демонстрации мы оставим ящик активным. В реальном приложении вы можете удалить его так:")
	fmt.Printf("client.DeleteInbox(\"%s\")\n", inboxID)
} 