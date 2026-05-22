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

async function apiPostResult(url, payload = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || '请求失败');
    }
    return result;
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
    firewallBandwidth: ['防火墙带宽', '华为防火墙上下行趋势'],
    trafficAnalysis: ['流量分析', ''],
    osdwan: ['OSDWAN 监控', '用户与带宽趋势'],
    switches: ['交换机监控', 'Prometheus 交换机目标状态'],
    wireless: ['无线控制器', 'AP、SSID 与无线用户状态'],
    devices: ['设备列表', '本地设备清单和在线状态'],
    clients: ['客户端列表', '联软准入终端数据'],
    users: ['用户管理', '系统账号与权限']
};

const clientState = {
    page: 1,
    perPage: 10,
    query: '',
    status: '',
    pages: 0,
    total: 0,
    statusCounts: {
        all: 0,
        online: 0,
        offline: 0
    }
};

const trafficAnalysisState = {
    page: 1,
    perPage: 10,
    query: '',
    line: '0',
    pages: 0,
    total: 0,
    allTotal: 0,
    top: null,
};

const switchState = {
    page: 1,
    perPage: 10,
    query: '',
    vendor: '',
    status: '',
    selectedInstance: '',
    portQuery: '',
    portStatus: '',
    portScope: 'business',
    portPage: 1,
    portPerPage: 10,
    portPages: 0,
    portTotal: 0,
    trafficRange: '1h',
    traceLoading: false,
    traceData: null,
    traceIp: '',
    ports: [],
    trafficSamples: [],
    pages: 0,
    total: 0,
    allTotal: 0,
    statusCounts: {
        all: 0,
        online: 0,
        offline: 0
    },
    vendorCounts: {}
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
    },
    statusFreshness: null,
    statusRefreshing: false,
    lastAutoRefreshAt: 0,
    portLookups: {}
};

const wirelessUserState = {
    page: 1,
    perPage: 10,
    query: '',
    resolveNames: false,
    sortBy: '',
    sortOrder: 'desc',
    pages: 0,
    total: 0,
    allTotal: 0,
    cached: false
};

const wirelessApState = {
    page: 1,
    perPage: 10,
    query: '',
    status: '',
    sortBy: '',
    sortOrder: 'desc',
    pages: 0,
    total: 0,
    allTotal: 0,
    statusCounts: {
        all: 0,
        online: 0,
        offline: 0
    }
};

let currentUser = null;
let usersCache = [];
let devicesCache = [];
let wirelessActiveView = 'aps';
const OSDWAN_METRICS_REFRESH_MS = 60 * 1000;
let osdwanMetricsAutoRefreshing = false;
let trafficAnalysisRequestId = 0;
let dashboardFirewallWarmupTimer = null;
let dashboardFirewallWarmupRetries = 0;
const firewallBandwidthState = {
    range: '6h',
    samples: [],
    latest: null,
};

const osdwanState = {
    data: null,
    allSamples: [],
    nodeSamples: [],
    allPeriod: '1day',
    nodePeriod: '6hours',
    userPage: 1,
    userPerPage: 10,
    userPages: 0,
    userTotal: 0,
    userQuery: '',
    userDepartment: '',
    userDepartments: [],
    userPeopleCount: 0,
    userMultiAccountCount: 0,
    proxyStatus: null,
};

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

async function loadSummary(options = {}) {
    const data = await apiGet('/api/dashboard/overview');
    const summary = data.summary || {};
    const wireless = data.wireless || {};
    const osdwan = data.osdwan || {};
    document.getElementById('metric-devices').textContent = `${summary.devices?.online ?? 0}/${summary.devices?.total ?? 0}`;
    document.getElementById('metric-wireless-users').textContent = wireless.wireless_users ?? 0;
    document.getElementById('metric-wireless-ap').textContent = wireless.ap_online ?? 0;
    document.getElementById('metric-osdwan-users').textContent = renderUserCapacity(osdwan.user_count, osdwan.user_capacity);
    document.getElementById('metric-osdwan-exits').textContent = renderProxyStatus(osdwan.proxy_status);
    renderFirewallDashboard(data.firewall || {});
    renderDashboardOsdwan(osdwan);
    renderDashboardHealth(data);
    renderDashboardAppRank(data.traffic_apps || {});
    renderTrafficTopList('wireless-user-upload-top', data.tops?.wireless_users?.upload || []);
    renderTrafficTopList('wireless-user-download-top', data.tops?.wireless_users?.download || []);
    if (!options.skipFirewallWarmup) {
        scheduleDashboardFirewallWarmup(data.firewall || {});
    }
}

function renderFirewallDashboard(firewall) {
    const configured = Boolean(firewall.configured);
    const ok = Boolean(firewall.ok);
    const status = document.getElementById('firewall-status');
    const totalBandwidth = Number(firewall.total_bandwidth || 0);
    const totalUpload = Number(firewall.total_upload ?? (Number(firewall.telecom_upload || 0) + Number(firewall.unicom_upload || 0)));
    const totalDownload = Number(firewall.total_download ?? (Number(firewall.telecom_download || 0) + Number(firewall.unicom_download || 0)));
    const uploadUtilization = Number(firewall.upload_utilization ?? (totalBandwidth ? (totalUpload / totalBandwidth) * 100 : 0));
    const downloadUtilization = Number(firewall.download_utilization ?? (totalBandwidth ? (totalDownload / totalBandwidth) * 100 : 0));

    status.textContent = configured ? (ok ? '正常' : '异常') : '未配置';
    status.classList.toggle('ok', configured && ok);
    status.classList.toggle('bad', configured && !ok);
    document.getElementById('firewall-total-upload').textContent = formatMbps(totalUpload);
    document.getElementById('firewall-total-download').textContent = formatMbps(totalDownload);
    document.getElementById('firewall-upload-utilization').textContent = `${formatNumber(uploadUtilization, 1)}%`;
    document.getElementById('firewall-download-utilization').textContent = `${formatNumber(downloadUtilization, 1)}%`;
    document.getElementById('firewall-upload-util-bar').style.width = `${clampPercent(uploadUtilization)}%`;
    document.getElementById('firewall-download-util-bar').style.width = `${clampPercent(downloadUtilization)}%`;
    document.getElementById('firewall-telecom-upload').textContent = formatMbps(firewall.telecom_upload);
    document.getElementById('firewall-telecom-download').textContent = formatMbps(firewall.telecom_download);
    document.getElementById('firewall-unicom-upload').textContent = formatMbps(firewall.unicom_upload);
    document.getElementById('firewall-unicom-download').textContent = formatMbps(firewall.unicom_download);
}

function renderDashboardOsdwan(osdwan) {
    const status = document.getElementById('dashboard-osdwan-status');
    const bandwidth = osdwan.bandwidth_latest || {};
    const saas = osdwan.saas_latest || {};

    status.textContent = osdwan.configured ? (osdwan.ok ? '正常' : '异常') : '未配置';
    status.classList.toggle('ok', Boolean(osdwan.configured && osdwan.ok));
    status.classList.toggle('bad', Boolean(osdwan.configured && !osdwan.ok));
    document.getElementById('dashboard-osdwan-bandwidth-down').textContent = `↓ ${bandwidth.download_rate || '-'}`;
    document.getElementById('dashboard-osdwan-bandwidth-up').textContent = `↑ ${bandwidth.upload_rate || '-'}`;
    document.getElementById('dashboard-osdwan-saas-down').textContent = `↓ ${saas.download_rate || '-'}`;
    document.getElementById('dashboard-osdwan-saas-up').textContent = `↑ ${saas.upload_rate || '-'}`;
}

function renderDashboardHealth(data) {
    const firewall = data.firewall || {};
    renderHealthItem('health-firewall', firewall.configured, firewall.ok, firewall.configured ? '正常' : '未配置');
    renderHealthItem('health-switches', data.switches?.configured, data.switches?.ok, data.switches?.configured ? `${data.switches?.online ?? 0}/${data.switches?.total ?? 0} UP` : '未配置');
    renderHealthItem('health-wireless', data.wireless?.configured, data.wireless?.ok, data.wireless?.configured ? '正常' : '未配置');
    renderHealthItem('health-osdwan', data.osdwan?.configured, data.osdwan?.ok, data.osdwan?.configured ? renderProxyStatus(data.osdwan?.proxy_status) : '未配置');
    renderHealthItem('health-firewall-cpu', firewall.configured, firewall.ok, firewall.configured ? `${formatNumber(firewall.cpu_usage, 1)}%` : '未配置');
    renderHealthItem('health-firewall-memory', firewall.configured, firewall.ok, firewall.configured ? `${formatNumber(firewall.memory_usage, 1)}%` : '未配置');
    renderHealthItem('health-firewall-bandwidth', firewall.configured, firewall.ok, firewall.configured ? formatMbps(firewall.total_bandwidth) : '未配置');
}

function scheduleDashboardFirewallWarmup(firewall) {
    const totalUpload = Number(firewall.total_upload || 0);
    const totalDownload = Number(firewall.total_download || 0);
    if (!firewall.configured || !firewall.ok || totalUpload > 0 || totalDownload > 0) {
        dashboardFirewallWarmupRetries = 0;
        if (dashboardFirewallWarmupTimer) {
            window.clearTimeout(dashboardFirewallWarmupTimer);
            dashboardFirewallWarmupTimer = null;
        }
        return;
    }
    if (dashboardFirewallWarmupTimer || dashboardFirewallWarmupRetries >= 2) {
        return;
    }
    dashboardFirewallWarmupRetries += 1;
    dashboardFirewallWarmupTimer = window.setTimeout(() => {
        dashboardFirewallWarmupTimer = null;
        const dashboardPanel = document.getElementById('dashboard-panel');
        if (!dashboardPanel || dashboardPanel.hidden || document.visibilityState === 'hidden') {
            return;
        }
        loadSummary()
            .catch((error) => console.warn('仪表盘防火墙数据补刷失败', error));
    }, 1800);
}

function renderHealthItem(elementId, configured, ok, text) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }
    element.textContent = text || '-';
    element.classList.toggle('ok', Boolean(configured && ok));
    element.classList.toggle('bad', Boolean(configured && !ok));
}

function renderDashboardAppRank(payload) {
    const list = document.getElementById('dashboard-app-rank');
    const subtitle = document.getElementById('dashboard-app-rank-subtitle');
    if (!list) {
        return;
    }
    if (!payload.configured) {
        if (subtitle) {
            subtitle.textContent = '深信服 AC 未配置';
        }
        list.innerHTML = '<li class="empty-state">暂无数据</li>';
        return;
    }
    if (!payload.ok) {
        if (subtitle) {
            subtitle.textContent = payload.error || '应用排行读取失败';
        }
        list.innerHTML = '<li class="empty-state">暂无数据</li>';
        return;
    }

    const items = payload.items || [];
    if (subtitle) {
        subtitle.textContent = `共 ${payload.total_apps || 0} 个应用`;
    }
    if (!items.length) {
        list.innerHTML = '<li class="empty-state">暂无数据</li>';
        return;
    }
    list.innerHTML = items.map((item, index) => `
        <li class="traffic-row app-rank-row">
            <span class="traffic-rank">${index + 1}</span>
            <span class="traffic-main">
                <strong title="${escapeHtml(item.app || '-')}">${escapeHtml(item.app || '-')}</strong>
                <small>下行 ${escapeHtml(item.down_rate || '0 bps')} / 上行 ${escapeHtml(item.up_rate || '0 bps')}</small>
                <span class="app-rank-bar"><i style="width: ${clampPercent(item.percent)}%"></i></span>
            </span>
            <span class="traffic-value">${escapeHtml(item.total_rate || '0 bps')}</span>
        </li>
    `).join('');
}

