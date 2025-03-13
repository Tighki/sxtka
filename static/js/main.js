document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Socket.IO
    var socket = io();

    // Установка задержки анимации для отделов
    document.querySelectorAll('.department-item').forEach((item, index) => {
        item.style.setProperty('--animation-order', index);
    });

    // Обработка сообщений чата
    if (document.querySelector('#message-form')) {
        document.querySelector('#message-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var messageInput = document.querySelector('#message');
            var message = messageInput.value;
            if (message.trim()) {
                socket.emit('send_message', {
                    content: message,
                    department_id: document.querySelector('#department_id').value
                });
                messageInput.value = '';
            }
        });

        socket.on('new_message', function(data) {
            var chatContainer = document.querySelector('.chat-container');
            var messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (data.is_own ? 'message-own' : 'message-other');
            messageDiv.innerHTML = `
                <strong>${data.username}</strong>
                <div class="message-content">${data.content}</div>
                <small>${data.timestamp}</small>
                ${currentUser.is_admin ? `
                    <button class="btn btn-sm btn-danger float-end delete-message" data-message-id="${data.message_id}">
                        Удалить
                    </button>
                ` : ''}
            `;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

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