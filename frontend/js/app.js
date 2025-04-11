/**
 * Класс приложения, связывающий API и UI
 */
class MailSlurpApp {
    constructor(api, ui) {
        this.api = api;
        this.ui = ui;
        
        // Состояние приложения
        this.currentInboxId = localStorage.getItem('current_inbox_id') || null;
        this.currentInboxEmail = localStorage.getItem('current_inbox_email') || null;
        this.inboxes = [];
        this.emails = {};
        this.accountInfo = null;
        this.isCreatingInbox = false; // Флаг для отслеживания процесса создания
        
        // Счетчики для статистики
        this.sentEmails = 0;
        this.receivedEmails = 0;
        this.unreadEmails = 0; // Счетчик непрочитанных писем
        
        // Данные генератора
        this.generatorData = null;
        this.generatorTimer = null;
        
        // Интервал проверки новых писем
        this.emailCheckInterval = null;
        
        // Добавляем секцию для управления пулом API-ключей
        this.apiKeyPoolSection = null;
        
        // Инициализация приложения
        this.init();
    }
    
    /**
     * Инициализировать приложение
     * @returns {Promise} - Promise, который разрешается после завершения инициализации
     */
    async init() {
        try {
            // Привязываем обработчики событий UI к методам приложения
            this.bindUIEvents();
            
            console.log('Инициализация приложения...');
            
            // Показываем предупреждение о времени жизни ящика при публичном API
            const isPublicApi = !this.api.usePersonalApi;
            if (isPublicApi) {
                // Принудительно обновляем пул ключей, чтобы убедиться, что новые ключи загружены
                if (this.api.keyPool) {
                    this.api.keyPool.forceRefreshState();
                }
                
                // Показываем уведомление сразу при запуске для информирования пользователя
                setTimeout(() => {
                    this.showInboxLifetimeInfo(true);
                }, 1000);
            }
            
            // Загружаем список почтовых ящиков (и автоматически восстанавливаем текущий ящик, если он есть)
            await this.loadInboxes();
            
            // Проверяем статус аккаунта
            await this.checkAccountStatus();
            
            // Добавляем обработчик для кнопки обновления
            document.getElementById('refresh-btn').addEventListener('click', () => {
                this.loadInboxes();
                this.checkAccountStatus();
            });
            
            document.getElementById('confirm-send-email').addEventListener('click', () => {
                this.sendEmail();
            });
            
            // Инициализируем состояние Markdown редактора
            this.initMarkdownEditor();
            
            // Инициализируем генератор данных
            this.initDataGenerator();
            
            // Запускаем интервал проверки новых писем
            this.startEmailCheckInterval();
            
            // Инициализируем настройки таймера удаления
            this.initDeleteTimerSettings();
            
            // Инициализируем настройки API ключа и режима
            this.initApiKeySettings();
            
            // Инициализируем поддержку интернационализации
            this.initInternationalization();
            
            console.log('Инициализация приложения завершена');
            return Promise.resolve();
        } catch (error) {
            console.error('Ошибка при инициализации приложения:', error);
            
            // Показываем сообщение об ошибке
            this.ui.showToast(`Ошибка при инициализации: ${error.message}`, 'error', 10000);
            return Promise.reject(error);
        }
    }
    
    /**
     * Привязать обработчики событий UI к методам приложения
     */
    bindUIEvents() {
        // Переопределяем методы UI
        this.ui.onViewEmails = (inboxId) => this.loadEmails(inboxId);
        this.ui.onViewEmail = (emailId) => this.viewEmail(emailId);
        this.ui.onDeleteInbox = (inboxId) => this.deleteInbox(inboxId);
        this.ui.onDeleteEmail = (emailId) => this.deleteEmail(emailId);
        this.ui.onUpdateApiKey = () => this.updateApiKey();
        this.ui.onSaveTimeouts = () => this.saveTimeouts();
        this.ui.onSaveAutoDelete = () => this.saveAutoDelete();
        this.ui.onSaveLogging = () => this.saveLogging();
        
        // События для управления API ключом и режимом
        document.getElementById('update-api-key-btn').addEventListener('click', () => this.updateApiKey());
        document.getElementById('reset-to-public-api-btn').addEventListener('click', () => this.resetToPublicApi());
        document.getElementById('api-mode-toggle').addEventListener('change', (e) => this.toggleApiMode(e.target.checked));
        document.getElementById('toggle-api-key-visibility').addEventListener('click', () => this.toggleApiKeyVisibility());
        
        // Секретный код
        const activateCodeBtn = document.getElementById('activate-code-btn');
        const toggleCodeBtn = document.getElementById('toggle-code-visibility');
        
        if (activateCodeBtn) {
            activateCodeBtn.addEventListener('click', () => this.checkSecretCode());
        }
        
        if (toggleCodeBtn) {
            toggleCodeBtn.addEventListener('click', () => this.toggleSecretCodeVisibility());
        }
        
        // Обновляем состояние секретного кода при инициализации
        this.updateSecretCodeStatus();
        
        // Подписываемся на события изменения статуса API
        document.addEventListener('api-connection-status-changed', (event) => {
            this.updateApiStatusIndicator(event.detail);
        });
        
        // Обработчик события автоматического удаления почтового ящика через 5 минут
        document.addEventListener('inbox-auto-deleted', (event) => {
            this.handleAutoDeletedInbox(event.detail);
        });
    }
    
