document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Socket.IO
    var socket = io();

    // Установка задержки анимации для отделов
    document.querySelectorAll('.department-item').forEach((item, index) => {
        item.style.setProperty('--animation-order', index);
    });

    // Обработка сообщений чата
    if (document.querySelector('#message-form')) {
        const fileInput = document.querySelector('#file-input');
        const attachButton = document.querySelector('#attach-button');

        // Обработка клика по кнопке прикрепления файла
        attachButton.addEventListener('click', function() {
            fileInput.click();
        });

        // Обработка выбора файла
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (!file.type.startsWith('image/')) {
                    alert('Пожалуйста, выберите изображение');
                    return;
                }

                const formData = new FormData();
                formData.append('image', file);
                formData.append('department_id', document.querySelector('#department_id').value);

                fetch('/upload_image', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        socket.emit('send_message', {
                            content: data.image_url,
                            department_id: document.querySelector('#department_id').value,
                            is_image: true
                        });
                    } else {
                        alert('Ошибка при загрузке изображения');
                    }
                })
                .catch(error => {
                    console.error('Ошибка:', error);
                    alert('Ошибка при загрузке изображения');
                })
                .finally(() => {
                    fileInput.value = ''; // Очищаем поле выбора файла
                });
            }
        });

        document.querySelector('#message-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var messageInput = document.querySelector('#message');
            var message = messageInput.value;
            if (message.trim()) {
                socket.emit('send_message', {
                    content: message,
                    department_id: document.querySelector('#department_id').value,
                    is_image: false
                });
                messageInput.value = '';
            }
        });

        socket.on('new_message', function(data) {
            var chatContainer = document.querySelector('.chat-container');
            var messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (data.is_own ? 'message-own' : 'message-other');
            
            const messageContent = data.is_image 
                ? `<img src="${data.content}" class="chat-image" alt="Изображение">`
                : escapeHtml(data.content);
            
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <div class="message-info">
                        <span class="message-author">${escapeHtml(data.username)}</span>
                    </div>
                    <div class="message-content">${messageContent}</div>
                    <div class="message-meta">
                        <span class="message-time">${data.timestamp.split(' ')[1]}</span>
                        ${data.is_own ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
                    </div>
                    ${currentUser.is_admin ? `
                        <button class="btn-delete-message delete-message" data-message-id="${data.message_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            
            chatContainer.querySelector('.messages-wrapper').appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        // Функция для экранирования HTML
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Обработка удаления сообщений
        document.querySelector('.chat-container').addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-message')) {
                if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
                    const messageId = e.target.dataset.messageId;
                    fetch(`/admin/delete_message/${messageId}`, {
                        method: 'POST'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            e.target.closest('.message').remove();
                        }
                    });
                }
            }
        });
    }

    // Переключение темы
    const themeSwitch = document.querySelector('.theme-switch');
    if (themeSwitch) {
        let isThemeSwitching = false;

        themeSwitch.addEventListener('click', async function() {
            if (isThemeSwitching) return;
            isThemeSwitching = true;

            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            const icon = themeSwitch.querySelector('i');

            try {
                const response = await fetch('/update_theme', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ theme: newTheme })
                });

                if (response.ok) {
                    document.documentElement.setAttribute('data-theme', newTheme);
                    icon.classList.remove(currentTheme === 'light' ? 'fa-moon' : 'fa-sun');
                    icon.classList.add(currentTheme === 'light' ? 'fa-sun' : 'fa-moon');
                }
            } catch (error) {
                console.error('Ошибка при обновлении темы:', error);
            } finally {
                setTimeout(() => {
                    isThemeSwitching = false;
                }, 300);
            }
        });
    }

    // Управление отделами
    const addDepartmentForm = document.getElementById('add-department-form');
    if (addDepartmentForm) {
        addDepartmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(addDepartmentForm);
            
            fetch('/add_department', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                }
            });
        });
    }

    // Автоматическая прокрутка чата вниз при загрузке
    if (document.querySelector('.chat-container')) {
        document.querySelector('.chat-container').scrollTop = document.querySelector('.chat-container').scrollHeight;
    }
}); 