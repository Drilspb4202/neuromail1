/**
 * API клиент для работы с MailSlurp
 */
class MailSlurpApi {
    constructor() {
        // Защищенный публичный API ключ - никогда не изменяется
        this.publicApiKey = '042b76d65e4661288db7647cfae566a7b7b02f2b5cf55528f5a2106ebd32de09';
        
        // API ключ пользователя - может быть изменен
        this.personalApiKey = localStorage.getItem('mailslurp_personal_api_key') || '';
        
        // Флаг, указывающий, какой API используется (public/personal)
        this.usePersonalApi = localStorage.getItem('use_personal_api') === 'true';
        
        // Устанавливаем активный API ключ
        this.apiKey = this.usePersonalApi && this.personalApiKey ? this.personalApiKey : this.publicApiKey;
        
        this.baseUrl = 'https://api.mailslurp.com';
        this.emailWaitTimeout = parseInt(localStorage.getItem('mailslurp_email_wait_timeout') || '30');
        this.httpTimeout = parseInt(localStorage.getItem('mailslurp_http_timeout') || '10');
        
        // Настройки для повторных попыток
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 секунда
        
        // Время жизни почтового ящика при использовании публичного API (5 минут в миллисекундах)
        this.publicApiInboxLifetime = 5 * 60 * 1000;
        
        // Инициализация менеджера API-ключей
        this.keyManager = new ApiKeyManager();
        
        // Обновляем статус соединения
        this.connectionStatus = {
            isConnected: false,
            apiType: this.usePersonalApi ? 'personal' : 'public',
            lastChecked: null
        };
        
        // Автоматически активируем ключ при создании объекта
        try {
            this.keyManager.activateKey(this.apiKey);
            console.log('API-ключ успешно активирован при инициализации');
            
            // Проверяем статус подключения
            this.checkConnection();
        } catch (error) {
            console.warn('Ошибка автоматической активации API-ключа:', error);
        }
    }