async function loadFirewallBandwidth(options = {}) {
    firewallBandwidthState.range = options.range || firewallBandwidthState.range;
    showView('firewall-bandwidth-panel', 'firewall-bandwidth-nav', 'firewallBandwidth');
    try {
        const params = new URLSearchParams({
            limit: 720,
            refresh: '1',
            range: firewallBandwidthState.range
        });
        const data = await apiGet(`/api/status/huawei-firewall/bandwidth-history?${params.toString()}`);
        renderFirewallBandwidthPage(data);
        if (options.toast) {
            showToast('带宽数据已刷新');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderFirewallBandwidthPage(data) {
    const latest = data.latest || {};
    const samples = data.samples || [];
    const configured = Boolean(latest.configured);
    const ok = Boolean(latest.ok);

    firewallBandwidthState.latest = latest;
    firewallBandwidthState.samples = samples;
    firewallBandwidthState.range = data.range || firewallBandwidthState.range;

    document.getElementById('firewall-bandwidth-source').textContent = latest.snmp_target
        ? `SNMP 目标 ${latest.snmp_target} · ${renderFirewallRangeLabel(firewallBandwidthState.range)} · 样本 ${data.sample_count ?? samples.length} 个`
        : 'SNMP 目标未配置';

    renderFirewallRangeButtons();
    drawBandwidthChart('firewall-unicom-download-chart', samples, [
        {key: 'unicom_download', label: '联通下行', color: '#2563eb', fill: 'rgba(37, 99, 235, 0.14)'},
    ]);
    drawBandwidthChart('firewall-unicom-upload-chart', samples, [
        {key: 'unicom_upload', label: '联通上行', color: '#0f766e', fill: 'rgba(15, 118, 110, 0.14)'},
    ]);
    drawBandwidthChart('firewall-telecom-download-chart', samples, [
        {key: 'telecom_download', label: '电信下行', color: '#2563eb', fill: 'rgba(37, 99, 235, 0.14)'},
    ]);
    drawBandwidthChart('firewall-telecom-upload-chart', samples, [
        {key: 'telecom_upload', label: '电信上行', color: '#0f766e', fill: 'rgba(15, 118, 110, 0.14)'},
    ]);
}

function renderFirewallRangeButtons() {
    const label = document.getElementById('firewall-range-label');
    const rangeLabel = renderFirewallRangeLabel(firewallBandwidthState.range);
    if (label) {
        label.textContent = rangeLabel;
    }
    const toggle = document.getElementById('firewall-range-toggle');
    if (toggle) {
        toggle.setAttribute('aria-label', `选择时间范围，当前${rangeLabel}`);
    }
    document.querySelectorAll('[data-firewall-range]').forEach((button) => {
        const active = button.dataset.firewallRange === firewallBandwidthState.range;
        button.classList.toggle('active', active);
        button.setAttribute('aria-checked', String(active));
    });
}

function openRangeDropdown(dropdown) {
    if (!dropdown) {
        return;
    }
    const trigger = dropdown.querySelector('[data-range-toggle]');
    const menu = dropdown.querySelector('.range-dropdown-menu');
    dropdown.classList.add('open');
    if (trigger) {
        trigger.setAttribute('aria-expanded', 'true');
    }
    if (menu) {
        menu.hidden = false;
    }
}

function closeRangeDropdown(dropdown) {
    if (!dropdown) {
        return;
    }
    const trigger = dropdown.querySelector('[data-range-toggle]');
    const menu = dropdown.querySelector('.range-dropdown-menu');
    dropdown.classList.remove('open');
    if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
    }
    if (menu) {
        menu.hidden = true;
    }
}

function closeRangeDropdowns(except = null) {
    document.querySelectorAll('[data-range-dropdown]').forEach((dropdown) => {
        if (dropdown !== except) {
            closeRangeDropdown(dropdown);
        }
    });
}

function toggleRangeDropdown(dropdown) {
    if (!dropdown) {
        return;
    }
    const shouldOpen = !dropdown.classList.contains('open');
    closeRangeDropdowns(dropdown);
    if (shouldOpen) {
        openRangeDropdown(dropdown);
    } else {
        closeRangeDropdown(dropdown);
    }
}

async function loadTrafficAnalysis(options = {}) {
    const requestId = ++trafficAnalysisRequestId;
    trafficAnalysisState.page = options.page || trafficAnalysisState.page;
    trafficAnalysisState.perPage = options.perPage || trafficAnalysisState.perPage;
    trafficAnalysisState.query = options.query !== undefined ? options.query : trafficAnalysisState.query;
    trafficAnalysisState.line = options.line !== undefined ? options.line : trafficAnalysisState.line;

    showView('traffic-analysis-panel', 'traffic-analysis-nav', 'trafficAnalysis');
    const body = document.getElementById('traffic-analysis-table-body');
    const summary = document.getElementById('traffic-analysis-summary');
    body.innerHTML = '<tr><td colspan="9">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const params = new URLSearchParams({
            page: trafficAnalysisState.page,
            per_page: trafficAnalysisState.perPage,
            q: trafficAnalysisState.query,
            line: trafficAnalysisState.line,
        });
        if (trafficAnalysisState.top) {
            params.set('top', trafficAnalysisState.top);
        }
        if (options.refresh) {
            params.set('refresh', '1');
        }
        const result = await apiGetResult(`/api/sangfor/user-rank?${params.toString()}`);
        if (requestId !== trafficAnalysisRequestId) {
            return;
        }
        const data = result.data || {};
        trafficAnalysisState.page = data.page || trafficAnalysisState.page;
        trafficAnalysisState.pages = data.pages || 0;
        trafficAnalysisState.total = data.total || 0;
        trafficAnalysisState.allTotal = data.all_total || 0;
        trafficAnalysisState.line = data.line || trafficAnalysisState.line;
        trafficAnalysisState.top = data.top || trafficAnalysisState.top;
        renderTrafficAnalysisMetrics(data.summary || {});
        renderTrafficAnalysisPager();

        const source = document.getElementById('traffic-analysis-source');
        if (source) {
            source.textContent = '';
        }

        if (result.code !== 0) {
            body.innerHTML = `<tr><td colspan="9">${escapeHtml(result.message || '请求失败')}</td></tr>`;
            summary.textContent = '无法获取流量排行';
            return;
        }

        const items = data.items || [];
        summary.textContent = `${renderTrafficAnalysisSummaryPrefix()}共 ${data.total || 0} 条，当前显示 ${data.returned || items.length} 条，接口返回 ${data.all_total || 0} 条，${renderClientNameCacheSummary(data.name_cache_refresh)}`;
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="9">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = items.map((item) => `
            <tr>
                <td class="rank-cell">${escapeHtml(item.rank || '-')}</td>
                <td class="user-cell">${escapeHtml(item.name || '-')}</td>
                <td>${renderTrafficAnalysisRealName(item)}</td>
                <td>${escapeHtml(item.ip || '-')}</td>
                <td class="rate-cell">${escapeHtml(item.up_rate || '0 bps')}</td>
                <td class="rate-cell">${escapeHtml(item.down_rate || '0 bps')}</td>
                <td>${escapeHtml(item.session ?? 0)}</td>
                <td>${renderTrafficAnalysisStatus(item)}</td>
                <td class="traffic-app-cell">${renderTrafficAnalysisApps(item.apps || [])}</td>
            </tr>
        `).join('');

        if (options.toast) {
            showToast('流量排行已刷新');
        }
    } catch (error) {
        if (requestId !== trafficAnalysisRequestId) {
            return;
        }
        body.innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
        showToast(error.message, 'error');
    }
}

async function loadOsdwan(options = {}) {
    showView('osdwan-panel', 'osdwan-nav', 'osdwan');
    const tasks = [
        loadOsdwanMetrics({silent: true}),
        loadOsdwanUsers(options),
    ];
    const results = await Promise.allSettled(tasks);
    const failed = results.find((item) => item.status === 'rejected');
    if (failed) {
        throw failed.reason;
    }
    if (options.toast) {
        showToast('OSDWAN 数据已刷新');
    }
}

async function loadOsdwanMetrics(options = {}) {
    osdwanState.allPeriod = '1day';
    osdwanState.nodePeriod = '6hours';

    showView('osdwan-panel', 'osdwan-nav', 'osdwan');
    try {
        const params = new URLSearchParams({
            all_period: osdwanState.allPeriod,
            node_period: osdwanState.nodePeriod,
        });
        const result = await apiGetResult(`/api/osdwan/metrics?${params.toString()}`);
        const data = result.data || {};
        if (result.code !== 0) {
            renderOsdwanMetricsError(result.message || 'OSDWAN 数据加载失败', data, options);
            return;
        }
        renderOsdwanMetrics(data, options);
        if (options.toast) {
            showToast('OSDWAN 状态已刷新');
        }
    } catch (error) {
        renderOsdwanMetricsError(error.message, {}, options);
        throw error;
    }
}

function startOsdwanMetricsAutoRefresh() {
    window.setInterval(() => {
        const osdwanPanel = document.getElementById('osdwan-panel');
        if (!osdwanPanel || osdwanPanel.hidden || document.visibilityState === 'hidden' || osdwanMetricsAutoRefreshing) {
            return;
        }
        osdwanMetricsAutoRefreshing = true;
        loadOsdwanMetrics({charts: false})
            .catch((error) => console.warn('OSDWAN 自动刷新失败', error))
            .finally(() => {
                osdwanMetricsAutoRefreshing = false;
            });
    }, OSDWAN_METRICS_REFRESH_MS);
}

async function loadOsdwanUsers(options = {}) {
    osdwanState.userPage = options.userPage || osdwanState.userPage;
    osdwanState.userPerPage = options.userPerPage || osdwanState.userPerPage;
    osdwanState.userQuery = options.query !== undefined ? options.query : osdwanState.userQuery;
    osdwanState.userDepartment = options.department !== undefined ? options.department : osdwanState.userDepartment;
    const searchControl = document.getElementById('osdwan-user-search');
    const departmentControl = document.getElementById('osdwan-department-filter');
    const pageSizeControl = document.getElementById('osdwan-user-page-size');
    if (options.query === undefined && searchControl) {
        osdwanState.userQuery = searchControl.value.trim();
    }
    if (options.department === undefined && departmentControl) {
        osdwanState.userDepartment = departmentControl.value;
    }
    if (options.userPerPage === undefined && pageSizeControl) {
        osdwanState.userPerPage = Number(pageSizeControl.value);
    }

    showView('osdwan-panel', 'osdwan-nav', 'osdwan');
    const usersBody = document.getElementById('osdwan-users-table-body');
    const usersSummary = document.getElementById('osdwan-users-summary');
    if (usersBody) {
        usersBody.innerHTML = '<tr><td colspan="7">加载中</td></tr>';
    }
    if (usersSummary) {
        usersSummary.textContent = '加载中';
    }
    renderOsdwanUserPager();
    try {
        const params = new URLSearchParams({
            user_page: osdwanState.userPage,
            user_per_page: osdwanState.userPerPage,
            user_q: osdwanState.userQuery,
            user_department: osdwanState.userDepartment,
        });
        const result = await apiGetResult(`/api/osdwan/users?${params.toString()}`);
        const data = result.data || {};
        if (result.code !== 0) {
            renderOsdwanUsersError(result.message || 'OSDWAN 用户列表加载失败', data);
            return;
        }
        renderOsdwanUserPage(data);
        if (options.toast) {
            showToast('OSDWAN 用户列表已刷新');
        }
    } catch (error) {
        renderOsdwanUsersError(error.message);
        throw error;
    }
}

function renderOsdwanPage(data) {
    renderOsdwanMetrics(data);
    renderOsdwanUserPage(data);
}

function renderOsdwanMetrics(data, options = {}) {
    const updateCharts = options.charts !== false;
    if (updateCharts) {
        osdwanState.data = data;
        osdwanState.allSamples = data.all_stats?.samples || [];
        osdwanState.nodeSamples = data.node?.stats?.samples || [];
        osdwanState.allPeriod = data.all_period || osdwanState.allPeriod;
        osdwanState.nodePeriod = data.node?.period || osdwanState.nodePeriod;
    }
    const errors = data.errors || {};
    const errorText = Object.values(errors).filter(Boolean).join('；');
    osdwanState.userPeopleCount = data.overall_user_people_count ?? data.user_people_count ?? 0;
    osdwanState.proxyStatus = data.proxy_status || null;

    document.getElementById('osdwan-source').textContent = errorText
        ? `${data.queried_at || '-'} · 部分接口异常`
        : `${data.queried_at || '-'}`;
    document.getElementById('osdwan-user-count').textContent = renderUserCapacity(data.overall_user_count ?? data.user_count, data.user_capacity);
    document.getElementById('osdwan-person-count').textContent = data.overall_user_people_count ?? data.user_people_count ?? 0;
    document.getElementById('osdwan-proxy-status').textContent = renderProxyStatus(data.proxy_status);
    renderOsdwanLatestMetric('osdwan-all-latest', data.all_stats?.latest);
    renderOsdwanLatestMetric('osdwan-node-latest', data.node?.stats?.latest);
    if (!updateCharts) {
        return;
    }
    document.getElementById('osdwan-all-source').textContent = `${renderOsdwanPeriod(data.all_period)} · 样本 ${data.all_stats?.sample_count ?? 0} 个`;
    document.getElementById('osdwan-node-source').textContent = `${data.node?.name || '办公开发'} · ${renderOsdwanPeriod(data.node?.period)} · 样本 ${data.node?.stats?.sample_count ?? 0} 个`;

    drawBandwidthChart('osdwan-all-chart', osdwanState.allSamples, osdwanChartSeries());
    drawBandwidthChart('osdwan-node-chart', osdwanState.nodeSamples, osdwanChartSeries());
}

function renderOsdwanUserPage(data) {
    const errors = data.errors || {};
    const userPagination = data.user_pagination || {};

    osdwanState.userPage = userPagination.page || osdwanState.userPage;
    osdwanState.userPerPage = userPagination.per_page || osdwanState.userPerPage;
    osdwanState.userPages = userPagination.pages || 0;
    osdwanState.userTotal = userPagination.total || 0;
    osdwanState.userQuery = data.user_query ?? osdwanState.userQuery;
    osdwanState.userDepartment = data.user_department ?? osdwanState.userDepartment;
    osdwanState.userDepartments = data.user_departments || [];
    osdwanState.userPeopleCount = data.user_people_count || 0;
    osdwanState.userMultiAccountCount = data.user_multi_account_count || 0;

    const searchControl = document.getElementById('osdwan-user-search');
    if (searchControl) {
        searchControl.value = osdwanState.userQuery;
    }
    renderOsdwanDepartmentOptions();
    const pageSizeControl = document.getElementById('osdwan-user-page-size');
    if (pageSizeControl) {
        pageSizeControl.value = String(osdwanState.userPerPage);
    }

    renderOsdwanUsers(data.users || [], errors.users || '', userPagination);
    renderOsdwanUserPager();
}

function renderOsdwanError(message, data = {}) {
    renderOsdwanMetricsError(message, data);
    renderOsdwanUsersError(message, data);
}

