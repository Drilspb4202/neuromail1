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
            
            // Скрываем прелоадер после полной инициализации
            setTimeout(() => {
                const preloader = document.querySelector('.preloader');
                if (preloader) {
                    preloader.classList.add('hidden');
                }
            }, 800);
            
            console.log('Инициализация приложения завершена');
            return Promise.resolve();
        } catch (error) {
            console.error('Ошибка при инициализации приложения:', error);
            
            // Скрываем прелоадер даже при ошибке
            const preloader = document.querySelector('.preloader');
            if (preloader) {
                preloader.classList.add('hidden');
            }
            
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
        // Проверяем, не идет ли уже процесс создания
        if (this.isCreatingInbox) {
            return;
        }

        try {
            this.isCreatingInbox = true;
            
            // Блокируем кнопку
            const confirmBtn = document.getElementById('confirm-create-inbox');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
            
            // Создаем пустой объект опций - без названия и описания
            const options = {};
            
            // Создаем новый ящик
            const newInbox = await this.api.createInbox(options);
            
            this.ui.closeModal(this.ui.createInboxModal);
            
            // Показываем информацию о времени жизни ящика при публичном API
            const isPublicApi = !this.api.usePersonalApi;
            this.showInboxLifetimeInfo(isPublicApi);
            
            // Сохраняем ID и Email нового ящика в localStorage
            this.currentInboxId = newInbox.id;
            this.currentInboxEmail = newInbox.emailAddress;
            localStorage.setItem('current_inbox_id', newInbox.id);
            localStorage.setItem('current_inbox_email', newInbox.emailAddress);
            
            // Добавляем новый ящик в список и обновляем отображение
            if (this.inboxes && Array.isArray(this.inboxes)) {
                this.inboxes.unshift(newInbox); // Добавляем в начало списка
                
                // Получаем лимит из localStorage или используем дефолтное значение
                const inboxLimit = parseInt(localStorage.getItem('mailslurp_inbox_limit') || '10');
                
                // Обновляем отображение
                this.renderInboxes(this.inboxes, inboxLimit);
                
                // Загружаем письма для нового ящика
                this.loadEmails(newInbox.id);
            } else {
                // Если список еще не загружен, загружаем его полностью
                await this.loadInboxes();
                
                // Загружаем письма для нового ящика
                this.loadEmails(newInbox.id);
            }
            
            this.ui.showToast('Почтовый ящик успешно создан', 'success');
        } catch (error) {
            console.error('Ошибка при создании почтового ящика:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
        } finally {
            // Восстанавливаем кнопку и снимаем флаг
            this.isCreatingInbox = false;
            const confirmBtn = document.getElementById('confirm-create-inbox');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Создать';
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
     * Загрузить письма для выбранного ящика
     * @param {string} inboxId - ID почтового ящика
     */
    async loadEmails(inboxId) {
        try {
            this.ui.showEmailsLoading();
            
            // Находим информацию о ящике
            const inbox = this.inboxes.find(inbox => inbox.id === inboxId);
            if (!inbox) {
                // Если ящик не найден в локальном списке, попробуем запросить его напрямую с сервера
                try {
                    const inboxData = await this.api.getInbox(inboxId);
                    if (inboxData && inboxData.id) {
                        // Успешно получили ящик - продолжаем загрузку писем
                        this.currentInboxId = inboxId;
                        this.currentInboxEmail = inboxData.emailAddress;
                        localStorage.setItem('current_inbox_id', inboxId);
                        localStorage.setItem('current_inbox_email', inboxData.emailAddress);
                        
                        // Продолжаем загрузку писем для найденного ящика
                        const emails = await this.api.getEmails(inboxId);
                        this.emails[inboxId] = emails;
                        this.ui.renderEmails(emails);
                        this.resetUnreadCount();
                        this.checkInboxDeleteTimer();
                        
                        // Обновляем заголовок
                        this.ui.currentInboxTitle.textContent = `📧 Письма (${inboxData.emailAddress})`;
                        this.ui.showInboxActions(inboxData);
                        
                        return;
                    }
                } catch (innerError) {
                    console.error('Ящик не найден на сервере:', innerError);
                    // Ящик не существует на сервере - очищаем данные
                    localStorage.removeItem('current_inbox_id');
                    localStorage.removeItem('current_inbox_email');
                    this.currentInboxId = null;
                    this.currentInboxEmail = null;
                    
                    // Показываем сообщение об ошибке
                    this.ui.hideEmailsLoading();
                    this.ui.emailsList.innerHTML = `
                        <tr class="no-inbox-selected">
                            <td colspan="4">Выбранный почтовый ящик не найден или был удален автоматически</td>
                        </tr>
                    `;
                    this.ui.currentInboxTitle.textContent = '📧 Письма';
                    
                    this.ui.showToast('Почтовый ящик не найден. Возможно, он был автоматически удален или срок его жизни истек.', 'error');
                    
                    // Обновляем список ящиков
                    this.loadInboxes();
                    
                    return; 
                }
                
                throw new Error('Почтовый ящик не найден');
            }
            
            // Сохраняем ID и email текущего ящика
            this.currentInboxId = inboxId;
            this.currentInboxEmail = inbox.emailAddress;
            
            // Сохраняем ID и email текущего ящика в localStorage
            localStorage.setItem('current_inbox_id', inboxId);
            localStorage.setItem('current_inbox_email', inbox.emailAddress);
            
            // Обновляем заголовок и адрес текущего ящика
            this.ui.currentInboxTitle.textContent = `📧 Письма (${inbox.emailAddress})`;
            
            // Показываем информацию о ящике и доступных действиях
            this.ui.showInboxActions(inbox);
            
            // Загружаем письма для ящика
            const emails = await this.api.getEmails(inboxId);
            
            // Сохраняем письма в кэш
            this.emails[inboxId] = emails;
            
            // Отображаем письма
            this.ui.renderEmails(emails);
            
            // Сбрасываем счетчик непрочитанных писем
            this.resetUnreadCount();
            
            // Проверяем и обновляем таймер удаления ящика при необходимости
            this.checkInboxDeleteTimer();
        } catch (error) {
            console.error('Ошибка при загрузке писем:', error);
            this.ui.showToast(`Ошибка: ${error.message}`, 'error');
            this.ui.hideEmailsLoading();
        }
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
}

// Инициализация компонентов приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM полностью загружен, инициализируем приложение');
    
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