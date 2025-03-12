document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Socket.IO
    var socket = io();

    // Обработка сообщений чата
    if (document.querySelector('#message-form')) {
        document.querySelector('#message-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var messageInput = document.querySelector('#message');
            var message = messageInput.value;
            if (message.trim()) {
                socket.emit('message', {
                    message: message,
                    department_id: document.querySelector('#department_id').value
                });
                messageInput.value = '';
            }
        });

        socket.on('message', function(data) {
            var chatContainer = document.querySelector('.chat-container');
            var messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (data.is_own ? 'message-own' : 'message-other');
            messageDiv.innerHTML = `
                <strong>${data.username}</strong><br>
                ${data.message}<br>
                <small>${data.timestamp}</small>
            `;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
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