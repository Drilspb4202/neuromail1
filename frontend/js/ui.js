/**
 * Интерфейс для работы с UI элементами
 */
class MailSlurpUI {
    constructor(app = null) {
        // Приложение может быть передано позже через setApp
        this.app = app;
        
        // Навигация
        this.navItems = document.querySelectorAll('.nav-item');
        this.contentSections = document.querySelectorAll('.content-section');
        
        // Секция почтовых ящиков
        this.inboxesList = document.getElementById('inboxes-list');
        this.createInboxBtn = document.getElementById('create-inbox-btn');
        this.totalInboxesEl = document.getElementById('total-inboxes');
        this.statsInboxesEl = document.getElementById('stats-total-inboxes');
        
        // Секция писем
        this.emailsList = document.getElementById('emails-list');
        this.currentInboxTitle = document.getElementById('current-inbox-title');
        this.sendEmailBtn = document.getElementById('send-email-btn');
        this.emailViewer = document.getElementById('email-viewer');
        this.emailFrom = document.getElementById('email-from');
        this.emailTo = document.getElementById('email-to');
        this.emailSubject = document.getElementById('email-subject');
        this.emailDate = document.getElementById('email-date');
        this.emailBody = document.getElementById('email-body');
        this.closeEmailBtn = document.getElementById('close-email-btn');
        
        // Секция статистики
        this.apiRequestsEl = document.getElementById('api-requests');
        this.statsApiRequestsEl = document.getElementById('stats-api-requests');
        this.statsSentEmailsEl = document.getElementById('stats-sent-emails');
        this.statsReceivedEmailsEl = document.getElementById('stats-received-emails');
        
        // Модальные окна
        this.createInboxModal = document.getElementById('create-inbox-modal');
        this.confirmCreateInboxBtn = document.getElementById('confirm-create-inbox');
        
        this.sendEmailModal = document.getElementById('send-email-modal');
        this.emailFromSelect = document.getElementById('email-from-select');
        this.emailToInput = document.getElementById('email-to');
        this.emailSubjectInput = document.getElementById('email-subject-input');
        this.emailBodyInput = document.getElementById('email-body-input');
        this.confirmSendEmailBtn = document.getElementById('confirm-send-email');
        
        this.deleteConfirmModal = document.getElementById('delete-confirm-modal');
        this.deleteConfirmText = document.getElementById('delete-confirm-text');
        this.confirmDeleteBtn = document.getElementById('confirm-delete');
        
        // Кнопки закрытия модальных окон
        this.modalCloseButtons = document.querySelectorAll('.modal-close');
        
        // Настройки
        this.apiKeyInput = document.getElementById('api-key');
        this.updateApiKeyBtn = document.getElementById('update-api-key-btn');
        this.emailWaitTimeoutInput = document.getElementById('email-wait-timeout');
        this.httpTimeoutInput = document.getElementById('http-timeout');
        this.saveTimeoutsBtn = document.getElementById('save-timeouts-btn');
        this.autoDeleteInboxesCheckbox = document.getElementById('auto-delete-inboxes');
        this.autoDeleteEmailsCheckbox = document.getElementById('auto-delete-emails');
        this.autoDeleteDaysInput = document.getElementById('auto-delete-days');
        this.inboxDeleteTimerRadios = document.querySelectorAll('input[name="inbox-delete-timer"]');
        this.saveAutoDeleteBtn = document.getElementById('save-auto-delete-btn');
        this.enableLoggingCheckbox = document.getElementById('enable-logging');
        this.saveLogToFileCheckbox = document.getElementById('save-log-to-file');
        this.logFilePathInput = document.getElementById('log-file-path');
        this.saveLoggingBtn = document.getElementById('save-logging-btn');
        
        // Другие элементы
        this.refreshBtn = document.getElementById('refresh-btn');
        this.toast = document.getElementById('toast');
        
        // Инициализация графика
        this.apiUsageChart = null;
        this.initChart();
        
        // Привязываем обработчики событий
        this.setupEventListeners();
        
        // Конфигурация Markdown парсера
        this.setupMarkdownParser();
        
        // Инициализация API-ключей перенесена в метод setApp
        // this.initApiKeyUI();
        
        this.markdownPreviewContent = document.querySelector('.markdown-preview-content');
        this.toggleMarkdownHelpBtn = document.getElementById('toggle-markdown-help');
        this.markdownHelpContent = document.getElementById('markdown-help-content');
        
        // Обработчики для помощи по форматированию
        this.formatTabs = document.querySelectorAll('.format-tab');
        this.formatContents = document.querySelectorAll('.format-content');
        
        // Инициализируем UI компоненты
        this.init();
        
        // Конфигурация Markdown парсера
        this.setupMarkdownParser();
    }
    