function renderOsdwanMetricsError(message, data = {}, options = {}) {
    const updateCharts = options.charts !== false;
    document.getElementById('osdwan-source').textContent = message;
    document.getElementById('osdwan-user-count').textContent = renderUserCapacity(data.overall_user_count ?? data.user_count, data.user_capacity) || '-';
    document.getElementById('osdwan-person-count').textContent = data.overall_user_people_count ?? data.user_people_count ?? '-';
    document.getElementById('osdwan-proxy-status').textContent = '-';
    document.getElementById('osdwan-all-latest').textContent = '-';
    document.getElementById('osdwan-node-latest').textContent = '-';
    if (!updateCharts) {
        osdwanState.proxyStatus = null;
        return;
    }
    document.getElementById('osdwan-all-source').textContent = message;
    document.getElementById('osdwan-node-source').textContent = message;
    drawBandwidthChart('osdwan-all-chart', [], osdwanChartSeries());
    drawBandwidthChart('osdwan-node-chart', [], osdwanChartSeries());
    osdwanState.proxyStatus = null;
}

function renderOsdwanUsersError(message, data = {}) {
    renderOsdwanUsers(data.users || [], message);
    osdwanState.userPages = 0;
    osdwanState.userTotal = 0;
    osdwanState.userDepartments = [];
    osdwanState.userMultiAccountCount = 0;
    renderOsdwanUserPager();
}

function renderOsdwanLatestMetric(elementId, sample) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }
    if (!sample) {
        element.textContent = '-';
        return;
    }
    element.innerHTML = `
        <span class="bandwidth-line down">
            <span class="bandwidth-line-label"><i class="bi bi-arrow-down"></i>下行</span>
            <strong title="${escapeHtml(sample.download_rate || '0 bps')}">${escapeHtml(sample.download_rate || '0 bps')}</strong>
        </span>
        <span class="bandwidth-line up">
            <span class="bandwidth-line-label"><i class="bi bi-arrow-up"></i>上行</span>
            <strong title="${escapeHtml(sample.upload_rate || '0 bps')}">${escapeHtml(sample.upload_rate || '0 bps')}</strong>
        </span>
    `;
}

function osdwanChartSeries() {
    return [
        {key: 'download_mbps', label: '下行', color: '#8b7cf6', fill: 'rgba(139, 124, 246, 0.16)', width: 1.7},
        {key: 'upload_mbps', label: '上行', color: '#4fc3c7', fill: 'rgba(79, 195, 199, 0.18)', width: 1.7},
    ];
}

function renderOsdwanPeriod(period) {
    const labels = {
        '1hour': '最近1小时',
        '6hours': '最近6小时',
        '1day': '最近1天',
        '1week': '最近1周',
        '1month': '最近1月',
        '24hours': '最近1天',
    };
    return labels[period] || period || '-';
}

function renderProxyStatus(status) {
    if (!status || !status.total) {
        return '-';
    }
    return `${status.online || 0}/${status.total} 正常`;
}

function renderUserCapacity(count, capacity) {
    if (capacity) {
        return `${count ?? 0}/${capacity}`;
    }
    return count ?? 0;
}

function renderOsdwanUsers(users, errorMessage = '', pagination = {}) {
    const body = document.getElementById('osdwan-users-table-body');
    const summary = document.getElementById('osdwan-users-summary');
    if (errorMessage) {
        if (summary) {
            summary.textContent = errorMessage;
        }
        if (body) {
            body.innerHTML = `<tr><td colspan="7" class="error-text">${escapeHtml(errorMessage)}</td></tr>`;
        }
        return;
    }
    if (summary) {
        const total = pagination.total ?? users.length;
        const returned = pagination.returned ?? users.length;
        const page = pagination.page || osdwanState.userPage;
        const pages = pagination.pages || osdwanState.userPages || 1;
        const prefix = (osdwanState.userQuery || osdwanState.userDepartment) ? '筛选后共' : '共';
        const splitText = `关联人员 ${osdwanState.userPeopleCount} 个，组合账号 ${osdwanState.userMultiAccountCount} 个`;
        summary.textContent = total
            ? `${prefix} ${total} 个用户，当前第 ${page}/${pages} 页，显示 ${returned} 个，${splitText}`
            : `${prefix} 0 个用户，当前显示 0 个，${splitText}`;
    }
    if (!body) {
        return;
    }
    if (!users.length) {
        body.innerHTML = '<tr><td colspan="7">暂无用户数据</td></tr>';
        return;
    }
    body.innerHTML = users.map((user) => `
        <tr>
            <td>${escapeHtml(user.username || user.id || '-')}</td>
            <td>${renderPersonChips(user.people || [])}</td>
            <td>${escapeHtml(user.departments || '-')}</td>
            <td>${escapeHtml(user.email || '-')}</td>
            <td>${escapeHtml(user.role || '-')}</td>
            <td>${escapeHtml(user.status || '-')}</td>
            <td>${escapeHtml(user.proxy_ips || '-')}</td>
        </tr>
    `).join('');
}

function renderOsdwanDepartmentOptions() {
    const select = document.getElementById('osdwan-department-filter');
    if (!select) {
        return;
    }
    select.innerHTML = [
        '<option value="">全部部门</option>',
        ...osdwanState.userDepartments.map((item) => (
            `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} (${item.count ?? 0})</option>`
        )),
    ].join('');
    select.value = osdwanState.userDepartment;
}

function renderPersonChips(people) {
    const names = Array.isArray(people) ? people.filter(Boolean) : [];
    if (!names.length) {
        return '-';
    }
    const chipClass = names.length > 1 ? 'person-chip' : 'person-chip single';
    return `<div class="person-chip-row">${names.map((name) => (
        `<span class="${chipClass}">${escapeHtml(name)}</span>`
    )).join('')}</div>`;
}

function renderOsdwanUserPager() {
    const pageText = document.getElementById('osdwan-users-page');
    const prev = document.getElementById('osdwan-users-prev');
    const next = document.getElementById('osdwan-users-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = osdwanState.userPages ? `${osdwanState.userPage} / ${osdwanState.userPages}` : '-';
    prev.disabled = osdwanState.userPage <= 1;
    next.disabled = osdwanState.userPages === 0 || osdwanState.userPage >= osdwanState.userPages;
}

function drawBandwidthChart(canvasId, samples, series) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || canvas.clientWidth || 720);
    const height = Math.max(220, rect.height || canvas.clientHeight || 280);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const plot = {left: 60, top: 18, right: 18, bottom: 34};
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const values = samples.flatMap((sample) => series.map((item) => Number(sample[item.key] || 0)));
    const maxValue = Math.max(1, ...values);
    const yMax = Math.ceil(maxValue * 1.15);

    ctx.strokeStyle = '#edf1f3';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#66737d';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';

    for (let index = 0; index <= 4; index += 1) {
        const y = plot.top + (plotHeight / 4) * index;
        const value = yMax - (yMax / 4) * index;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(width - plot.right, y);
        ctx.stroke();
        ctx.fillText(formatMbps(value), 8, y + 4);
    }

    ctx.strokeStyle = '#d9e0e4';
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.top + plotHeight);
    ctx.lineTo(width - plot.right, plot.top + plotHeight);
    ctx.stroke();

    if (!samples.length) {
        ctx.fillStyle = '#66737d';
        ctx.textAlign = 'center';
        ctx.fillText('暂无带宽历史样本', width / 2, height / 2);
        ctx.textAlign = 'left';
        return;
    }

    const xFor = (sampleIndex) => {
        if (samples.length === 1) {
            return plot.left + plotWidth;
        }
        return plot.left + (plotWidth * sampleIndex) / (samples.length - 1);
    };
    const yFor = (value) => plot.top + plotHeight - (plotHeight * Number(value || 0)) / yMax;

    series.forEach((line) => {
        const points = samples.map((sample, index) => ({
            x: xFor(index),
            y: yFor(sample[line.key]),
        }));
        if (line.fill && points.length > 1) {
            ctx.fillStyle = line.fill;
            ctx.beginPath();
            points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, plot.top + plotHeight);
                    ctx.lineTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.lineTo(points[points.length - 1].x, plot.top + plotHeight);
            ctx.closePath();
            ctx.fill();
        }

        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.width || 2;
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
    });

    const firstTimestamp = Number(samples[0].timestamp || 0);
    const lastTimestamp = Number(samples[samples.length - 1].timestamp || 0);
    const rangeSeconds = Math.max(0, lastTimestamp - firstTimestamp);
    ctx.fillStyle = '#66737d';
    chartAxisTicks(samples, width).forEach((tick) => {
        const x = xFor(tick.index);
        ctx.textAlign = tick.align;
        ctx.fillText(formatChartAxisTime(samples[tick.index].timestamp, rangeSeconds), x, height - 10);
    });
    ctx.textAlign = 'left';
}

function chartAxisTicks(samples, width) {
    if (!samples.length) {
        return [];
    }
    const desired = width < 640 ? 3 : 5;
    const maxIndex = samples.length - 1;
    if (maxIndex === 0) {
        return [{index: 0, align: 'center'}];
    }
    const ticks = [];
    for (let step = 0; step < desired; step += 1) {
        const index = Math.round((maxIndex * step) / (desired - 1));
        if (!ticks.some((tick) => tick.index === index)) {
            ticks.push({
                index,
                align: step === 0 ? 'left' : (step === desired - 1 ? 'right' : 'center'),
            });
        }
    }
    return ticks;
}

function renderTrafficTopList(elementId, items) {
    const list = document.getElementById(elementId);
    if (!list) {
        return;
    }
    if (!items.length) {
        list.innerHTML = '<li class="empty-state">暂无数据</li>';
        return;
    }
    list.innerHTML = items.map((item, index) => `
        <li class="traffic-row">
            <span class="traffic-rank">${index + 1}</span>
            <span class="traffic-main">
                <strong>${escapeHtml(item.label || '-')}</strong>
                <small>${escapeHtml(item.sub_label || '-')}</small>
            </span>
            <span class="traffic-value">${escapeHtml(item.value || '0 bps')}</span>
        </li>
    `).join('');
}

function formatNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return digits ? (0).toFixed(digits) : '0';
    }
    return number.toFixed(digits);
}

function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 0;
    }
    return Math.max(0, Math.min(number, 100));
}

function formatMbps(value) {
    const mbps = Number(value);
    if (!Number.isFinite(mbps)) {
        return '-';
    }
    if (mbps >= 1000) {
        return `${(mbps / 1000).toFixed(2)} Gbps`;
    }
    if (mbps > 0 && mbps < 1) {
        return `${Math.round(mbps * 1000)} Kbps`;
    }
    return `${mbps.toFixed(1)} Mbps`;
}

function formatTimestamp(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || !value) {
        return '-';
    }
    return new Date(value * 1000).toLocaleString('zh-CN', {hour12: false});
}

function renderFirewallRangeLabel(value) {
    const labels = {
        '5m': '最近 5 分钟',
        '15m': '最近 15 分钟',
        '30m': '最近 30 分钟',
        '1h': '最近 1 小时',
        '3h': '最近 3 小时',
        '6h': '最近 6 小时',
        '12h': '最近 12 小时',
        '24h': '最近 24 小时',
        '2d': '最近 2 天',
    };
    return labels[value] || labels['6h'];
}

