from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_mail import Mail, Message
from flask_socketio import SocketIO, emit
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-password'

# Инициализация расширений
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
mail = Mail(app)
socketio = SocketIO(app)

# Модели базы данных
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    is_admin = db.Column(db.Boolean, default=False)
    theme = db.Column(db.String(20), default='light')
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))

class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    users = db.relationship('User', backref='department', lazy=True)
    messages = db.relationship('Message', backref='department', lazy=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    user = db.relationship('User', backref='messages')

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# Маршруты аутентификации
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        flash('Неверный email или пароль', 'danger')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(username=username).first():
            flash('Пользователь с таким именем уже существует', 'danger')
            return redirect(url_for('register'))
            
        if User.query.filter_by(email=email).first():
            flash('Пользователь с таким email уже существует', 'danger')
            return redirect(url_for('register'))
            
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        
        flash('Регистрация успешна! Теперь вы можете войти', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# Основные маршруты
@app.route('/')
@login_required
def index():
    departments = Department.query.all()
    return render_template('index.html', departments=departments)

@app.route('/chat/<int:department_id>')
@login_required
def chat(department_id):
    department = Department.query.get_or_404(department_id)
    messages = Message.query.filter_by(department_id=department_id).order_by(Message.timestamp).all()
    return render_template('chat.html', department=department, messages=messages)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        if 'username' in request.form:
            new_username = request.form.get('username')
            if User.query.filter_by(username=new_username).first() and new_username != current_user.username:
                flash('Пользователь с таким именем уже существует', 'danger')
            else:
                current_user.username = new_username
                db.session.commit()
                flash('Имя пользователя обновлено', 'success')
                
        if 'password' in request.form:
            new_password = request.form.get('password')
            current_user.password_hash = generate_password_hash(new_password)
            db.session.commit()
            flash('Пароль обновлен', 'success')
            
    return render_template('profile.html')

@app.route('/update_theme', methods=['POST'])
@login_required
def update_theme():
    data = request.get_json()
    current_user.theme = data.get('theme')
    db.session.commit()
    return jsonify({'success': True})

# Админ-панель
@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    users = User.query.all()
    departments = Department.query.all()
    return render_template('admin.html', users=users, departments=departments)

@app.route('/add_department', methods=['POST'])
@login_required
def add_department():
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
        
    name = request.form.get('name')
    parent_id = request.form.get('parent_id')
    
    department = Department(name=name)
    if parent_id:
        department.parent_id = int(parent_id)
        
    db.session.add(department)
    db.session.commit()
    return jsonify({'success': True})

# Дополнительные маршруты для админ-панели
@app.route('/admin/delete_user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
    
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'success': False, 'message': 'Нельзя удалить самого себя'})
    
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/update_user_department/<int:user_id>', methods=['POST'])
@login_required
def update_user_department(user_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
    
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    department_id = data.get('department_id')
    
    if department_id:
        department = Department.query.get_or_404(int(department_id))
        user.department_id = department.id
    else:
        user.department_id = None
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/toggle_admin/<int:user_id>', methods=['POST'])
@login_required
def toggle_admin(user_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
    
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'success': False, 'message': 'Нельзя изменить свой статус администратора'})
    
    user.is_admin = not user.is_admin
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/delete_department/<int:department_id>', methods=['POST'])
@login_required
def delete_department(department_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
    
    department = Department.query.get_or_404(department_id)
    
    # Удаляем все сообщения в отделе
    Message.query.filter_by(department_id=department_id).delete()
    
    # Обновляем пользователей, у которых был этот отдел
    User.query.filter_by(department_id=department_id).update({User.department_id: None})
    
    # Обновляем дочерние отделы
    Department.query.filter_by(parent_id=department_id).update({Department.parent_id: None})
    
    db.session.delete(department)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/delete_message/<int:message_id>', methods=['POST'])
@login_required
def delete_message(message_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Доступ запрещен'})
    
    message = Message.query.get_or_404(message_id)
    db.session.delete(message)
    db.session.commit()
    return jsonify({'success': True})

# Socket.IO события
@socketio.on('send_message')
def handle_message(data):
    if not current_user.is_authenticated:
        return
        
    message = Message(
        content=data['content'],
        user_id=current_user.id,
        department_id=data['department_id']
    )
    db.session.add(message)
    db.session.commit()
    
    emit('new_message', {
        'content': message.content,
        'username': current_user.username,
        'timestamp': message.timestamp.strftime('%d.%m.%Y %H:%M'),
        'user_id': current_user.id,
        'is_own': current_user.id == message.user_id,
        'message_id': message.id
    }, broadcast=True)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Создаем администратора по умолчанию, если его нет
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@example.com',
                password_hash=generate_password_hash('admin'),
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
    socketio.run(app, debug=True) 