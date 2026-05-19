async function apiGet(url) {
    const response = await fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '请求失败');
    }
    return result.data;
}

async function apiGetResult(url) {
    const response = await fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    return response.json();
}

async function apiPost(url, payload = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '请求失败');
    }
    return result.data;
}

async function apiPostForm(url, formData) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '请求失败');
    }
    return result.data;
}

async function apiPut(url, payload = {}) {
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '请求失败');
    }
    return result.data;
}

async function apiDelete(url) {
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
        throw new Error(result.message || '请求失败');
    }
    return result.data;
}

function showToast(message, type = 'info') {
    const stack = document.getElementById('toast-stack');
    const item = document.createElement('div');
    item.className = `toast-message ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3500);
}

const viewTitles = {
    dashboard: ['仪表盘', '系统运行概览'],
    wireless: ['无线控制器', 'AP、SSID 与无线用户状态'],
    devices: ['设备列表', '本地设备清单和在线状态'],
    clients: ['客户端列表', '联软准入终端数据'],
    cache: ['缓存管理', '姓名与设备系统信息缓存'],
    users: ['用户管理', '系统账号与权限']
};

const clientState = {
    page: 1,
    perPage: 10,
    query: '',
    resolveNames: false,
    pages: 0,
    total: 0
};

const deviceState = {
    page: 1,
    perPage: 10,
    query: '',
    category: '',
    status: '',
    pages: 0,
    total: 0,
    categories: [],
    statusCounts: {
        all: 0,
        online: 0,
        offline: 0
    }
};

let currentUser = null;
let usersCache = [];
let devicesCache = [];

function showView(viewId, navId, titleKey) {
    document.querySelectorAll('.app-view').forEach((view) => {
        view.hidden = view.id !== viewId;
    });
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.id === navId);
    });

    const title = viewTitles[titleKey] || viewTitles.dashboard;
    document.getElementById('page-title').textContent = title[0];
    document.getElementById('page-subtitle').textContent = title[1];
}

async function loadProfile() {
    const user = await apiGet('/api/user/profile');
    currentUser = user;
    document.getElementById('current-user-name').textContent = user.full_name || user.username;
    document.getElementById('current-user-role').textContent = user.role;
    if (user.role !== 'admin' && !user.is_superuser) {
        document.getElementById('users-nav').classList.add('disabled');
    }
}

async function loadSummary() {
    const data = await apiGet('/api/dashboard/summary');
    document.getElementById('metric-users').textContent = `${data.users.active}/${data.users.total}`;
    document.getElementById('metric-devices').textContent = `${data.devices.online}/${data.devices.total}`;
    document.getElementById('metric-cache').textContent = data.cache.user_names + data.cache.device_os;
}

async function loadHealth() {
    const data = await apiGet('/api/health');
    const pill = document.getElementById('health-pill');
    pill.textContent = data.status;
    pill.classList.toggle('ok', data.status === 'ok');
    document.getElementById('system-version').textContent = data.version;
    document.getElementById('database-status').textContent = data.database;
}

async function loadUsers() {
    showView('users-panel', 'users-nav', 'users');
    const usersPanel = document.getElementById('users-panel');
    const body = document.getElementById('users-table-body');
    usersPanel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';

    try {
        const result = await apiGet('/api/user/list');
        const users = Array.isArray(result) ? result : (result.users || []);
        usersCache = users;
        if (!users.length) {
            body.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = users.map((user) => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.full_name || '-')}</td>
                <td>${escapeHtml(user.email || '-')}</td>
                <td>${escapeHtml(user.role)}</td>
                <td>${renderUserStatus(user)}</td>
                <td>${escapeHtml(user.last_login || '-')}</td>
                <td>${renderUserActions(user)}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function loadDevices(options = {}) {
    deviceState.page = options.page || deviceState.page;
    deviceState.perPage = options.perPage || deviceState.perPage;
    deviceState.query = options.query !== undefined ? options.query : deviceState.query;
    deviceState.category = options.category !== undefined ? options.category : deviceState.category;
    deviceState.status = options.status !== undefined ? options.status : deviceState.status;

    const searchControl = document.getElementById('device-search');
    const categoryControl = document.getElementById('device-category-filter');
    const pageSizeControl = document.getElementById('device-page-size');
    if (options.query === undefined && searchControl) {
        deviceState.query = searchControl.value.trim();
    }
    if (options.category === undefined && categoryControl) {
        deviceState.category = categoryControl.value;
    }
    if (options.perPage === undefined && pageSizeControl) {
        deviceState.perPage = Number(pageSizeControl.value);
    }

    showView('devices-panel', 'devices-nav', 'devices');
    const panel = document.getElementById('devices-panel');
    const body = document.getElementById('devices-table-body');
    const summary = document.getElementById('devices-summary');
    panel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const params = new URLSearchParams({
            page: deviceState.page,
            per_page: deviceState.perPage,
            q: deviceState.query,
            category: deviceState.category,
            status: deviceState.status
        });
        const result = await apiGet(`/api/access-control/device-list?${params.toString()}`);
        const devices = result.devices || [];
        devicesCache = devices;
        deviceState.page = result.page || deviceState.page;
        deviceState.pages = result.pages || 0;
        deviceState.total = result.total || 0;
        deviceState.categories = result.categories || [];
        deviceState.status = result.status || '';
        deviceState.statusCounts = result.status_counts || {all: 0, online: 0, offline: 0};
        renderDeviceCategoryOptions();
        renderDeviceStatusFilters();
        renderDevicePager();

        summary.textContent = `${renderDeviceSummaryPrefix()}共 ${deviceState.total} 台，当前显示 ${result.returned || devices.length} 台`;
        if (!devices.length) {
            body.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = devices.map((device) => `
            <tr>
                <td title="${escapeHtml(device.details || '')}">${escapeHtml(device.username)}</td>
                <td>${escapeHtml(device.ip_address)}</td>
                <td>${escapeHtml(device.mac_address || '-')}</td>
                <td>${escapeHtml(device.category || '未分类')}</td>
                <td>${renderDeviceStatus(device)}</td>
                <td>${escapeHtml(device.last_check_time || '-')}</td>
                <td>${renderDeviceActions(device)}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function loadWireless() {
    showView('wireless-panel', 'wireless-nav', 'wireless');
    const panel = document.getElementById('wireless-panel');
    const body = document.getElementById('wireless-ap-table-body');
    panel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';

    try {
        const status = await apiGetResult('/api/status/wireless-controller');
        const apInfo = await apiGetResult('/api/statistics/ap-info');
        const data = status.data || {};
        document.getElementById('wireless-users').textContent = data.wireless_users ?? 0;
        document.getElementById('wireless-ap-online').textContent = data.ap_online ?? 0;
        document.getElementById('wireless-cpu').textContent = `${data.cpu_usage ?? 0}%`;

        const apList = (apInfo.data && apInfo.data.ap_list) || [];
        if (!apList.length) {
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(apInfo.message || status.message || '暂无数据')}</td></tr>`;
            return;
        }
        body.innerHTML = apList.map((ap) => `
            <tr>
                <td>${escapeHtml(ap.ap_name || '-')}</td>
                <td>${escapeHtml(ap.ap_ip || '-')}</td>
                <td>${escapeHtml(ap.ap_mac_address || '-')}</td>
                <td>${escapeHtml(ap.status_text || ap.status || '-')}</td>
                <td>${escapeHtml(ap.user_count ?? 0)}</td>
                <td>${escapeHtml(ap.ap_recv_rate || '-')}</td>
                <td>${escapeHtml(ap.ap_send_rate || '-')}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function loadClients(options = {}) {
    clientState.page = options.page || clientState.page;
    clientState.perPage = options.perPage || clientState.perPage;
    clientState.query = options.query !== undefined ? options.query : clientState.query;
    clientState.resolveNames = options.resolveNames !== undefined ? options.resolveNames : clientState.resolveNames;

    showView('clients-panel', 'clients-nav', 'clients');
    const panel = document.getElementById('clients-panel');
    const body = document.getElementById('clients-table-body');
    const summary = document.getElementById('clients-summary');
    panel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const params = new URLSearchParams({
            page: clientState.page,
            per_page: clientState.perPage,
            q: clientState.query,
            resolve_names: clientState.resolveNames ? '1' : '0'
        });
        const result = await apiGetResult(`/api/access-control/client-list?${params.toString()}`);
        const data = result.data || {};
        clientState.page = data.page || clientState.page;
        clientState.pages = data.pages || 0;
        clientState.total = data.total || 0;
        renderClientPager();

        if (result.code !== 0) {
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(result.message || '请求失败')}</td></tr>`;
            summary.textContent = '无法获取客户端数据';
            return;
        }

        const clients = data.client_list || [];
        summary.textContent = `共 ${data.total || 0} 条，当前显示 ${data.returned || clients.length} 条，姓名${data.names_resolved ? '已解析当前页' : '优先使用缓存'}`;
        if (!clients.length) {
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(result.message || '暂无数据')}</td></tr>`;
            return;
        }
        body.innerHTML = clients.map((client) => `
            <tr>
                <td>${escapeHtml(client.device_ip || '-')}</td>
                <td>${escapeHtml(client.username || '-')}</td>
                <td>${escapeHtml(client.real_name || '-')}</td>
                <td>${escapeHtml(client.device_name || '-')}</td>
                <td>${escapeHtml(client.mac_address || '-')}</td>
                <td>${escapeHtml(client.department || '-')}</td>
                <td>${client.is_online ? '在线' : '离线'}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function loadCacheStatus() {
    showView('cache-panel', 'cache-nav', 'cache');
    const panel = document.getElementById('cache-panel');
    panel.hidden = false;
    try {
        const data = await apiGet('/api/access-control/cache-status');
        const osStats = await apiGet('/api/cache/os-stats');
        document.getElementById('cache-user-names').textContent = `${data.user_name_cache.valid_cached}/${data.user_name_cache.database_cached}`;
        document.getElementById('cache-device-os').textContent = `${data.device_os_cache.valid_cached}/${data.device_os_cache.database_cached}`;
        document.getElementById('cache-expired-os').textContent = osStats.expired_caches;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function saveDevice(event) {
    event.preventDefault();
    const message = document.getElementById('device-form-message');
    const saveButton = document.getElementById('save-device-button');
    const deviceId = document.getElementById('device-id').value;
    const payload = {
        username: document.getElementById('device-username').value.trim(),
        ip_address: document.getElementById('device-ip').value.trim(),
        mac_address: document.getElementById('device-mac').value.trim(),
        category: document.getElementById('device-category').value.trim(),
        details: document.getElementById('device-details').value.trim()
    };

    message.textContent = '';
    saveButton.disabled = true;
    try {
        if (deviceId) {
            await apiPut(`/api/access-control/device-list/${deviceId}`, payload);
            showToast('设备已更新');
        } else {
            await apiPost('/api/access-control/device-list', payload);
            showToast('设备已创建');
        }
        closeModal('device-modal');
        await Promise.all([loadDevices(), loadSummary()]);
    } catch (error) {
        message.textContent = error.message;
    } finally {
        saveButton.disabled = false;
    }
}

async function refreshDeviceStatus() {
    try {
        await apiPost('/api/access-control/device-status/refresh');
        await Promise.all([loadDevices(), loadSummary()]);
        showToast('设备状态已刷新');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderDevicePager() {
    const pageText = document.getElementById('devices-page');
    const prev = document.getElementById('devices-prev');
    const next = document.getElementById('devices-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = deviceState.pages ? `${deviceState.page} / ${deviceState.pages}` : '-';
    prev.disabled = deviceState.page <= 1;
    next.disabled = deviceState.pages === 0 || deviceState.page >= deviceState.pages;
}

function renderDeviceCategoryOptions() {
    const select = document.getElementById('device-category-filter');
    if (!select) {
        return;
    }
    const categories = [...new Set((deviceState.categories || []).filter(Boolean))];
    if (deviceState.category && !categories.includes(deviceState.category)) {
        categories.unshift(deviceState.category);
    }
    select.innerHTML = [
        '<option value="">全部分类</option>',
        ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join('');
    select.value = deviceState.category;
}

function renderDeviceStatusFilters() {
    const statusMap = {
        '': 'all',
        online: 'online',
        offline: 'offline'
    };
    document.querySelectorAll('[data-device-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.deviceStatus === deviceState.status);
    });

    const counts = deviceState.statusCounts || {};
    Object.entries(statusMap).forEach(([, key]) => {
        const target = document.getElementById(`device-status-${key}`);
        if (target) {
            target.textContent = counts[key] ?? 0;
        }
    });
}

function renderDeviceSummaryPrefix() {
    if (deviceState.status === 'online') {
        return '在线设备，';
    }
    if (deviceState.status === 'offline') {
        return '离线设备，';
    }
    return '';
}

function renderDeviceStatus(device) {
    return device.is_online
        ? '<span class="status-badge ok">在线</span>'
        : '<span class="status-badge bad">离线</span>';
}

function renderDeviceActions(device) {
    return `
        <div class="action-cell">
            <button class="row-button" type="button" data-device-action="edit" data-device-id="${device.id}">编辑</button>
            <button class="row-button" type="button" data-device-action="check" data-device-id="${device.id}">检测</button>
            <button class="row-button danger" type="button" data-device-action="delete" data-device-id="${device.id}">删除</button>
        </div>
    `;
}

function findDevice(deviceId) {
    return devicesCache.find((device) => String(device.id) === String(deviceId));
}

function openCreateDeviceModal() {
    document.getElementById('device-modal-title').textContent = '新增设备';
    document.getElementById('device-form').reset();
    document.getElementById('device-id').value = '';
    document.getElementById('device-form-message').textContent = '';
    openModal('device-modal');
}

function openEditDeviceModal(device) {
    if (!device) {
        showToast('设备不存在', 'error');
        return;
    }
    document.getElementById('device-modal-title').textContent = '编辑设备';
    document.getElementById('device-id').value = device.id;
    document.getElementById('device-username').value = device.username || '';
    document.getElementById('device-ip').value = device.ip_address || '';
    document.getElementById('device-mac').value = device.mac_address || '';
    document.getElementById('device-category').value = device.category || '';
    document.getElementById('device-details').value = device.details || '';
    document.getElementById('device-form-message').textContent = '';
    openModal('device-modal');
}

async function deleteDevice(device) {
    if (!device) {
        showToast('设备不存在', 'error');
        return;
    }
    if (!window.confirm(`确认删除设备 ${device.username}？`)) {
        return;
    }
    try {
        await apiDelete(`/api/access-control/device-list/${device.id}`);
        showToast('设备已删除');
        await Promise.all([loadDevices(), loadSummary()]);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function checkDeviceStatus(device) {
    if (!device) {
        showToast('设备不存在', 'error');
        return;
    }
    try {
        await apiPost(`/api/access-control/device-status/${device.id}`);
        showToast('设备状态已检测');
        await Promise.all([loadDevices(), loadSummary()]);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function importDevices(event) {
    const fileInput = event.currentTarget;
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
        const result = await apiPostForm('/api/access-control/device-list/import', formData);
        const message = `导入完成：新增 ${result.created || 0} 条，更新 ${result.updated || 0} 条，跳过 ${result.skipped || 0} 条`;
        showToast(result.error_count ? `${message}，${result.error_count} 行有错误` : message, result.error_count ? 'error' : 'info');
        await Promise.all([loadDevices({page: 1}), loadSummary()]);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        fileInput.value = '';
    }
}

function exportDevices() {
    const searchControl = document.getElementById('device-search');
    const categoryControl = document.getElementById('device-category-filter');
    if (searchControl) {
        deviceState.query = searchControl.value.trim();
    }
    if (categoryControl) {
        deviceState.category = categoryControl.value;
    }
    const params = new URLSearchParams();
    if (deviceState.query) {
        params.set('q', deviceState.query);
    }
    if (deviceState.category) {
        params.set('category', deviceState.category);
    }
    if (deviceState.status) {
        params.set('status', deviceState.status);
    }
    const query = params.toString();
    window.location.href = `/api/access-control/device-list/export${query ? `?${query}` : ''}`;
}

async function loadIntegrationStatus() {
    const list = document.getElementById('integration-status-list');
    list.innerHTML = '<div class="empty-state">检查中</div>';

    try {
        const services = await apiGet('/api/integrations/status');
        list.innerHTML = services.map((service) => `
            <div class="status-row">
                <span class="status-dot ${service.ok ? 'ok' : 'bad'}"></span>
                <div>
                    <div class="status-name">${escapeHtml(service.label)}</div>
                    <div class="status-detail">${escapeHtml(service.message)} · ${escapeHtml(service.seconds)}s</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        list.innerHTML = `<div class="empty-state error-text">${escapeHtml(error.message)}</div>`;
    }
}

function renderClientPager() {
    const pageText = document.getElementById('clients-page');
    const prev = document.getElementById('clients-prev');
    const next = document.getElementById('clients-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = clientState.pages ? `${clientState.page} / ${clientState.pages}` : '-';
    prev.disabled = clientState.page <= 1;
    next.disabled = clientState.pages === 0 || clientState.page >= clientState.pages;
}

function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function renderUserStatus(user) {
    const activeBadge = user.is_active
        ? '<span class="status-badge ok">启用</span>'
        : '<span class="status-badge bad">停用</span>';
    const lockedBadge = user.is_locked
        ? `<span class="status-badge warn">锁定${user.locked_until ? ` 至 ${escapeHtml(user.locked_until)}` : ''}</span>`
        : '';
    const superBadge = user.is_superuser ? '<span class="status-badge">超级管理员</span>' : '';
    return `<span class="status-badges">${activeBadge}${lockedBadge}${superBadge}</span>`;
}

function renderUserActions(user) {
    const canLock = currentUser && user.id !== currentUser.id && !user.is_superuser;
    const lockAction = user.is_locked
        ? `<button class="row-button" type="button" data-user-action="unlock" data-user-id="${user.id}">解锁</button>`
        : `<button class="row-button danger" type="button" data-user-action="lock" data-user-id="${user.id}" ${canLock ? '' : 'disabled'}>锁定</button>`;
    return `
        <div class="action-cell">
            <button class="row-button" type="button" data-user-action="edit" data-user-id="${user.id}">编辑</button>
            <button class="row-button" type="button" data-user-action="reset-password" data-user-id="${user.id}">重置密码</button>
            ${lockAction}
        </div>
    `;
}

function findUser(userId) {
    return usersCache.find((user) => String(user.id) === String(userId));
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.hidden = false;
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.hidden = true;
    }
}

function openCreateUserModal() {
    document.getElementById('user-modal-title').textContent = '新增用户';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-username').disabled = false;
    document.getElementById('user-password-row').hidden = false;
    document.getElementById('user-password').required = true;
    document.getElementById('user-is-active').checked = true;
    document.getElementById('user-form-message').textContent = '';
    openModal('user-modal');
}

function openEditUserModal(user) {
    if (!user) {
        showToast('用户不存在', 'error');
        return;
    }
    document.getElementById('user-modal-title').textContent = '编辑用户';
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-username').disabled = true;
    document.getElementById('user-full-name').value = user.full_name || '';
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-role').value = user.role || 'user';
    document.getElementById('user-password-row').hidden = true;
    document.getElementById('user-password').required = false;
    document.getElementById('user-password').value = '';
    document.getElementById('user-is-active').checked = Boolean(user.is_active);
    document.getElementById('user-form-message').textContent = '';
    openModal('user-modal');
}

function openPasswordModal(user) {
    if (!user) {
        showToast('用户不存在', 'error');
        return;
    }
    document.getElementById('password-user-id').value = user.id;
    document.getElementById('new-password').value = '';
    document.getElementById('password-form-message').textContent = '';
    openModal('password-modal');
}

function openLockModal(user) {
    if (!user) {
        showToast('用户不存在', 'error');
        return;
    }
    document.getElementById('lock-user-id').value = user.id;
    document.getElementById('lock-minutes').value = 30;
    document.getElementById('lock-form-message').textContent = '';
    openModal('lock-modal');
}

async function saveUser(event) {
    event.preventDefault();
    const message = document.getElementById('user-form-message');
    const saveButton = document.getElementById('save-user-button');
    const userId = document.getElementById('user-id').value;
    const payload = {
        full_name: document.getElementById('user-full-name').value.trim(),
        email: document.getElementById('user-email').value.trim(),
        role: document.getElementById('user-role').value,
        is_active: document.getElementById('user-is-active').checked
    };

    if (!userId) {
        payload.username = document.getElementById('user-username').value.trim();
        payload.password = document.getElementById('user-password').value;
    }

    message.textContent = '';
    saveButton.disabled = true;
    try {
        if (userId) {
            await apiPut(`/api/user/${userId}`, payload);
            showToast('用户已更新');
        } else {
            await apiPost('/api/user/create', payload);
            showToast('用户已创建');
        }
        closeModal('user-modal');
        await Promise.all([loadUsers(), loadSummary()]);
    } catch (error) {
        message.textContent = error.message;
    } finally {
        saveButton.disabled = false;
    }
}

async function resetUserPassword(event) {
    event.preventDefault();
    const message = document.getElementById('password-form-message');
    const userId = document.getElementById('password-user-id').value;
    const newPassword = document.getElementById('new-password').value;
    message.textContent = '';
    try {
        await apiPost(`/api/user/${userId}/reset-password`, {new_password: newPassword});
        closeModal('password-modal');
        showToast('密码已重置');
    } catch (error) {
        message.textContent = error.message;
    }
}

async function lockUser(event) {
    event.preventDefault();
    const message = document.getElementById('lock-form-message');
    const userId = document.getElementById('lock-user-id').value;
    const minutes = Number(document.getElementById('lock-minutes').value);
    message.textContent = '';
    try {
        await apiPost(`/api/user/${userId}/lock`, {minutes});
        closeModal('lock-modal');
        showToast('用户已锁定');
        await loadUsers();
    } catch (error) {
        message.textContent = error.message;
    }
}

async function unlockUser(user) {
    if (!user) {
        showToast('用户不存在', 'error');
        return;
    }
    try {
        await apiPost(`/api/user/${user.id}/unlock`);
        showToast('用户已解锁');
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function logout() {
    try {
        await apiPost('/api/user/logout');
    } finally {
        window.location.href = '/login';
    }
}

async function boot() {
    try {
        await loadProfile();
        showView('dashboard-panel', 'dashboard-nav', 'dashboard');
        await Promise.all([loadSummary(), loadHealth()]);
    } catch (error) {
        if (error.message.includes('未授权')) {
            window.location.href = '/login';
            return;
        }
        showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    const refreshSummary = document.getElementById('refresh-summary');
    if (refreshSummary) {
        refreshSummary.addEventListener('click', () => {
            Promise.all([loadSummary(), loadHealth()])
                .then(() => showToast('已刷新'))
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const dashboardNav = document.getElementById('dashboard-nav');
    if (dashboardNav) {
        dashboardNav.addEventListener('click', (event) => {
            event.preventDefault();
            showView('dashboard-panel', 'dashboard-nav', 'dashboard');
            Promise.all([loadSummary(), loadHealth()])
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const usersNav = document.getElementById('users-nav');
    if (usersNav) {
        usersNav.addEventListener('click', (event) => {
            event.preventDefault();
            if (usersNav.classList.contains('disabled')) {
                return;
            }
            loadUsers();
        });
    }

    const devicesNav = document.getElementById('devices-nav');
    if (devicesNav) {
        devicesNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadDevices();
        });
    }

    const wirelessNav = document.getElementById('wireless-nav');
    if (wirelessNav) {
        wirelessNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadWireless();
        });
    }

    const clientsNav = document.getElementById('clients-nav');
    if (clientsNav) {
        clientsNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadClients({page: 1, resolveNames: false});
        });
    }

    const cacheNav = document.getElementById('cache-nav');
    if (cacheNav) {
        cacheNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadCacheStatus();
        });
    }

    const reloadUsers = document.getElementById('reload-users');
    if (reloadUsers) {
        reloadUsers.addEventListener('click', loadUsers);
    }

    const createUserButton = document.getElementById('create-user-button');
    if (createUserButton) {
        createUserButton.addEventListener('click', openCreateUserModal);
    }

    const usersTableBody = document.getElementById('users-table-body');
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('[data-user-action]');
            if (!button || button.disabled) {
                return;
            }
            const user = findUser(button.dataset.userId);
            if (button.dataset.userAction === 'edit') {
                openEditUserModal(user);
            } else if (button.dataset.userAction === 'reset-password') {
                openPasswordModal(user);
            } else if (button.dataset.userAction === 'lock') {
                openLockModal(user);
            } else if (button.dataset.userAction === 'unlock') {
                unlockUser(user);
            }
        });
    }

    const reloadDevices = document.getElementById('reload-devices');
    if (reloadDevices) {
        reloadDevices.addEventListener('click', () => loadDevices());
    }

    const createDeviceButton = document.getElementById('create-device-button');
    if (createDeviceButton) {
        createDeviceButton.addEventListener('click', openCreateDeviceModal);
    }

    const importDevicesButton = document.getElementById('import-devices-button');
    const deviceImportFile = document.getElementById('device-import-file');
    if (importDevicesButton && deviceImportFile) {
        importDevicesButton.addEventListener('click', () => deviceImportFile.click());
        deviceImportFile.addEventListener('change', importDevices);
    }

    const exportDevicesButton = document.getElementById('export-devices-button');
    if (exportDevicesButton) {
        exportDevicesButton.addEventListener('click', exportDevices);
    }

    const deviceSearch = document.getElementById('device-search');
    if (deviceSearch) {
        deviceSearch.addEventListener('input', debounce((event) => {
            loadDevices({page: 1, query: event.target.value.trim()});
        }));
    }

    const deviceCategoryFilter = document.getElementById('device-category-filter');
    if (deviceCategoryFilter) {
        deviceCategoryFilter.addEventListener('change', (event) => {
            loadDevices({page: 1, category: event.target.value});
        });
    }

    const devicePageSize = document.getElementById('device-page-size');
    if (devicePageSize) {
        devicePageSize.addEventListener('change', (event) => {
            loadDevices({page: 1, perPage: Number(event.target.value)});
        });
    }

    document.querySelectorAll('[data-device-status]').forEach((button) => {
        button.addEventListener('click', () => {
            loadDevices({page: 1, status: button.dataset.deviceStatus || ''});
        });
    });

    const devicesPrev = document.getElementById('devices-prev');
    if (devicesPrev) {
        devicesPrev.addEventListener('click', () => {
            if (deviceState.page > 1) {
                loadDevices({page: deviceState.page - 1});
            }
        });
    }

    const devicesNext = document.getElementById('devices-next');
    if (devicesNext) {
        devicesNext.addEventListener('click', () => {
            if (deviceState.page < deviceState.pages) {
                loadDevices({page: deviceState.page + 1});
            }
        });
    }

    const devicesTableBody = document.getElementById('devices-table-body');
    if (devicesTableBody) {
        devicesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('[data-device-action]');
            if (!button || button.disabled) {
                return;
            }
            const device = findDevice(button.dataset.deviceId);
            if (button.dataset.deviceAction === 'edit') {
                openEditDeviceModal(device);
            } else if (button.dataset.deviceAction === 'check') {
                checkDeviceStatus(device);
            } else if (button.dataset.deviceAction === 'delete') {
                deleteDevice(device);
            }
        });
    }

    const reloadWireless = document.getElementById('reload-wireless');
    if (reloadWireless) {
        reloadWireless.addEventListener('click', loadWireless);
    }

    const reloadClients = document.getElementById('reload-clients');
    if (reloadClients) {
        reloadClients.addEventListener('click', () => loadClients({page: clientState.page, resolveNames: false}));
    }

    const resolveClientNames = document.getElementById('resolve-client-names');
    if (resolveClientNames) {
        resolveClientNames.addEventListener('click', () => {
            showToast('开始解析当前页姓名');
            loadClients({resolveNames: true});
        });
    }

    const clientSearch = document.getElementById('client-search');
    if (clientSearch) {
        clientSearch.addEventListener('input', debounce((event) => {
            loadClients({page: 1, query: event.target.value.trim(), resolveNames: false});
        }));
    }

    const clientPageSize = document.getElementById('client-page-size');
    if (clientPageSize) {
        clientPageSize.addEventListener('change', (event) => {
            loadClients({page: 1, perPage: Number(event.target.value), resolveNames: false});
        });
    }

    const clientsPrev = document.getElementById('clients-prev');
    if (clientsPrev) {
        clientsPrev.addEventListener('click', () => {
            if (clientState.page > 1) {
                loadClients({page: clientState.page - 1, resolveNames: false});
            }
        });
    }

    const clientsNext = document.getElementById('clients-next');
    if (clientsNext) {
        clientsNext.addEventListener('click', () => {
            if (clientState.page < clientState.pages) {
                loadClients({page: clientState.page + 1, resolveNames: false});
            }
        });
    }

    const deviceForm = document.getElementById('device-form');
    if (deviceForm) {
        deviceForm.addEventListener('submit', saveDevice);
    }

    const refreshDeviceStatusButton = document.getElementById('refresh-device-status');
    if (refreshDeviceStatusButton) {
        refreshDeviceStatusButton.addEventListener('click', refreshDeviceStatus);
    }

    const reloadCache = document.getElementById('reload-cache');
    if (reloadCache) {
        reloadCache.addEventListener('click', loadCacheStatus);
    }

    const checkIntegrations = document.getElementById('check-integrations');
    if (checkIntegrations) {
        checkIntegrations.addEventListener('click', loadIntegrationStatus);
    }

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', saveUser);
    }

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', resetUserPassword);
    }

    const lockForm = document.getElementById('lock-form');
    if (lockForm) {
        lockForm.addEventListener('submit', lockUser);
    }

    boot();
});