function formatChartTime(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || !value) {
        return '-';
    }
    return new Date(value * 1000).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function formatChartAxisTime(timestamp, rangeSeconds = 0) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || !value) {
        return '-';
    }
    const date = new Date(value * 1000);
    if (rangeSeconds >= 2 * 24 * 60 * 60) {
        return date.toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
        });
    }
    if (rangeSeconds >= 20 * 60 * 60) {
        return date.toLocaleString('zh-CN', {
            hour12: false,
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    return date.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
    });
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
    body.innerHTML = '<tr><td colspan="8">加载中</td></tr>';
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
        deviceState.statusFreshness = result.status_freshness || null;
        renderDeviceCategoryOptions();
        renderDeviceStatusFilters();
        renderDevicePager();

        summary.textContent = `${renderDeviceSummaryPrefix()}共 ${deviceState.total} 台，当前显示 ${result.returned || devices.length} 台${renderDeviceFreshnessSummary(deviceState.statusFreshness)}`;
        if (!devices.length) {
            body.innerHTML = '<tr><td colspan="8">暂无数据</td></tr>';
            maybeAutoRefreshDeviceStatus(deviceState.statusFreshness, options);
            return;
        }
        body.innerHTML = devices.map((device) => `
            <tr>
                <td title="${escapeHtml(device.details || '')}">${escapeHtml(device.username)}</td>
                <td>${escapeHtml(device.ip_address)}</td>
                <td class="device-port-cell" data-device-port-cell="${escapeHtml(device.id)}">${renderDevicePortLookup(device)}</td>
                <td>${escapeHtml(device.mac_address || '-')}</td>
                <td>${escapeHtml(device.category || '未分类')}</td>
                <td>${renderDeviceStatus(device)}</td>
                <td>${escapeHtml(device.last_check_time || '-')}</td>
                <td>${renderDeviceActions(device)}</td>
            </tr>
        `).join('');
        maybeAutoRefreshDeviceStatus(deviceState.statusFreshness, options);
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function loadWireless(options = {}) {
    wirelessApState.page = options.page || wirelessApState.page;
    wirelessApState.perPage = options.perPage || wirelessApState.perPage;
    wirelessApState.query = options.query !== undefined ? options.query : wirelessApState.query;
    wirelessApState.status = options.status !== undefined ? options.status : wirelessApState.status;
    wirelessApState.sortBy = options.sortBy !== undefined ? options.sortBy : wirelessApState.sortBy;
    wirelessApState.sortOrder = options.sortOrder !== undefined ? options.sortOrder : wirelessApState.sortOrder;

    const searchControl = document.getElementById('wireless-ap-search');
    const pageSizeControl = document.getElementById('wireless-ap-page-size');
    if (options.query === undefined && searchControl) {
        wirelessApState.query = searchControl.value.trim();
    }
    if (options.perPage === undefined && pageSizeControl) {
        wirelessApState.perPage = Number(pageSizeControl.value);
    }

    showView('wireless-panel', 'wireless-nav', 'wireless');
    showWirelessSubview('aps');
    const panel = document.getElementById('wireless-panel');
    const body = document.getElementById('wireless-ap-table-body');
    const summary = document.getElementById('wireless-ap-summary');
    panel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const status = await loadWirelessMetrics();
        const params = new URLSearchParams({
            page: wirelessApState.page,
            per_page: wirelessApState.perPage,
            q: wirelessApState.query,
            status: wirelessApState.status,
            sort_by: wirelessApState.sortBy,
            sort_order: wirelessApState.sortOrder
        });
        const apInfo = await apiGetResult(`/api/statistics/ap-info?${params.toString()}`);
        const apData = apInfo.data || {};

        const apList = apData.ap_list || [];
        wirelessApState.page = apData.page || wirelessApState.page;
        wirelessApState.pages = apData.pages || 0;
        wirelessApState.total = apData.total_aps || 0;
        wirelessApState.allTotal = apData.all_total_aps || apData.total_aps || 0;
        wirelessApState.status = apData.status || '';
        wirelessApState.sortBy = apData.sort_by || wirelessApState.sortBy;
        wirelessApState.sortOrder = apData.sort_order || wirelessApState.sortOrder;
        wirelessApState.statusCounts = apData.status_counts || {all: 0, online: 0, offline: 0};
        renderWirelessApStatusFilters();
        renderWirelessApPager();
        renderWirelessApSortIndicators();

        summary.textContent = `${renderWirelessApSummaryPrefix()}共 ${wirelessApState.total} 个 AP，当前显示 ${apData.returned || apList.length} 个，承载 ${apData.total_users || 0} 个用户`;
        if (!apList.length) {
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(apInfo.message || status.message || '暂无数据')}</td></tr>`;
            summary.textContent = apInfo.message || status.message || '暂无 AP 数据';
            return;
        }
        body.innerHTML = apList.map((ap) => `
            <tr>
                <td>${escapeHtml(ap.ap_name || '-')}</td>
                <td>${escapeHtml(ap.ap_ip || '-')}</td>
                <td>${escapeHtml(ap.ap_mac_address || '-')}</td>
                <td>${renderWirelessApStatus(ap)}</td>
                <td>${escapeHtml(ap.user_count ?? 0)}</td>
                <td>${escapeHtml(ap.ap_recv_rate || '-')}</td>
                <td>${escapeHtml(ap.ap_send_rate || '-')}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function loadWirelessMetrics() {
    const status = await apiGetResult('/api/status/wireless-controller');
    const data = status.data || {};
    document.getElementById('wireless-users').textContent = data.wireless_users ?? 0;
    document.getElementById('wireless-ap-online').textContent = data.ap_online ?? 0;
    document.getElementById('wireless-cpu').textContent = `${data.cpu_usage ?? 0}%`;
    return status;
}

async function loadSwitches(options = {}) {
    switchState.page = options.page || switchState.page;
    switchState.perPage = options.perPage || switchState.perPage;
    switchState.query = options.query !== undefined ? options.query : switchState.query;
    switchState.vendor = options.vendor !== undefined ? options.vendor : switchState.vendor;
    switchState.status = options.status !== undefined ? options.status : switchState.status;

    const searchControl = document.getElementById('switch-search');
    const vendorControl = document.getElementById('switch-vendor-filter');
    const pageSizeControl = document.getElementById('switch-page-size');
    if (options.query === undefined && searchControl) {
        switchState.query = searchControl.value.trim();
    }
    if (options.vendor === undefined && vendorControl) {
        switchState.vendor = vendorControl.value;
    }
    if (options.perPage === undefined && pageSizeControl) {
        switchState.perPage = Number(pageSizeControl.value);
    }

    showView('switches-panel', 'switches-nav', 'switches');
    const body = document.getElementById('switches-table-body');
    const summary = document.getElementById('switches-summary');
    body.innerHTML = '<tr><td colspan="9">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const params = new URLSearchParams({
            page: switchState.page,
            per_page: switchState.perPage,
            q: switchState.query,
            vendor: switchState.vendor,
            status: switchState.status
        });
        const result = await apiGetResult(`/api/statistics/switches?${params.toString()}`);
        const data = result.data || {};
        switchState.page = data.page || switchState.page;
        switchState.pages = data.pages || 0;
        switchState.total = data.total || 0;
        switchState.allTotal = data.all_total || data.total || 0;
        switchState.vendor = data.vendor || '';
        switchState.status = data.status || '';
        switchState.statusCounts = data.status_counts || {all: 0, online: 0, offline: 0};
        switchState.vendorCounts = data.vendor_counts || {};
        renderSwitchMetrics(data);
        renderSwitchVendorOptions();
        renderSwitchStatusFilters();
        renderSwitchPager();

        if (result.code !== 0) {
            body.innerHTML = `<tr><td colspan="9">${escapeHtml(result.message || '请求失败')}</td></tr>`;
            summary.textContent = '无法获取交换机数据';
            return;
        }

        const switches = data.switch_list || [];
        summary.textContent = `${renderSwitchSummaryPrefix()}共 ${data.total || 0} 台，当前显示 ${data.returned || switches.length} 台`;
        if (!switches.length) {
            body.innerHTML = '<tr><td colspan="9">暂无数据</td></tr>';
            return;
        }

        body.innerHTML = switches.map((item) => `
            <tr class="${item.instance === switchState.selectedInstance ? 'selected-row' : ''}">
                <td>${escapeHtml(item.instance || '-')}</td>
                <td>${escapeHtml(renderSwitchVendorName(item.vendor))}</td>
                <td>${escapeHtml(item.module || '-')}</td>
                <td>${renderSwitchStatus(item)}</td>
                <td>${escapeHtml(item.last_scrape_at || '-')}</td>
                <td>${escapeHtml(item.scrape_duration_text || '-')}</td>
                <td>${escapeHtml(item.scrape_interval || '-')}</td>
                <td title="${escapeHtml(item.last_error || '')}">${escapeHtml(item.last_error || '-')}</td>
                <td>
                    <button class="icon-action" type="button" data-switch-action="ports" data-switch-instance="${escapeHtml(item.instance || '')}" title="端口与流量">
                        <i class="bi bi-activity"></i>
                        <span>端口</span>
                    </button>
                </td>
            </tr>
        `).join('');
        const detail = document.getElementById('switch-detail-section');
        if (detail && !detail.hidden && switchState.selectedInstance) {
            loadSwitchDetailData({toast: false}).catch((error) => showToast(error.message, 'error'));
        }
    } catch (error) {
        body.innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function traceSwitchTerminal(event) {
    if (event) {
        event.preventDefault();
    }
    const input = document.getElementById('switch-trace-ip');
    const button = document.getElementById('switch-trace-button');
    const summary = document.getElementById('switch-trace-summary');
    const resultPanel = document.getElementById('switch-trace-result');
    const ip = input ? input.value.trim() : '';
    if (!ip) {
        showToast('请输入终端 IP', 'error');
        if (input) {
            input.focus();
        }
        return;
    }

    switchState.traceLoading = true;
    switchState.traceIp = ip;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i><span>追踪中</span>';
    }
    if (summary) {
        summary.textContent = `正在从核心交换机追踪 ${ip}`;
    }
    if (resultPanel) {
        resultPanel.hidden = false;
        resultPanel.innerHTML = '<div class="trace-empty">正在执行 ARP、MAC 表和 LLDP 查询</div>';
    }

    try {
        const result = await apiPostResult('/api/statistics/switches/trace-terminal', {ip});
        switchState.traceData = result.data || {};
        renderSwitchTraceResult(switchState.traceData, result.message || '', result.code || 0);
        showToast(result.code === 0 ? '终端定位完成' : (result.message || '终端定位异常'), result.code === 0 ? 'info' : 'error');
    } catch (error) {
        switchState.traceData = null;
        renderSwitchTraceError(error.message);
        showToast(error.message, 'error');
    } finally {
        switchState.traceLoading = false;
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-search"></i><span>开始追踪</span>';
        }
    }
}

