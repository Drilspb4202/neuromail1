/**
 * Менеджер пула API ключей с автоматической ротацией
 */
class ApiKeyPool {
    constructor() {
        // Пул публичных API ключей
        this.publicKeys = [
            {
                key: 'bb883bc4065365fedcfacd7cc41a355e54d4b19d06de6505b213c4516f03ae1',
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            },
            {
                key: '7d65e4661288db7647cfae566a7b7b02f2b5cf55528f5a2106ebd32de09042b',
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            },
            {
                key: '1288db7647cfae566a7b7b02f2b5cf55528f5a2106ebd32de09042b76d65e46',
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            },
            {
                key: '647cfae566a7b7b02f2b5cf55528f5a2106ebd32de09042b76d65e4661288db',
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            },
            {
                key: 'ae566a7b7b02f2b5cf55528f5a2106ebd32de09042b76d65e4661288db7647cf',
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            }
        ];

        // Текущий активный ключ
        this.currentKeyIndex = 0;

        // Лимиты использования
        this.limits = {
            monthlyInboxLimit: 50,  // Лимит создания ящиков в месяц
            dailyRequestLimit: 250, // Лимит запросов в день
        };

        // Загружаем сохраненное состояние
        this.loadState();

        // Запускаем проверку сброса счетчиков
        this.checkCountersReset();
    }

    /**
     * Загрузка сохраненного состояния пула ключей
     */
    loadState() {
        const savedState = localStorage.getItem('api_key_pool_state');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.publicKeys = state.publicKeys;
                this.currentKeyIndex = state.currentKeyIndex;
            } catch (error) {
                console.error('Ошибка при загрузке состояния пула ключей:', error);
            }
        }
    }

    /**
     * Сохранение текущего состояния пула ключей
     */
    saveState() {
        try {
            const state = {
                publicKeys: this.publicKeys,
                currentKeyIndex: this.currentKeyIndex
            };
            localStorage.setItem('api_key_pool_state', JSON.stringify(state));
        } catch (error) {
            console.error('Ошибка при сохранении состояния пула ключей:', error);
        }
    }

    /**
     * Проверка и сброс счетчиков использования
     */
    checkCountersReset() {
        const now = new Date().getTime();
        
        this.publicKeys.forEach((keyData, index) => {
            // Сброс месячного счетчика
            if (now - keyData.monthlyReset >= 30 * 24 * 60 * 60 * 1000) { // 30 дней
                this.publicKeys[index].usageCount = 0;
                this.publicKeys[index].isExhausted = false;
                this.publicKeys[index].monthlyReset = now;
            }
        });

        this.saveState();

        // Планируем следующую проверку через час
        setTimeout(() => this.checkCountersReset(), 60 * 60 * 1000);
    }

    /**
     * Получить следующий доступный ключ
     * @returns {string|null} API ключ или null, если все ключи исчерпаны
     */
    getNextAvailableKey() {
        const startIndex = this.currentKeyIndex;
        let attempts = 0;

        while (attempts < this.publicKeys.length) {
            const keyData = this.publicKeys[this.currentKeyIndex];

            if (!keyData.isExhausted) {
                return keyData.key;
            }

            // Переходим к следующему ключу по кругу
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.publicKeys.length;
            attempts++;
        }

        // Если все ключи исчерпаны, возвращаем null
        return null;
    }

    /**
     * Пометить текущий ключ как исчерпанный
     */
    markCurrentKeyExhausted() {
        this.publicKeys[this.currentKeyIndex].isExhausted = true;
        this.publicKeys[this.currentKeyIndex].lastUsed = new Date().getTime();
        
        // Переключаемся на следующий ключ
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.publicKeys.length;
        
        this.saveState();

        // Создаем событие об исчерпании ключа
        const event = new CustomEvent('api-key-exhausted', {
            detail: {
                exhaustedKey: this.publicKeys[this.currentKeyIndex].key,
                newKey: this.getNextAvailableKey()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Увеличить счетчик использования текущего ключа
     */
    incrementCurrentKeyUsage() {
        const keyData = this.publicKeys[this.currentKeyIndex];
        keyData.usageCount++;
        keyData.lastUsed = new Date().getTime();

        // Проверяем, не достигнут ли лимит
        if (keyData.usageCount >= this.limits.monthlyInboxLimit) {
            this.markCurrentKeyExhausted();
        }

        this.saveState();
    }

    /**
     * Получить информацию о текущем состоянии пула ключей
     * @returns {Object} Информация о состоянии пула
     */
    getPoolStatus() {
        return {
            totalKeys: this.publicKeys.length,
            availableKeys: this.publicKeys.filter(k => !k.isExhausted).length,
            currentKey: this.publicKeys[this.currentKeyIndex],
            allKeys: this.publicKeys.map(k => ({
                key: k.key.substring(0, 8) + '...',
                usageCount: k.usageCount,
                isExhausted: k.isExhausted,
                lastUsed: k.lastUsed ? new Date(k.lastUsed).toLocaleString() : 'Never'
            }))
        };
    }

    /**
     * Сбросить все счетчики и состояния
     */
    resetPool() {
        this.publicKeys.forEach(keyData => {
            keyData.usageCount = 0;
            keyData.isExhausted = false;
            keyData.lastUsed = null;
            keyData.monthlyReset = new Date().getTime();
        });

        this.currentKeyIndex = 0;
        this.saveState();
    }

    /**
     * Обновить ключ по индексу
     * @param {number} index - Индекс ключа в массиве
     * @param {string} newKey - Новый ключ API
     * @returns {boolean} - Результат операции
     */
    updateKey(index, newKey) {
        if (index < 0 || index >= this.publicKeys.length) {
            console.error(`Невозможно обновить ключ: индекс ${index} вне диапазона`);
            return false;
        }
        
        try {
            // Обновляем ключ и сбрасываем его счетчики
            this.publicKeys[index] = {
                key: newKey,
                usageCount: 0,
                lastUsed: null,
                isExhausted: false,
                monthlyReset: new Date().getTime()
            };
            
            // Если текущий активный ключ - это обновленный, сбрасываем localStorage
            if (this.currentKeyIndex === index) {
                localStorage.removeItem('api_key_pool_state');
            }
            
            // Сохраняем новое состояние
            this.saveState();
            
            console.log(`Ключ API по индексу ${index} успешно обновлен`);
            return true;
        } catch (error) {
            console.error('Ошибка при обновлении ключа:', error);
            return false;
        }
    }

    /**
     * Принудительно сбросить сохраненное состояние и использовать текущие значения ключей
     */
    forceRefreshState() {
        localStorage.removeItem('api_key_pool_state');
        this.currentKeyIndex = 0;
        
        // Сбрасываем состояния всех ключей
        this.publicKeys.forEach((keyData, index) => {
            this.publicKeys[index].usageCount = 0;
            this.publicKeys[index].isExhausted = false;
        });
        
        // Сохраняем текущее состояние
        this.saveState();
        console.log('Состояние пула ключей принудительно обновлено');
        
        // Создаем событие обновления ключей
        const event = new CustomEvent('api-keys-refreshed');
        document.dispatchEvent(event);
    }
}

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiKeyPool;
} 