    /**
     * Настроить обработчики событий
     */
    setupEventListeners() {
        // Навигация
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.activateTab(item.dataset.target);
            });
        });
        
        // Закрытие модальных окон
        this.modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });
        
        // Обработчики кнопок
        this.createInboxBtn.addEventListener('click', () => this.openModal(this.createInboxModal));
        this.sendEmailBtn.addEventListener('click', () => this.openModal(this.sendEmailModal));
        this.closeEmailBtn.addEventListener('click', () => this.hideEmailViewer());
        
        // Добавляем обработчик для кнопки подтверждения создания ящика
        this.confirmCreateInboxBtn.addEventListener('click', () => {
            if(this.app) {
                this.app.createInbox();
            } else {
                console.error('App не инициализирован для создания ящика');
            }
        });
        
        // Обработчики настроек
        this.updateApiKeyBtn.addEventListener('click', () => this.onUpdateApiKey());
        this.saveTimeoutsBtn.addEventListener('click', () => this.onSaveTimeouts());
        this.saveAutoDeleteBtn.addEventListener('click', () => this.onSaveAutoDelete());
        this.saveLoggingBtn.addEventListener('click', () => this.onSaveLogging());
        
        // Обработчики для кошелька USDT
        const showWalletBtn = document.getElementById('show-usdt-wallet');
        if (showWalletBtn) {
            showWalletBtn.addEventListener('click', () => {
                const walletModal = document.getElementById('wallet-modal');
                this.openModal(walletModal);
            });
        }
        
        const copyWalletBtn = document.getElementById('copy-wallet-address');
        if (copyWalletBtn) {
            copyWalletBtn.addEventListener('click', () => {
                const walletAddress = document.getElementById('wallet-address-text').textContent;
                this.copyToClipboard(walletAddress);
                this.showToast('Адрес кошелька скопирован в буфер обмена', 'success');
            });
        }
        
        const copyWalletIconBtn = document.querySelector('.copy-wallet-btn');
        if (copyWalletIconBtn) {
            copyWalletIconBtn.addEventListener('click', () => {
                const walletAddress = document.getElementById('wallet-address-text').textContent;
                this.copyToClipboard(walletAddress);
                this.showToast('Адрес кошелька скопирован в буфер обмена', 'success');
            });
        }
        
        // Обработчик для кнопки пожертвования
        const donateBtn = document.getElementById('donate-btn');
        if (donateBtn) {
            donateBtn.addEventListener('click', () => {
                const walletModal = document.getElementById('wallet-modal');
                this.openModal(walletModal);
            });
        }
        
        // Обработчики для Markdown
        const previewBtn = document.getElementById('preview-markdown-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.togglePreview());
        }
        
        const toggleHelpBtn = document.getElementById('toggle-markdown-help');
        if (toggleHelpBtn) {
            toggleHelpBtn.addEventListener('click', () => this.toggleFormatHelp());
        }
        
        const closePreviewBtn = document.querySelector('.close-preview-btn');
        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', () => this.closePreview());
        }
        
        // Вкладки форматирования
        const formatTabs = document.querySelectorAll('.format-tab');
        formatTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchFormatTab(tab.dataset.tab);
            });
        });
        
        // Радиокнопки для переключения режима редактора
        const editorModeRadios = document.querySelectorAll('input[name="editor-mode"]');
        editorModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateEditorMode(radio.value);
            });
        });
    }
    
    /**
     * Установить экземпляр приложения
     * @param {Object} app - Экземпляр приложения
     */
    setApp(app) {
        this.app = app;
        
        // Теперь когда у нас есть app, можно инициализировать компоненты, зависящие от него
        if (this.apiKeyStatusBadge && this.apiKeyPlanElement) {
            this.initApiKeyUI();
        }
    }
    
    /**
     * Активировать вкладку
     * @param {string} tabId - ID вкладки для активации
     */
    activateTab(tabId) {
        // Деактивируем все вкладки
        this.navItems.forEach(item => item.classList.remove('active'));
        this.contentSections.forEach(section => section.classList.remove('active'));
        
        // Активируем выбранную вкладку
        document.querySelector(`.nav-item[data-target="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }
    
    /**
     * Открыть модальное окно
     * @param {HTMLElement} modal - Модальное окно
     */
    openModal(modal) {
        modal.classList.add('active');
    }
    
    /**
     * Закрыть модальное окно
     * @param {HTMLElement} modal - Модальное окно
     */
    closeModal(modal) {
        modal.classList.remove('active');
    }
    
    /**
     * Отобразить загрузку в списке почтовых ящиков
     */
    showInboxesLoading() {
        this.inboxesList.innerHTML = `
            <tr class="loading-placeholder">
                <td colspan="4">Загрузка почтовых ящиков...</td>
            </tr>
        `;
    }
    
    /**
     * Отобразить список почтовых ящиков
     * @param {Array} inboxes - Список почтовых ящиков
     * @param {number} totalLimit - Общий лимит ящиков
     */
    renderInboxes(inboxes, totalLimit) {
        console.log('Отрисовка списка ящиков:', inboxes);
        
        if (!inboxes || inboxes.length === 0) {
            this.inboxesList.innerHTML = `
                <tr class="loading-placeholder">
                    <td colspan="4">Почтовых ящиков не найдено</td>
                </tr>
            `;
            return;
        }
        
        // Обновляем статистику
        this.updateInboxStats(inboxes.length, totalLimit);
        
        // Очищаем и заполняем выпадающий список отправителей
        this.emailFromSelect.innerHTML = '';
        
        let html = '';
        inboxes.forEach(inbox => {
            const createdDate = new Date(inbox.createdAt);
            const formattedDate = `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}`;
            const inboxName = inbox.name ? 
                `<span class="inbox-name">${inbox.name}</span>` : 
                '<span class="inbox-no-name">(Без имени)</span>';
            
            html += `
                <tr data-inbox-id="${inbox.id}">
                    <td title="${inbox.id}">${inbox.id.substr(0, 8)}...
                        <div class="inbox-details">${inboxName}</div>
                    </td>
                    <td class="inbox-email-address">${inbox.emailAddress}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn btn-icon view-emails-btn" title="Просмотреть письма">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="btn btn-icon copy-email-btn" title="Копировать email">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-icon delete-inbox-btn" title="Удалить ящик">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            
            // Добавляем в выпадающий список
            const option = document.createElement('option');
            option.value = inbox.id;
            option.textContent = inbox.emailAddress;
            this.emailFromSelect.appendChild(option);
        });
        
        this.inboxesList.innerHTML = html;
        
        // Добавляем обработчики событий для кнопок
        this.addInboxActionHandlers();
    }
    
    /**
     * Добавить обработчики событий для кнопок в списке ящиков
     */
    addInboxActionHandlers() {
        const viewEmailsBtns = document.querySelectorAll('.view-emails-btn');
        const copyEmailBtns = document.querySelectorAll('.copy-email-btn');
        const deleteInboxBtns = document.querySelectorAll('.delete-inbox-btn');
        
        viewEmailsBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inboxId = e.target.closest('tr').dataset.inboxId;
                // Сначала активируем вкладку с письмами
                this.activateTab('emails-section');
                // Затем вызываем обработчик для загрузки писем
                this.onViewEmails(inboxId);
            });
        });
        
        copyEmailBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const emailAddress = e.target.closest('tr').cells[1].textContent;
                this.copyToClipboard(emailAddress);
            });
        });
        
        deleteInboxBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inboxId = e.target.closest('tr').dataset.inboxId;
                const emailAddress = e.target.closest('tr').cells[1].textContent;
                this.confirmDeleteInbox(inboxId, emailAddress);
            });
        });
    }
    
    /**
     * Обновить статистику почтовых ящиков
     * @param {number} count - Количество ящиков
     * @param {number} limit - Лимит ящиков
     */
    updateInboxStats(count, limit) {
        const percentage = limit ? Math.round((count / limit) * 100) : 0;
        
        this.totalInboxesEl.textContent = `${count}/${limit}`;
        this.statsInboxesEl.textContent = `${count}/${limit}`;
        
        document.querySelector('#inboxes-section .stat-card:first-child .progress').style.width = `${percentage}%`;
        document.querySelector('#stats-section .stat-card:first-child .progress').style.width = `${percentage}%`;
    }
    
    /**
     * Обновить статистику API запросов
     * @param {number} count - Количество запросов
     * @param {number} limit - Лимит запросов
     */
    updateApiRequestsStats(count, limit) {
        const percentage = limit ? Math.round((count / limit) * 100) : 0;
        
        this.apiRequestsEl.textContent = `${count}/${limit}`;
        this.statsApiRequestsEl.textContent = `${count}/${limit}`;
        
        document.querySelector('#inboxes-section .stat-card:last-child .progress').style.width = `${percentage}%`;
        document.querySelector('#stats-section .stat-card:nth-child(2) .progress').style.width = `${percentage}%`;
    }
    
    /**
     * Обновить статистику писем
     * @param {number} sent - Количество отправленных писем
     * @param {number} received - Количество полученных писем
     */
    updateEmailStats(sent, received) {
        this.statsSentEmailsEl.textContent = sent;
        this.statsReceivedEmailsEl.textContent = received;
    }
    
    /**
     * Отобразить загрузку в списке писем
     */
    showEmailsLoading() {
        this.emailsList.innerHTML = `
            <tr class="loading-placeholder">
                <td colspan="4">Загрузка писем...</td>
            </tr>
        `;
    }
    
    /**
     * Отрисовать список писем
     * @param {Array} emails - Массив писем
     * @param {string} inboxId - ID текущего почтового ящика
     * @param {string} inboxEmail - Email адрес ящика
     */
    renderEmails(emails, inboxId, inboxEmail) {
        const emailsList = document.getElementById('emails-list');
        
        if (!emailsList) {
            console.error('Не найден элемент для отображения списка писем');
            return;
        }
        
        // Очищаем содержимое
        emailsList.innerHTML = '';
        
        // Обновляем заголовок с текущим ящиком
        const inboxTitle = document.getElementById('current-inbox-title');
        if (inboxTitle) {
            inboxTitle.innerHTML = `📧 Письма - <span class="current-inbox-email">${inboxEmail || ''}</span>`;
        }
        
        // Если писем нет, показываем соответствующее сообщение
        if (!emails || emails.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-inbox';
            
            const td = document.createElement('td');
            td.setAttribute('colspan', '4');
            td.textContent = 'В этом ящике пока нет писем';
            td.setAttribute('data-i18n', 'emails_empty');
            
            tr.appendChild(td);
            emailsList.appendChild(tr);
            return;
        }
        
        // Отображаем каждое письмо
        emails.forEach(email => {
            // Пропускаем письма без ID или отправителя
            if (!email.id) return;
            
            const tr = document.createElement('tr');
            tr.className = 'email-item';
            tr.setAttribute('data-email-id', email.id);
            
            // Если письмо не было прочитано, добавляем класс
            if (!email.read) {
                tr.classList.add('unread');
            }
            
            // Отправитель
            const tdFrom = document.createElement('td');
            tdFrom.className = 'email-sender';
            tdFrom.textContent = this.formatSender(email.from);
            tr.appendChild(tdFrom);
            
            // Тема
            const tdSubject = document.createElement('td');
            tdSubject.className = 'email-subject';
            tdSubject.textContent = email.subject || '(без темы)';
            tr.appendChild(tdSubject);
            
            // Дата получения
            const tdDate = document.createElement('td');
            tdDate.className = 'email-date';
            tdDate.textContent = this.formatDate(email.createdAt);
            tr.appendChild(tdDate);
            
            // Действия
            const tdActions = document.createElement('td');
            tdActions.className = 'action-buttons';
            
            // Кнопка просмотра
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-icon view-email-btn clickable-element';
            viewBtn.setAttribute('title', 'Просмотреть письмо');
            viewBtn.setAttribute('data-email-id', email.id);
            
            const viewIcon = document.createElement('i');
            viewIcon.className = 'fas fa-eye';
            viewBtn.appendChild(viewIcon);
            
            // Кнопка удаления
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-icon delete-email-btn clickable-element';
            deleteBtn.setAttribute('title', 'Удалить письмо');
            deleteBtn.setAttribute('data-email-id', email.id);
            
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash-alt';
            deleteBtn.appendChild(deleteIcon);
            
            tdActions.appendChild(viewBtn);
            tdActions.appendChild(deleteBtn);
            tr.appendChild(tdActions);
            
            // Добавляем письмо в список
            emailsList.appendChild(tr);
        });
        
        // Добавляем обработчики событий для новых элементов
        this.addEmailEventListeners();
    }
    
    /**
     * Добавить обработчики событий для элементов списка писем
     */
    addEmailEventListeners() {
        // Обработчики для кнопок просмотра писем
        document.querySelectorAll('.view-email-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const emailId = e.currentTarget.getAttribute('data-email-id');
                if (emailId) {
                    document.dispatchEvent(new CustomEvent('viewEmail', {
                        detail: { emailId }
                    }));
                }
            });
        });
        
        // Обработчики для кнопок удаления писем
        document.querySelectorAll('.delete-email-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const emailId = e.currentTarget.getAttribute('data-email-id');
                if (emailId) {
                    if (confirm('Вы действительно хотите удалить это письмо?')) {
                        document.dispatchEvent(new CustomEvent('deleteEmail', {
                            detail: { emailId }
                        }));
                    }
                }
            });
        });
        
        // Обработчики клика по строке письма (открытие письма)
        document.querySelectorAll('.email-item').forEach(row => {
            row.addEventListener('click', (e) => {
                // Проверяем, что клик не был по кнопкам
                if (!e.target.closest('.btn')) {
                    const emailId = row.getAttribute('data-email-id');
                    if (emailId) {
                        document.dispatchEvent(new CustomEvent('viewEmail', {
                            detail: { emailId }
                        }));
                    }
                }
            });
        });
    }
    
    /**
     * Определить формат письма
     * @param {Object} email - Объект письма
     * @returns {string} - Формат письма (plain/markdown/html)
     */
    determineEmailFormat(email) {
        // Проверяем тело письма
        const body = email.body || '';
        
        // Проверяем, есть ли в теме метка формата Markdown
        if (email.subject && email.subject.startsWith('[MD]')) {
            return 'markdown';
        }
        
        // Проверяем наличие HTML тегов или DOCTYPE
        if (/<html|<!DOCTYPE html>|<body|<div|<a\s|<table|<head/i.test(body)) {
            return 'html';
        }
        
        // Проверяем, есть ли в теле письма метки HTML (теги)
        if (/<[a-z][\s\S]*>/i.test(body)) {
            return 'html';
        }
        
        // Проверяем, содержит ли тело много markdown-синтаксиса
        const markdownCount = (body.match(/[*#`]|\[.*\]\(.*\)/g) || []).length;
        if (markdownCount > 2) {
            return 'markdown';
        }
        
        // Проверяем Content-Type в заголовках
        if (email.headers) {
            const contentType = email.headers['Content-Type'] || email.headers['content-type'];
            if (contentType) {
                if (contentType.includes('text/html')) {
                    return 'html';
                }
                if (contentType.includes('text/markdown')) {
                    return 'markdown';
                }
            }
        }
        
        // Проверяем наличие MIME типа
        if (email.mimeMessage && email.mimeMessage.mimeType) {
            if (email.mimeMessage.mimeType.includes('text/html')) {
                return 'html';
            }
        }
        
        // Проверяем версию MIME
        if (email.mimeMessage && email.mimeMessage.mimeVersion) {
            // Большинство MIME писем с версией - это HTML
            return 'html';
        }
        
        // По умолчанию считаем, что это обычный текст
        return 'plain';
    }
    
    /**
     * Показать просмотр письма
     * @param {Object} email - Объект письма
     */
    showEmailViewer(email) {
        // Заполняем детали письма
        document.getElementById('email-from').textContent = email.from || 'Неизвестно';
        document.getElementById('email-to').textContent = email.to?.join(', ') || 'Неизвестно';
        document.getElementById('email-subject').textContent = email.subject || '(Без темы)';
        
        // Форматируем дату
        const date = email.createdAt ? new Date(email.createdAt) : new Date();
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        document.getElementById('email-date').textContent = formattedDate;
        
        // Очищаем контейнер тела письма
        const emailBody = document.getElementById('email-body');
        emailBody.innerHTML = '';
        
        // Определяем формат письма
        const format = this.determineEmailFormat(email);
        
        // Проверяем наличие тела письма
        const body = email.body || '';
        
        // Обрабатываем тело письма в зависимости от формата
        if (format === 'html') {
            // HTML формат
            const container = document.createElement('div');
            container.className = 'html-content';
            
            // Создаем iframe для изолированного отображения HTML
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            container.appendChild(iframe);
            
            // Добавляем контейнер в DOM
            emailBody.appendChild(container);
            
            // Пишем HTML содержимое в iframe
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            
            // Если HTML не содержит базовые теги, добавляем их
            if (!/<html|<!DOCTYPE html>/i.test(body)) {
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <base target="_blank">
                        <meta charset="UTF-8">
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                margin: 10px;
                                padding: 0;
                            }
                            a { color: #2575fc; }
                            img { max-width: 100%; }
                            pre { 
                                background-color: #f5f5f5;
                                padding: 10px;
                                border-radius: 4px;
                                overflow-x: auto;
                            }
                            code {
                                font-family: monospace;
                                background-color: #f0f0f0;
                                padding: 2px 4px;
                                border-radius: 3px;
                            }
                            table {
                                border-collapse: collapse;
                                width: 100%;
                                margin: 10px 0;
                            }
                            th, td {
                                border: 1px solid #ddd;
                                padding: 8px;
                                text-align: left;
                            }
                            tr:nth-child(even) {
                                background-color: #f2f2f2;
                            }
                            button, .button {
                                display: inline-block;
                                padding: 8px 16px;
                                background-color: #6a11cb;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                text-decoration: none;
                            }
                        </style>
                    </head>
                    <body>
                        ${body}
                    </body>
                    </html>
                `);
            } else {
                // Если HTML уже содержит полную структуру, используем его как есть
                // Но добавляем базовый тег для открытия ссылок в новой вкладке
                const modifiedBody = body.replace('<head>', '<head><base target="_blank">');
                iframeDoc.write(modifiedBody);
            }
            
            iframeDoc.close();
            
            // Настраиваем высоту iframe по содержимому
            const resizeIframe = () => {
                if (iframe.contentWindow.document.body) {
                    const height = iframe.contentWindow.document.body.scrollHeight;
                    iframe.style.height = height + 20 + 'px'; // Добавляем отступ для надежности
                }
            };
            
            // Вызываем функцию изменения размера после загрузки содержимого
            iframe.onload = resizeIframe;
            setTimeout(resizeIframe, 100); // Дополнительно вызываем через таймаут
            
            // Показываем iframe предпросмотра
            iframe.style.display = 'block';
        } else if (format === 'markdown') {
            // Markdown формат
            const container = document.createElement('div');
            container.className = 'markdown-content';
            
            if (body.trim()) {
                // Преобразуем Markdown в HTML
                if (typeof marked !== 'undefined') {
                    container.innerHTML = marked.parse(body);
                    
                    // Применяем подсветку синтаксиса к блокам кода
                    if (typeof hljs !== 'undefined') {
                        container.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                    
                    // Настраиваем ссылки для открытия в новой вкладке
                    container.querySelectorAll('a').forEach(a => {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    });
                } else {
                    container.textContent = body;
                }
            } else {
                container.innerHTML = '<em>(Письмо не содержит текста)</em>';
            }
            
            emailBody.appendChild(container);
        } else {
            // Обычный текст
            const container = document.createElement('div');
            container.className = 'plain-text';
            
            if (body.trim()) {
                // Заменяем URL на кликабельные ссылки
                const linkedText = body.replace(
                    /((https?:\/\/|www\.)[^\s]+)/g, 
                    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
                container.innerHTML = linkedText;
            } else {
                container.innerHTML = '<em>(Письмо не содержит текста)</em>';
            }
            
            emailBody.appendChild(container);
        }
        
        // Добавляем отображение вложений, если они есть
        if (email.attachments && email.attachments.length > 0) {
            // Создаем секцию для вложений
            const attachmentsSection = document.createElement('div');
            attachmentsSection.className = 'email-attachments';
            attachmentsSection.innerHTML = `
                <h4 class="attachments-header">
                    <i class="fas fa-paperclip"></i> Вложения (${email.attachments.length})
                </h4>
                <div class="attachments-list"></div>
            `;
            
            const attachmentsList = attachmentsSection.querySelector('.attachments-list');
            
            // Добавляем каждое вложение в список
            email.attachments.forEach(attachment => {
                const attachmentItem = document.createElement('div');
                attachmentItem.className = 'attachment-item';
                
                // Определяем иконку в зависимости от типа файла
                let fileIcon = 'file';
                if (attachment.contentType) {
                    if (attachment.contentType.includes('image')) {
                        fileIcon = 'file-image';
                    } else if (attachment.contentType.includes('pdf')) {
                        fileIcon = 'file-pdf';
                    } else if (attachment.contentType.includes('word') || attachment.contentType.includes('document')) {
                        fileIcon = 'file-word';
                    } else if (attachment.contentType.includes('excel') || attachment.contentType.includes('spreadsheet')) {
                        fileIcon = 'file-excel';
                    } else if (attachment.contentType.includes('zip') || attachment.contentType.includes('archive')) {
                        fileIcon = 'file-archive';
                    } else if (attachment.contentType.includes('text')) {
                        fileIcon = 'file-alt';
                    }
                }
                
                // Форматируем размер файла
                const fileSize = attachment.sizeBytes ? this.formatFileSize(attachment.sizeBytes) : 'Неизвестно';
                
                // Создаем элемент вложения
                attachmentItem.innerHTML = `
                    <div class="attachment-icon">
                        <i class="fas fa-${fileIcon}"></i>
                    </div>
                    <div class="attachment-info">
                        <div class="attachment-name">${attachment.name || 'Вложение'}</div>
                        <div class="attachment-meta">
                            ${attachment.contentType || 'application/octet-stream'} • ${fileSize}
                        </div>
                    </div>
                    <div class="attachment-actions">
                        <a href="${attachment.downloadUrl}" class="btn-download" download="${attachment.name || 'attachment'}" target="_blank">
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                `;
                
                // Добавляем обработчик для скачивания через JavaScript, если требуется
                const downloadBtn = attachmentItem.querySelector('.btn-download');
                downloadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.downloadAttachment(attachment);
                });
                
                attachmentsList.appendChild(attachmentItem);
            });
            
            // Добавляем секцию вложений в тело письма
            emailBody.appendChild(attachmentsSection);
        }
        
        // Показываем просмотр письма
        document.getElementById('email-viewer').classList.add('active');
    }
    
    /**
     * Форматирует размер файла в человекочитаемом виде
     * @param {number} bytes - Размер в байтах
     * @returns {string} - Отформатированный размер
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Байт';
        
        const k = 1024;
        const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Скачивает вложение через API
     * @param {Object} attachment - Объект вложения
     */
    downloadAttachment(attachment) {
        if (!this.app || !this.app.api) {
            this.showToast('Невозможно скачать вложение: API не инициализирован', 'error');
            return;
        }
        
        // Показываем уведомление о начале скачивания
        this.showToast(`Скачивание файла: ${attachment.name || 'Вложение'}...`, 'info');
        
        // Получаем вложение через API
        this.app.api.downloadAttachment(attachment.id)
            .then(blob => {
                // Создаем ссылку для скачивания
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = attachment.name || 'attachment';
                
                // Добавляем ссылку в DOM и эмулируем клик
                document.body.appendChild(a);
                a.click();
                
                // Очищаем ресурсы
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showToast(`Файл ${attachment.name || 'Вложение'} успешно скачан`, 'success');
            })
            .catch(error => {
                console.error('Ошибка при скачивании вложения:', error);
                this.showToast(`Ошибка при скачивании вложения: ${error.message}`, 'error');
            });
    }
    
    /**
     * Скрыть просмотр письма
     */
    hideEmailViewer() {
        this.emailViewer.classList.remove('active');
    }
    
    /**
     * Подтвердить удаление почтового ящика
     * @param {string} inboxId - ID почтового ящика
     * @param {string} emailAddress - Email адрес ящика
     */
    confirmDeleteInbox(inboxId, emailAddress) {
        this.deleteConfirmText.textContent = `Вы уверены, что хотите удалить почтовый ящик ${emailAddress}?`;
        
        // Устанавливаем callback для кнопки подтверждения
        this.confirmDeleteBtn.onclick = () => {
            this.onDeleteInbox(inboxId);
            this.closeModal(this.deleteConfirmModal);
        };
        
        this.openModal(this.deleteConfirmModal);
    }
    
    /**
     * Копировать текст в буфер обмена
     * @param {string} text - Текст для копирования
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                this.showToast('Email адрес скопирован в буфер обмена', 'success');
            })
            .catch(err => {
                console.error('Ошибка при копировании текста: ', err);
                this.showToast('Не удалось скопировать email адрес', 'error');
            });
    }
    
    /**
     * Показать всплывающее уведомление
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления (success, error, warning, info)
     * @param {number} duration - Продолжительность показа в мс (по умолчанию 3000)
     */
    showToast(message, type = '', duration = 3000) {
        this.toast.textContent = message;
        this.toast.className = `toast ${type}`;
        this.toast.classList.add('active');
        
        // Автоматически скрываем через 3 секунды (или указанную продолжительность)
        setTimeout(() => {
            this.toast.classList.remove('active');
        }, duration);
    }
    
    /**
     * Инициализировать график использования API
     */
    initChart() {
        // Проверяем, существует ли уже экземпляр графика
        if (this.apiUsageChart) {
            // Уничтожаем существующий график перед созданием нового
            this.apiUsageChart.destroy();
        }

        const ctx = document.getElementById('api-usage-chart').getContext('2d');
        
        // Создаем фиктивные данные для графика
        const labels = [];
        const data = [];
        
        // Последние 7 дней
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());
            data.push(Math.floor(Math.random() * 50));
        }
        
        this.apiUsageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'API запросы',
                    data: data,
                    backgroundColor: 'rgba(106, 17, 203, 0.2)',
                    borderColor: 'rgba(106, 17, 203, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'API запросы за последние 7 дней'
                    }
                }
            }
        });
    }
    
    /**
     * Обновить график использования API
     * @param {Array} data - Данные для графика
     */
    updateChart(data) {
        if (!this.apiUsageChart) return;
        
        this.apiUsageChart.data.datasets[0].data = data;
        this.apiUsageChart.update();
    }
    
    // Заглушки для обработчиков событий, которые будут переопределены в app.js
    onViewEmails(inboxId) {
        console.log('View emails for inbox:', inboxId);
    }
    
    onViewEmail(emailId) {
        console.log('View email:', emailId);
    }
    
    onDeleteInbox(inboxId) {
        console.log('Delete inbox:', inboxId);
    }
    
    onDeleteEmail(emailId) {
        console.log('Delete email:', emailId);
    }
    
    onUpdateApiKey() {
        console.log('Update API key');
    }
    
    onSaveTimeouts() {
        console.log('Save timeouts');
    }
    
    onSaveAutoDelete() {
        console.log('Save auto delete settings');
    }
    
    onSaveLogging() {
        console.log('Save logging settings');
    }
    
    /**
     * Настройка парсера Markdown
     */
    setupMarkdownParser() {
        // Проверяем, доступна ли библиотека marked
        if (typeof marked !== 'undefined') {
            // Настраиваем рендерер для безопасного рендеринга ссылок
            const renderer = new marked.Renderer();
            renderer.link = function(href, title, text) {
                return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            };
            
            // Настраиваем marked с подсветкой синтаксиса
            marked.setOptions({
                renderer: renderer,
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined') {
                        try {
                            if (lang && hljs.getLanguage(lang)) {
                                return hljs.highlight(code, { language: lang }).value;
                            } else {
                                return hljs.highlightAuto(code).value;
                            }
                        } catch (e) {
                            console.error('Ошибка при подсветке синтаксиса:', e);
                            return code;
                        }
                    }
                    return code;
                },
                gfm: true,
                breaks: true,
                sanitize: false,
                smartLists: true,
                smartypants: true,
                xhtml: false
            });
        }
    }
    
    /**
     * Переключить предпросмотр
     */
    togglePreview() {
        const previewElement = document.getElementById('markdown-preview');
        const contentElement = document.querySelector('.markdown-preview-content');
        const textValue = this.emailBodyInput.value.trim();
        const editorMode = document.querySelector('input[name="editor-mode"]:checked').value;
        
        // Если не выбран ни Markdown, ни HTML, переключаем на Markdown автоматически
        if (editorMode === 'plain') {
            // Переключаем на Markdown режим
            document.querySelector('input[name="editor-mode"][value="markdown"]').checked = true;
            this.updateEditorMode('markdown');
            this.showToast('Переключено в режим Markdown', 'info');
        }
        
        if (!previewElement.classList.contains('active')) {
            // Показываем предпросмотр
            if (editorMode === 'html') {
                // HTML предпросмотр
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '300px';
                iframe.style.border = 'none';
                
                contentElement.innerHTML = '';
                contentElement.appendChild(iframe);
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <base target="_blank">
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                margin: 10px;
                            }
                            a { color: #2575fc; }
                            img { max-width: 100%; }
                            button, .button {
                                display: inline-block;
                                padding: 8px 16px;
                                background-color: #6a11cb;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                text-decoration: none;
                            }
                        </style>
                    </head>
                    <body>
                        ${textValue}
                    </body>
                    </html>
                `);
                iframeDoc.close();
            } else {
                // Markdown предпросмотр
                if (typeof marked !== 'undefined') {
                    contentElement.innerHTML = textValue ? marked.parse(textValue) : '<em>(Нет содержимого для предпросмотра)</em>';
                    
                    // Применяем подсветку синтаксиса к блокам кода
                    if (typeof hljs !== 'undefined') {
                        contentElement.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                } else {
                    contentElement.textContent = textValue || '(Нет содержимого для предпросмотра)';
                }
            }
            
            previewElement.classList.add('active');
        } else {
            // Обновляем содержимое предпросмотра
            if (editorMode === 'html') {
                // Обновляем HTML предпросмотр
                const iframe = contentElement.querySelector('iframe');
                if (iframe) {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const body = iframeDoc.querySelector('body');
                    if (body) {
                        body.innerHTML = textValue;
                    }
                }
            } else {
                // Обновляем Markdown предпросмотр
                if (typeof marked !== 'undefined') {
                    contentElement.innerHTML = textValue ? marked.parse(textValue) : '<em>(Нет содержимого для предпросмотра)</em>';
                    
                    // Применяем подсветку синтаксиса к блокам кода
                    if (typeof hljs !== 'undefined') {
                        contentElement.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                } else {
                    contentElement.textContent = textValue || '(Нет содержимого для предпросмотра)';
                }
            }
        }
    }
    
    /**
     * Закрыть предпросмотр
     */
    closePreview() {
        const previewElement = document.getElementById('markdown-preview');
        previewElement.classList.remove('active');
    }
    
    /**
     * Переключить справку по форматированию
     */
    toggleFormatHelp() {
        const helpContent = document.getElementById('markdown-help-content');
        helpContent.classList.toggle('hidden');
    }
    
    /**
     * Переключить вкладку справки по форматированию
     * @param {string} tabName - Имя вкладки (markdown/html)
     */
    switchFormatTab(tabName) {
        // Деактивируем все вкладки
        document.querySelectorAll('.format-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.format-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Активируем выбранную вкладку
        document.querySelector(`.format-tab[data-tab="${tabName}"]`).classList.add('active');
        document.querySelector(`.${tabName}-tab`).classList.add('active');
    }
    
    /**
     * Обновить режим редактора
     * @param {string} mode - Режим редактора (plain/markdown/html)
     */
    updateEditorMode(mode) {
        const previewBtn = document.getElementById('preview-markdown-btn');
        const helpElement = document.querySelector('.markdown-help');
        
        if (mode === 'markdown' || mode === 'html') {
            previewBtn.style.display = 'block';
            helpElement.style.display = 'block';
            
            // Обновляем заголовок кнопки предпросмотра
            previewBtn.textContent = `Предпросмотр ${mode === 'markdown' ? 'Markdown' : 'HTML'}`;
            
            // Если справка открыта, переключаем на соответствующую вкладку
            if (!document.getElementById('markdown-help-content').classList.contains('hidden')) {
                this.switchFormatTab(mode);
            }
            
            // Обновляем плейсхолдер
            this.emailBodyInput.setAttribute('placeholder', `Введите текст в формате ${mode}...`);
        } else {
            previewBtn.style.display = 'none';
            helpElement.style.display = 'none';
            this.closePreview();
            this.emailBodyInput.setAttribute('placeholder', 'Текст письма...');
        }
    }
    
    /**
     * Инициализация UI элементов для управления API-ключами
     */
    initApiKeyUI() {
        // Элементы для отображения статуса ключа
        this.apiKeyStatusBadge = document.getElementById('api-key-status');
        this.apiKeyPlanElement = document.getElementById('api-key-plan');
        this.apiKeyExpiresElement = document.getElementById('api-key-expires');
        this.apiKeyInboxesUsageElement = document.getElementById('api-key-inboxes-usage');
        this.apiKeyEmailsUsageElement = document.getElementById('api-key-emails-usage');
        
        // Тарифные карточки
        this.tariffCards = document.querySelectorAll('.tariff-card');
        this.tariffSelectButtons = document.querySelectorAll('.tariff-select-btn');
        
        // Документация API
        this.viewApiDocsButton = document.getElementById('view-full-api-docs');
        
        // Установка обработчиков событий
        this.tariffSelectButtons.forEach(button => {
            button.addEventListener('click', () => {
                const planType = button.getAttribute('data-plan');
                this.selectTariffPlan(planType);
            });
        });
        
        if (this.viewApiDocsButton) {
            this.viewApiDocsButton.addEventListener('click', () => {
                // Открываем модальное окно с документацией API
                this.showApiDocumentation();
            });
        }
        
        // Обновляем отображение статуса API-ключа
        this.updateApiKeyStatus();
    }
    
    /**
     * Обновление отображения статуса API-ключа
     */
    updateApiKeyStatus() {
        // Проверяем, что app и api доступны
        if (!this.app || !this.app.api) {
            console.warn('API объект не инициализирован. Отображение статуса API-ключа невозможно.');
            return;
        }
        
        // Проверяем наличие элементов UI
        if (!this.apiKeyStatusBadge || !this.apiKeyPlanElement) {
            console.warn('Элементы UI для отображения статуса API-ключа не найдены.');
            return;
        }
        
        // Получаем данные о ключе из API-клиента
        const keyInfo = this.app.api.getApiKeyInfo();
        
        // Обновляем статус ключа
        if (keyInfo.isActive) {
            this.apiKeyStatusBadge.textContent = 'Активен';
            this.apiKeyStatusBadge.classList.add('active');
        } else {
            this.apiKeyStatusBadge.textContent = 'Не активирован';
            this.apiKeyStatusBadge.classList.remove('active');
        }
        
        // Обновляем информацию о тарифном плане
        this.apiKeyPlanElement.textContent = this.getPlanDisplayName(keyInfo.planType);
        
        // Обновляем дату истечения
        if (keyInfo.expiresAt) {
            const expiryDate = new Date(keyInfo.expiresAt);
            this.apiKeyExpiresElement.textContent = expiryDate.toLocaleDateString();
        } else {
            this.apiKeyExpiresElement.textContent = '-';
        }
        
        // Обновляем использование ящиков
        if (keyInfo.limits && keyInfo.usage) {
            this.apiKeyInboxesUsageElement.textContent = `${keyInfo.usage.inboxesCreated || 0} / ${keyInfo.limits.maxInboxes || 0}`;
            this.apiKeyEmailsUsageElement.textContent = `${keyInfo.usage.emailsSent || 0} / ${keyInfo.limits.maxEmailsPerDay || 0}`;
        } else {
            this.apiKeyInboxesUsageElement.textContent = '0 / 0';
            this.apiKeyEmailsUsageElement.textContent = '0 / 0';
        }
        
        // Подсвечиваем активный тарифный план
        this.highlightActivePlan(keyInfo.planType);
    }
    
    /**
     * Получение отображаемого имени тарифного плана
     * @param {string} planType - Тип тарифного плана
     * @returns {string} - Отображаемое имя плана
     */
    getPlanDisplayName(planType) {
        const planNames = {
            'free': 'Бесплатный',
            'basic': 'Базовый',
            'professional': 'Профессиональный',
            'enterprise': 'Корпоративный',
            'none': '-'
        };
        
        return planNames[planType] || '-';
    }
    
    /**
     * Подсветка активного тарифного плана
     * @param {string} planType - Тип тарифного плана
     */
    highlightActivePlan(planType) {
        // Убираем подсветку со всех карточек
        this.tariffCards.forEach(card => {
            card.classList.remove('active');
        });
        
        // Если тип плана не указан или не активен, выходим
        if (!planType || planType === 'none') return;
        
        // Находим и подсвечиваем карточку активного плана
        const activeCard = document.querySelector(`.tariff-card[data-plan="${planType}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
    }
    
    /**
     * Выбор тарифного плана
     * @param {string} planType - Тип тарифного плана
     */
    selectTariffPlan(planType) {
        // Получаем текущий API-ключ
        const apiKey = this.app.api.getApiKey();
        
        // Проверяем, что API-ключ указан
        if (!apiKey) {
            this.showToast('Пожалуйста, сначала введите API-ключ', 'error');
            return;
        }
        
        try {
            // Активируем ключ с выбранным тарифным планом
            this.app.api.activateApiKey(apiKey, planType);
            
            // Обновляем отображение статуса
            this.updateApiKeyStatus();
            
            // Показываем сообщение об успешной активации
            this.showToast(`Тарифный план "${this.getPlanDisplayName(planType)}" активирован!`, 'success');
        } catch (error) {
            console.error('Ошибка при активации тарифного плана:', error);
            this.showToast(`Ошибка активации плана: ${error.message}`, 'error');
        }
    }
    
    /**
     * Показ модального окна с документацией API
     */
    showApiDocumentation() {
        // Создаем модальное окно для документации API
        const modalId = 'api-docs-modal';
        const modalHtml = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Документация по API</h3>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="api-docs-tabs">
                    <button class="api-docs-tab active" data-tab="overview">Обзор</button>
                    <button class="api-docs-tab" data-tab="authentication">Аутентификация</button>
                    <button class="api-docs-tab" data-tab="inboxes">Почтовые ящики</button>
                    <button class="api-docs-tab" data-tab="emails">Письма</button>
                </div>
                
                <div class="api-docs-content active" data-content="overview">
                    <h4>Обзор API</h4>
                    <p>
                        API NeuroMail предоставляет полный доступ к функциям создания и управления временными почтовыми ящиками.
                        Используйте ваш API-ключ для доступа к изолированному пространству имен, где только вы имеете доступ к вашим данным.
                    </p>
                    <p>
                        <strong>Базовый URL API:</strong> <code>https://api.mailslurp.com</code>
                    </p>
                    <p>
                        <strong>Формат ответа:</strong> Все ответы возвращаются в формате JSON.
                    </p>
                </div>
                
                <div class="api-docs-content" data-content="authentication">
                    <h4>Аутентификация</h4>
                    <p>
                        Все запросы должны включать ваш API-ключ в заголовке <code>x-api-key</code>.
                    </p>
                    <div class="api-example">
                        <h5>Пример запроса с аутентификацией</h5>
                        <pre><code>fetch('https://api.mailslurp.com/inboxes', {
    method: 'GET',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                    </div>
                </div>
                
                <div class="api-docs-content" data-content="inboxes">
                    <h4>Работа с почтовыми ящиками</h4>
                    
                    <div class="api-endpoint">
                        <h5>Получение списка ящиков</h5>
                        <p><strong>GET</strong> /inboxes</p>
                        <p>Возвращает список всех ваших почтовых ящиков.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/inboxes', {
    method: 'GET',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                        </div>
                    </div>
                    
                    <div class="api-endpoint">
                        <h5>Создание нового ящика</h5>
                        <p><strong>POST</strong> /inboxes</p>
                        <p>Создает новый почтовый ящик с указанными параметрами.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/inboxes', {
    method: 'POST',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        name: 'Мой ящик'
    })
})</code></pre>
                        </div>
                    </div>
                    
                    <div class="api-endpoint">
                        <h5>Удаление ящика</h5>
                        <p><strong>DELETE</strong> /inboxes/{inboxId}</p>
                        <p>Удаляет указанный почтовый ящик.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/inboxes/123abc', {
    method: 'DELETE',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                        </div>
                    </div>
                </div>
                
                <div class="api-docs-content" data-content="emails">
                    <h4>Работа с письмами</h4>
                    
                    <div class="api-endpoint">
                        <h5>Получение писем ящика</h5>
                        <p><strong>GET</strong> /emails?inboxId={inboxId}</p>
                        <p>Возвращает список писем в указанном ящике.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/emails?inboxId=123abc', {
    method: 'GET',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                        </div>
                    </div>
                    
                    <div class="api-endpoint">
                        <h5>Получение письма</h5>
                        <p><strong>GET</strong> /emails/{emailId}</p>
                        <p>Возвращает подробную информацию о письме.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/emails/456def?decodeBody=true&htmlBody=true', {
    method: 'GET',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                        </div>
                    </div>
                    
                    <div class="api-endpoint">
                        <h5>Ожидание нового письма</h5>
                        <p><strong>GET</strong> /waitForLatestEmail</p>
                        <p>Ожидает и возвращает последнее письмо в ящике.</p>
                        <div class="api-example">
                            <pre><code>fetch('https://api.mailslurp.com/waitForLatestEmail?inboxId=123abc&timeout=30000&unreadOnly=true', {
    method: 'GET',
    headers: {
        'x-api-key': 'ваш-api-ключ',
        'Accept': 'application/json'
    }
})</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // Создаем и показываем модальное окно
        this.createModal(modalId, modalHtml);
        
        // Добавляем обработчики для вкладок документации
        const apiDocsTabs = document.querySelectorAll('.api-docs-tab');
        const apiDocsContents = document.querySelectorAll('.api-docs-content');
        
        apiDocsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Убираем активный класс со всех вкладок и содержимого
                apiDocsTabs.forEach(t => t.classList.remove('active'));
                apiDocsContents.forEach(c => c.classList.remove('active'));
                
                // Устанавливаем активный класс на выбранную вкладку
                tab.classList.add('active');
                
                // Показываем соответствующее содержимое
                const tabId = tab.getAttribute('data-tab');
                const content = document.querySelector(`.api-docs-content[data-content="${tabId}"]`);
                if (content) {
                    content.classList.add('active');
                }
            });
        });
    }
    
    /**
     * Инициализировать UI компоненты
     */
    init() {
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Инициализируем график
        this.initChart();
        
        // Конфигурация Markdown парсера
        this.setupMarkdownParser();
        
        // Инициализация API-ключей перенесена в метод setApp,
        // так как требует наличия app.api
        // this.initApiKeyUI();
    }

    /**
     * Показать действия с текущим почтовым ящиком
     * @param {Object} inbox - Объект почтового ящика
     */
    showInboxActions(inbox) {
        // Создаем или обновляем панель действий с почтовым ящиком
        const actionsContainer = document.getElementById('inbox-actions') || document.createElement('div');
        actionsContainer.id = 'inbox-actions';
        actionsContainer.className = 'inbox-actions';
        
        // Обновляем содержимое панели
        actionsContainer.innerHTML = `
            <div class="inbox-address">
                <span class="label">Адрес:</span>
                <span class="value">${inbox.emailAddress}</span>
                <button class="btn btn-icon copy-email-btn" title="Скопировать адрес">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="inbox-actions-buttons">
                <button class="btn btn-sm btn-danger" id="delete-inbox-btn">
                    <i class="fas fa-trash"></i> Удалить ящик
                </button>
                <button class="btn btn-sm btn-primary" id="send-from-inbox-btn">
                    <i class="fas fa-paper-plane"></i> Отправить письмо
                </button>
            </div>
        `;
        
        // Добавляем панель в DOM, если её ещё нет
        const emailsSection = document.getElementById('emails-section');
        const existingActions = document.getElementById('inbox-actions');
        if (!existingActions) {
            emailsSection.insertBefore(actionsContainer, this.emailsList.parentNode);
        }
        
        // Добавляем обработчики событий
        document.querySelector('.copy-email-btn').addEventListener('click', () => {
            this.copyToClipboard(inbox.emailAddress);
            this.showToast('Email адрес скопирован в буфер обмена', 'success');
        });
        
        document.getElementById('delete-inbox-btn').addEventListener('click', () => {
            this.confirmDeleteInbox(inbox.id, inbox.emailAddress);
        });
        
        document.getElementById('send-from-inbox-btn').addEventListener('click', () => {
            // Заполняем поле From в модальном окне отправки
            if (this.emailFromSelect) {
                this.emailFromSelect.value = inbox.id;
            }
            this.openModal(this.sendEmailModal);
        });
    }

    /**
     * Скрыть индикатор загрузки писем
     */
    hideEmailsLoading() {
        const loadingRow = this.emailsList.querySelector('.loading-placeholder');
        if (loadingRow) {
            loadingRow.remove();
        }
    }

    /**
     * Показать индикатор загрузки для указанного контейнера
     * @param {string} containerId - ID контейнера
     * @param {string} message - Сообщение для отображения
     */
    showLoading(containerId, message = 'Загрузка...') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Для таблиц
        if (container.tagName === 'TBODY') {
            container.innerHTML = `
                <tr class="loading-placeholder">
                    <td colspan="4">${message}</td>
                </tr>
            `;
        } else {
            // Сохраняем оригинальное содержимое
            container._originalContent = container.innerHTML;
            
            // Заменяем содержимое на индикатор загрузки
            container.innerHTML = `
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * Показать сообщение об ошибке в указанном контейнере
     * @param {string} containerId - ID контейнера
     * @param {string} message - Сообщение об ошибке
     * @param {Error} error - Объект ошибки
     */
    showErrorMessage(containerId, message = 'Произошла ошибка', error = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Логируем ошибку для отладки
        if (error) {
            console.error(message, error);
        }
        
        // Для таблиц
        if (container.tagName === 'TBODY') {
            container.innerHTML = `
                <tr class="error-message">
                    <td colspan="4">
                        <div class="error-container">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>${message}</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            container.innerHTML = `
                <div class="error-container">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                    ${error ? `<small>${error.message}</small>` : ''}
                </div>
            `;
        }
        
        // Показываем уведомление
        this.showToast(message, 'error');
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

/**
 * Создает и возвращает экземпляр UI
 * @returns {MailSlurpUI} - Экземпляр UI
 */
function createMailslurpUI() {
    console.log('Создание UI компонента...');
    return new MailSlurpUI();
}

// Делаем функцию доступной глобально
window.createMailslurpUI = createMailslurpUI; 