function renderSwitchTraceResult(data, message, code) {
    const summary = document.getElementById('switch-trace-summary');
    const resultPanel = document.getElementById('switch-trace-result');
    const core = document.getElementById('switch-trace-core');
    if (!resultPanel) {
        return;
    }
    const resultType = data.result_type || 'failed';
    const finalText = renderSwitchTraceFinalText(data, message);
    if (core && data.start_switch) {
        core.textContent = `核心 ${data.start_switch}`;
    }
    if (summary) {
        summary.innerHTML = `${renderSwitchTraceBadge(resultType, code)} <span>${escapeHtml(finalText)}</span>`;
    }
    const keyInfo = buildSwitchTraceKeyInfo(data);
    resultPanel.hidden = false;
    resultPanel.innerHTML = `
        <div class="trace-summary-table-wrap">
            <table class="trace-summary-table">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>IP 地址</th>
                        <th>MAC 地址</th>
                        <th>核心交换机端口</th>
                        <th>接入交换机</th>
                        <th>接入交换机端口</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(keyInfo.name)}</td>
                        <td>${escapeHtml(keyInfo.ip)}</td>
                        <td>${escapeHtml(keyInfo.mac)}</td>
                        <td>${escapeHtml(keyInfo.corePort)}</td>
                        <td>${escapeHtml(keyInfo.accessSwitch)}</td>
                        <td>${escapeHtml(keyInfo.accessPort)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function renderSwitchTraceError(message) {
    const summary = document.getElementById('switch-trace-summary');
    const resultPanel = document.getElementById('switch-trace-result');
    if (summary) {
        summary.textContent = message || '终端定位失败';
    }
    if (resultPanel) {
        resultPanel.hidden = false;
        resultPanel.innerHTML = `<div class="trace-empty error">${escapeHtml(message || '终端定位失败')}</div>`;
    }
}

function renderSwitchTraceFinalText(data, message) {
    const switchIp = data.final_switch || data.start_switch || '-';
    const interfaceName = data.final_interface || '-';
    if (data.result_type === 'terminal') {
        return `最终端口 ${switchIp} / ${interfaceName}`;
    }
    if (data.result_type === 'downstream') {
        return `已定位到下联口 ${switchIp} / ${interfaceName}`;
    }
    if (data.result_type === 'not_found') {
        return message || '核心 ARP 未找到';
    }
    return message || '追踪失败';
}

function buildSwitchTraceKeyInfo(data) {
    const hops = data.hops || [];
    const coreHop = hops.find((hop) => hop.switch_ip === data.start_switch) || hops[0] || {};
    const finalHop = hops[hops.length - 1] || {};
    const neighbor = coreHop.neighbor || {};
    const finalSwitch = data.final_switch || finalHop.switch_ip || '';
    const accessSwitch = finalSwitch && finalSwitch !== data.start_switch
        ? finalSwitch
        : neighbor.management_ip || finalSwitch || data.start_switch || '-';
    return {
        name: data.target_name || '无',
        ip: data.target_ip || switchState.traceIp || '-',
        mac: data.target_mac || coreHop.target_mac || finalHop.target_mac || '-',
        corePort: coreHop.ingress_interface || '-',
        accessSwitch,
        accessPort: data.final_interface || finalHop.ingress_interface || '-'
    };
}

function renderSwitchTraceHop(hop, data) {
    const neighbor = hop.neighbor || {};
    const fields = [
        ['交换机', hop.switch_name ? `${hop.switch_name} · ${hop.switch_ip || '-'}` : (hop.switch_ip || '-')],
        ['入口接口', hop.ingress_interface || '-'],
        ['目标 MAC', hop.target_mac || data.target_mac || '-'],
        ['接口 MAC 数量', hop.mac_count ?? '-'],
        ['LLDP 邻居', neighbor.system_name || '-'],
        ['邻居管理 IP', neighbor.management_ip || '-'],
        ['对端接口', neighbor.port_id || '-']
    ];
    const commands = hop.commands || [];
    return `
        <li class="trace-hop-card">
            <div class="trace-hop-heading">
                <div>
                    <span class="trace-step">第 ${escapeHtml(hop.index || '-')} 跳</span>
                    <strong>${escapeHtml(hop.switch_ip || '-')}</strong>
                </div>
                ${renderSwitchTraceHopBadge(hop)}
            </div>
            <dl class="trace-hop-fields">
                ${fields.map(([label, value]) => `
                    <div>
                        <dt>${escapeHtml(label)}</dt>
                        <dd>${escapeHtml(value)}</dd>
                    </div>
                `).join('')}
            </dl>
            ${renderSwitchTraceMacSamples(hop.mac_samples || [])}
            ${commands.length ? `
                <ul class="trace-command-list">
                    ${commands.map((command) => renderSwitchTraceCommand(command)).join('')}
                </ul>
            ` : ''}
            ${hop.error ? `<div class="trace-hop-error">${escapeHtml(hop.error)}</div>` : ''}
        </li>
    `;
}

function renderSwitchTraceMacSamples(samples) {
    if (!samples.length) {
        return '';
    }
    return `
        <div class="trace-mac-samples">
            ${samples.slice(0, 6).map((mac) => `<code>${escapeHtml(mac)}</code>`).join('')}
            ${samples.length > 6 ? `<span>+${samples.length - 6}</span>` : ''}
        </div>
    `;
}

function renderSwitchTraceCommand(command) {
    const preview = command.output_preview ? `<span>${escapeHtml(command.output_preview)}</span>` : '';
    const error = command.error ? `<strong>${escapeHtml(command.error)}</strong>` : '';
    return `
        <li>
            <code>${escapeHtml(command.command || '-')}</code>
            <em>${escapeHtml(command.summary || '-')}</em>
            ${preview}
            ${error}
        </li>
    `;
}

function renderSwitchTraceBadge(resultType, code) {
    const className = resultType === 'terminal'
        ? 'ok'
        : resultType === 'downstream' || resultType === 'not_found'
            ? 'warn'
            : code === 0
                ? 'warn'
                : 'bad';
    return `<span class="status-badge ${className}">${escapeHtml(renderSwitchTraceTypeLabel(resultType))}</span>`;
}

function renderSwitchTraceHopBadge(hop) {
    const hasError = Boolean(hop.error);
    const neighbor = hop.neighbor || {};
    const className = hasError ? 'bad' : neighbor.management_ip ? 'warn' : 'ok';
    return `<span class="status-badge ${className}">${escapeHtml(hop.status || '已检查')}</span>`;
}

function renderSwitchTraceTypeLabel(resultType) {
    const labels = {
        terminal: '普通终端',
        downstream: '下联口',
        not_found: '未找到',
        failed: '异常'
    };
    return labels[resultType] || '异常';
}

async function openSwitchDetail(instance) {
    if (!instance) {
        showToast('交换机地址为空', 'error');
        return;
    }
    if (switchState.selectedInstance !== instance) {
        switchState.portPage = 1;
    }
    switchState.selectedInstance = instance;
    const detail = document.getElementById('switch-detail-section');
    if (detail) {
        detail.hidden = false;
        detail.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
    document.querySelectorAll('#switches-table-body tr').forEach((row) => {
        const button = row.querySelector('[data-switch-instance]');
        row.classList.toggle('selected-row', button?.dataset.switchInstance === instance);
    });
    await loadSwitchDetailData();
}

async function loadSwitchDetailData(options = {}) {
    if (!switchState.selectedInstance) {
        return;
    }
    switchState.trafficRange = options.range || switchState.trafficRange;
    switchState.portQuery = options.portQuery !== undefined ? options.portQuery : switchState.portQuery;
    switchState.portStatus = options.portStatus !== undefined ? options.portStatus : switchState.portStatus;
    switchState.portScope = options.portScope !== undefined ? options.portScope : switchState.portScope;
    switchState.portPage = options.page || switchState.portPage;
    switchState.portPerPage = options.perPage || switchState.portPerPage;

    const portSearch = document.getElementById('switch-port-search');
    const portStatus = document.getElementById('switch-port-status');
    const portScope = document.getElementById('switch-port-scope');
    const portPageSize = document.getElementById('switch-port-page-size');
    if (options.portQuery === undefined && portSearch) {
        switchState.portQuery = portSearch.value.trim();
    }
    if (options.portStatus === undefined && portStatus) {
        switchState.portStatus = portStatus.value;
    }
    if (options.portScope === undefined && portScope) {
        switchState.portScope = portScope.value;
    }
    if (options.perPage === undefined && portPageSize) {
        switchState.portPerPage = Number(portPageSize.value);
    }

    const body = document.getElementById('switch-ports-table-body');
    const summary = document.getElementById('switch-ports-summary');
    const title = document.getElementById('switch-detail-title');
    const subtitle = document.getElementById('switch-detail-subtitle');
    if (title) {
        title.textContent = `端口与流量 ${switchState.selectedInstance}`;
    }
    if (subtitle) {
        subtitle.textContent = 'Prometheus 正在查询';
    }
    if (body) {
        body.innerHTML = '<tr><td colspan="8">加载中</td></tr>';
    }
    if (summary) {
        summary.textContent = '加载中';
    }
    renderSwitchTrafficRangeButtons();

    const encodedInstance = encodeURIComponent(switchState.selectedInstance);
    const portParams = new URLSearchParams({
        q: switchState.portQuery,
        status: switchState.portStatus,
        scope: switchState.portScope,
        page: switchState.portPage,
        per_page: switchState.portPerPage,
        sort_by: 'traffic',
        sort_order: 'desc'
    });
    const trafficParams = new URLSearchParams({
        range: switchState.trafficRange,
        scope: switchState.portScope
    });

    const [portsResult, trafficResult] = await Promise.allSettled([
        apiGetResult(`/api/statistics/switches/${encodedInstance}/ports?${portParams.toString()}`),
        apiGetResult(`/api/statistics/switches/${encodedInstance}/traffic-history?${trafficParams.toString()}`)
    ]);

    if (portsResult.status === 'fulfilled' && portsResult.value.code === 0) {
        renderSwitchPortData(portsResult.value.data || {});
    } else {
        const message = portsResult.status === 'fulfilled'
            ? (portsResult.value.message || '端口数据加载失败')
            : portsResult.reason.message;
        renderSwitchPortError(message);
    }

    if (trafficResult.status === 'fulfilled' && trafficResult.value.code === 0) {
        renderSwitchTrafficData(trafficResult.value.data || {});
    } else {
        const message = trafficResult.status === 'fulfilled'
            ? (trafficResult.value.message || '流量趋势加载失败')
            : trafficResult.reason.message;
        renderSwitchTrafficError(message);
    }

    if (options.toast) {
        showToast('交换机端口与流量已刷新');
    }
}

function renderSwitchPortData(data) {
    const ports = data.ports || [];
    const stats = data.summary || {};
    switchState.ports = ports;
    switchState.portScope = data.scope || switchState.portScope;
    switchState.portPage = data.page || switchState.portPage;
    switchState.portPages = data.pages || 0;
    switchState.portTotal = data.total || 0;
    switchState.portPerPage = data.per_page || switchState.portPerPage;

    const subtitle = document.getElementById('switch-detail-subtitle');
    if (subtitle) {
        subtitle.textContent = `Prometheus · job=${data.job || 'sw'} · 窗口 ${data.rate_window || '5m'} · ${data.queried_at || '-'}`;
    }
    const pageSize = document.getElementById('switch-port-page-size');
    if (pageSize) {
        pageSize.value = String(switchState.portPerPage);
    }
    const online = document.getElementById('switch-port-online');
    const totalIn = document.getElementById('switch-total-in');
    const totalOut = document.getElementById('switch-total-out');
    const busiest = document.getElementById('switch-busiest-port');
    if (online) {
        online.textContent = `${stats.online_count ?? 0}/${stats.port_count ?? data.total ?? 0}`;
    }
    if (totalIn) {
        totalIn.textContent = stats.total_in_rate || '-';
    }
    if (totalOut) {
        totalOut.textContent = stats.total_out_rate || '-';
    }
    if (busiest) {
        const port = stats.busiest_port || {};
        busiest.textContent = port.if_name ? `${port.if_name} ${port.total_rate || ''}` : '-';
    }

    const summary = document.getElementById('switch-ports-summary');
    if (summary) {
        const hiddenText = data.hidden_total && data.scope !== 'all'
            ? `，已隐藏 ${data.hidden_total} 个虚拟/管理端口`
            : '';
        summary.textContent = `共 ${data.total || 0} 个端口，当前显示 ${data.returned || ports.length} 个，入方向 ${stats.total_in_rate || '0 bps'}，出方向 ${stats.total_out_rate || '0 bps'}${hiddenText}`;
    }
    renderSwitchPortPager();
    const body = document.getElementById('switch-ports-table-body');
    if (!body) {
        return;
    }
    if (!ports.length) {
        body.innerHTML = '<tr><td colspan="8">暂无端口数据</td></tr>';
        return;
    }
    body.innerHTML = ports.map((port) => {
        const errorTotal = Number(port.in_errors || 0) + Number(port.out_errors || 0);
        const utilization = Number(port.utilization || 0);
        return `
            <tr>
                <td>
                    <div class="stacked-cell">
                        <strong>${escapeHtml(port.if_name || '-')}</strong>
                        <small>#${escapeHtml(port.if_index || '-')}</small>
                    </div>
                </td>
                <td title="${escapeHtml(port.if_alias || '')}">${escapeHtml(port.if_alias || '-')}</td>
                <td>${renderSwitchPortStatus(port)}</td>
                <td>${escapeHtml(port.speed_text || '-')}</td>
                <td>${escapeHtml(port.in_rate || '0 bps')}</td>
                <td>${escapeHtml(port.out_rate || '0 bps')}</td>
                <td>
                    <div class="utilization-cell">
                        <span style="width: ${clampPercent(utilization)}%"></span>
                        <strong>${escapeHtml(port.utilization_text || '-')}</strong>
                    </div>
                </td>
                <td title="入错误 ${escapeHtml(port.in_errors || 0)}，出错误 ${escapeHtml(port.out_errors || 0)}">${escapeHtml(errorTotal)}</td>
            </tr>
        `;
    }).join('');
}

function renderSwitchPortError(message) {
    const body = document.getElementById('switch-ports-table-body');
    const summary = document.getElementById('switch-ports-summary');
    if (body) {
        body.innerHTML = `<tr><td colspan="8">${escapeHtml(message)}</td></tr>`;
    }
    if (summary) {
        summary.textContent = '端口加载失败';
    }
    switchState.portPages = 0;
    switchState.portTotal = 0;
    renderSwitchPortPager();
    ['switch-port-online', 'switch-total-in', 'switch-total-out', 'switch-busiest-port'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = '-';
        }
    });
}

function renderSwitchPortPager() {
    const pageText = document.getElementById('switch-ports-page');
    const prev = document.getElementById('switch-ports-prev');
    const next = document.getElementById('switch-ports-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = switchState.portPages ? `${switchState.portPage} / ${switchState.portPages}` : '-';
    prev.disabled = switchState.portPage <= 1;
    next.disabled = switchState.portPages === 0 || switchState.portPage >= switchState.portPages;
}

function renderSwitchTrafficData(data) {
    const samples = data.samples || [];
    switchState.trafficSamples = samples;
    const source = document.getElementById('switch-traffic-source');
    if (source) {
        const scopeText = data.scope === 'all' ? '全部端口' : '业务端口';
        source.textContent = `${renderFirewallRangeLabel(data.range || switchState.trafficRange)} · ${scopeText} · 样本 ${data.sample_count ?? samples.length} 个 · 窗口 ${data.rate_window || '5m'}`;
    }
    switchState.trafficRange = data.range || switchState.trafficRange;
    renderSwitchTrafficRangeButtons();
    drawBandwidthChart('switch-traffic-chart', samples, [
        {key: 'total_in_mbps', label: '入方向', color: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)'},
        {key: 'total_out_mbps', label: '出方向', color: '#0f766e', fill: 'rgba(15, 118, 110, 0.12)'},
    ]);
}

function renderSwitchTrafficError(message) {
    switchState.trafficSamples = [];
    const source = document.getElementById('switch-traffic-source');
    if (source) {
        source.textContent = message;
    }
    drawBandwidthChart('switch-traffic-chart', [], [
        {key: 'total_in_mbps', label: '入方向', color: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)'},
        {key: 'total_out_mbps', label: '出方向', color: '#0f766e', fill: 'rgba(15, 118, 110, 0.12)'},
    ]);
}

function renderSwitchTrafficRangeButtons() {
    const label = document.getElementById('switch-traffic-range-label');
    const rangeLabel = renderFirewallRangeLabel(switchState.trafficRange);
    if (label) {
        label.textContent = rangeLabel;
    }
    const toggle = document.getElementById('switch-traffic-range-toggle');
    if (toggle) {
        toggle.setAttribute('aria-label', `选择时间范围，当前${rangeLabel}`);
    }
    document.querySelectorAll('[data-switch-traffic-range]').forEach((button) => {
        const active = button.dataset.switchTrafficRange === switchState.trafficRange;
        button.classList.toggle('active', active);
        button.setAttribute('aria-checked', String(active));
    });
}

function closeSwitchDetail() {
    switchState.selectedInstance = '';
    const detail = document.getElementById('switch-detail-section');
    if (detail) {
        detail.hidden = true;
    }
    document.querySelectorAll('#switches-table-body tr').forEach((row) => row.classList.remove('selected-row'));
}

async function loadWirelessUsers(options = {}) {
    wirelessUserState.page = options.page || wirelessUserState.page;
    wirelessUserState.perPage = options.perPage || wirelessUserState.perPage;
    wirelessUserState.query = options.query !== undefined ? options.query : wirelessUserState.query;
    wirelessUserState.resolveNames = options.resolveNames !== undefined ? options.resolveNames : wirelessUserState.resolveNames;
    wirelessUserState.sortBy = options.sortBy !== undefined ? options.sortBy : wirelessUserState.sortBy;
    wirelessUserState.sortOrder = options.sortOrder !== undefined ? options.sortOrder : wirelessUserState.sortOrder;

    const searchControl = document.getElementById('wireless-user-search');
    const pageSizeControl = document.getElementById('wireless-user-page-size');
    if (options.query === undefined && searchControl) {
        wirelessUserState.query = searchControl.value.trim();
    }
    if (options.perPage === undefined && pageSizeControl) {
        wirelessUserState.perPage = Number(pageSizeControl.value);
    }

    showView('wireless-panel', 'wireless-nav', 'wireless');
    showWirelessSubview('users');
    const body = document.getElementById('wireless-users-table-body');
    const summary = document.getElementById('wireless-users-summary');
    body.innerHTML = '<tr><td colspan="5">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        await loadWirelessMetrics();
        const params = new URLSearchParams({
            page: wirelessUserState.page,
            per_page: wirelessUserState.perPage,
            q: wirelessUserState.query,
            resolve_names: wirelessUserState.resolveNames ? '1' : '0',
            sort_by: wirelessUserState.sortBy,
            sort_order: wirelessUserState.sortOrder
        });
        const result = await apiGetResult(`/api/statistics/online-user-list?${params.toString()}`);
        const data = result.data || {};

        wirelessUserState.page = data.page || wirelessUserState.page;
        wirelessUserState.pages = data.pages || 0;
        wirelessUserState.total = data.total_users || 0;
        wirelessUserState.allTotal = data.all_total_users || data.total_users || 0;
        wirelessUserState.cached = Boolean(data.cached);
        wirelessUserState.sortBy = data.sort_by || wirelessUserState.sortBy;
        wirelessUserState.sortOrder = data.sort_order || wirelessUserState.sortOrder;
        renderWirelessUserPager();
        renderWirelessUserSortIndicators();

        if (result.code !== 0) {
            body.innerHTML = `<tr><td colspan="5">${escapeHtml(result.message || '请求失败')}</td></tr>`;
            summary.textContent = '无法获取在线用户数据';
            return;
        }

        const users = data.user_list || [];
        summary.textContent = `共 ${wirelessUserState.total} 个在线用户，当前显示 ${data.returned || users.length} 个${data.names_resolved ? '，已解析当前页姓名' : ''}${wirelessUserState.cached ? '，使用缓存' : ''}`;
        if (!users.length) {
            body.innerHTML = `<tr><td colspan="5">${escapeHtml(result.message || '暂无在线用户')}</td></tr>`;
            return;
        }
        body.innerHTML = users.map((user) => `
            <tr>
                <td>${escapeHtml(user.phone_number || '-')}</td>
                <td>${escapeHtml(user.real_name || '无')}</td>
                <td>${escapeHtml(user.ip_address || '-')}</td>
                <td>${escapeHtml(user.recv_rate || '-')}</td>
                <td>${escapeHtml(user.send_rate || '-')}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

async function loadClients(options = {}) {
    clientState.page = options.page || clientState.page;
    clientState.perPage = options.perPage || clientState.perPage;
    clientState.query = options.query !== undefined ? options.query : clientState.query;
    clientState.status = options.status !== undefined ? options.status : clientState.status;

    showView('clients-panel', 'clients-nav', 'clients');
    const panel = document.getElementById('clients-panel');
    const body = document.getElementById('clients-table-body');
    const summary = document.getElementById('clients-summary');
    panel.hidden = false;
    body.innerHTML = '<tr><td colspan="8">加载中</td></tr>';
    summary.textContent = '加载中';

    try {
        const params = new URLSearchParams({
            page: clientState.page,
            per_page: clientState.perPage,
            q: clientState.query,
            status: clientState.status
        });
        const result = await apiGetResult(`/api/access-control/client-list?${params.toString()}`);
        const data = result.data || {};
        clientState.page = data.page || clientState.page;
        clientState.pages = data.pages || 0;
        clientState.total = data.total || 0;
        clientState.status = data.status || '';
        clientState.statusCounts = data.status_counts || {all: 0, online: 0, offline: 0};
        renderClientPager();
        renderClientStatusFilters();

        if (result.code !== 0) {
            body.innerHTML = `<tr><td colspan="8">${escapeHtml(result.message || '请求失败')}</td></tr>`;
            summary.textContent = '无法获取客户端数据';
            return;
        }

        const clients = data.client_list || [];
        summary.textContent = `${renderClientSummaryPrefix()}共 ${data.total || 0} 条，当前显示 ${data.returned || clients.length} 条，${renderClientNameCacheSummary(data.name_cache_refresh)}`;
        if (!clients.length) {
            body.innerHTML = '<tr><td colspan="8">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = clients.map((client) => `
            <tr>
                <td>${escapeHtml(client.device_ip || '-')}</td>
                <td>${escapeHtml(client.username || '-')}</td>
                <td>${escapeHtml(client.real_name || '-')}</td>
                <td>${escapeHtml(client.device_name || '-')}</td>
                <td>${escapeHtml(client.mac_address || '-')}</td>
                <td>${escapeHtml(client.os || '-')}</td>
                <td>${escapeHtml(client.os_version || '-')}</td>
                <td>${renderClientStatus(client)}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
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

async function refreshDeviceStatus(options = {}) {
    if (deviceState.statusRefreshing) {
        return;
    }
    const button = document.getElementById('refresh-device-status');
    const originalButtonHtml = button ? button.innerHTML : '';
    deviceState.statusRefreshing = true;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i><span>刷新中</span>';
    }
    try {
        await apiPost('/api/access-control/device-status/refresh');
        await Promise.all([loadDevices({skipAutoRefresh: true}), loadSummary()]);
        showToast(options.auto ? '设备状态已自动刷新' : '设备状态已刷新');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        deviceState.statusRefreshing = false;
        if (button) {
            button.disabled = false;
            button.innerHTML = originalButtonHtml;
        }
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

function renderDeviceFreshnessSummary(freshness) {
    if (!freshness) {
        return '';
    }
    const latest = freshness.latest_check_time
        ? `最新检查 ${freshness.latest_check_time}`
        : '暂无检查记录';
    const expired = `过期 ${Number(freshness.expired_count || 0)} 台`;
    const unchecked = Number(freshness.unchecked_count || 0);
    return unchecked > 0
        ? `，${latest}，${expired}，未检查 ${unchecked} 台`
        : `，${latest}，${expired}`;
}

function maybeAutoRefreshDeviceStatus(freshness, options = {}) {
    if (
        options.skipAutoRefresh
        || deviceState.statusRefreshing
        || !freshness?.needs_refresh
        || !canManageDeviceStatus()
    ) {
        return;
    }

    const now = Date.now();
    if (now - deviceState.lastAutoRefreshAt < 60 * 1000) {
        return;
    }
    deviceState.lastAutoRefreshAt = now;
    refreshDeviceStatus({auto: true});
}

function canManageDeviceStatus() {
    return Boolean(currentUser && (currentUser.is_superuser || currentUser.role === 'admin'));
}

function renderDeviceStatus(device) {
    return device.is_online
        ? '<span class="status-badge ok">在线</span>'
        : '<span class="status-badge bad">离线</span>';
}

function renderDevicePortLookup(device) {
    const ip = String(device.ip_address || '').trim();
    const lookup = deviceState.portLookups[device.id];
    if (lookup && lookup.ip !== ip) {
        delete deviceState.portLookups[device.id];
    }
    const current = deviceState.portLookups[device.id];
    if (isWirelessDeviceIp(ip)) {
        return '<span class="device-port-note">无线端口</span>';
    }
    if (!isTraceableDeviceIp(ip)) {
        return '<span class="device-port-empty"></span>';
    }
    if (current?.status === 'loading') {
        return `
            <span class="device-port-state loading">
                <i class="bi bi-hourglass-split"></i>
                <span>查看中</span>
            </span>
        `;
    }
    if (current?.status === 'success') {
        return `
            <div class="device-port-card" title="接入交换机 ${escapeHtml(current.switchIp || '-')}，端口 ${escapeHtml(current.interfaceName || '-')}">
                <div class="device-port-lines">
                    <span class="device-port-switch">
                        <i class="bi bi-hdd-network"></i>
                        <span>${escapeHtml(current.switchIp || '-')}</span>
                    </span>
                    <span class="device-port-interface">
                        <i class="bi bi-ethernet"></i>
                        <span>${escapeHtml(current.interfaceName || '-')}</span>
                    </span>
                </div>
                <button class="device-port-icon-button" type="button" data-device-action="trace-port" data-device-id="${escapeHtml(device.id)}" title="重新查看" aria-label="重新查看端口">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        `;
    }
    if (current?.status === 'notice') {
        return `
            <div class="device-port-inline">
                <span class="device-port-state muted">
                    <i class="bi bi-info-circle"></i>
                    <span>${escapeHtml(current.message || '未定位到接入交换机')}</span>
                </span>
                <button class="device-port-icon-button" type="button" data-device-action="trace-port" data-device-id="${escapeHtml(device.id)}" title="重新查看" aria-label="重新查看端口">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        `;
    }
    if (current?.status === 'error') {
        return `
            <div class="device-port-inline">
                <span class="device-port-state error">
                    <i class="bi bi-exclamation-triangle"></i>
                    <span>${escapeHtml(current.message || '追踪失败')}</span>
                </span>
                <button class="device-port-icon-button" type="button" data-device-action="trace-port" data-device-id="${escapeHtml(device.id)}" title="重试" aria-label="重试查看端口">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
            </div>
        `;
    }
    return `
        <button class="device-port-lookup-button" type="button" data-device-action="trace-port" data-device-id="${escapeHtml(device.id)}" title="按需追踪接入交换机端口">
            <i class="bi bi-search"></i>
            <span>查看端口</span>
        </button>
    `;
}

function isTraceableDeviceIp(ip) {
    return /^172\.16\.(?:70|101)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip);
}

function isWirelessDeviceIp(ip) {
    return /^172\.16\.64\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip);
}

function updateDevicePortCell(device) {
    const cell = document.querySelector(`[data-device-port-cell="${CSS.escape(String(device.id))}"]`);
    if (cell) {
        cell.innerHTML = renderDevicePortLookup(device);
    }
}

async function traceDevicePort(device) {
    if (!device) {
        showToast('设备不存在', 'error');
        return;
    }
    const ip = String(device.ip_address || '').trim();
    if (!isTraceableDeviceIp(ip)) {
        showToast('该网段不需要端口追踪', 'info');
        return;
    }

    deviceState.portLookups[device.id] = {status: 'loading', ip};
    updateDevicePortCell(device);
    try {
        const result = await apiPostResult('/api/statistics/switches/trace-terminal', {ip});
        const data = result.data || {};
        const accessPort = buildDeviceAccessPortInfo(data);
        if (result.code === 0 && accessPort) {
            deviceState.portLookups[device.id] = {
                status: 'success',
                ip,
                switchIp: accessPort.switchIp,
                interfaceName: accessPort.interfaceName
            };
            showToast('端口查看完成');
        } else if (result.code === 0) {
            deviceState.portLookups[device.id] = {
                status: 'notice',
                ip,
                message: '未定位到接入交换机'
            };
            showToast('未定位到接入交换机', 'info');
        } else {
            deviceState.portLookups[device.id] = {
                status: 'error',
                ip,
                message: renderDevicePortErrorLabel(data, result.message)
            };
            showToast(renderDevicePortErrorLabel(data, result.message), 'error');
        }
    } catch (error) {
        deviceState.portLookups[device.id] = {
            status: 'error',
            ip,
            message: renderDevicePortErrorLabel({}, error.message)
        };
        showToast(renderDevicePortErrorLabel({}, error.message), 'error');
    } finally {
        updateDevicePortCell(device);
    }
}

function buildDeviceAccessPortInfo(data) {
    const startSwitch = data.start_switch || '';
    const hops = Array.isArray(data.hops) ? data.hops : [];
    const accessHop = [...hops].reverse().find((hop) => {
        const switchIp = hop.switch_ip || '';
        return switchIp && switchIp !== startSwitch && hop.ingress_interface;
    });
    if (accessHop) {
        return {
            switchIp: accessHop.switch_ip,
            interfaceName: accessHop.ingress_interface
        };
    }

    const finalSwitch = data.final_switch || '';
    const finalInterface = data.final_interface || '';
    if (finalSwitch && finalInterface && finalSwitch !== startSwitch) {
        return {
            switchIp: finalSwitch,
            interfaceName: finalInterface
        };
    }

    const coreHop = hops.find((hop) => hop.switch_ip === startSwitch) || hops[0] || {};
    const neighbor = coreHop.neighbor || {};
    const neighborIp = neighbor.management_ip || '';
    if (neighborIp && neighborIp !== startSwitch) {
        return {
            switchIp: neighborIp,
            interfaceName: neighbor.port_id || '-'
        };
    }

    return null;
}

function renderDevicePortErrorLabel(data, message = '') {
    const text = String(message || data.error || '').toLowerCase();
    if (data.result_type === 'not_found' || text.includes('arp') || text.includes('未找到')) {
        return '未找到';
    }
    if (text.includes('ssh') || text.includes('netmiko') || text.includes('timeout') || text.includes('authentication')) {
        return 'SSH 失败';
    }
    return '追踪失败';
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

function renderClientStatusFilters() {
    const counts = clientState.statusCounts || {};
    document.querySelectorAll('[data-client-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.clientStatus === clientState.status);
    });
    ['all', 'online', 'offline'].forEach((key) => {
        const target = document.getElementById(`client-status-${key}`);
        if (target) {
            target.textContent = counts[key] ?? 0;
        }
    });
}

function renderClientSummaryPrefix() {
    if (clientState.status === 'online') {
        return '在线客户端，';
    }
    if (clientState.status === 'offline') {
        return '离线客户端，';
    }
    return '';
}

function renderClientStatus(client) {
    return client.is_online
        ? '<span class="status-badge ok">在线</span>'
        : '<span class="status-badge bad">离线</span>';
}

function renderClientNameCacheSummary(cache) {
    if (!cache) {
        return '姓名使用缓存';
    }
    if (!cache.configured) {
        return '姓名使用缓存，后台解析未配置';
    }
    if (cache.running || cache.queued > 0 || cache.missing > 0) {
        const countText = cache.missing ? `（${cache.missing} 个待解析）` : '';
        return `姓名使用缓存，后台更新中${countText}`;
    }
    if (cache.last_error) {
        return '姓名使用缓存，后台更新异常';
    }
    return '姓名使用缓存';
}

function renderTrafficAnalysisMetrics(summary) {
    document.getElementById('traffic-user-count').textContent = summary.user_count ?? 0;
    document.getElementById('traffic-status-count').textContent = `${summary.normal_count ?? 0}/${summary.frozen_count ?? 0}`;
    document.getElementById('traffic-total-rate').innerHTML = `
        <span class="bandwidth-line down">
            <span class="bandwidth-line-label"><i class="bi bi-arrow-down"></i>下行</span>
            <strong>${escapeHtml(summary.down_rate || '0 bps')}</strong>
        </span>
        <span class="bandwidth-line up">
            <span class="bandwidth-line-label"><i class="bi bi-arrow-up"></i>上行</span>
            <strong>${escapeHtml(summary.up_rate || '0 bps')}</strong>
        </span>
    `;
    document.getElementById('traffic-session-count').textContent = summary.session_count ?? 0;
}

function renderTrafficAnalysisPager() {
    const pageText = document.getElementById('traffic-analysis-page');
    const prev = document.getElementById('traffic-analysis-prev');
    const next = document.getElementById('traffic-analysis-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = trafficAnalysisState.pages ? `${trafficAnalysisState.page} / ${trafficAnalysisState.pages}` : '-';
    prev.disabled = trafficAnalysisState.page <= 1;
    next.disabled = trafficAnalysisState.pages === 0 || trafficAnalysisState.page >= trafficAnalysisState.pages;
}

function renderTrafficAnalysisSummaryPrefix() {
    return trafficAnalysisState.line && trafficAnalysisState.line !== '0'
        ? `线路 ${trafficAnalysisState.line}，`
        : '';
}

function renderTrafficAnalysisStatus(item) {
    return item.status
        ? '<span class="status-badge ok">正常</span>'
        : '<span class="status-badge warn">冻结</span>';
}

function renderTrafficAnalysisRealName(item) {
    if (item.real_name) {
        return `<span class="person-chip traffic-name-chip">${escapeHtml(item.real_name)}</span>`;
    }
    if (item.name_is_mobile) {
        return '<span class="traffic-name-chip pending">解析中</span>';
    }
    return '-';
}

function renderTrafficAnalysisApps(apps) {
    const visibleApps = (apps || []).filter((app) => app && app.app).slice(0, 3);
    if (!visibleApps.length) {
        return '-';
    }
    return `
        <div class="traffic-app-stack">
            ${visibleApps.map((app) => `
                <div class="traffic-app-item">
                    <div class="traffic-app-meta">
                        <strong title="${escapeHtml(app.app || '-')}">${escapeHtml(app.app || '-')}</strong>
                        <span>${escapeHtml(renderTrafficAppValue(app))}</span>
                    </div>
                    <div class="traffic-app-bar">
                        <i style="width: ${clampPercent(app.percent)}%"></i>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTrafficAppValue(app) {
    const percent = Number(app.percent);
    if (Number.isFinite(percent) && percent > 0) {
        return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
    }
    return app.total_rate || '';
}

function showWirelessSubview(view) {
    wirelessActiveView = view;
    const apView = document.getElementById('wireless-ap-view');
    const userView = document.getElementById('wireless-user-view');
    const apButton = document.getElementById('wireless-ap-view-button');
    const userButton = document.getElementById('wireless-user-view-button');

    if (apView) {
        apView.hidden = view !== 'aps';
    }
    if (userView) {
        userView.hidden = view !== 'users';
    }
    if (apButton) {
        apButton.classList.toggle('active', view === 'aps');
    }
    if (userButton) {
        userButton.classList.toggle('active', view === 'users');
    }
}

function renderWirelessApPager() {
    const pageText = document.getElementById('wireless-ap-page');
    const prev = document.getElementById('wireless-ap-prev');
    const next = document.getElementById('wireless-ap-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = wirelessApState.pages ? `${wirelessApState.page} / ${wirelessApState.pages}` : '-';
    prev.disabled = wirelessApState.page <= 1;
    next.disabled = wirelessApState.pages === 0 || wirelessApState.page >= wirelessApState.pages;
}

function renderWirelessApStatusFilters() {
    const counts = wirelessApState.statusCounts || {};
    document.querySelectorAll('[data-wireless-ap-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.wirelessApStatus === wirelessApState.status);
    });
    ['all', 'online', 'offline'].forEach((key) => {
        const target = document.getElementById(`wireless-ap-status-${key}`);
        if (target) {
            target.textContent = counts[key] ?? 0;
        }
    });
}

function renderWirelessApSortIndicators() {
    const recv = document.getElementById('wireless-ap-sort-recv');
    const send = document.getElementById('wireless-ap-sort-send');
    const icon = (field) => {
        if (wirelessApState.sortBy !== field) {
            return '↕';
        }
        return wirelessApState.sortOrder === 'asc' ? '↑' : '↓';
    };
    if (recv) {
        recv.textContent = icon('ap_recv_rate');
    }
    if (send) {
        send.textContent = icon('ap_send_rate');
    }
}

function renderWirelessApSummaryPrefix() {
    if (wirelessApState.status === 'online') {
        return '在线 AP，';
    }
    if (wirelessApState.status === 'offline') {
        return '离线 AP，';
    }
    return '';
}

function renderWirelessApStatus(ap) {
    return ap.is_online || ap.status === 'Online'
        ? '<span class="status-badge ok">在线</span>'
        : '<span class="status-badge bad">离线</span>';
}

function renderSwitchMetrics(data) {
    document.getElementById('switch-total').textContent = data.all_total ?? data.total ?? 0;
    document.getElementById('switch-online').textContent = data.online_count ?? 0;
    document.getElementById('switch-avg-duration').textContent = formatDurationSeconds(data.avg_scrape_duration);
    const source = document.getElementById('switches-source');
    if (source) {
        source.textContent = data.target_group
            ? `Prometheus targets · ${data.target_group} · job=${data.job || 'sw'}`
            : `Prometheus targets · job=${data.job || 'sw'}`;
    }
}

function renderSwitchVendorOptions() {
    const select = document.getElementById('switch-vendor-filter');
    if (!select) {
        return;
    }
    const vendors = Object.keys(switchState.vendorCounts || {}).sort();
    if (switchState.vendor && !vendors.includes(switchState.vendor)) {
        vendors.unshift(switchState.vendor);
    }
    select.innerHTML = [
        '<option value="">全部厂商</option>',
        ...vendors.map((vendor) => {
            const count = switchState.vendorCounts[vendor] ?? 0;
            return `<option value="${escapeHtml(vendor)}">${escapeHtml(renderSwitchVendorName(vendor))} (${count})</option>`;
        })
    ].join('');
    select.value = switchState.vendor;
}

function renderSwitchStatusFilters() {
    const counts = switchState.statusCounts || {};
    document.querySelectorAll('[data-switch-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.switchStatus === switchState.status);
    });
    ['all', 'online', 'offline'].forEach((key) => {
        const target = document.getElementById(`switch-status-${key}`);
        if (target) {
            target.textContent = counts[key] ?? 0;
        }
    });
}

function renderSwitchPager() {
    const pageText = document.getElementById('switches-page');
    const prev = document.getElementById('switches-prev');
    const next = document.getElementById('switches-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = switchState.pages ? `${switchState.page} / ${switchState.pages}` : '-';
    prev.disabled = switchState.page <= 1;
    next.disabled = switchState.pages === 0 || switchState.page >= switchState.pages;
}

function renderSwitchSummaryPrefix() {
    const parts = [];
    if (switchState.vendor) {
        parts.push(`${renderSwitchVendorName(switchState.vendor)}厂商`);
    }
    if (switchState.status === 'online') {
        parts.push('在线');
    } else if (switchState.status === 'offline') {
        parts.push('离线');
    }
    return parts.length ? `${parts.join('、')}，` : '';
}

function renderSwitchStatus(item) {
    return item.is_online
        ? '<span class="status-badge ok">UP</span>'
        : '<span class="status-badge bad">DOWN</span>';
}

function renderSwitchPortStatus(port) {
    return port.is_online
        ? '<span class="status-badge ok">UP</span>'
        : `<span class="status-badge bad">${escapeHtml((port.oper_status_text || 'DOWN').toUpperCase())}</span>`;
}

function renderSwitchVendorName(value) {
    const vendor = String(value || 'unknown').toLowerCase();
    const labels = {
        huawei: '华为',
        h3c: 'H3C',
        sangfor: '深信服',
        unknown: '未知'
    };
    return labels[vendor] || value;
}

function formatDurationSeconds(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return '-';
    }
    if (number >= 1) {
        return `${number.toFixed(2)}s`;
    }
    return `${Math.round(number * 1000)}ms`;
}

function renderWirelessUserPager() {
    const pageText = document.getElementById('wireless-users-page');
    const prev = document.getElementById('wireless-users-prev');
    const next = document.getElementById('wireless-users-next');
    if (!pageText || !prev || !next) {
        return;
    }
    pageText.textContent = wirelessUserState.pages ? `${wirelessUserState.page} / ${wirelessUserState.pages}` : '-';
    prev.disabled = wirelessUserState.page <= 1;
    next.disabled = wirelessUserState.pages === 0 || wirelessUserState.page >= wirelessUserState.pages;
}

function renderWirelessUserSortIndicators() {
    const recv = document.getElementById('wireless-user-sort-recv');
    const send = document.getElementById('wireless-user-sort-send');
    const icon = (field) => {
        if (wirelessUserState.sortBy !== field) {
            return '↕';
        }
        return wirelessUserState.sortOrder === 'asc' ? '↑' : '↓';
    };
    if (recv) {
        recv.textContent = icon('recv_rate');
    }
    if (send) {
        send.textContent = icon('send_rate');
    }
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
        await loadSummary();
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
            const firewallPanel = document.getElementById('firewall-bandwidth-panel');
            const trafficAnalysisPanel = document.getElementById('traffic-analysis-panel');
            const osdwanPanel = document.getElementById('osdwan-panel');
            const switchesPanel = document.getElementById('switches-panel');
            const task = firewallPanel && !firewallPanel.hidden
                ? loadFirewallBandwidth({toast: false})
                : trafficAnalysisPanel && !trafficAnalysisPanel.hidden
                    ? loadTrafficAnalysis({page: trafficAnalysisState.page})
                    : osdwanPanel && !osdwanPanel.hidden
                        ? loadOsdwanMetrics({charts: false})
                        : switchesPanel && !switchesPanel.hidden
                            ? loadSwitches()
                            : loadSummary();
            task
                .then(() => showToast('已刷新'))
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const dashboardNav = document.getElementById('dashboard-nav');
    if (dashboardNav) {
        dashboardNav.addEventListener('click', (event) => {
            event.preventDefault();
            showView('dashboard-panel', 'dashboard-nav', 'dashboard');
            loadSummary()
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const firewallBandwidthNav = document.getElementById('firewall-bandwidth-nav');
    if (firewallBandwidthNav) {
        firewallBandwidthNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadFirewallBandwidth();
        });
    }

    const trafficAnalysisNav = document.getElementById('traffic-analysis-nav');
    if (trafficAnalysisNav) {
        trafficAnalysisNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadTrafficAnalysis({page: 1});
        });
    }

    const osdwanNav = document.getElementById('osdwan-nav');
    if (osdwanNav) {
        osdwanNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadOsdwan();
        });
    }

    const switchesNav = document.getElementById('switches-nav');
    if (switchesNav) {
        switchesNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadSwitches({page: 1});
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
            loadClients({page: 1});
        });
    }

    const reloadUsers = document.getElementById('reload-users');
    if (reloadUsers) {
        reloadUsers.addEventListener('click', loadUsers);
    }

    const reloadFirewallBandwidth = document.getElementById('reload-firewall-bandwidth');
    if (reloadFirewallBandwidth) {
        reloadFirewallBandwidth.addEventListener('click', () => loadFirewallBandwidth({toast: true}));
    }

    const reloadTrafficAnalysis = document.getElementById('reload-traffic-analysis');
    if (reloadTrafficAnalysis) {
        reloadTrafficAnalysis.addEventListener('click', () => loadTrafficAnalysis({page: trafficAnalysisState.page, toast: true, refresh: true}));
    }

    const reloadOsdwan = document.getElementById('reload-osdwan');
    if (reloadOsdwan) {
        reloadOsdwan.addEventListener('click', () => loadOsdwanMetrics({toast: true, charts: false}));
    }

    const trafficAnalysisSearch = document.getElementById('traffic-analysis-search');
    if (trafficAnalysisSearch) {
        trafficAnalysisSearch.addEventListener('input', debounce((event) => {
            loadTrafficAnalysis({page: 1, query: event.target.value.trim()});
        }));
    }

    const trafficLineFilter = document.getElementById('traffic-line-filter');
    if (trafficLineFilter) {
        trafficLineFilter.addEventListener('change', (event) => {
            loadTrafficAnalysis({page: 1, line: event.target.value});
        });
    }

    const trafficAnalysisPageSize = document.getElementById('traffic-analysis-page-size');
    if (trafficAnalysisPageSize) {
        trafficAnalysisPageSize.addEventListener('change', (event) => {
            loadTrafficAnalysis({page: 1, perPage: Number(event.target.value)});
        });
    }

    const trafficAnalysisPrev = document.getElementById('traffic-analysis-prev');
    if (trafficAnalysisPrev) {
        trafficAnalysisPrev.addEventListener('click', () => {
            if (trafficAnalysisState.page > 1) {
                loadTrafficAnalysis({page: trafficAnalysisState.page - 1});
            }
        });
    }

    const trafficAnalysisNext = document.getElementById('traffic-analysis-next');
    if (trafficAnalysisNext) {
        trafficAnalysisNext.addEventListener('click', () => {
            if (trafficAnalysisState.page < trafficAnalysisState.pages) {
                loadTrafficAnalysis({page: trafficAnalysisState.page + 1});
            }
        });
    }

    const osdwanUserSearch = document.getElementById('osdwan-user-search');
    if (osdwanUserSearch) {
        osdwanUserSearch.addEventListener('input', debounce((event) => {
            loadOsdwanUsers({userPage: 1, query: event.target.value.trim()});
        }));
    }

    const osdwanDepartmentFilter = document.getElementById('osdwan-department-filter');
    if (osdwanDepartmentFilter) {
        osdwanDepartmentFilter.addEventListener('change', (event) => {
            loadOsdwanUsers({userPage: 1, department: event.target.value});
        });
    }

    const osdwanUserPageSize = document.getElementById('osdwan-user-page-size');
    if (osdwanUserPageSize) {
        osdwanUserPageSize.addEventListener('change', (event) => {
            loadOsdwanUsers({userPage: 1, userPerPage: Number(event.target.value)});
        });
    }

    const osdwanUsersPrev = document.getElementById('osdwan-users-prev');
    if (osdwanUsersPrev) {
        osdwanUsersPrev.addEventListener('click', () => {
            if (osdwanState.userPage > 1) {
                loadOsdwanUsers({userPage: osdwanState.userPage - 1});
            }
        });
    }

    const osdwanUsersNext = document.getElementById('osdwan-users-next');
    if (osdwanUsersNext) {
        osdwanUsersNext.addEventListener('click', () => {
            if (osdwanState.userPage < osdwanState.userPages) {
                loadOsdwanUsers({userPage: osdwanState.userPage + 1});
            }
        });
    }

    const reloadSwitches = document.getElementById('reload-switches');
    if (reloadSwitches) {
        reloadSwitches.addEventListener('click', () => loadSwitches({page: switchState.page}));
    }

    const switchTraceForm = document.getElementById('switch-trace-form');
    if (switchTraceForm) {
        switchTraceForm.addEventListener('submit', traceSwitchTerminal);
    }

    document.querySelectorAll('[data-range-toggle]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleRangeDropdown(button.closest('[data-range-dropdown]'));
        });
    });

    document.querySelectorAll('[data-firewall-range]').forEach((button) => {
        button.addEventListener('click', () => {
            closeRangeDropdown(button.closest('[data-range-dropdown]'));
            loadFirewallBandwidth({range: button.dataset.firewallRange});
        });
    });

    document.querySelectorAll('[data-switch-traffic-range]').forEach((button) => {
        button.addEventListener('click', () => {
            closeRangeDropdown(button.closest('[data-range-dropdown]'));
            loadSwitchDetailData({range: button.dataset.switchTrafficRange})
                .catch((error) => showToast(error.message, 'error'));
        });
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-range-dropdown]')) {
            closeRangeDropdowns();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeRangeDropdowns();
        }
    });

    window.addEventListener('resize', debounce(() => {
        const firewallPanel = document.getElementById('firewall-bandwidth-panel');
        if (firewallPanel && !firewallPanel.hidden) {
            renderFirewallBandwidthPage({
                latest: firewallBandwidthState.latest || {},
                samples: firewallBandwidthState.samples || [],
                sample_count: firewallBandwidthState.samples.length,
                range: firewallBandwidthState.range,
            });
        }
        const osdwanPanel = document.getElementById('osdwan-panel');
        if (osdwanPanel && !osdwanPanel.hidden && osdwanState.data) {
            renderOsdwanMetrics(osdwanState.data);
        }
        const switchDetail = document.getElementById('switch-detail-section');
        if (switchDetail && !switchDetail.hidden) {
            renderSwitchTrafficData({
                samples: switchState.trafficSamples || [],
                sample_count: switchState.trafficSamples.length,
                range: switchState.trafficRange,
            });
        }
    }, 150));

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
            } else if (button.dataset.deviceAction === 'trace-port') {
                traceDevicePort(device);
            } else if (button.dataset.deviceAction === 'delete') {
                deleteDevice(device);
            }
        });
    }

    const reloadWireless = document.getElementById('reload-wireless');
    if (reloadWireless) {
        reloadWireless.addEventListener('click', () => {
            if (wirelessActiveView === 'users') {
                loadWirelessUsers();
            } else {
                loadWireless();
            }
        });
    }

    const switchSearch = document.getElementById('switch-search');
    if (switchSearch) {
        switchSearch.addEventListener('input', debounce((event) => {
            loadSwitches({page: 1, query: event.target.value.trim()});
        }));
    }

    const switchVendorFilter = document.getElementById('switch-vendor-filter');
    if (switchVendorFilter) {
        switchVendorFilter.addEventListener('change', (event) => {
            loadSwitches({page: 1, vendor: event.target.value});
        });
    }

    const switchPageSize = document.getElementById('switch-page-size');
    if (switchPageSize) {
        switchPageSize.addEventListener('change', (event) => {
            loadSwitches({page: 1, perPage: Number(event.target.value)});
        });
    }

    document.querySelectorAll('[data-switch-status]').forEach((button) => {
        button.addEventListener('click', () => {
            loadSwitches({page: 1, status: button.dataset.switchStatus || ''});
        });
    });

    const switchesPrev = document.getElementById('switches-prev');
    if (switchesPrev) {
        switchesPrev.addEventListener('click', () => {
            if (switchState.page > 1) {
                loadSwitches({page: switchState.page - 1});
            }
        });
    }

    const switchesNext = document.getElementById('switches-next');
    if (switchesNext) {
        switchesNext.addEventListener('click', () => {
            if (switchState.page < switchState.pages) {
                loadSwitches({page: switchState.page + 1});
            }
        });
    }

    const switchesTableBody = document.getElementById('switches-table-body');
    if (switchesTableBody) {
        switchesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('[data-switch-action]');
            if (!button || button.disabled) {
                return;
            }
            if (button.dataset.switchAction === 'ports') {
                openSwitchDetail(button.dataset.switchInstance)
                    .catch((error) => showToast(error.message, 'error'));
            }
        });
    }

    const reloadSwitchDetail = document.getElementById('reload-switch-detail');
    if (reloadSwitchDetail) {
        reloadSwitchDetail.addEventListener('click', () => {
            loadSwitchDetailData({toast: true})
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const closeSwitchDetailButton = document.getElementById('close-switch-detail');
    if (closeSwitchDetailButton) {
        closeSwitchDetailButton.addEventListener('click', closeSwitchDetail);
    }

    const switchPortSearch = document.getElementById('switch-port-search');
    if (switchPortSearch) {
        switchPortSearch.addEventListener('input', debounce((event) => {
            loadSwitchDetailData({page: 1, portQuery: event.target.value.trim()})
                .catch((error) => showToast(error.message, 'error'));
        }));
    }

    const switchPortScope = document.getElementById('switch-port-scope');
    if (switchPortScope) {
        switchPortScope.addEventListener('change', (event) => {
            loadSwitchDetailData({page: 1, portScope: event.target.value})
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const switchPortStatus = document.getElementById('switch-port-status');
    if (switchPortStatus) {
        switchPortStatus.addEventListener('change', (event) => {
            loadSwitchDetailData({page: 1, portStatus: event.target.value})
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const switchPortPageSize = document.getElementById('switch-port-page-size');
    if (switchPortPageSize) {
        switchPortPageSize.addEventListener('change', (event) => {
            loadSwitchDetailData({page: 1, perPage: Number(event.target.value)})
                .catch((error) => showToast(error.message, 'error'));
        });
    }

    const switchPortsPrev = document.getElementById('switch-ports-prev');
    if (switchPortsPrev) {
        switchPortsPrev.addEventListener('click', () => {
            if (switchState.portPage > 1) {
                loadSwitchDetailData({page: switchState.portPage - 1})
                    .catch((error) => showToast(error.message, 'error'));
            }
        });
    }

    const switchPortsNext = document.getElementById('switch-ports-next');
    if (switchPortsNext) {
        switchPortsNext.addEventListener('click', () => {
            if (switchState.portPage < switchState.portPages) {
                loadSwitchDetailData({page: switchState.portPage + 1})
                    .catch((error) => showToast(error.message, 'error'));
            }
        });
    }

    const wirelessApViewButton = document.getElementById('wireless-ap-view-button');
    if (wirelessApViewButton) {
        wirelessApViewButton.addEventListener('click', loadWireless);
    }

    const wirelessApSearch = document.getElementById('wireless-ap-search');
    if (wirelessApSearch) {
        wirelessApSearch.addEventListener('input', debounce((event) => {
            loadWireless({page: 1, query: event.target.value.trim()});
        }));
    }

    const wirelessApPageSize = document.getElementById('wireless-ap-page-size');
    if (wirelessApPageSize) {
        wirelessApPageSize.addEventListener('change', (event) => {
            loadWireless({page: 1, perPage: Number(event.target.value)});
        });
    }

    document.querySelectorAll('[data-wireless-ap-status]').forEach((button) => {
        button.addEventListener('click', () => {
            loadWireless({page: 1, status: button.dataset.wirelessApStatus || ''});
        });
    });

    document.querySelectorAll('[data-wireless-ap-sort]').forEach((button) => {
        button.addEventListener('click', () => {
            const sortBy = button.dataset.wirelessApSort;
            const sortOrder = wirelessApState.sortBy === sortBy && wirelessApState.sortOrder === 'desc' ? 'asc' : 'desc';
            loadWireless({page: 1, sortBy, sortOrder});
        });
    });

    const wirelessApPrev = document.getElementById('wireless-ap-prev');
    if (wirelessApPrev) {
        wirelessApPrev.addEventListener('click', () => {
            if (wirelessApState.page > 1) {
                loadWireless({page: wirelessApState.page - 1});
            }
        });
    }

    const wirelessApNext = document.getElementById('wireless-ap-next');
    if (wirelessApNext) {
        wirelessApNext.addEventListener('click', () => {
            if (wirelessApState.page < wirelessApState.pages) {
                loadWireless({page: wirelessApState.page + 1});
            }
        });
    }

    const wirelessUserViewButton = document.getElementById('wireless-user-view-button');
    if (wirelessUserViewButton) {
        wirelessUserViewButton.addEventListener('click', () => loadWirelessUsers({page: 1}));
    }

    const wirelessUserSearch = document.getElementById('wireless-user-search');
    if (wirelessUserSearch) {
        wirelessUserSearch.addEventListener('input', debounce((event) => {
            loadWirelessUsers({page: 1, query: event.target.value.trim(), resolveNames: true});
        }));
    }

    const wirelessUserPageSize = document.getElementById('wireless-user-page-size');
    if (wirelessUserPageSize) {
        wirelessUserPageSize.addEventListener('change', (event) => {
            loadWirelessUsers({page: 1, perPage: Number(event.target.value), resolveNames: true});
        });
    }

    document.querySelectorAll('[data-wireless-user-sort]').forEach((button) => {
        button.addEventListener('click', () => {
            const sortBy = button.dataset.wirelessUserSort;
            const sortOrder = wirelessUserState.sortBy === sortBy && wirelessUserState.sortOrder === 'desc' ? 'asc' : 'desc';
            loadWirelessUsers({page: 1, sortBy, sortOrder});
        });
    });

    const wirelessUsersPrev = document.getElementById('wireless-users-prev');
    if (wirelessUsersPrev) {
        wirelessUsersPrev.addEventListener('click', () => {
            if (wirelessUserState.page > 1) {
                loadWirelessUsers({page: wirelessUserState.page - 1});
            }
        });
    }

    const wirelessUsersNext = document.getElementById('wireless-users-next');
    if (wirelessUsersNext) {
        wirelessUsersNext.addEventListener('click', () => {
            if (wirelessUserState.page < wirelessUserState.pages) {
                loadWirelessUsers({page: wirelessUserState.page + 1});
            }
        });
    }

    const reloadClients = document.getElementById('reload-clients');
    if (reloadClients) {
        reloadClients.addEventListener('click', () => loadClients({page: clientState.page}));
    }

    const clientSearch = document.getElementById('client-search');
    if (clientSearch) {
        clientSearch.addEventListener('input', debounce((event) => {
            loadClients({page: 1, query: event.target.value.trim()});
        }));
    }

    const clientPageSize = document.getElementById('client-page-size');
    if (clientPageSize) {
        clientPageSize.addEventListener('change', (event) => {
            loadClients({page: 1, perPage: Number(event.target.value)});
        });
    }

    document.querySelectorAll('[data-client-status]').forEach((button) => {
        button.addEventListener('click', () => {
            loadClients({page: 1, status: button.dataset.clientStatus || ''});
        });
    });

    const clientsPrev = document.getElementById('clients-prev');
    if (clientsPrev) {
        clientsPrev.addEventListener('click', () => {
            if (clientState.page > 1) {
                loadClients({page: clientState.page - 1});
            }
        });
    }

    const clientsNext = document.getElementById('clients-next');
    if (clientsNext) {
        clientsNext.addEventListener('click', () => {
            if (clientState.page < clientState.pages) {
                loadClients({page: clientState.page + 1});
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
    startOsdwanMetricsAutoRefresh();
});