    /**
     * Задержка выполнения
     * @param {number} ms - Время задержки в миллисекундах
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Выполнить запрос с повторными попытками
     * @param {Function} requestFn - Функция запроса
     * @returns {Promise<Object>} - Результат запроса
     */
    async withRetry(requestFn) {
        let lastError;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                console.warn(`Попытка ${attempt + 1} из ${this.maxRetries} не удалась:`, error);
                lastError = error;
                
                if (attempt < this.maxRetries - 1) {
                    await this.delay(this.retryDelay * Math.pow(2, attempt)); // Экспоненциальная задержка
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Проверяет статус подключения к API
     * @returns {Promise<Object>} - Статус подключения
     */
    async checkConnection() {
        try {
            // Пробуем выполнить тестовый запрос
            const status = await this.checkAccountStatus();
            
            this.connectionStatus = {
                isConnected: true,
                apiType: this.usePersonalApi ? 'personal' : 'public',
                lastChecked: new Date(),
                data: status
            };
            
            // Создаем событие об изменении статуса подключения
            const event = new CustomEvent('api-connection-status-changed', { 
                detail: this.connectionStatus 
            });
            document.dispatchEvent(event);
            
            return this.connectionStatus;
        } catch (error) {
            this.connectionStatus = {
                isConnected: false,
                apiType: this.usePersonalApi ? 'personal' : 'public',
                lastChecked: new Date(),
                error: error.message
            };
            
            // Создаем событие об изменении статуса подключения
            const event = new CustomEvent('api-connection-status-changed', { 
                detail: this.connectionStatus 
            });
            document.dispatchEvent(event);
            
            return this.connectionStatus;
        }
    }

    /**
     * Переключение между публичным и персональным API
     * @param {boolean} usePersonal - Использовать персональный API
     * @returns {Object} - Статус переключения
     */
    switchApiMode(usePersonal) {
        if (usePersonal && !this.personalApiKey) {
            throw new Error('Персональный API-ключ не установлен. Пожалуйста, установите ключ перед переключением.');
        }
        
        this.usePersonalApi = usePersonal;
        localStorage.setItem('use_personal_api', usePersonal.toString());
        
        // Обновляем активный API ключ
        this.apiKey = usePersonal ? this.personalApiKey : this.publicApiKey;
        
        // Активируем ключ в менеджере
        try {
            this.keyManager.activateKey(this.apiKey);
            console.log(`Успешное переключение на ${usePersonal ? 'персональный' : 'публичный'} API`);
            
            // Проверяем статус нового подключения
            this.checkConnection();
            
            return {
                success: true,
                mode: usePersonal ? 'personal' : 'public'
            };
        } catch (error) {
            console.error('Ошибка при переключении API режима:', error);
            
            // Возвращаем обратно на публичный API в случае ошибки
            if (usePersonal) {
                this.usePersonalApi = false;
                localStorage.setItem('use_personal_api', 'false');
                this.apiKey = this.publicApiKey;
                this.keyManager.activateKey(this.apiKey);
            }
            
            throw error;
        }
    }

    /**
     * Получить текущий режим API
     * @returns {Object} - Информация о текущем режиме API
     */
    getCurrentApiMode() {
        return {
            mode: this.usePersonalApi ? 'personal' : 'public',
            apiKey: this.apiKey,
            connectionStatus: this.connectionStatus
        };
    }

    /**
     * Задать персональный API ключ
     * @param {string} apiKey - Персональный API ключ MailSlurp
     */
    setPersonalApiKey(apiKey) {
        this.personalApiKey = apiKey;
        localStorage.setItem('mailslurp_personal_api_key', apiKey);
        
        // Если мы в режиме персонального API, активируем новый ключ
        if (this.usePersonalApi) {
            this.apiKey = apiKey;
            try {
                this.keyManager.activateKey(apiKey);
                // Проверяем статус нового подключения
                this.checkConnection();
            } catch (error) {
                console.warn('Не удалось активировать персональный API-ключ:', error);
                // Переключаемся обратно на публичный API
                this.switchApiMode(false);
                throw error;
            }
        }
    }

    /**
     * Задать API ключ (устаревший метод, для совместимости)
     * @param {string} apiKey - API ключ MailSlurp
     */
    setApiKey(apiKey) {
        // Для совместимости с существующим кодом
        // Этот метод теперь устанавливает персональный ключ и переключается на него
        this.setPersonalApiKey(apiKey);
        
        // Переключаемся на персональный API
        if (apiKey) {
            try {
                this.switchApiMode(true);
            } catch (error) {
                console.warn('Не удалось переключиться на персональный API:', error);
            }
        }
    }

    /**
     * Получить текущий API ключ
     * @returns {string} - текущий API ключ
     */
    getApiKey() {
        return this.apiKey;
    }

    /**
     * Получить публичный API ключ
     * @returns {string} - публичный API ключ
     */
    getPublicApiKey() {
        return this.publicApiKey;
    }

    /**
     * Получить персональный API ключ
     * @returns {string} - персональный API ключ
     */
    getPersonalApiKey() {
        return this.personalApiKey;
    }

    /**
     * Задать тайм-аут ожидания письма
     * @param {number} timeout - Тайм-аут в секундах
     */
    setEmailWaitTimeout(timeout) {
        this.emailWaitTimeout = timeout;
        localStorage.setItem('mailslurp_email_wait_timeout', timeout.toString());
    }

    /**
     * Задать тайм-аут HTTP запроса
     * @param {number} timeout - Тайм-аут в секундах
     */
    setHttpTimeout(timeout) {
        this.httpTimeout = timeout;
        localStorage.setItem('mailslurp_http_timeout', timeout.toString());
    }

    /**
     * Выполнить GET запрос
     * @param {string} endpoint - Конечная точка API
     * @param {Object} params - URL параметры запроса
     * @returns {Promise<Object>} - Ответ API
     */
    async get(endpoint, params = {}) {
        return this.withRetry(async () => {
            const url = new URL(`${this.baseUrl}${endpoint}`);
            
            // Добавляем параметры в URL
            Object.keys(params).forEach(key => {
                url.searchParams.append(key, params[key]);
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout * 1000);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'x-api-key': this.apiKey,
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return data;
            } finally {
                clearTimeout(timeoutId);
            }
        });
    }

    /**
     * Выполнить POST запрос
     * @param {string} endpoint - Конечная точка API
     * @param {Object} body - Тело запроса
     * @returns {Promise<Object>} - Ответ API
     */
    async post(endpoint, body = {}) {
        return this.withRetry(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout * 1000);

            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return data;
            } finally {
                clearTimeout(timeoutId);
            }
        });
    }

    /**
     * Выполнить DELETE запрос
     * @param {string} endpoint - Конечная точка API
     * @returns {Promise<void>}
     */
    async delete(endpoint) {
        return this.withRetry(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout * 1000);

            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    method: 'DELETE',
                    headers: {
                        'x-api-key': this.apiKey,
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
            } finally {
                clearTimeout(timeoutId);
            }
        });
    }

    /**
     * Получить список почтовых ящиков с фильтрацией по префиксу пользователя
     * @returns {Promise<Array>} - Список почтовых ящиков
     */
    async getInboxes() {
        const allInboxes = await this.get('/inboxes');
        // Фильтруем ящики по префиксу пользователя
        return this.keyManager.filterInboxesByPrefix(allInboxes);
    }

    /**
     * Создать новый почтовый ящик с префиксом пользователя
     * @param {Object} options - Опции создания ящика
     * @returns {Promise<Object>} - Созданный почтовый ящик
     */
    async createInbox(options = {}) {
        try {
            // Сначала получаем текущие ящики для проверки их количества
            const currentInboxes = await this.getInboxes();
            
            // Обновляем счетчик в менеджере ключей
            this.keyManager.updateInboxCount(currentInboxes);
            
            // Проверяем лимиты на создание ящиков с обновленным счетчиком
            this.keyManager.checkKeyLimits('createInbox');
            
            // Получаем текущий префикс пользователя для отладки
            const userPrefix = this.keyManager.getCurrentUserPrefix();
            console.log('Создание ящика. Текущий префикс пользователя:', userPrefix);
            
            // Добавляем префикс к имени ящика для изоляции
            if (options.name) {
                options.name = this.keyManager.addPrefixToInboxName(options.name);
            } else {
                // Генерируем имя с префиксом, если не указано
                options.name = this.keyManager.addPrefixToInboxName(`inbox-${Date.now()}`);
            }
            
            // Добавляем теги для лучшей фильтрации
            options.tags = options.tags || [];
            options.tags.push(`prefix:${userPrefix}`);
            
            console.log('Создаем ящик с именем:', options.name);
            
            const newInbox = await this.post('/inboxes', options);
            console.log('Созданный ящик:', newInbox);
            
            // После успешного создания обновляем список ящиков
            const updatedInboxes = await this.getInboxes();
            this.keyManager.updateInboxCount(updatedInboxes);
            
            // Если используется публичный API ключ, настраиваем автоматическое удаление через 5 минут
            if (!this.usePersonalApi && newInbox.id) {
                console.log(`Автоматическое удаление ящика ${newInbox.id} через 5 минут (публичный API)`);
                
                // Устанавливаем таймер на удаление
                setTimeout(() => {
                    try {
                        this.deleteInbox(newInbox.id)
                            .then(() => {
                                console.log(`Автоматически удален ящик ${newInbox.id} после 5 минут`);
                                // Создаем событие об удалении ящика
                                const event = new CustomEvent('inbox-auto-deleted', { 
                                    detail: { inboxId: newInbox.id, emailAddress: newInbox.emailAddress } 
                                });
                                document.dispatchEvent(event);
                            })
                            .catch(err => {
                                console.error(`Ошибка автоматического удаления ящика ${newInbox.id}:`, err);
                            });
                    } catch (error) {
                        console.error(`Ошибка в таймере удаления ящика ${newInbox.id}:`, error);
                    }
                }, this.publicApiInboxLifetime);
            }
            
            return newInbox;
        } catch (error) {
            console.error('Ошибка при создании ящика:', error);
            throw error;
        }
    }

    /**
     * Удалить почтовый ящик
     * @param {string} inboxId - ID почтового ящика
     * @returns {Promise<Object>} - Результат операции
     */
    async deleteInbox(inboxId) {
        return this.delete(`/inboxes/${inboxId}`);
    }

    /**
     * Отправить электронное письмо
     * @param {string} inboxId - ID почтового ящика отправителя
     * @param {Object} emailOptions - Параметры письма
     * @returns {Promise<Object>} - Результат операции
     */
    async sendEmail(inboxId, emailOptions) {
        // Проверяем лимиты на отправку писем
        this.keyManager.checkKeyLimits('sendEmail');
        return this.post(`/inboxes/${inboxId}`, emailOptions);
    }

    /**
     * Ждать и получить последнее письмо в ящике
     * @param {string} inboxId - ID почтового ящика
     * @param {boolean} unreadOnly - Только непрочитанные письма
     * @returns {Promise<Object>} - Полученное письмо
     */
    async waitForLatestEmail(inboxId, unreadOnly = true) {
        return this.get('/waitForLatestEmail', {
            inboxId,
            timeout: this.emailWaitTimeout * 1000,
            unreadOnly: unreadOnly.toString()
        });
    }

    /**
     * Получить список писем в ящике
     * @param {string} inboxId - ID почтового ящика
     * @returns {Promise<Array>} - Список писем
     */
    async getEmails(inboxId) {
        return this.get('/emails', { inboxId });
    }

    /**
     * Получить письмо по ID
     * @param {string} inboxId - ID почтового ящика (опционально) 
     * @param {string} emailId - ID письма 
     * @returns {Promise<Object>} - Объект с данными письма
     */
    async getEmail(inboxId, emailId) {
        try {
            // Если второй параметр не передан, значит первый и есть emailId
            if (!emailId) {
                emailId = inboxId;
                console.log('getEmail вызван только с emailId:', emailId);
            } else {
                console.log('getEmail вызван с inboxId и emailId:', inboxId, emailId);
            }
            
            const response = await fetch(`${this.baseUrl}/emails/${emailId}?decodeBody=true&htmlBody=true`, {
                method: 'GET',
                headers: {
                    'x-api-key': this.apiKey,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.error(`Ошибка API при получении письма: ${response.status} ${response.statusText}`);
                throw new Error(`Ошибка при получении письма: ${response.status} ${response.statusText}`);
            }
            
            const email = await response.json();
            console.log('Получено письмо:', email);
            
            // Если письмо имеет MIME содержимое, обрабатываем его
            if (email.mimeMessage) {
                // Если у нас есть HTML body, используем его
                if (email.mimeMessage.html) {
                    email.body = email.mimeMessage.html;
                } else if (email.mimeMessage.text) {
                    email.body = email.mimeMessage.text;
                }
            }
            
            // Обрабатываем вложения, если они есть
            if (email.attachments && email.attachments.length > 0) {
                console.log('Письмо содержит вложения:', email.attachments);
                
                // Добавляем дополнительную информацию для отображения и скачивания
                email.attachments = email.attachments.map(attachment => {
                    return {
                        ...attachment,
                        // Добавляем URL для скачивания вложения
                        downloadUrl: `${this.baseUrl}/attachments/${attachment.id}?apiKey=${this.apiKey}`,
                    };
                });
            }
            
            return email;
        } catch (error) {
            console.error('Ошибка при получении письма:', error);
            throw error;
        }
    }

    /**
     * Скачать вложение по ID
     * @param {string} attachmentId - ID вложения
     * @returns {Promise<Blob>} - Данные вложения в виде Blob
     */
    async downloadAttachment(attachmentId) {
        try {
            console.log('Скачивание вложения с ID:', attachmentId);
            
            const response = await fetch(`${this.baseUrl}/attachments/${attachmentId}`, {
                method: 'GET',
                headers: {
                    'x-api-key': this.apiKey
                }
            });
            
            if (!response.ok) {
                console.error(`Ошибка API при скачивании вложения: ${response.status} ${response.statusText}`);
                throw new Error(`Ошибка при скачивании вложения: ${response.status} ${response.statusText}`);
            }
            
            // Возвращаем данные как Blob для скачивания
            return await response.blob();
        } catch (error) {
            console.error('Ошибка при скачивании вложения:', error);
            throw error;
        }
    }

    /**
     * Проверить статус аккаунта и лимиты
     * @returns {Promise<Object>} - Информация об аккаунте и установленных лимитах
     */
    async checkAccountStatus() {
        try {
            // Получаем данные из API MailSlurp
            const apiStatus = await this.get('/user/info');
            
            // Добавляем информацию о статусе ключа
            const keyStatus = this.keyManager.checkKeyStatus();
            const usageData = this.keyManager.getKeyUsageData();
            
            return {
                ...apiStatus,
                keyStatus,
                usage: usageData.usage,
                limits: usageData.limits,
                planType: usageData.planType,
                expiresAt: usageData.expiresAt
            };
        } catch (error) {
            console.error('Ошибка при проверке статуса аккаунта:', error);
            throw error;
        }
    }
    
    /**
     * Активировать новый API-ключ с тарифным планом
     * @param {string} apiKey - API-ключ для активации
     * @param {string} planType - Тип тарифного плана (free, basic, professional, enterprise)
     * @returns {Object} - Данные активированного ключа
     */
    activateApiKey(apiKey, planType = 'basic') {
        const keyData = this.keyManager.activateKey(apiKey, planType);
        this.setApiKey(apiKey);
        return keyData;
    }
    
    /**
     * Получить информацию о текущем API-ключе и его лимитах
     * @returns {Object} - Данные использования и лимитов
     */
    getApiKeyInfo() {
        return this.keyManager.getKeyUsageData();
    }

    /**
     * Получить информацию о почтовом ящике по ID
     * @param {string} inboxId - ID почтового ящика
     * @returns {Promise<Object>} - Информация о почтовом ящике
     */
    async getInbox(inboxId) {
        if (!inboxId) {
            throw new Error('ID почтового ящика не указан');
        }
        
        try {
            return await this.get(`/inboxes/${inboxId}`);
        } catch (error) {
            console.error(`Ошибка при получении информации о почтовом ящике ${inboxId}:`, error);
            throw error;
        }
    }
}

// Экспортируем один экземпляр API клиента для всего приложения
const mailslurpApi = new MailSlurpApi(); 