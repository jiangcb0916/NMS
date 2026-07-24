const form = document.getElementById('login-form');
const submitButton = document.getElementById('login-submit');
const message = document.getElementById('login-message');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('toggle-password');

if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
        const showing = passwordInput.type === 'text';
        passwordInput.type = showing ? 'password' : 'text';
        passwordToggle.setAttribute('aria-label', showing ? '显示密码' : '隐藏密码');
        passwordToggle.setAttribute('title', showing ? '显示密码' : '隐藏密码');
        const icon = passwordToggle.querySelector('i');
        if (icon) {
            icon.className = showing ? 'bi bi-eye' : 'bi bi-eye-slash';
        }
        passwordInput.focus();
    });
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.setAttribute('aria-busy', 'true');

    const payload = {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        remember_me: document.getElementById('remember-me').checked
    };

    try {
        const response = await fetch('/api/user/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.code === 0) {
            window.location.href = result.data.redirect_url || '/';
            return;
        }

        message.textContent = result.message || '登录失败';
    } catch (error) {
        message.textContent = '登录请求失败';
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('is-loading');
        submitButton.setAttribute('aria-busy', 'false');
    }
});