    /**
     * Загрузить список почтовых ящиков
     */
    async loadInboxes() {
        try {
            // Сохраняем ID текущего ящика перед загрузкой нового списка
            const savedInboxId = this.currentInboxId;
            const savedInboxEmail = this.currentInboxEmail;
            
            this.ui.showInboxesLoading();
            
            const inboxes = await this.api.getInboxes();
            this.inboxes = inboxes;
            
            // Получаем лимит из localStorage или используем дефолтное значение
            const inboxLimit = parseInt(localStorage.getItem('mailslurp_inbox_limit') || '10');
            
            // Используем наш метод для отрисовки с возможностью копирования
            this.renderInboxes(inboxes, inboxLimit);
            
            // Проверяем, существует ли ящик с сохраненным ID в новом списке
            if (savedInboxId) {
                const inboxExists = inboxes.some(inbox => inbox.id === savedInboxId);
                
                if (inboxExists) {
                    // Если ящик существует, восстанавливаем его и загружаем письма
                    this.currentInboxId = savedInboxId;
                    this.currentInboxEmail = savedInboxEmail;
                    
                    // Загружаем письма для восстановленного ящика
                    this.loadEmails(savedInboxId);
                } else {
                    // Если ящик не существует (был удален), очищаем localStorage
                    console.log('Ящик с ID', savedInboxId, 'не найден в списке. Был удален с сервера.');
                    localStorage.removeItem('current_inbox_id');
                    localStorage.removeItem('current_inbox_email');
                    this.currentInboxId = null;
                    this.currentInboxEmail = null;
                    
                    // Очищаем интерфейс писем
                    this.ui.emailsList.innerHTML = `
                        <tr class="no-inbox-selected">
                            <td colspan="4">Выберите почтовый ящик для просмотра писем</td>
                        </tr>
                    `;
                    this.ui.currentInboxTitle.textContent = '📧 Письма';
                    
                    // Показываем уведомление пользователю
                    this.ui.showToast('Ранее выбранный почтовый ящик был удален с сервера или срок его жизни истек', 'warning');
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке списка почтовых ящиков:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Проверить статус аккаунта и лимиты
     */
    async checkAccountStatus() {
        try {
            const accountInfo = await this.api.checkAccountStatus();
            this.accountInfo = accountInfo;
            
            // Сохраняем информацию о лимитах
            if (accountInfo.plan && accountInfo.plan.inboxLimit) {
                localStorage.setItem('mailslurp_inbox_limit', accountInfo.plan.inboxLimit.toString());
            }
            
            if (accountInfo.plan && accountInfo.plan.requestLimit) {
                localStorage.setItem('mailslurp_request_limit', accountInfo.plan.requestLimit.toString());
            }
            
            // Обновляем статистику
            const requestLimit = parseInt(localStorage.getItem('mailslurp_request_limit') || '100');
            this.ui.updateApiRequestsStats(accountInfo.requestsUsed || 0, requestLimit);
            
            // Обновляем статистику писем
            this.updateEmailStats();
            
            // Обновляем график
            this.updateUsageChart(accountInfo);
        } catch (error) {
            console.error('Ошибка при проверке статуса аккаунта:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Показать информацию о времени жизни почтового ящика
     * @param {boolean} isPublicApi - Флаг использования публичного API
     */
    showInboxLifetimeInfo(isPublicApi = false) {
        if (isPublicApi && !this.api.secretCodeActivated) {
            // Показываем уведомление о времени жизни ящика при публичном API
            const lifetimeMinutes = this.api.publicApiInboxLifetime / 60000;
            this.ui.showToast(`Внимание! При использовании публичного API почтовые ящики автоматически удаляются через ${lifetimeMinutes} мин. Для постоянных ящиков используйте персональный API ключ или активируйте секретный код.`, 'warning', 8000);
        } else if (isPublicApi && this.api.secretCodeActivated) {
            // Если секретный код активирован, показываем подтверждение
            this.ui.showToast(`Секретный код активирован. Ваши почтовые ящики не будут автоматически удаляться даже с публичным API.`, 'success', 5000);
        }
    }
    
    /**
     * Создать новый почтовый ящик
     */
    async createInbox() {
        try {
            if (this.isCreatingInbox) {
                console.log('Создание почтового ящика уже в процессе, ожидаем завершения...');
                return;
            }
            
            this.isCreatingInbox = true;
            this.ui.showToast('Создаем новый почтовый ящик...', 'info');
            
            const inbox = await this.api.createInbox();
            
            // Проверяем, что ответ является объектом с id (успешное создание)
            if (inbox && inbox.id) {
                console.log('Ящик успешно создан:', inbox);
                
                // Получаем текущий список ящиков и добавляем новый в начало
                const inboxes = await this.loadInboxes();
                
                // Находим новый ящик в списке и добавляем класс для анимации
                setTimeout(() => {
                    const newInboxRow = document.querySelector(`tr[data-inbox-id="${inbox.id}"]`);
                    if (newInboxRow) {
                        newInboxRow.classList.add('new-item');
                        
                        // Прокручиваем к новому ящику если он не в области видимости
                        newInboxRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        
                        // Удаляем класс через 3 секунды
                        setTimeout(() => {
                            newInboxRow.classList.remove('new-item');
                        }, 3000);
                    }
                }, 300);
                
                this.ui.showToast(`Почтовый ящик ${inbox.emailAddress} успешно создан`, 'success');
                
                // Показываем информацию о времени жизни ящика
                this.showInboxLifetimeInfo(this.api.isPersonalKey());
                
                // Если создан первый ящик, активируем секцию писем
                if (this.inboxes.length === 1) {
                    this.currentInboxId = inbox.id;
                    this.currentInboxEmail = inbox.emailAddress;
                    localStorage.setItem('current_inbox_id', this.currentInboxId);
                    localStorage.setItem('current_inbox_email', this.currentInboxEmail);
                    
                    // Загружаем письма для нового ящика
                    await this.loadEmails(this.currentInboxId);
                }
            } else {
                this.ui.showToast(`Ошибка создания ящика: Не удалось создать ящик`, 'error');
            }
        } catch (error) {
            console.error('Ошибка при создании почтового ящика:', error);
            this.ui.showToast(`Ошибка создания ящика: ${error.message}`, 'error');
        } finally {
            this.isCreatingInbox = false;
        }
    }
    
    /**
     * Удалить почтовый ящик
     * @param {string} inboxId - ID почтового ящика
     */
    async deleteInbox(inboxId) {
        try {
            await this.api.deleteInbox(inboxId);
            
            // Если это текущий ящик, сбрасываем ID и очищаем localStorage
            if (this.currentInboxId === inboxId) {
                this.currentInboxId = null;
                this.currentInboxEmail = null;
                this.emails = {};
                
                // Очищаем данные в localStorage
                localStorage.removeItem('current_inbox_id');
                localStorage.removeItem('current_inbox_email');
                
                // Сбрасываем список писем
                this.ui.emailsList.innerHTML = `
                    <tr class="no-inbox-selected">
                        <td colspan="4">Выберите почтовый ящик для просмотра писем</td>
                    </tr>
                `;
                
                this.ui.currentInboxTitle.textContent = '📧 Письма';
            }
            
            // Перезагружаем список ящиков
            await this.loadInboxes();
            
            this.ui.showToast('Почтовый ящик успешно удален', 'success');
        } catch (error) {
            console.error('Ошибка при удалении почтового ящика:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Загрузить письма для указанного почтового ящика
     * @param {string} inboxId - ID почтового ящика
     */
    async loadEmails(inboxId) {
        try {
            // Сохраняем текущий ID ящика
            this.currentInboxId = inboxId;
            localStorage.setItem('current_inbox_id', inboxId);
            
            // Находим и сохраняем email адрес текущего ящика
            const inbox = this.inboxes.find(inbox => inbox.id === inboxId);
            if (inbox) {
                this.currentInboxEmail = inbox.emailAddress;
                console.log('Текущий email адрес:', this.currentInboxEmail);
            }
            
            // Показываем индикатор загрузки
            this.ui.showLoading('emails-list', 'Загрузка писем...');
            
            // Запрашиваем письма из API
            const response = await this.api.getEmails(inboxId);
            
            // Обработка ответа в зависимости от его формата
            let emails = [];
            if (response.content && Array.isArray(response.content)) {
                emails = response.content;
            } else if (Array.isArray(response)) {
                emails = response;
            } else {
                console.warn('Неизвестный формат ответа при получении писем:', response);
            }
            
            // Сохраняем в кэш
            this.emails[inboxId] = emails;
            
            // Отображаем письма
            this.ui.renderEmails(emails, inboxId, this.currentInboxEmail);
            
            // Обработка событий для новых элементов писем
            this.setupEmailEventHandlers();
            
            // Обновляем статистику писем
            this.updateEmailStats();
            
            // Логируем результат
            console.log(`Загружено ${emails.length} писем для ящика ${inboxId}`);
            
            return emails;
        } catch (error) {
            console.error('Ошибка при загрузке писем:', error);
            this.ui.showErrorMessage('emails-list', 'Не удалось загрузить письма', error);
            throw error;
        }
    }
    
    /**
     * Настроить обработчики событий для элементов писем
     */
    setupEmailEventHandlers() {
        // Сначала удаляем предыдущие обработчики, чтобы избежать дублирования
        document.removeEventListener('viewEmail', this.viewEmailHandler);
        document.removeEventListener('deleteEmail', this.deleteEmailHandler);
        
        // Создаем обработчики и сохраняем ссылки на них для возможности удаления
        this.viewEmailHandler = (e) => {
            const { emailId } = e.detail;
            if (emailId) {
                console.log('События просмотра письма:', emailId);
                this.viewEmail(emailId);
            }
        };
        
        this.deleteEmailHandler = (e) => {
            const { emailId } = e.detail;
            if (emailId) {
                console.log('События удаления письма:', emailId);
                this.deleteEmail(emailId);
            }
        };
        
        // Добавляем обработчики без опции once: true
        document.addEventListener('viewEmail', this.viewEmailHandler);
        document.addEventListener('deleteEmail', this.deleteEmailHandler);
    }
    
    /**
     * Просмотреть письмо
     * @param {string} emailId - ID письма
     */
    async viewEmail(emailId) {
        try {
            this.ui.showToast('Загрузка письма...', 'info');
            console.log('Начинаем загрузку письма с ID:', emailId);
            
            // Добавляем проверку, что ID письма действительно передан
            if (!emailId) {
                throw new Error('ID письма не указан или неверный формат');
            }
            
            // Проверяем, что ящик выбран
            if (!this.currentInboxId) {
                console.warn('Текущий ящик не выбран, пытаемся получить письмо напрямую по ID');
            }
            
            try {
                // Получаем письмо по ID
                const email = await this.api.getEmail(this.currentInboxId, emailId);
                
                // Если письмо не найдено в кэше, добавляем его
                if (!this.emails[this.currentInboxId]?.find(e => e.id === emailId)) {
                    if (!this.emails[this.currentInboxId]) {
                        this.emails[this.currentInboxId] = [];
                    }
                    this.emails[this.currentInboxId].push(email);
                    console.log('Письмо добавлено в кэш');
                }
                
                // Показываем письмо в UI
                this.ui.showEmailViewer(email);
                
                // Обновляем счетчик просмотренных писем для статистики
                this.receivedEmails += 1;
                this.updateEmailStats();
                
                // Сбрасываем счетчик непрочитанных писем при просмотре
                this.resetUnreadCount();
                
                // Устанавливаем URL с ID письма для возможности поделиться ссылкой
                if (history.pushState) {
                    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?email=${emailId}`;
                    window.history.pushState({path: newUrl}, '', newUrl);
                }
                
                // Проверяем настройки таймера удаления ящика
                this.checkInboxDeleteTimer();
                
                console.log('Письмо успешно загружено и отображено');
            } catch (apiError) {
                console.error('Ошибка API при загрузке письма:', apiError);
                
                // Попробуем получить письмо из кэша, если есть
                const cachedEmail = this.findEmailById(emailId);
                if (cachedEmail) {
                    console.log('Письмо найдено в кэше, используем его');
                    this.ui.showEmailViewer(cachedEmail);
                    
                    // Показываем уведомление о использовании кэша
                    this.ui.showToast('Используем кэшированную версию письма', 'warning');
                    return;
                }
                
                // Если не удалось найти в кэше, пробрасываем ошибку
                throw apiError;
            }
        } catch (error) {
            console.error('Ошибка при просмотре письма:', error);
            this.ui.showToast(`Ошибка при загрузке письма: ${error.message}`, 'error');
            
            // Предложить пользователю обновить страницу
            setTimeout(() => {
                if (confirm('Произошла ошибка при загрузке письма. Хотите обновить страницу?')) {
                    window.location.reload();
                }
            }, 1000);
        }
    }
    
    /**
     * Найти письмо по ID в кэше
     * @param {string} emailId - ID письма
     * @returns {Object|null} - Найденное письмо или null
     */
    findEmailById(emailId) {
        for (const inboxId in this.emails) {
            const found = this.emails[inboxId].find(email => email.id === emailId);
            if (found) {
                return found;
            }
        }
        return null;
    }
    
    /**
     * Удалить письмо
     * @param {string} emailId - ID письма
     */
    async deleteEmail(emailId) {
        try {
            // В текущем API MailSlurp нет метода для удаления письма,
            // поэтому мы просто удаляем его из кэша
            
            // Находим письмо в кэше
            for (const inboxId in this.emails) {
                const index = this.emails[inboxId].findIndex(email => email.id === emailId);
                if (index !== -1) {
                    // Удаляем из кэша
                    this.emails[inboxId].splice(index, 1);
                    
                    // Обновляем отображение
                    this.ui.renderEmails(this.emails[inboxId], inboxId, this.currentInboxEmail);
                    this.ui.hideEmailViewer();
                    
                    this.ui.showToast('Письмо успешно удалено из списка', 'success');
                    
                    // Обновляем статистику писем
                    this.updateEmailStats();
                    return;
                }
            }
            
            throw new Error('Письмо не найдено');
        } catch (error) {
            console.error('Ошибка при удалении письма:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Отправить письмо
     */
    async sendEmail() {
        try {
            const fromInboxId = this.ui.emailFromSelect.value;
            const to = this.ui.emailToInput.value.trim();
            const subject = this.ui.emailSubjectInput.value.trim();
            const body = this.ui.emailBodyInput.value.trim();
            const format = document.querySelector('input[name="editor-mode"]:checked').value;
            
            if (!fromInboxId) {
                throw new Error('Выберите отправителя');
            }
            
            if (!to) {
                throw new Error('Укажите получателя');
            }
            
            const emailOptions = {
                to: [to],
                subject: subject || '(Без темы)',
                body: body || '(Без содержимого)'
            };
            
            // Добавляем метаданные в тему в зависимости от формата
            if (format === 'markdown') {
                // Префикс [MD] в теме указывает, что тело письма содержит Markdown
                emailOptions.subject = `[MD] ${emailOptions.subject}`;
            } else if (format === 'html') {
                // Если HTML не обёрнут в базовые теги, добавляем их
                if (!/<html|<!DOCTYPE html>/i.test(body)) {
                    emailOptions.body = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        </head>
                        <body>
                            ${body}
                        </body>
                        </html>
                    `;
                }
            }
            
            await this.api.sendEmail(fromInboxId, emailOptions);
            
            this.ui.closeModal(this.ui.sendEmailModal);
            
            // Очищаем поля формы
            this.ui.emailToInput.value = '';
            this.ui.emailSubjectInput.value = '';
            this.ui.emailBodyInput.value = '';
            
            // Увеличиваем счетчик отправленных писем
            this.sentEmails++;
            this.updateEmailStats();
            
            this.ui.showToast(`Письмо успешно отправлено в формате ${format === 'plain' ? 'обычного текста' : format}`, 'success');
            
            // Если отправили из текущего ящика, обновляем список писем
            if (this.currentInboxId === fromInboxId) {
                await this.loadEmails(fromInboxId);
            }
        } catch (error) {
            console.error('Ошибка при отправке письма:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Обновить статистику писем
     */
    updateEmailStats() {
        // Подсчитываем количество писем
        let totalReceived = 0;
        for (const inboxId in this.emails) {
            totalReceived += this.emails[inboxId].length;
        }
        
        // Обновляем счетчик полученных писем
        this.receivedEmails = totalReceived;
        
        // Обновляем UI
        this.ui.updateEmailStats(this.sentEmails, this.receivedEmails);
    }
    
    /**
     * Обновить график использования API
     * @param {Object} accountInfo - Информация об аккаунте
     */
    updateUsageChart(accountInfo) {
        // В реальном приложении здесь можно брать данные из accountInfo
        // Но так как в API MailSlurp нет метода для получения истории использования,
        // мы будем использовать случайные данные
        
        const data = [];
        for (let i = 0; i < 7; i++) {
            data.push(Math.floor(Math.random() * 50));
        }
        
        this.ui.updateChart(data);
    }
    
    /**
     * Инициализировать настройки API ключа и режима
     */
    initApiKeySettings() {
        // Получаем текущий режим API
        const apiMode = this.api.getCurrentApiMode();
        const apiModeToggle = document.getElementById('api-mode-toggle');
        const personalKeyInput = document.getElementById('api-key');
        
        // Устанавливаем состояние переключателя
        apiModeToggle.checked = apiMode.mode === 'personal';
        
        // Подсвечиваем активный режим
        this.highlightActiveApiMode(apiMode.mode === 'personal');
        
        // Устанавливаем значение персонального ключа в поле ввода
        personalKeyInput.value = this.api.getPersonalApiKey() || '';
        
        // Обновляем индикатор статуса
        this.updateApiStatusIndicator(apiMode.connectionStatus);
        
        // Проверяем статус соединения
        this.api.checkConnection();
        
        // Добавляем UI для управления пулом API-ключей
        this.initApiKeyPoolUI();
    }
    
    /**
     * Инициализировать UI для управления пулом API-ключей
     */
    initApiKeyPoolUI() {
        // Находим или создаем контейнер для настроек пула ключей
        let apiPoolContainer = document.getElementById('api-key-pool-container');
        
        if (!apiPoolContainer) {
            // Находим блок с настройками API
            const apiSettingsContainer = document.querySelector('.api-settings');
            
            if (apiSettingsContainer) {
                // Создаем контейнер для пула ключей
                apiPoolContainer = document.createElement('div');
                apiPoolContainer.id = 'api-key-pool-container';
                apiPoolContainer.className = 'settings-section key-pool-section mt-4';
                apiPoolContainer.innerHTML = `
                    <h4>Пул публичных API-ключей</h4>
                    <p class="text-muted small">Добавьте до 5 публичных API-ключей для автоматической ротации при достижении лимитов</p>
                    
                    <div class="key-pool-status mb-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <span>Доступных ключей: <span id="available-keys-count">0/0</span></span>
                            <button id="refresh-key-pool" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-sync-alt"></i> Обновить
                            </button>
                        </div>
                    </div>
                    
                    <div id="key-pool-list" class="mb-3">
                        <!-- Здесь будет список ключей -->
                    </div>
                    
                    <div class="d-flex gap-2">
                        <button id="reset-key-pool" class="btn btn-sm btn-warning">
                            <i class="fas fa-redo"></i> Сбросить счетчики
                        </button>
                        <button id="test-keys" class="btn btn-sm btn-info">
                            <i class="fas fa-check-circle"></i> Проверить ключи
                        </button>
                    </div>
                `;
                
                // Добавляем контейнер в блок настроек
                apiSettingsContainer.appendChild(apiPoolContainer);
                
                // Инициализируем обработчики событий
                document.getElementById('refresh-key-pool').addEventListener('click', () => this.refreshApiKeyPool());
                document.getElementById('reset-key-pool').addEventListener('click', () => this.resetApiKeyPool());
                document.getElementById('test-keys').addEventListener('click', () => this.testApiKeys());
                
                // Загружаем начальное состояние пула ключей
                this.refreshApiKeyPool();
            }
        }
    }
    
    /**
     * Обновить отображение пула API-ключей
     */
    refreshApiKeyPool() {
        try {
            const poolStatus = this.api.getPublicKeyPoolStatus();
            
            if (poolStatus) {
                // Обновляем счетчик доступных ключей
                const availableKeysCount = document.getElementById('available-keys-count');
                if (availableKeysCount) {
                    availableKeysCount.textContent = `${poolStatus.availableKeys}/${poolStatus.totalKeys}`;
                }
                
                // Обновляем список ключей
                const keyPoolList = document.getElementById('key-pool-list');
                if (keyPoolList) {
                    let html = '';
                    
                    poolStatus.allKeys.forEach((keyInfo, index) => {
                        const isExhausted = keyInfo.isExhausted;
                        const statusClass = isExhausted ? 'text-danger' : 'text-success';
                        const statusIcon = isExhausted ? 'fa-times-circle' : 'fa-check-circle';
                        const statusText = isExhausted ? 'Исчерпан' : 'Активен';
                        
                        html += `
                            <div class="key-item mb-2 p-2 border rounded">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="text-truncate small">Ключ #${index + 1}: ${keyInfo.key}</div>
                                        <div class="text-muted smaller">
                                            Использован: ${keyInfo.usageCount} раз • Последнее: ${keyInfo.lastUsed}
                                        </div>
                                    </div>
                                    <div>
                                        <span class="${statusClass}">
                                            <i class="fas ${statusIcon}"></i> ${statusText}
                                        </span>
                                    </div>
                                </div>
                                <div class="mt-2 d-flex gap-1">
                                    <button class="btn btn-sm btn-primary edit-api-key" data-index="${index}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-info test-api-key" data-index="${index}">
                                        <i class="fas fa-vial"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                    
                    keyPoolList.innerHTML = html;
                    
                    // Добавляем обработчики событий для редактирования и тестирования
                    document.querySelectorAll('.edit-api-key').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const index = parseInt(e.currentTarget.dataset.index);
                            this.editApiKeyInPool(index);
                        });
                    });
                    
                    document.querySelectorAll('.test-api-key').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const index = parseInt(e.currentTarget.dataset.index);
                            this.testApiKey(index);
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка при обновлении пула API-ключей:', error);
            this.ui.showToast(`Ошибка обновления пула ключей: ${error.message}`, 'error');
        }
    }
    
    /**
     * Редактировать ключ API в пуле
     * @param {number} index - Индекс ключа в пуле
     */
    editApiKeyInPool(index) {
        // Показываем модальное окно для ввода нового ключа
        const modal = this.ui.showModal(
            'Обновление публичного API ключа',
            `
                <div class="mb-3">
                    <label for="new-api-key" class="form-label">Введите новый API ключ (минимум 32 символа)</label>
                    <input type="text" class="form-control" id="new-api-key" placeholder="Введите ключ API">
                </div>
            `,
            [
                {
                    text: 'Отмена',
                    class: 'btn-secondary',
                    onClick: () => modal.hide()
                },
                {
                    text: 'Сохранить',
                    class: 'btn-primary',
                    onClick: () => {
                        const newKey = document.getElementById('new-api-key').value.trim();
                        if (newKey.length >= 32) {
                            const result = this.api.addPublicApiKey(newKey, index);
                            
                            if (result) {
                                this.ui.showToast(`Ключ API #${index + 1} успешно обновлен`, 'success');
                                this.refreshApiKeyPool();
                            } else {
                                this.ui.showToast('Не удалось обновить ключ API', 'error');
                            }
                            
                            modal.hide();
                        } else {
                            this.ui.showToast('Ключ API должен содержать не менее 32 символов', 'warning');
                        }
                    }
                }
            ]
        );
    }
    
    /**
     * Тестировать конкретный API ключ
     * @param {number} index - Индекс ключа в пуле
     */
    async testApiKey(index) {
        try {
            this.ui.showToast(`Проверка ключа API #${index + 1}...`, 'info');
            
            // Используем функцию тестирования из apiKeyUpdater
            if (window.apiKeyUpdater) {
                const result = await window.apiKeyUpdater.testKey(index);
                
                if (result.success) {
                    this.ui.showToast(`Ключ API #${index + 1} работает корректно!`, 'success');
                } else {
                    this.ui.showToast(`Ключ API #${index + 1} не работает: ${result.error}`, 'error');
                }
            } else {
                this.ui.showToast('Компонент тестирования ключей не инициализирован', 'error');
            }
        } catch (error) {
            console.error('Ошибка при тестировании ключа API:', error);
            this.ui.showToast(`Ошибка тестирования: ${error.message}`, 'error');
        }
    }
    
    /**
     * Протестировать все API ключи в пуле
     */
    async testApiKeys() {
        try {
            const poolStatus = this.api.getPublicKeyPoolStatus();
            
            if (poolStatus) {
                this.ui.showToast('Начата проверка всех API ключей...', 'info');
                
                for (let i = 0; i < poolStatus.totalKeys; i++) {
                    await this.testApiKey(i);
                    // Делаем паузу между запросами, чтобы не перегружать сервер
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('Ошибка при тестировании API ключей:', error);
            this.ui.showToast(`Ошибка тестирования ключей: ${error.message}`, 'error');
        }
    }
    
    /**
     * Сбросить счетчики использования API ключей в пуле
     */
    resetApiKeyPool() {
        try {
            const result = this.api.resetPublicKeyPool();
            
            if (result) {
                this.ui.showToast('Счетчики использования API ключей успешно сброшены', 'success');
                this.refreshApiKeyPool();
            } else {
                this.ui.showToast('Не удалось сбросить счетчики API ключей', 'error');
            }
        } catch (error) {
            console.error('Ошибка при сбросе счетчиков API ключей:', error);
            this.ui.showToast(`Ошибка сброса: ${error.message}`, 'error');
        }
    }
    
    /**
     * Подсветка активного режима API
     * @param {boolean} isPersonal - Флаг персонального режима
     */
    highlightActiveApiMode(isPersonal) {
        const publicOption = document.getElementById('public-api-option');
        const personalOption = document.getElementById('personal-api-option');
        const publicKeyNote = document.getElementById('public-key-note');
        const personalKeyNote = document.getElementById('personal-key-note');
        
        if (isPersonal) {
            publicOption.classList.remove('active');
            personalOption.classList.add('active');
            publicKeyNote.style.display = 'none';
            personalKeyNote.style.display = 'block';
        } else {
            publicOption.classList.add('active');
            personalOption.classList.remove('active');
            publicKeyNote.style.display = 'block';
            personalKeyNote.style.display = 'none';
        }
    }
    
    /**
     * Обновляет индикатор статуса API
     * @param {Object} status - Статус API соединения
     */
    updateApiStatusIndicator(status) {
        const statusDot = document.getElementById('api-status-dot');
        const statusText = document.getElementById('api-status-text');
        
        // Сбрасываем все классы
        statusDot.classList.remove('connected', 'disconnected');
        
        if (status.isConnected) {
            statusDot.classList.add('connected');
            statusText.textContent = `Подключено к ${status.apiType.toUpperCase()} API`;
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = `Ошибка подключения к ${status.apiType.toUpperCase()} API`;
        }
    }
    
    /**
     * Переключение между режимами API
     * @param {boolean} usePersonal - Использовать персональный API
     */
    toggleApiMode(usePersonal) {
        try {
            // Проверяем, есть ли персональный ключ
            if (usePersonal && !this.api.getPersonalApiKey()) {
                alert('Пожалуйста, сначала введите и сохраните ваш персональный API ключ.');
                // Возвращаем переключатель в положение "публичный"
                document.getElementById('api-mode-toggle').checked = false;
                this.highlightActiveApiMode(false);
                return;
            }
            
            // Переключаем режим API
            this.api.switchApiMode(usePersonal);
            
            // Обновляем подсветку активного режима
            this.highlightActiveApiMode(usePersonal);
            
            // Показываем уведомление
            this.ui.showToast(`Переключение на ${usePersonal ? 'персональный' : 'публичный'} API выполнено успешно`, 'success');
            
        } catch (error) {
            console.error('Ошибка при переключении API режима:', error);
            
            // Возвращаем переключатель в предыдущее состояние
            document.getElementById('api-mode-toggle').checked = !usePersonal;
            this.highlightActiveApiMode(!usePersonal);
            
            // Показываем ошибку
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Сброс на публичный API
     */
    resetToPublicApi() {
        try {
            // Переключаемся на публичный API
            this.api.switchApiMode(false);
            
            // Обновляем состояние переключателя
            document.getElementById('api-mode-toggle').checked = false;
            
            // Обновляем подсветку активного режима
            this.highlightActiveApiMode(false);
            
            // Показываем уведомление
            this.ui.showToast('Успешно переключено на публичный API', 'success');
            
        } catch (error) {
            console.error('Ошибка при сбросе на публичный API:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Переключение видимости API ключа
     */
    toggleApiKeyVisibility() {
        const apiKeyInput = document.getElementById('api-key');
        const toggleBtn = document.getElementById('toggle-api-key-visibility');
        const eyeIcon = toggleBtn.querySelector('i');
        
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            eyeIcon.className = 'fas fa-eye-slash';
        } else {
            apiKeyInput.type = 'password';
            eyeIcon.className = 'fas fa-eye';
        }
    }
    
    /**
     * Обновление API ключа
     */
    updateApiKey() {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput.value.trim();
        
            if (!apiKey) {
            this.ui.showToast('Пожалуйста, введите API ключ', 'error');
            return;
        }
        
        try {
            // Сохраняем новый персональный ключ
            this.api.setPersonalApiKey(apiKey);
            
            // Если переключатель в положении "персональный", применяем новый ключ
            if (document.getElementById('api-mode-toggle').checked) {
                this.api.switchApiMode(true);
            }
            
            this.ui.showToast('API ключ успешно обновлен', 'success');
            
        } catch (error) {
            console.error('Ошибка при обновлении API ключа:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Сохранить настройки тайм-аутов
     */
    saveTimeouts() {
        try {
            const emailWaitTimeout = parseInt(this.ui.emailWaitTimeoutInput.value);
            const httpTimeout = parseInt(this.ui.httpTimeoutInput.value);
            
            if (isNaN(emailWaitTimeout) || emailWaitTimeout <= 0) {
                throw new Error('Некорректное значение тайм-аута ожидания письма');
            }
            
            if (isNaN(httpTimeout) || httpTimeout <= 0) {
                throw new Error('Некорректное значение тайм-аута HTTP запроса');
            }
            
            this.api.setEmailWaitTimeout(emailWaitTimeout);
            this.api.setHttpTimeout(httpTimeout);
            
            this.ui.showToast('Настройки тайм-аутов сохранены', 'success');
        } catch (error) {
            console.error('Ошибка при сохранении настроек тайм-аутов:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Сохранить настройки автоматического удаления
     */
    saveAutoDelete() {
        try {
            const autoDeleteInboxes = this.ui.autoDeleteInboxesCheckbox.checked;
            const autoDeleteEmails = this.ui.autoDeleteEmailsCheckbox.checked;
            const autoDeleteDays = parseInt(this.ui.autoDeleteDaysInput.value);
            
            // Получаем значение таймера удаления
            let inboxDeleteTimer = 0;
            this.ui.inboxDeleteTimerRadios.forEach(radio => {
                if (radio.checked) {
                    inboxDeleteTimer = parseInt(radio.value);
                }
            });
            
            if (autoDeleteEmails && (isNaN(autoDeleteDays) || autoDeleteDays <= 0)) {
                throw new Error('Некорректное значение дней для автоудаления писем');
            }
            
            localStorage.setItem('mailslurp_auto_delete_inboxes', autoDeleteInboxes.toString());
            localStorage.setItem('mailslurp_auto_delete_emails', autoDeleteEmails.toString());
            localStorage.setItem('mailslurp_auto_delete_days', autoDeleteDays.toString());
            localStorage.setItem('mailslurp_inbox_delete_timer', inboxDeleteTimer.toString());
            
            this.ui.showToast('Настройки автоудаления сохранены', 'success');
        } catch (error) {
            console.error('Ошибка при сохранении настроек автоудаления:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Сохранить настройки журналирования
     */
    saveLogging() {
        try {
            const enableLogging = this.ui.enableLoggingCheckbox.checked;
            const saveLogToFile = this.ui.saveLogToFileCheckbox.checked;
            const logFilePath = this.ui.logFilePathInput.value.trim();
            
            if (saveLogToFile && !logFilePath) {
                throw new Error('Укажите путь к файлу журнала');
            }
            
            localStorage.setItem('mailslurp_enable_logging', enableLogging.toString());
            localStorage.setItem('mailslurp_save_log_to_file', saveLogToFile.toString());
            localStorage.setItem('mailslurp_log_file_path', logFilePath);
            
            this.ui.showToast('Настройки журналирования сохранены', 'success');
        } catch (error) {
            console.error('Ошибка при сохранении настроек журналирования:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    /**
     * Инициализировать редактор форматирования (Markdown/HTML)
     */
    initMarkdownEditor() {
        // При открытии модального окна отправки письма сбрасываем состояние редактора
        this.ui.sendEmailBtn.addEventListener('click', () => {
            // Устанавливаем режим "Обычный текст" по умолчанию
            const plainRadio = document.querySelector('input[name="editor-mode"][value="plain"]');
            if (plainRadio) {
                plainRadio.checked = true;
                this.ui.updateEditorMode('plain');
            }
            
            // Сбрасываем предпросмотр и справку
            this.ui.closePreview();
            const helpContent = document.getElementById('markdown-help-content');
            if (helpContent) {
                helpContent.classList.add('hidden');
            }
        });
        
        // Инициализируем начальное состояние
        const previewBtn = document.getElementById('preview-markdown-btn');
        const helpElement = document.querySelector('.markdown-help');
        
        if (previewBtn) {
            previewBtn.style.display = 'none';
        }
        
        if (helpElement) {
            helpElement.style.display = 'none';
        }
        
        // Добавляем обработчик для кнопки "Вставить шаблон письма с кнопкой"
        // Добавляем эту кнопку в модальное окно отправки письма
        const modalFooter = document.querySelector('#send-email-modal .modal-footer');
        if (modalFooter) {
            // Создаем новую кнопку и вставляем её перед кнопкой отправки
            const insertTemplateBtn = document.createElement('button');
            insertTemplateBtn.className = 'btn';
            insertTemplateBtn.textContent = 'Вставить шаблон с кнопкой';
            insertTemplateBtn.addEventListener('click', () => this.insertEmailTemplate());
            
            // Вставляем кнопку перед кнопкой отправки
            modalFooter.insertBefore(insertTemplateBtn, document.getElementById('confirm-send-email'));
        }
    }
    
    /**
     * Вставить шаблон письма с кнопкой
     */
    insertEmailTemplate() {
        // Переключаемся на HTML режим
        const htmlRadio = document.querySelector('input[name="editor-mode"][value="html"]');
        if (htmlRadio) {
            htmlRadio.checked = true;
            this.ui.updateEditorMode('html');
        }
        
        // Получаем текущие значения полей
        const subject = this.ui.emailSubjectInput.value.trim() || 'Важное уведомление';
        
        // Вставляем HTML шаблон в поле сообщения
        this.ui.emailBodyInput.value = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            border-top: 5px solid #6a11cb;
            background-color: #2c2c2c;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            background-color: #ffffff;
            padding: 30px 20px;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .button {
            display: inline-block;
            background-color: #6a11cb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
        }
        .footer {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Уведомление</h1>
        </div>
        <div class="content">
            <h2>Здравствуйте!</h2>
            <p>Это пример письма с кнопкой. Вы можете изменить весь текст и стили по своему усмотрению.</p>
            
            <div class="button-container">
                <a href="https://example.com" class="button">Нажмите сюда</a>
            </div>
            
            <p>Если у вас возникли вопросы, пожалуйста, свяжитесь с нами.</p>
            
            <p>С уважением,<br>Ваша команда</p>
        </div>
        <div class="footer">
            <p>© 2023 Ваша компания. Все права защищены.</p>
            <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
        </div>
    </div>
</body>
</html>
`;
        
        // Показываем предпросмотр
        this.ui.togglePreview();
        
        // Показываем уведомление
        this.ui.showToast('Шаблон письма с кнопкой вставлен', 'success');
    }
    
    /**
     * Инициализировать генератор данных
     */
    initDataGenerator() {
        // Находим элементы интерфейса
        const generateDataBtn = document.getElementById('generate-data-btn');
        const generatorModal = document.getElementById('generator-modal');
        const generateNewDataBtn = document.getElementById('generate-new-data-btn');
        const copyAllDataBtn = document.getElementById('copy-all-data-btn');
        
        // Добавляем обработчики событий
        if (generateDataBtn) {
            generateDataBtn.addEventListener('click', () => this.openDataGenerator());
        }
        
        if (generateNewDataBtn) {
            generateNewDataBtn.addEventListener('click', () => this.generateNewData());
        }
        
        if (copyAllDataBtn) {
            copyAllDataBtn.addEventListener('click', () => this.copyAllGeneratedData());
        }
        
        // Добавляем обработчик для закрытия модального окна
        const modalCloseButtons = generatorModal.querySelectorAll('.modal-close');
        modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.ui.closeModal(generatorModal);
                this.clearGeneratorTimer();
            });
        });
        
        // Добавляем обработчики для копирования отдельных полей при клике
        const copyableFields = generatorModal.querySelectorAll('.copyable');
        copyableFields.forEach(field => {
            field.addEventListener('click', (e) => this.copyFieldToClipboard(e.target));
        });
    }
    
    /**
     * Открыть генератор данных
     */
    openDataGenerator() {
        // Генерируем новые данные
        this.generateNewData();
        
        // Открываем модальное окно
        const generatorModal = document.getElementById('generator-modal');
        this.ui.openModal(generatorModal);
    }
    
    /**
     * Генерировать новые данные
     */
    generateNewData() {
        // Очищаем предыдущий таймер
        this.clearGeneratorTimer();
        
        // Генерируем новые данные
        this.generatorData = dataGenerator.generateUserData();
        
        // Заполняем поля в интерфейсе
        document.getElementById('generator-first-name').value = this.generatorData.firstName;
        document.getElementById('generator-last-name').value = this.generatorData.lastName;
        document.getElementById('generator-login').value = this.generatorData.login;
        document.getElementById('generator-password').value = this.generatorData.password;
        
        // Запускаем таймер
        this.startGeneratorTimer(this.generatorData.expiryMinutes * 60);
    }
    
    /**
     * Запустить таймер для сгенерированных данных
     * @param {number} seconds - Количество секунд
     */
    startGeneratorTimer(seconds) {
        const expiryElement = document.getElementById('generator-expiry');
        
        // Функция обновления времени
        const updateTimer = () => {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            expiryElement.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
            
            if (seconds <= 0) {
                this.clearGeneratorTimer();
                this.generateNewData();
                return;
            }
            
            seconds--;
        };
        
        // Сразу обновляем, чтобы показать начальное время
        updateTimer();
        
        // Запускаем интервал
        this.generatorTimer = setInterval(updateTimer, 1000);
    }
    
    /**
     * Очистить таймер генератора
     */
    clearGeneratorTimer() {
        if (this.generatorTimer) {
            clearInterval(this.generatorTimer);
            this.generatorTimer = null;
        }
    }
    
    /**
     * Копировать все сгенерированные данные
     */
    copyAllGeneratedData() {
        if (!this.generatorData) return;
        
        const textToCopy = `Имя: ${this.generatorData.firstName}
Фамилия: ${this.generatorData.lastName}
Логин: ${this.generatorData.login}
Пароль: ${this.generatorData.password}`;
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                this.ui.showToast('Все данные скопированы в буфер обмена', 'success');
            })
            .catch(err => {
                console.error('Ошибка при копировании данных:', err);
                this.ui.showToast('Не удалось скопировать данные', 'error');
            });
    }
    
    /**
     * Копировать значение поля в буфер обмена
     * @param {HTMLElement} field - Поле для копирования
     */
    copyFieldToClipboard(field) {
        if (!field || !field.value) return;
        
        // Выделяем текст в поле
        field.select();
        
        // Копируем в буфер обмена
        navigator.clipboard.writeText(field.value)
            .then(() => {
                // Добавляем анимацию успешного копирования
                field.classList.add('copied-animation');
                
                // Показываем уведомление
                const fieldName = field.previousElementSibling.textContent;
                this.ui.showToast(`${fieldName} скопировано в буфер обмена`, 'success');
                
                // Удаляем класс анимации через 1 секунду
                setTimeout(() => {
                    field.classList.remove('copied-animation');
                }, 1000);
            })
            .catch(err => {
                console.error('Ошибка при копировании данных:', err);
                this.ui.showToast('Не удалось скопировать данные', 'error');
            });
    }
    
    /**
     * Отрисовать список почтовых ящиков с возможностью копирования адресов
     * @param {Array} inboxes - Список почтовых ящиков
     * @param {number} inboxLimit - Лимит почтовых ящиков
     */
    renderInboxes(inboxes, inboxLimit) {
        // Сначала вызываем оригинальный метод UI для отрисовки
        this.ui.renderInboxes(inboxes, inboxLimit);
        
        // Затем добавляем обработчики для копирования адресов
        const emailCells = document.querySelectorAll('.inbox-email-address');
        emailCells.forEach(cell => {
            cell.classList.add('email-address-cell');
            cell.addEventListener('click', (e) => this.copyEmailToClipboard(e.target));
        });
    }
    
    /**
     * Копировать адрес электронной почты в буфер обмена
     * @param {HTMLElement} element - Элемент с адресом
     */
    copyEmailToClipboard(element) {
        if (!element || !element.textContent) return;
        
        const email = element.textContent.trim();
        
        navigator.clipboard.writeText(email)
            .then(() => {
                // Добавляем анимацию успешного копирования
                element.classList.add('copied-animation');
                
                // Показываем уведомление
                this.ui.showToast(`Адрес ${email} скопирован в буфер обмена`, 'success');
                
                // Удаляем класс анимации через 1 секунду
                setTimeout(() => {
                    element.classList.remove('copied-animation');
                }, 1000);
            })
            .catch(err => {
                console.error('Ошибка при копировании адреса:', err);
                this.ui.showToast('Не удалось скопировать адрес', 'error');
            });
    }
    
    /**
     * Генерировать случайный код верификации
     * @param {number} length - Длина кода
     * @param {boolean} numbersOnly - Только цифры
     * @returns {string} - Случайный код
     */
    generateCode(length = 6, numbersOnly = true) {
        return dataGenerator.generateVerificationCode(length, false, numbersOnly);
    }
    
    /**
     * Запустить интервал проверки новых писем
     */
    startEmailCheckInterval() {
        // Очищаем предыдущий интервал, если он был
        if (this.emailCheckInterval) {
            clearInterval(this.emailCheckInterval);
        }
        
        // Проверяем новые письма каждые 30 секунд
        this.emailCheckInterval = setInterval(() => {
            if (this.currentInboxId) {
                this.checkNewEmails();
            }
        }, 30000);
    }
    
    /**
     * Проверить наличие новых писем
     */
    async checkNewEmails() {
        try {
            if (!this.currentInboxId) return;
            
            // Получаем текущие письма
            const response = await this.api.getEmails(this.currentInboxId);
            
            // Проверяем формат ответа
            let emails = [];
            if (response.content && Array.isArray(response.content)) {
                emails = response.content;
            } else if (Array.isArray(response)) {
                emails = response;
            }
            
            // Если в текущем ящике нет кэшированных писем, инициализируем массив
            if (!this.emails[this.currentInboxId]) {
                this.emails[this.currentInboxId] = [];
            }
            
            // Проверяем, есть ли новые письма
            const currentCount = this.emails[this.currentInboxId].length;
            const newCount = emails.length;
            
            if (newCount > currentCount) {
                // Вычисляем количество новых писем
                const newEmailsCount = newCount - currentCount;
                
                // Увеличиваем счетчик непрочитанных писем
                this.unreadEmails += newEmailsCount;
                
                // Обновляем индикатор непрочитанных писем
                this.updateUnreadBadge();
                
                // Показываем уведомление
                this.ui.showToast(`Получено ${newEmailsCount} новых писем!`, 'success');
                
                // Обновляем кэш писем
                this.emails[this.currentInboxId] = emails;
                
                // Обновляем отображение списка писем
                this.ui.renderEmails(emails, this.currentInboxId, this.currentInboxEmail);
                
                // Обновляем статистику писем
                this.updateEmailStats();
            }
        } catch (error) {
            console.error('Ошибка при проверке новых писем:', error);
        }
    }
    
    /**
     * Обновить индикатор непрочитанных писем
     */
    updateUnreadBadge() {
        console.log('Обновление счетчика непрочитанных писем:', this.unreadEmails);
        
        // Находим элемент счетчика
        let badge = document.getElementById('unread-count');
        
        // Если элемент не существует, создаем его
        if (!badge) {
            console.log('Элемент счетчика не найден, создаем новый');
            badge = document.createElement('span');
            badge.id = 'unread-count';
            badge.className = 'badge';
            
            // Находим подходящий контейнер для бейджа
            const navEmailsLink = document.querySelector('a[href="#emails-section"]');
            if (navEmailsLink) {
                navEmailsLink.appendChild(badge);
            } else {
                // Если нет подходящего элемента, добавляем в заголовок
                const emailsTitle = document.querySelector('#emails-section .section-title');
                if (emailsTitle) {
                    emailsTitle.appendChild(badge);
                }
            }
        }
        
        // Обновляем текст и визуальное состояние
        badge.textContent = this.unreadEmails;
        
        if (this.unreadEmails > 0) {
            badge.classList.add('active');
            
            // Обновляем заголовок вкладки, чтобы привлечь внимание пользователя
            document.title = `(${this.unreadEmails}) MailSlurp - Новые письма`;
            
            // Изменяем иконку для привлечения внимания
            const faviconLink = document.querySelector('link[rel="icon"]');
            if (faviconLink) {
                // Сохраняем оригинальную иконку, если еще не сохранили
                if (!this._originalFavicon) {
                    this._originalFavicon = faviconLink.href;
                }
                // Устанавливаем иконку с уведомлением
                faviconLink.href = 'assets/favicon-notification.ico';
            }
        } else {
            badge.classList.remove('active');
            
            // Восстанавливаем оригинальный заголовок
            document.title = 'MailSlurp - Временные Email';
            
            // Восстанавливаем оригинальную иконку
            const faviconLink = document.querySelector('link[rel="icon"]');
            if (faviconLink && this._originalFavicon) {
                faviconLink.href = this._originalFavicon;
            }
        }
        
        console.log('Счетчик непрочитанных писем обновлен');
    }
    
    /**
     * Сбросить счетчик непрочитанных писем
     */
    resetUnreadCount() {
        this.unreadEmails = 0;
        this.updateUnreadBadge();
    }
    
    /**
     * Проверить настройки таймера удаления ящика
     */
    checkInboxDeleteTimer() {
        // Получаем настройки таймера из localStorage
        const inboxDeleteTimer = parseInt(localStorage.getItem('mailslurp_inbox_delete_timer') || '0');
        
        // Если таймер не установлен (0), то ничего не делаем
        if (inboxDeleteTimer <= 0) return;
        
        // Если уже есть активный таймер, очищаем его
        if (this.inboxDeleteTimeout) {
            clearTimeout(this.inboxDeleteTimeout);
            this.inboxDeleteTimeout = null;
        }
        
        // Создаем элемент для отображения таймера
        this.createDeleteTimerElement(inboxDeleteTimer);
        
        // Устанавливаем таймер на удаление ящика
        const minutes = inboxDeleteTimer;
        const milliseconds = minutes * 60 * 1000;
        
        this.inboxDeleteTimeout = setTimeout(() => {
            this.deleteCurrentInbox();
        }, milliseconds);
    }
    
    /**
     * Создать элемент для отображения таймера удаления
     * @param {number} minutes - Количество минут до удаления
     */
    createDeleteTimerElement(minutes) {
        // Удаляем предыдущий элемент таймера, если он есть
        const existingTimer = document.querySelector('.delete-timer');
        if (existingTimer) {
            existingTimer.remove();
        }
        
        // Создаем новый элемент таймера
        const timerElement = document.createElement('div');
        timerElement.className = 'delete-timer';
        
        // Добавляем иконку и текст
        timerElement.innerHTML = `
            <i class="fas fa-clock"></i>
            <span class="delete-timer-text">Ящик будет удален через <span id="delete-timer-countdown">${minutes}:00</span></span>
            <button class="delete-timer-cancel">Отменить</button>
        `;
        
        // Добавляем элемент в DOM
        const emailViewer = document.getElementById('email-viewer');
        emailViewer.appendChild(timerElement);
        
        // Добавляем обработчик для кнопки отмены
        const cancelButton = timerElement.querySelector('.delete-timer-cancel');
        cancelButton.addEventListener('click', () => this.cancelInboxDeletion());
        
        // Запускаем обратный отсчет
        this.startDeleteCountdown(minutes);
    }
    
    /**
     * Запустить обратный отсчет для таймера удаления
     * @param {number} minutes - Количество минут до удаления
     */
    startDeleteCountdown(minutes) {
        let totalSeconds = minutes * 60;
        const countdownElement = document.getElementById('delete-timer-countdown');
        
        // Очищаем предыдущий интервал, если он есть
        if (this.deleteCountdownInterval) {
            clearInterval(this.deleteCountdownInterval);
        }
        
        // Функция обновления времени
        const updateCountdown = () => {
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            
            countdownElement.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            
            if (totalSeconds <= 0) {
                clearInterval(this.deleteCountdownInterval);
                return;
            }
            
            totalSeconds--;
        };
        
        // Сразу обновляем, чтобы показать начальное время
        updateCountdown();
        
        // Запускаем интервал
        this.deleteCountdownInterval = setInterval(updateCountdown, 1000);
    }
    
    /**
     * Отменить удаление ящика
     */
    cancelInboxDeletion() {
        // Очищаем таймер
        if (this.inboxDeleteTimeout) {
            clearTimeout(this.inboxDeleteTimeout);
            this.inboxDeleteTimeout = null;
        }
        
        // Очищаем интервал обратного отсчета
        if (this.deleteCountdownInterval) {
            clearInterval(this.deleteCountdownInterval);
            this.deleteCountdownInterval = null;
        }
        
        // Удаляем элемент таймера
        const timerElement = document.querySelector('.delete-timer');
        if (timerElement) {
            timerElement.remove();
        }
        
        this.ui.showToast('Автоматическое удаление ящика отменено', 'success');
    }
    
    /**
     * Удалить текущий ящик
     */
    deleteCurrentInbox() {
        if (!this.currentInboxId) return;
        
        // Удаляем ящик
        this.deleteInbox(this.currentInboxId)
            .then(() => {
                // Очищаем интервал обратного отсчета
                if (this.deleteCountdownInterval) {
                    clearInterval(this.deleteCountdownInterval);
                    this.deleteCountdownInterval = null;
                }
                
                // Удаляем элемент таймера
                const timerElement = document.querySelector('.delete-timer');
                if (timerElement) {
                    timerElement.remove();
                }
            })
            .catch(error => {
                console.error('Ошибка при автоматическом удалении ящика:', error);
            });
    }
    
    /**
     * Инициализировать настройки таймера удаления
     */
    initDeleteTimerSettings() {
        // Получаем сохраненное значение таймера из localStorage
        const savedTimer = parseInt(localStorage.getItem('mailslurp_inbox_delete_timer') || '0');
        
        // Устанавливаем соответствующую радио-кнопку
        this.ui.inboxDeleteTimerRadios.forEach(radio => {
            if (parseInt(radio.value) === savedTimer) {
                radio.checked = true;
            }
        });
        
        // Инициализируем переменные для таймеров
        this.inboxDeleteTimeout = null;
        this.deleteCountdownInterval = null;
    }
    
    /**
     * Обрабатывает событие автоматического удаления почтового ящика
     * @param {Object} data - Данные удаленного ящика (inboxId, emailAddress)
     */
    async handleAutoDeletedInbox(data) {
        try {
            // Удаляем ящик из локального списка
            if (this.inboxes && Array.isArray(this.inboxes)) {
                this.inboxes = this.inboxes.filter(inbox => inbox.id !== data.inboxId);
                
                // Получаем лимит из localStorage или используем дефолтное значение
                const inboxLimit = parseInt(localStorage.getItem('mailslurp_inbox_limit') || '10');
                
                // Обновляем отображение списка ящиков
                this.renderInboxes(this.inboxes, inboxLimit);
            }
            
            // Показываем уведомление пользователю
            this.ui.showToast(`Почтовый ящик ${data.emailAddress} автоматически удален через 5 минут (публичный API)`, 'warning', 5000);
            
            // Если это был текущий ящик, сбрасываем ID и очищаем localStorage
            if (this.currentInboxId === data.inboxId) {
                this.currentInboxId = null;
                this.currentInboxEmail = null;
                this.emails = {};
                
                // Очищаем данные в localStorage
                localStorage.removeItem('current_inbox_id');
                localStorage.removeItem('current_inbox_email');
                
                // Обновляем UI
                this.ui.emailsList.innerHTML = `
                    <tr class="no-inbox-selected">
                        <td colspan="4">Почтовый ящик был автоматически удален. Создайте новый ящик.</td>
                    </tr>
                `;
                this.ui.currentInboxTitle.textContent = '📧 Письма';
                
                // Если есть элемент с действиями ящика, удаляем его
                const inboxActions = document.getElementById('inbox-actions');
                if (inboxActions) {
                    inboxActions.remove();
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке автоудаления ящика:', error);
        }
    }
    
    /**
     * Проверяет и активирует секретный код
     */
    checkSecretCode() {
        const secretCodeInput = document.getElementById('secret-code');
        const secretCodeSection = document.querySelector('.secret-code-section');
        const code = secretCodeInput.value.trim();
        
        if (!code) {
            this.ui.showToast('Пожалуйста, введите секретный код', 'error');
            return;
        }
        
        // Удаляем классы анимации, если они были
        secretCodeSection.classList.remove('code-activation-success', 'code-activation-error');
        
        // Проверяем код
        const isValid = this.api.checkSecretCode(code);
        
        if (isValid) {
            // Добавляем класс для анимации успешной активации
            secretCodeSection.classList.add('code-activation-success');
            
            // Обновляем статус
            this.updateSecretCodeStatus();
            
            // Показываем уведомление об успехе
            this.ui.showToast('Секретный код активирован! Ваши почтовые ящики не будут автоматически удаляться.', 'success', 6000);
        } else {
            // Добавляем класс для анимации ошибки
            secretCodeSection.classList.add('code-activation-error');
            
            // Показываем уведомление об ошибке
            this.ui.showToast('Неверный секретный код. Пожалуйста, проверьте введенный код и попробуйте снова.', 'error');
        }
    }
    
    /**
     * Обновляет визуальный статус секретного кода
     */
    updateSecretCodeStatus() {
        const codeInactive = document.querySelector('.code-inactive');
        const codeActive = document.querySelector('.code-active');
        const activateBtn = document.getElementById('activate-code-btn');
        
        if (this.api.secretCodeActivated) {
            codeInactive.style.display = 'none';
            codeActive.style.display = 'inline-block';
            
            // Меняем текст кнопки на "Деактивировать"
            activateBtn.innerHTML = '<i class="fas fa-lock"></i> Деактивировать код';
            activateBtn.onclick = () => this.deactivateSecretCode();
        } else {
            codeInactive.style.display = 'inline-block';
            codeActive.style.display = 'none';
            
            // Меняем текст кнопки на "Активировать"
            activateBtn.innerHTML = '<i class="fas fa-unlock"></i> Активировать код';
            activateBtn.onclick = () => this.checkSecretCode();
        }
    }
    
    /**
     * Деактивирует секретный код
     */
    deactivateSecretCode() {
        this.api.deactivateSecretCode();
        this.updateSecretCodeStatus();
        this.ui.showToast('Секретный код деактивирован. Почтовые ящики будут автоматически удаляться через 5 минут при использовании публичного API.', 'warning', 6000);
    }
    
    /**
     * Переключает видимость секретного кода
     */
    toggleSecretCodeVisibility() {
        const secretCodeInput = document.getElementById('secret-code');
        const toggleBtn = document.getElementById('toggle-code-visibility');
        const eyeIcon = toggleBtn.querySelector('i');
        
        if (secretCodeInput.type === 'password') {
            secretCodeInput.type = 'text';
            eyeIcon.className = 'fas fa-eye-slash';
        } else {
            secretCodeInput.type = 'password';
            eyeIcon.className = 'fas fa-eye';
        }
    }
    
    /**
     * Инициализация поддержки интернационализации
     */
    initInternationalization() {
        // Проверяем, загружен ли уже модуль i18n
        if (window.i18n) {
            console.log('Модуль интернационализации инициализирован');
            
            // Инициализируем переводы для ключевых элементов, с которыми взаимодействует пользователь
            this.applyTranslationsToElements();
            
            // Подписываемся на события изменения языка
            document.addEventListener('language-changed', (event) => {
                console.log('Язык изменен на:', event.detail.language);
                
                // Перезагружаем переводы для динамических элементов
                this.applyTranslationsToElements();
                
                // Добавляем класс для анимации элементов при смене языка
                document.querySelectorAll('[data-i18n]').forEach(element => {
                    element.classList.add('lang-changed');
                    
                    // Удаляем класс после завершения анимации
                    setTimeout(() => {
                        element.classList.remove('lang-changed');
                    }, 300);
                });
            });
        } else {
            console.warn('Модуль интернационализации не загружен');
            
            // Пытаемся загрузить модуль
            const script = document.createElement('script');
            script.src = 'js/i18n.js?v=' + Date.now();
            script.onload = () => {
                console.log('Модуль i18n загружен динамически');
                this.initInternationalization();
            };
            script.onerror = (err) => {
                console.error('Ошибка загрузки модуля i18n:', err);
                this.ui.showToast('Не удалось загрузить модуль переводов', 'error');
            };
            document.head.appendChild(script);
        }
    }
    
    /**
     * Применить переводы к ключевым элементам интерфейса
     */
    applyTranslationsToElements() {
        if (!window.i18n) return;
        
        // Обновляем заголовки и тексты в соответствии с текущим языком
        try {
            // Секция почтовых ящиков
            const inboxHeaderEl = document.querySelector('#inboxes-section .section-header h2');
            if (inboxHeaderEl) {
                inboxHeaderEl.textContent = window.i18n.t('inbox_management');
            }
            
            const createInboxBtn = document.querySelector('#create-inbox-btn');
            if (createInboxBtn) {
                const icon = createInboxBtn.querySelector('i').outerHTML;
                createInboxBtn.innerHTML = icon + ' ' + window.i18n.t('create_new_inbox');
            }
            
            // Секция писем
            const emailsHeaderEl = document.querySelector('#current-inbox-title');
            if (emailsHeaderEl) {
                emailsHeaderEl.textContent = window.i18n.t('emails_title');
            }
            
            const sendEmailBtn = document.querySelector('#send-email-btn');
            if (sendEmailBtn) {
                const icon = sendEmailBtn.querySelector('i').outerHTML;
                sendEmailBtn.innerHTML = icon + ' ' + window.i18n.t('emails_send');
            }
            
            // Таблица почтовых ящиков
            const inboxTableHeaders = document.querySelectorAll('#inboxes-table th');
            if (inboxTableHeaders.length >= 4) {
                inboxTableHeaders[0].textContent = window.i18n.t('inbox_id');
                inboxTableHeaders[1].textContent = window.i18n.t('inbox_email');
                inboxTableHeaders[2].textContent = window.i18n.t('inbox_created');
                inboxTableHeaders[3].textContent = window.i18n.t('inbox_actions');
            }
            
            // Таблица писем
            const emailTableHeaders = document.querySelectorAll('#emails-table th');
            if (emailTableHeaders.length >= 4) {
                emailTableHeaders[0].textContent = window.i18n.t('emails_from');
                emailTableHeaders[1].textContent = window.i18n.t('emails_subject');
                emailTableHeaders[2].textContent = window.i18n.t('emails_received');
                emailTableHeaders[3].textContent = window.i18n.t('inbox_actions');
            }
            
            // Модальные окна
            document.querySelectorAll('.modal-header h3').forEach(el => {
                if (el.textContent.includes('Создание')) {
                    el.textContent = window.i18n.t('modal_create_inbox') || 'Создание нового почтового ящика';
                } else if (el.textContent.includes('Отправка')) {
                    el.textContent = window.i18n.t('modal_send_email');
                } else if (el.textContent.includes('Подтверждение')) {
                    el.textContent = window.i18n.t('modal_delete_inbox') || 'Подтверждение удаления';
                }
            });
            
            // Кнопки в модальных окнах
            document.querySelectorAll('.modal-close').forEach(el => {
                if (el.tagName === 'BUTTON' && !el.querySelector('i')) {
                    el.textContent = window.i18n.t('cancel');
                }
            });
            
            document.querySelectorAll('.btn-primary').forEach(el => {
                if (el.id === 'confirm-create-inbox') {
                    el.textContent = window.i18n.t('create');
                } else if (el.id === 'confirm-send-email') {
                    el.textContent = window.i18n.t('send');
                } else if (el.id === 'confirm-delete') {
                    el.textContent = window.i18n.t('delete');
                }
            });
            
            // Информационная панель
            const welcomeTitle = document.querySelector('.info-panel-content h4');
            if (welcomeTitle) {
                welcomeTitle.textContent = window.i18n.t('welcome_title');
            }
            
            console.log('Переводы применены к элементам интерфейса');
        } catch (error) {
            console.error('Ошибка при применении переводов:', error);
        }
    }
    
    /**
     * Инициализация приложения завершена, удаляем прелоадер
     */
    hidePreloader() {
        // Функция больше не нужна, так как прелоадер удален из HTML
        return;
    }

    /**
     * Отформатировать строку отправителя
     * @param {string} sender - Строка с адресом отправителя
     * @returns {string} - Отформатированный отправитель
     */
    formatSender(sender) {
        if (!sender) return 'Неизвестный отправитель';
        
        // Проверяем, содержит ли строка имя и email в формате "Name <email@example.com>"
        const matches = sender.match(/^([^<]+)<([^>]+)>$/);
        if (matches && matches.length >= 3) {
            const name = matches[1].trim();
            const email = matches[2].trim();
            return name || email;
        }
        
        return sender;
    }

    /**
     * Отформатировать дату для отображения
     * @param {string|Date} dateString - Дата в виде строки или объекта Date
     * @returns {string} - Отформатированная дата
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            
            // Проверка на валидность даты
            if (isNaN(date.getTime())) {
                return 'Недавно';
            }
            
            // Определяем, нужно ли показывать полную дату или относительное время
            const now = new Date();
            const diff = now - date;
            const diffMinutes = Math.floor(diff / (1000 * 60));
            const diffHours = Math.floor(diff / (1000 * 60 * 60));
            const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            // Форматируем время
            if (diffMinutes < 1) {
                return 'Только что';
            } else if (diffMinutes < 60) {
                return `${diffMinutes} мин. назад`;
            } else if (diffHours < 24) {
                return `${diffHours} ч. назад`;
            } else if (diffDays < 7) {
                return `${diffDays} дн. назад`;
            } else {
                // Форматируем полную дату
                return date.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {
            console.error('Ошибка форматирования даты:', e);
            return dateString || '';
        }
    }
}

// Инициализация компонентов приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM полностью загружен, инициализируем приложение');
    
    // Инициализируем языковые переключатели
    initLanguageSwitchers();
    
    // Инициализируем рекламные блоки
    initializeAdComponents();
    
    // Инициализируем API клиент
    const mailslurpApi = new MailSlurpApi();
    console.log('👍 API клиент инициализирован');
    
    // Создаем экземпляр UI
    const mailslurpUI = createMailslurpUI();
    console.log('👍 UI компонент инициализирован');
    
    // Создаем экземпляр приложения
    const app = new MailSlurpApp(mailslurpApi, mailslurpUI);
    console.log('👍 Приложение создано');
    
    // Устанавливаем ссылку на приложение в UI
    mailslurpUI.setApp(app);
    
    // Инициализируем приложение
    app.init().then(() => {
        console.log('✅ Приложение полностью инициализировано и готово к работе!');
        
        // Скрываем прелоадер после инициализации
        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) {
                preloader.classList.add('hidden');
                
                // Полностью удаляем прелоадер после завершения анимации
                setTimeout(() => {
                    preloader.remove();
                }, 500);
            }
        }, 800); // Небольшая задержка для эффекта
    }).catch(error => {
        console.error('❌ Ошибка при инициализации приложения:', error);
        // Даже при ошибке скрываем прелоадер
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('hidden');
        }
    });
});

/**
 * Создает и возвращает экземпляр UI
 * @returns {MailSlurpUI} - Экземпляр UI
 */
function createMailslurpUI() {
    console.log('Создание UI компонента...');
    return new MailSlurpUI();
}

/**
 * Инициализация языковых переключателей
 */
function initLanguageSwitchers() {
    try {
        if (window.i18n) {
            console.log('✅ Модуль i18n успешно загружен');
            
            // Устанавливаем правильные классы для кнопок языка
            const currentLang = window.i18n.currentLang || 'ru';
            document.querySelectorAll('.lang-btn').forEach(btn => {
                if (btn.getAttribute('data-lang') === currentLang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Добавляем прямые обработчики событий для кнопок переключения языка
            const ruBtn = document.getElementById('lang-ru');
            const enBtn = document.getElementById('lang-en');
            
            if (ruBtn) {
                ruBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.i18n) {
                        console.log('Переключаем на русский язык');
                        window.i18n.setLanguage('ru');
                    }
                });
            }
            
            if (enBtn) {
                enBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.i18n) {
                        console.log('Переключаем на английский язык');
                        window.i18n.setLanguage('en');
                    }
                });
            }
        } else {
            console.error('❌ Модуль i18n не загружен');
            
            // Попытка динамической загрузки
            const script = document.createElement('script');
            script.src = 'js/i18n.js?v=' + Date.now();
            script.onload = function() {
                console.log('Модуль i18n загружен динамически');
                if (window.i18n) {
                    window.i18n.initEvents();
                }
            };
            document.head.appendChild(script);
        }
    } catch (error) {
        console.error('Ошибка при инициализации языкового переключателя:', error);
    }
}

/**
 * Инициализация и управление рекламными блоками
 */
function initializeAdComponents() {
    console.log('Initializing ad components');
    
    // Восстанавливаем прокрутку для основного контента
    const appContent = document.querySelector('.app-content');
    if (appContent) {
        // Убеждаемся, что контент имеет прокрутку
        appContent.style.overflowY = 'auto';
        
        // Обработчик для фиксации максимальной высоты контента
        function updateContentHeight() {
            const headerHeight = document.querySelector('.app-header')?.offsetHeight || 0;
            const navHeight = document.querySelector('.app-nav')?.offsetHeight || 0;
            const langSwitcherHeight = document.querySelector('.language-switcher')?.offsetHeight || 0;
            
            const totalHeaderHeight = headerHeight + navHeight + langSwitcherHeight;
            appContent.style.maxHeight = `calc(100vh - ${totalHeaderHeight + 20}px)`;
            
            // Форсируем перерисовку для фиксации скролла
            appContent.style.display = 'none';
            setTimeout(() => {
                appContent.style.display = '';
            }, 0);
        }
        
        // Обновляем высоту при загрузке и изменении размера
        updateContentHeight();
        window.addEventListener('resize', updateContentHeight);
    }
    
    // Исправляем работу навигационных элементов
    fixNavigationItems();
    
    // Функционал для рекламных блоков по бокам
    const adButtons = document.querySelectorAll('.ad-unit .btn');
    adButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const adUnit = e.target.closest('.ad-unit');
            const adTitle = adUnit ? adUnit.querySelector('h3').textContent : 'Unknown';
            console.log(`Ad clicked: ${adTitle}`);
            
            // Здесь можно добавить логику для аналитики кликов по рекламе
            if (typeof gtag === 'function') {
                gtag('event', 'ad_click', {
                    'ad_title': adTitle,
                    'click_type': 'button'
                });
            }
            
            // Пример переадресации в зависимости от заголовка рекламы
            if (adTitle === 'Премиум-доступ') {
                document.querySelector('[data-target="premium-section"]').click();
            } else if (adTitle === 'VPN-сервис') {
                window.open('https://example.com/vpn', '_blank');
            } else if (adTitle === 'NeuroMail Pro') {
                document.querySelector('[data-target="premium-section"]').click();
            } else if (adTitle === 'Защита Данных') {
                window.open('https://example.com/security', '_blank');
            }
        });
    });
    
    // Мобильный баннер
    const mobileAdBanner = document.querySelector('.mobile-ad-banner');
    if (mobileAdBanner) {
        const mobileAdClose = document.querySelector('.mobile-ad-close');
        const mobileAdButton = document.querySelector('.mobile-ad-banner .btn');
        
        // Показываем мобильный баннер только на мобильных устройствах
        if (window.innerWidth <= 1000) {
            setTimeout(() => {
                mobileAdBanner.style.display = 'block';
            }, 3000); // Показываем баннер через 3 секунды после загрузки
        }
        
        if (mobileAdClose) {
            mobileAdClose.addEventListener('click', () => {
                mobileAdBanner.style.display = 'none';
                if (appContent) {
                    appContent.style.paddingBottom = '0';
                }
                
                // Сохраняем в localStorage информацию о том, что баннер был закрыт
                localStorage.setItem('mobile_ad_closed', Date.now());
            });
        }
        
        if (mobileAdButton) {
            mobileAdButton.addEventListener('click', () => {
                window.open('https://example.com/vpn', '_blank');
                
                // Аналитика
                if (typeof gtag === 'function') {
                    gtag('event', 'ad_click', {
                        'ad_title': 'Mobile VPN Banner',
                        'click_type': 'button'
                    });
                }
            });
        }
        
        // Проверяем, был ли баннер закрыт недавно
        const lastClosed = localStorage.getItem('mobile_ad_closed');
        if (lastClosed) {
            const hoursElapsed = (Date.now() - parseInt(lastClosed)) / (1000 * 60 * 60);
            if (hoursElapsed < 24) { // Не показываем баннер, если он был закрыт менее 24 часов назад
                mobileAdBanner.style.display = 'none';
            }
        }
    }
    
    // Адаптивное поведение рекламных блоков
    window.addEventListener('resize', handleAdResponsiveness);
    handleAdResponsiveness();
    
    // Исправляем возможные проблемы с блоком приложения
    fixAppContainer();
}

/**
 * Исправления для навигационных элементов
 */
function fixNavigationItems() {
    // Исправляем подход к улучшению навигации - вместо клонирования будем модифицировать существующие элементы
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        // Улучшаем стили для абсолютной уверенности
        item.style.display = 'flex';
        item.style.opacity = '1';
        item.style.visibility = 'visible';
        item.style.pointerEvents = 'auto';
        item.style.cursor = 'pointer';
        item.style.position = 'relative';
        item.style.zIndex = '20';
        
        // Убеждаемся, что тексты отображаются
        const textSpan = item.querySelector('span');
        if (textSpan) {
            textSpan.style.display = 'inline-block';
            textSpan.style.opacity = '1';
            textSpan.style.visibility = 'visible';
            textSpan.style.pointerEvents = 'none';
        }
        
        // Очищаем существующие события и добавляем новый обработчик
        const newItem = item.cloneNode(true);
        newItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const target = this.getAttribute('data-target');
            if (target) {
                // Делаем все секции неактивными
                document.querySelectorAll('.content-section').forEach(section => {
                    section.classList.remove('active');
                });
                
                // Активируем целевую секцию
                const targetSection = document.getElementById(target);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                // Обновляем активный класс в навигации
                document.querySelectorAll('.nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                this.classList.add('active');
                
                console.log(`Navigated to: ${target}`);
            }
        });
        
        // Безопасно заменяем элемент
        if (item.parentNode) {
            item.parentNode.replaceChild(newItem, item);
        }
    });
    
    // Делаем навигацию прокручиваемой
    const appNav = document.querySelector('.app-nav');
    if (appNav) {
        appNav.style.overflowX = 'auto';
        appNav.style.webkitOverflowScrolling = 'touch';
        appNav.style.justifyContent = 'flex-start';
    }
}

/**
 * Исправления для контейнера приложения
 */
function fixAppContainer() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        // Гарантируем правильное отображение и скролл
        appContainer.style.overflow = 'visible';
        appContainer.style.position = 'relative';
        appContainer.style.zIndex = '5';
        
        // Принудительно обновляем DOM для перерисовки
        const display = appContainer.style.display;
        appContainer.style.display = 'none';
        setTimeout(() => {
            appContainer.style.display = display || 'grid';
        }, 0);
    }
}

/**
 * Адаптивное поведение рекламных блоков в зависимости от размера экрана
 */
function handleAdResponsiveness() {
    const adLeft = document.querySelector('.ad-left');
    const adRight = document.querySelector('.ad-right');
    const mobileAdBanner = document.querySelector('.mobile-ad-banner');
    const appContent = document.querySelector('.app-content');
    
    if (window.innerWidth <= 1000) {
        // Для мобильных устройств
        if (adLeft) adLeft.style.display = 'none';
        if (adRight) adRight.style.display = 'none';
        
        // Показываем мобильный баннер если он не был закрыт недавно
        if (mobileAdBanner) {
            const lastClosed = localStorage.getItem('mobile_ad_closed');
            if (!lastClosed || (Date.now() - parseInt(lastClosed)) / (1000 * 60 * 60) >= 24) {
                mobileAdBanner.style.display = 'block';
                if (appContent) {
                    appContent.style.paddingBottom = '80px';
                }
            }
        }
        
        // Особая обработка для маленьких экранов
        if (window.innerWidth <= 768) {
            // Убеждаемся, что навигация имеет горизонтальную прокрутку
            const appNav = document.querySelector('.app-nav');
            if (appNav) {
                appNav.style.overflowX = 'auto';
                appNav.style.justifyContent = 'flex-start';
                
                // Убеждаемся, что все элементы навигации видны
                const navItems = document.querySelectorAll('.nav-item');
                navItems.forEach(item => {
                    item.style.flexShrink = '0';
                    item.style.minWidth = 'auto';
                });
            }
        }
    } else {
        // Для десктопных устройств
        if (adLeft) adLeft.style.display = 'flex';
        if (adRight) adRight.style.display = 'flex';
        
        // Скрываем мобильный баннер
        if (mobileAdBanner) {
            mobileAdBanner.style.display = 'none';
            if (appContent) {
                appContent.style.paddingBottom = '0';
            }
        }
    }
    
    // Обновляем максимальную высоту контента
    if (appContent) {
        const headerHeight = document.querySelector('.app-header')?.offsetHeight || 0;
        const navHeight = document.querySelector('.app-nav')?.offsetHeight || 0;
        const langSwitcherHeight = document.querySelector('.language-switcher')?.offsetHeight || 0;
        
        const totalHeaderHeight = headerHeight + navHeight + langSwitcherHeight;
        appContent.style.maxHeight = `calc(100vh - ${totalHeaderHeight + 20}px)`;
        
        // Включаем скролл
        appContent.style.overflowY = 'auto';
    }
    
    // Глобальный фикс для кликабельности
    document.querySelectorAll('.clickable-element, button, .btn, [role="button"]').forEach(el => {
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.style.zIndex = '50';
    });
} 