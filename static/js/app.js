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
    if (!stack) {
        return;
    }
    const item = document.createElement('div');
    item.className = `toast-message ${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3500);
}

const viewTitles = {
    dashboard: ['网络运行总览', '核心网络与接入资产运行状态'],
    firewallBandwidth: ['防火墙带宽', '华为防火墙上下行趋势'],
    trafficAnalysis: ['流量分析', 'AC 用户速率与应用明细'],
    osdwan: ['OSDWAN 监控', '用户与带宽趋势'],
    topology: ['网络拓扑', '核心 LLDP 关系与终端接入路径'],
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
    hasValidData: false,
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
    traceTarget: '',
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

const topologyState = {
    data: null,
    devices: [],
    trace: null,
    traceMessage: '',
    traceCode: 0,
    selectedNodeId: '',
    loading: false,
    autoRefreshing: false,
    pickerOpen: false,
    pickerIndex: -1,
    pickerMatches: [],
    pickerSelection: null,
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
let wirelessApEmptyRetryTimer = null;
let activeModalId = null;
let previousFocusedElement = null;
const OSDWAN_METRICS_REFRESH_MS = 60 * 1000;
const TOPOLOGY_STATUS_REFRESH_MS = 60 * 1000;
let osdwanMetricsAutoRefreshing = false;
let trafficAnalysisRequestId = 0;
let dashboardFirewallWarmupTimer = null;
let dashboardFirewallWarmupRetries = 0;
let firewallBandwidthRequestId = 0;
const firewallBandwidthState = {
    range: '6h',
    committedRange: '6h',
    samples: [],
    latest: null,
    hasValidData: false,
    emptyMessage: '暂无带宽历史样本',
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

const OPS_VIEW_IDS = new Set([
    'dashboard-panel',
    'firewall-bandwidth-panel',
    'traffic-analysis-panel',
    'osdwan-panel',
    'topology-panel',
    'switches-panel',
    'wireless-panel',
    'devices-panel',
    'clients-panel',
    'users-panel',
]);
const WORKSPACE_VIEW_IDS = new Set([
    'osdwan-panel',
    'topology-panel',
    'switches-panel',
    'wireless-panel',
    'devices-panel',
    'clients-panel',
    'users-panel',
]);

function showView(viewId, navId, titleKey) {
    document.querySelectorAll('.app-view').forEach((view) => {
        view.hidden = view.id !== viewId;
    });
    const dashboardActive = viewId === 'dashboard-panel';
    const firewallActive = viewId === 'firewall-bandwidth-panel';
    const trafficActive = viewId === 'traffic-analysis-panel';
    document.body.classList.toggle('ops-screen-active', OPS_VIEW_IDS.has(viewId));
    document.body.classList.toggle('workspace-screen-active', WORKSPACE_VIEW_IDS.has(viewId));
    document.body.classList.toggle('dashboard-screen-active', dashboardActive);
    document.body.classList.toggle('firewall-screen-active', firewallActive);
    document.body.classList.toggle('traffic-screen-active', trafficActive);
    document.querySelectorAll('.nav-item').forEach((item) => {
        const active = item.id === navId;
        item.classList.toggle('active', active);
        if (active) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });

    const title = viewTitles[titleKey] || viewTitles.dashboard;
    document.getElementById('page-title').textContent = title[0];
    document.getElementById('page-subtitle').textContent = title[1];
    const navItem = document.getElementById(navId);
    const hash = navItem?.getAttribute('href');
    if (hash && hash.startsWith('#') && window.location.hash !== hash) {
        history.replaceState(null, '', hash);
    }
    closeSidebar();
}

function openSidebar() {
    document.body.classList.add('sidebar-open');
    const toggle = document.getElementById('mobile-nav-toggle');
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', '关闭导航');
    }
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const toggle = document.getElementById('mobile-nav-toggle');
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', '打开导航');
    }
}

function toggleSidebar() {
    if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function setButtonBusy(button, busy) {
    if (!button) {
        return;
    }
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
    button.setAttribute('aria-busy', String(busy));
}

function runButtonTask(button, taskFactory) {
    setButtonBusy(button, true);
    Promise.resolve()
        .then(taskFactory)
        .catch((error) => showToast(error.message || '操作失败', 'error'))
        .finally(() => setButtonBusy(button, false));
}

const MODAL_FOCUS_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getModalFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(MODAL_FOCUS_SELECTOR))
        .filter((element) => element.getClientRects().length > 0);
}

function focusFirstModalControl(modal) {
    const focusable = getModalFocusableElements(modal)[0];
    if (focusable) {
        focusable.focus();
    } else {
        modal.focus();
    }
}

function trapModalFocus(event) {
    if (!activeModalId || event.key !== 'Tab') {
        return false;
    }

    const modal = document.getElementById(activeModalId);
    if (!modal || modal.hidden) {
        return false;
    }

    const focusable = getModalFocusableElements(modal);
    if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return true;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return true;
    }
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
        return true;
    }
    return false;
}

function isVisibleView(viewId) {
    const view = document.getElementById(viewId);
    return Boolean(view && !view.hidden);
}

function refreshCurrentView() {
    if (isVisibleView('firewall-bandwidth-panel')) {
        return loadFirewallBandwidth({toast: false});
    }
    if (isVisibleView('traffic-analysis-panel')) {
        return loadTrafficAnalysis({page: trafficAnalysisState.page, refresh: true});
    }
    if (isVisibleView('osdwan-panel')) {
        return loadOsdwanMetrics({charts: false});
    }
    if (isVisibleView('topology-panel')) {
        return loadTopology();
    }
    if (isVisibleView('switches-panel')) {
        const switchDetail = document.getElementById('switch-detail-section');
        if (switchDetail && !switchDetail.hidden && switchState.selectedInstance) {
            return loadSwitchDetailData({page: switchState.portPage});
        }
        return loadSwitches({page: switchState.page});
    }
    if (isVisibleView('wireless-panel')) {
        if (wirelessActiveView === 'users') {
            return loadWirelessUsers({page: wirelessUserState.page});
        }
        return loadWireless({page: wirelessApState.page});
    }
    if (isVisibleView('devices-panel')) {
        return loadDevices({page: deviceState.page});
    }
    if (isVisibleView('clients-panel')) {
        return loadClients({page: clientState.page});
    }
    if (isVisibleView('users-panel')) {
        return loadUsers();
    }
    return loadSummary();
}

async function loadProfile() {
    const user = await apiGet('/api/user/profile');
    currentUser = user;
    document.getElementById('current-user-name').textContent = user.full_name || user.username;
    document.getElementById('current-user-role').textContent = user.role;
    if (user.role !== 'admin' && !user.is_superuser) {
        const usersNav = document.getElementById('users-nav');
        if (usersNav) {
            usersNav.classList.add('disabled');
            usersNav.setAttribute('aria-disabled', 'true');
        }
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
    renderSituationOverview(data);
    renderFirewallDashboard(data.firewall || {});
    renderDashboardOsdwan(osdwan);
    renderDashboardHealth(data);
    renderDashboardActions(data);
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

function renderSituationOverview(data) {
    const actions = buildDashboardActions(data || {});
    const scoreInfo = calculateSituationScore(data || {}, actions);
    const summary = data.summary || {};
    const devices = summary.devices || {};
    const freshness = devices.status_freshness || {};
    const osdwan = data.osdwan || {};
    const proxyStatus = osdwan.proxy_status || {};
    const systems = [
        data.firewall,
        data.switches,
        data.wireless,
        osdwan,
        data.traffic_apps,
    ];
    const okSystems = systems.filter((item) => item?.configured && item?.ok).length;

    setText('situation-updated-at', `最近同步 ${formatDashboardTime(new Date())}`);
    setText('situation-health-score', scoreInfo.score);
    setText('situation-health-level', scoreInfo.label);
    setText('situation-alert-total', actions.length ? `${actions.length} 项事件` : '无待处理');
    setText('situation-ok-systems', `${okSystems}/${systems.length}`);
    setText('situation-offline-devices', devices.offline ?? 0);
    setText('situation-stale-devices', Number(freshness.expired_count || 0) + Number(freshness.unchecked_count || 0));
    setText('situation-proxy-risk', renderOsdwanProxyRisk(osdwan));
    setText('situation-device-risk', renderDeviceSituationText(devices));
    setText('situation-health-summary', scoreInfo.summary);

    const panel = document.getElementById('dashboard-panel');
    if (panel) {
        panel.dataset.situationLevel = scoreInfo.state;
    }

    renderSituationNode('situation-node-firewall', classifyIntegrationNode(data.firewall, '链路正常', '接口异常'));
    renderSituationNode('situation-node-switches', classifySwitchNode(data.switches));
    renderSituationNode('situation-node-wireless', classifyIntegrationNode(data.wireless, '控制器正常', '查询异常'));
    renderSituationNode('situation-node-osdwan', classifyOsdwanNode(osdwan));
    renderSituationNode('situation-node-devices', classifyDeviceNode(devices));
}

function calculateSituationScore(data, actions) {
    const summary = data.summary || {};
    const devices = summary.devices || {};
    const freshness = devices.status_freshness || {};
    const proxyStatus = data.osdwan?.proxy_status || {};
    const totalDevices = Number(devices.total || 0);
    const offlineDevices = Number(devices.offline || 0);
    const staleDevices = Number(freshness.expired_count || 0) + Number(freshness.unchecked_count || 0);
    const unconfiguredCount = [data.firewall, data.switches, data.wireless, data.osdwan, data.traffic_apps]
        .filter((item) => item && !item.configured).length;
    let score = 100;

    actions.forEach((item) => {
        if (item.level === 'critical') {
            score -= 16;
        } else if (item.level === 'warning') {
            score -= 8;
        } else if (item.level === 'info') {
            score -= 5;
        }
    });
    if (totalDevices > 0 && offlineDevices > 0) {
        score -= Math.min(24, Math.round((offlineDevices / totalDevices) * 30));
    }
    if (staleDevices > 0) {
        score -= Math.min(14, 6 + Math.round(staleDevices / 20));
    }
    if (Number(proxyStatus.offline || 0) > 0) {
        score -= 10;
    }
    score -= unconfiguredCount * 4;
    score = Math.max(42, Math.min(100, score));

    if (score >= 85 && actions.length === 0) {
        return {
            score,
            state: 'normal',
            label: '运行平稳',
            summary: '核心链路、资产和外部接口处于可观测状态，保持巡检即可。',
        };
    }
    if (score >= 68) {
        return {
            score,
            state: 'warning',
            label: '需要关注',
            summary: `发现 ${actions.length} 项待关注事件，建议优先核查离线资产、状态新鲜度和外部接口。`,
        };
    }
    return {
        score,
        state: 'critical',
        label: '存在告警',
        summary: `当前存在 ${actions.length} 项风险事件，优先处理高优先级告警和关键接口异常。`,
    };
}

function renderSituationNode(elementId, node) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }
    element.dataset.state = node.state;
    const value = element.querySelector('strong');
    if (value) {
        value.textContent = node.text;
    }
    element.title = node.detail || node.text;
}

function classifyIntegrationNode(payload, okText, badText) {
    const item = payload || {};
    if (!item.configured) {
        return {state: 'unconfigured', text: '未配置', detail: '缺少接口配置'};
    }
    if (!item.ok) {
        return {state: 'critical', text: badText, detail: item.error || badText};
    }
    return {state: 'normal', text: okText, detail: okText};
}

function classifySwitchNode(payload) {
    const item = payload || {};
    if (!item.configured) {
        return {state: 'unconfigured', text: '未配置', detail: 'Prometheus targets 未配置'};
    }
    if (!item.ok) {
        return {state: 'critical', text: '采集异常', detail: item.error || '交换机监控异常'};
    }
    if (Number(item.offline || 0) > 0) {
        return {state: 'warning', text: `${item.online || 0}/${item.total || 0} UP`, detail: `${item.offline} 台交换机离线`};
    }
    return {state: 'normal', text: `${item.online || 0}/${item.total || 0} UP`, detail: '交换机目标正常'};
}

function classifyOsdwanNode(payload) {
    const item = payload || {};
    const proxyStatus = item.proxy_status || {};
    if (!item.configured) {
        return {state: 'unconfigured', text: '未配置', detail: 'OSDWAN Token 或节点未配置'};
    }
    if (!item.ok) {
        return {state: 'critical', text: '接口异常', detail: item.error || 'OSDWAN 接口异常'};
    }
    if (Number(proxyStatus.offline || 0) > 0) {
        return {state: 'warning', text: `${proxyStatus.online || 0}/${proxyStatus.total || 0} 正常`, detail: `${proxyStatus.offline} 个出口异常`};
    }
    return {state: 'normal', text: `${proxyStatus.online || 0}/${proxyStatus.total || 0} 正常`, detail: 'OSDWAN 出口正常'};
}

function classifyDeviceNode(devices) {
    const item = devices || {};
    const freshness = item.status_freshness || {};
    const offline = Number(item.offline || 0);
    const stale = Number(freshness.expired_count || 0) + Number(freshness.unchecked_count || 0);
    if (offline > 0) {
        return {state: 'critical', text: `${offline} 离线`, detail: `${offline} 台设备当前离线`};
    }
    if (stale > 0) {
        return {state: 'warning', text: `${stale} 过期`, detail: `${stale} 台设备状态需要刷新`};
    }
    return {state: 'normal', text: `${item.online || 0}/${item.total || 0} 在线`, detail: '设备状态正常'};
}

function renderDeviceSituationText(devices) {
    const item = devices || {};
    const freshness = item.status_freshness || {};
    const offline = Number(item.offline || 0);
    const stale = Number(freshness.expired_count || 0) + Number(freshness.unchecked_count || 0);
    if (offline > 0) {
        return `${offline} 台离线`;
    }
    if (stale > 0) {
        return `${stale} 台需刷新`;
    }
    return '资产状态正常';
}

function renderOsdwanProxyRisk(osdwan) {
    const item = osdwan || {};
    const proxyStatus = item.proxy_status || {};
    if (!item.configured) {
        return '未配置';
    }
    if (!item.ok) {
        return '接口异常';
    }
    const offline = Number(proxyStatus.offline || 0);
    return offline > 0 ? `${offline} 异常` : '正常';
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value ?? '-';
    }
}

function formatDashboardTime(date) {
    return date.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function renderDashboardActions(data) {
    const list = document.getElementById('dashboard-action-list');
    const count = document.getElementById('workbench-todos-count');
    const subtitle = document.getElementById('workbench-todos-subtitle');
    if (!list || !count || !subtitle) {
        return;
    }

    const actions = buildDashboardActions(data || {});
    count.textContent = actions.length ? `${actions.length} 项` : '正常';
    count.classList.toggle('ok', actions.length === 0);
    count.classList.toggle('bad', actions.some((item) => item.level === 'critical'));
    subtitle.textContent = actions.length
        ? '优先处理会影响监控可信度或用户访问的事项'
        : '核心系统暂无需要立即处理的事项';

    if (!actions.length) {
        list.innerHTML = `
            <div class="workbench-action situation-alert-row ok" role="listitem">
                    <span class="workbench-action-severity">正常</span>
                <span class="workbench-action-copy">
                    <strong>核心状态正常</strong>
                    <small>继续关注实时带宽、离线资产和外部接口状态。</small>
                </span>
                <em>持续监控</em>
            </div>
        `;
        return;
    }

    list.innerHTML = actions.map((item) => {
        const statusAttr = item.status ? ` data-workbench-status="${escapeHtml(item.status)}"` : '';
        const detailTitle = item.detailTitle || item.detail;
        return `
            <div class="workbench-action-item" role="listitem">
                <button class="workbench-action situation-alert-row ${escapeHtml(item.level)}" type="button" data-workbench-nav="${escapeHtml(item.navId)}"${statusAttr}>
                    <span class="workbench-action-severity">${escapeHtml(renderDashboardActionLevelLabel(item.level))}</span>
                    <span class="workbench-action-copy">
                        <strong>${escapeHtml(item.title)}</strong>
                        <small title="${escapeHtml(detailTitle)}">${escapeHtml(item.detail)}</small>
                    </span>
                    <em>${escapeHtml(item.action)}</em>
                </button>
            </div>
        `;
    }).join('');
}

function buildDashboardActions(data) {
    const actions = [];
    const summary = data.summary || {};
    const devices = summary.devices || {};
    const freshness = devices.status_freshness || {};
    const offlineDevices = Number(devices.offline || 0);
    const expiredDevices = Number(freshness.expired_count || 0);
    const uncheckedDevices = Number(freshness.unchecked_count || 0);

    if (expiredDevices || uncheckedDevices) {
        actions.push({
            level: 'warning',
            icon: 'bi-hourglass-split',
            title: '设备状态需要刷新',
            detail: `过期 ${expiredDevices} 台，未检查 ${uncheckedDevices} 台`,
            action: '查看设备',
            navId: 'devices-nav',
        });
    }
    if (offlineDevices) {
        actions.push({
            level: 'critical',
            icon: 'bi-hdd-network',
            title: '存在离线设备',
            detail: `${offlineDevices} 台设备当前离线`,
            action: '筛选离线',
            navId: 'devices-nav',
            status: 'offline',
        });
    }

    addIntegrationAction(actions, data.firewall, '防火墙接口异常', '防火墙未配置或状态异常', '防火墙带宽', 'firewall-bandwidth-nav');
    addIntegrationAction(actions, data.switches, '交换机监控异常', 'Prometheus targets 未配置或状态异常', '交换机监控', 'switches-nav');
    addIntegrationAction(actions, data.wireless, '无线控制器异常', '无线 Prometheus 查询未配置或状态异常', '无线控制器', 'wireless-nav');
    addIntegrationAction(actions, data.traffic_apps, '流量分析异常', '深信服 AC 应用排行未配置或读取失败', '流量分析', 'traffic-analysis-nav');

    const osdwan = data.osdwan || {};
    const proxyStatus = osdwan.proxy_status || {};
    if (!osdwan.configured || !osdwan.ok || Number(proxyStatus.offline || 0) > 0) {
        actions.push({
            level: osdwan.configured ? 'warning' : 'info',
            icon: 'bi-cloud-arrow-up',
            title: osdwan.configured ? 'OSDWAN 需要关注' : 'OSDWAN 未配置',
            detail: osdwan.configured ? `出口 ${proxyStatus.online || 0}/${proxyStatus.total || 0} 正常` : '缺少 Token 或节点配置',
            action: '查看 OSDWAN',
            navId: 'osdwan-nav',
        });
    }

    return actions.slice(0, 6);
}

function renderDashboardActionLevelLabel(level) {
    const labels = {
        critical: '高',
        warning: '中',
        info: '配置',
        ok: 'OK',
    };
    return labels[level] || '待办';
}

function addIntegrationAction(actions, payload, title, detail, action, navId) {
    const status = payload || {};
    if (status.configured && status.ok) {
        return;
    }
    const detailText = status.configured
        ? summarizeIntegrationError(status.error, detail)
        : detail;
    actions.push({
        level: status.configured ? 'warning' : 'info',
        icon: status.configured ? 'bi-exclamation-triangle' : 'bi-slash-circle',
        title,
        detail: detailText,
        action,
        navId,
    });
}

function summarizeIntegrationError(error, fallback) {
    const rawText = String(error || '').trim();
    const fallbackText = String(fallback || '接口读取失败')
        .replace('未配置或', '')
        .replace('或状态异常', '状态异常');
    if (!rawText) {
        return fallbackText;
    }

    const lowerText = rawText.toLowerCase();
    if (rawText.includes('ConnectionResetError') || lowerText.includes('connection reset')) {
        return '接口连接被对端重置';
    }
    if (lowerText.includes('timeout') || lowerText.includes('timed out') || rawText.includes('超时')) {
        return '接口请求超时';
    }
    if (lowerText.includes('connection aborted') || rawText.includes('Connection aborted')) {
        return '接口连接中断';
    }
    if (lowerText.includes('connection refused') || rawText.includes('Connection refused')) {
        return '接口连接被拒绝';
    }
    if (lowerText.includes('name or service not known') || lowerText.includes('failed to resolve') || lowerText.includes('nodename nor servname')) {
        return '接口地址无法解析';
    }
    if (lowerText.includes('unauthorized') || lowerText.includes('forbidden') || rawText.includes('401') || rawText.includes('403')) {
        return '接口鉴权失败';
    }
    return '接口返回异常，进入对应页面查看详情';
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
    const requestId = ++firewallBandwidthRequestId;
    firewallBandwidthState.range = options.range || firewallBandwidthState.range;
    showView('firewall-bandwidth-panel', 'firewall-bandwidth-nav', 'firewallBandwidth');
    setFirewallPageStatus('loading', firewallBandwidthState.latest ? '刷新中' : '检查中');
    renderFirewallRangeButtons();
    try {
        const params = new URLSearchParams({
            limit: 720,
            refresh: '1',
            range: firewallBandwidthState.range
        });
        const data = await apiGet(`/api/status/huawei-firewall/bandwidth-history?${params.toString()}`);
        if (requestId !== firewallBandwidthRequestId) {
            return;
        }
        renderFirewallBandwidthPage(data);
        if (options.toast) {
            showToast('带宽数据已刷新');
        }
    } catch (error) {
        if (requestId !== firewallBandwidthRequestId) {
            return;
        }
        firewallBandwidthState.range = firewallBandwidthState.committedRange;
        renderFirewallRangeButtons();
        renderFirewallBandwidthFailure(error.message);
        showToast(error.message, 'error');
    }
}

function renderFirewallBandwidthPage(data) {
    const latest = data.latest || {};
    const samples = data.samples || [];
    const configured = Boolean(latest.configured ?? data.configured);
    const ok = Boolean(latest.ok);
    const hasSamples = samples.length > 0;
    const hasMetricData = ok || hasSamples;

    firewallBandwidthState.latest = latest;
    firewallBandwidthState.samples = samples;
    firewallBandwidthState.hasValidData = hasMetricData;
    firewallBandwidthState.range = data.range || firewallBandwidthState.range;
    firewallBandwidthState.committedRange = firewallBandwidthState.range;

    const rangeLabel = renderFirewallRangeLabel(firewallBandwidthState.range);
    const sampleCount = data.sample_count ?? samples.length;
    const sampleTimestamp = hasMetricData
        ? (samples[samples.length - 1]?.timestamp || latest.timestamp)
        : null;
    const source = latest.snmp_target
        ? `SNMP 目标 ${latest.snmp_target} · ${rangeLabel} · ${sampleCount} 个样本`
        : 'SNMP 目标未配置';

    if (!configured) {
        setFirewallPageStatus('unconfigured', 'SNMP 未配置');
        setText('firewall-bandwidth-source', '未配置华为防火墙 SNMP 采集目标');
    } else if (ok) {
        setFirewallPageStatus('ok', '采集正常');
        setText('firewall-bandwidth-source', source);
    } else {
        const errorSummary = summarizeIntegrationError(latest.error, '防火墙采集异常');
        setFirewallPageStatus(hasSamples ? 'warning' : 'bad', '采集异常');
        setText('firewall-bandwidth-source', hasSamples
            ? `${errorSummary} · 当前展示历史样本`
            : errorSummary);
    }

    setText('firewall-last-sample', sampleTimestamp ? `最后样本 ${formatChartTime(sampleTimestamp)}` : '最后样本 -');
    renderFirewallMetricSnapshot(latest, configured, hasMetricData, ok, sampleCount, rangeLabel);

    renderFirewallRangeButtons();
    firewallBandwidthState.emptyMessage = configured ? '暂无带宽历史样本' : 'SNMP 未配置';
    renderFirewallBandwidthCharts(samples, firewallBandwidthState.emptyMessage);
}

function renderFirewallMetricSnapshot(latest, configured, hasMetricData, hasResourceData, sampleCount, rangeLabel) {
    const telecomDownload = Number(latest.telecom_download || 0);
    const telecomUpload = Number(latest.telecom_upload || 0);
    const unicomDownload = Number(latest.unicom_download || 0);
    const unicomUpload = Number(latest.unicom_upload || 0);
    const totalDownloadValue = Number(latest.total_download);
    const totalUploadValue = Number(latest.total_upload);
    const totalDownload = Number.isFinite(totalDownloadValue)
        ? totalDownloadValue
        : telecomDownload + unicomDownload;
    const totalUpload = Number.isFinite(totalUploadValue)
        ? totalUploadValue
        : telecomUpload + unicomUpload;
    const totalBandwidth = Number(latest.total_bandwidth);
    const downloadUtilizationValue = Number(latest.download_utilization);
    const uploadUtilizationValue = Number(latest.upload_utilization);
    const downloadUtilization = Number.isFinite(downloadUtilizationValue)
        ? downloadUtilizationValue
        : (totalBandwidth ? (totalDownload / totalBandwidth) * 100 : 0);
    const uploadUtilization = Number.isFinite(uploadUtilizationValue)
        ? uploadUtilizationValue
        : (totalBandwidth ? (totalUpload / totalBandwidth) * 100 : 0);

    setText('firewall-page-total-download', hasMetricData ? formatMbps(totalDownload) : '-');
    setText('firewall-page-total-upload', hasMetricData ? formatMbps(totalUpload) : '-');
    setText('firewall-page-download-utilization', hasMetricData ? `${formatNumber(downloadUtilization, 1)}%` : '-');
    setText('firewall-page-upload-utilization', hasMetricData ? `${formatNumber(uploadUtilization, 1)}%` : '-');
    setText('firewall-page-total-bandwidth', configured && Number.isFinite(totalBandwidth) ? formatMbps(totalBandwidth) : '-');
    setText('firewall-page-cpu', hasResourceData ? `${formatNumber(latest.cpu_usage, 1)}%` : '-');
    setText('firewall-page-memory', hasResourceData ? `${formatNumber(latest.memory_usage, 1)}%` : '-');

    const downloadBar = document.getElementById('firewall-page-download-bar');
    const uploadBar = document.getElementById('firewall-page-upload-bar');
    if (downloadBar) {
        downloadBar.style.width = `${hasMetricData ? clampPercent(downloadUtilization) : 0}%`;
    }
    if (uploadBar) {
        uploadBar.style.width = `${hasMetricData ? clampPercent(uploadUtilization) : 0}%`;
    }

    setText('firewall-telecom-download-current', hasMetricData ? formatMbps(telecomDownload) : '-');
    setText('firewall-telecom-upload-current', hasMetricData ? formatMbps(telecomUpload) : '-');
    setText('firewall-unicom-download-current', hasMetricData ? formatMbps(unicomDownload) : '-');
    setText('firewall-unicom-upload-current', hasMetricData ? formatMbps(unicomUpload) : '-');
    setText('firewall-collection-target', configured ? (latest.snmp_target || '-') : '未配置');
    setText('firewall-collection-range', rangeLabel);
    setText('firewall-sample-count', `${sampleCount || 0} 个`);
}

function renderFirewallBandwidthCharts(samples, emptyMessage = '暂无带宽历史样本') {
    const options = {theme: 'dark', emptyMessage};
    const downloadSeries = {label: '下行', color: '#58b88b', fill: 'rgba(88, 184, 139, 0.10)', width: 1.8};
    const uploadSeries = {label: '上行', color: '#63a7df', fill: 'rgba(99, 167, 223, 0.08)', width: 1.8};
    drawBandwidthChart('firewall-total-chart', samples, [
        {...downloadSeries, key: 'total_download'},
        {...uploadSeries, key: 'total_upload'},
    ], options);
    drawBandwidthChart('firewall-telecom-chart', samples, [
        {...downloadSeries, key: 'telecom_download'},
        {...uploadSeries, key: 'telecom_upload'},
    ], options);
    drawBandwidthChart('firewall-unicom-chart', samples, [
        {...downloadSeries, key: 'unicom_download'},
        {...uploadSeries, key: 'unicom_upload'},
    ], options);
    updateFirewallChartLabel('firewall-total-chart', '防火墙总带宽趋势', samples, 'total_download', 'total_upload', emptyMessage);
    updateFirewallChartLabel('firewall-telecom-chart', '电信链路带宽趋势', samples, 'telecom_download', 'telecom_upload', emptyMessage);
    updateFirewallChartLabel('firewall-unicom-chart', '联通链路带宽趋势', samples, 'unicom_download', 'unicom_upload', emptyMessage);
}

function updateFirewallChartLabel(canvasId, title, samples, downloadKey, uploadKey, emptyMessage) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }
    const latest = samples[samples.length - 1];
    const label = latest
        ? `${title}，共 ${samples.length} 个样本，当前下行 ${formatMbps(latest[downloadKey])}，当前上行 ${formatMbps(latest[uploadKey])}`
        : `${title}，${emptyMessage}`;
    canvas.setAttribute('aria-label', label);
}

function renderFirewallBandwidthFailure(message) {
    const errorSummary = summarizeIntegrationError(message, '防火墙带宽读取失败');
    if (firewallBandwidthState.hasValidData) {
        setFirewallPageStatus('bad', '刷新失败');
        setText('firewall-bandwidth-source', `${errorSummary} · 已保留上次有效数据`);
        return;
    }

    setFirewallPageStatus('bad', '读取失败');
    setText('firewall-bandwidth-source', errorSummary);
    setText('firewall-last-sample', '最后样本 -');
    renderFirewallMetricSnapshot({}, false, false, false, 0, renderFirewallRangeLabel(firewallBandwidthState.range));
    firewallBandwidthState.emptyMessage = '带宽数据读取失败';
    renderFirewallBandwidthCharts([], firewallBandwidthState.emptyMessage);
}

function setFirewallPageStatus(state, label) {
    const status = document.getElementById('firewall-page-status');
    if (!status) {
        return;
    }
    status.className = `firewall-page-status ${state}`;
    status.textContent = label;
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
    const table = body.closest('table');
    const preserveCurrent = trafficAnalysisState.hasValidData;
    const loadingLabel = options.refresh ? '刷新中' : (preserveCurrent ? '查询中' : '检查中');
    setTrafficAnalysisPageStatus('loading', loadingLabel);
    table?.setAttribute('aria-busy', 'true');
    if (!preserveCurrent) {
        trafficAnalysisState.hasValidData = false;
        body.innerHTML = '<tr><td colspan="9">加载中</td></tr>';
        summary.textContent = '正在读取用户流量排行';
    }

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
        if (result.code !== 0) {
            const message = summarizeIntegrationError(result.message, '流量排行读取失败');
            setTrafficAnalysisPageStatus('bad', '采集异常');
            setText('traffic-analysis-source', preserveCurrent ? `${message} · 已保留上次有效数据` : message);
            if (!preserveCurrent) {
                resetTrafficAnalysisView();
                body.innerHTML = `<tr><td colspan="9">${escapeHtml(message)}</td></tr>`;
                summary.textContent = '无法获取流量排行';
            }
            return;
        }

        trafficAnalysisState.page = data.page || trafficAnalysisState.page;
        trafficAnalysisState.pages = data.pages || 0;
        trafficAnalysisState.total = data.total || 0;
        trafficAnalysisState.allTotal = data.all_total || 0;
        trafficAnalysisState.line = data.line || trafficAnalysisState.line;
        trafficAnalysisState.top = data.top || trafficAnalysisState.top;
        renderTrafficAnalysisMetrics(data.summary || {});
        renderTrafficAnalysisPager();
        trafficAnalysisState.hasValidData = true;

        const snapshot = data.snapshot || {};
        const snapshotDate = snapshot.updated_at ? new Date(snapshot.updated_at) : new Date();
        const effectiveDate = Number.isNaN(snapshotDate.getTime()) ? new Date() : snapshotDate;
        setTrafficAnalysisPageStatus('ok', snapshot.cached ? '快照可用' : '数据正常');
        setText('traffic-analysis-updated-at', `${snapshot.cached ? '快照' : '最近更新'} ${formatDashboardTime(effectiveDate)}`);
        setText('traffic-analysis-source', data.source ? `数据源 ${data.source}` : '深信服 AC · 用户速率与应用明细');

        const items = data.items || [];
        summary.textContent = `${renderTrafficAnalysisSummaryPrefix()}共 ${data.total || 0} 条，当前显示 ${data.returned || items.length} 条，接口返回 ${data.all_total || 0} 条，${renderClientNameCacheSummary(data.name_cache_refresh)}`;
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="9">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = items.map((item) => `
            <tr>
                <td class="rank-cell" data-label="排名">${escapeHtml(item.rank || '-')}</td>
                <td class="user-cell" data-label="用户">${escapeHtml(item.name || '-')}</td>
                <td data-label="姓名">${renderTrafficAnalysisRealName(item)}</td>
                <td data-label="IP">${escapeHtml(item.ip || '-')}</td>
                <td class="rate-cell" data-label="上行">${escapeHtml(item.up_rate || '0 bps')}</td>
                <td class="rate-cell" data-label="下行">${escapeHtml(item.down_rate || '0 bps')}</td>
                <td data-label="会话">${escapeHtml(item.session ?? 0)}</td>
                <td data-label="状态">${renderTrafficAnalysisStatus(item)}</td>
                <td class="traffic-app-cell" data-label="应用明细">${renderTrafficAnalysisApps(item.apps || [])}</td>
            </tr>
        `).join('');

        if (options.toast) {
            showToast('流量排行已刷新');
        }
    } catch (error) {
        if (requestId !== trafficAnalysisRequestId) {
            return;
        }
        const message = summarizeIntegrationError(error.message, '流量排行读取失败');
        setTrafficAnalysisPageStatus('bad', '读取失败');
        setText('traffic-analysis-source', preserveCurrent ? `${message} · 已保留上次有效数据` : message);
        if (!preserveCurrent) {
            resetTrafficAnalysisView();
            body.innerHTML = `<tr><td colspan="9">${escapeHtml(message)}</td></tr>`;
            summary.textContent = '加载失败';
        }
        showToast(error.message, 'error');
    } finally {
        if (requestId === trafficAnalysisRequestId) {
            table?.removeAttribute('aria-busy');
        }
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

    const chartOptions = {theme: 'dark', emptyMessage: '暂无流量样本'};
    drawBandwidthChart('osdwan-all-chart', osdwanState.allSamples, osdwanChartSeries(), chartOptions);
    drawBandwidthChart('osdwan-node-chart', osdwanState.nodeSamples, osdwanChartSeries(), chartOptions);
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
    const chartOptions = {theme: 'dark', emptyMessage: message || '暂无流量样本'};
    drawBandwidthChart('osdwan-all-chart', [], osdwanChartSeries(), chartOptions);
    drawBandwidthChart('osdwan-node-chart', [], osdwanChartSeries(), chartOptions);
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
        {key: 'download_mbps', label: '下行', color: '#58b88b', fill: 'rgba(88, 184, 139, 0.10)', width: 1.8},
        {key: 'upload_mbps', label: '上行', color: '#63a7df', fill: 'rgba(99, 167, 223, 0.08)', width: 1.8},
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
            <td data-label="用户">${escapeHtml(user.username || user.id || '-')}</td>
            <td data-label="关联人员">${renderPersonChips(user.people || [])}</td>
            <td data-label="部门">${escapeHtml(user.departments || '-')}</td>
            <td data-label="邮箱">${escapeHtml(user.email || '-')}</td>
            <td data-label="角色">${escapeHtml(user.role || '-')}</td>
            <td data-label="状态">${escapeHtml(user.status || '-')}</td>
            <td data-label="出口 IP">${escapeHtml(user.proxy_ips || '-')}</td>
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

function drawBandwidthChart(canvasId, samples, series, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }

    const darkTheme = options.theme === 'dark';
    const colors = darkTheme ? {
        background: '#181e21',
        grid: '#293135',
        axis: '#3a4449',
        text: '#8c989e',
    } : {
        background: '#ffffff',
        grid: '#edf1f3',
        axis: '#d9e0e4',
        text: '#66737d',
    };
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || canvas.clientWidth || 720);
    const height = Math.max(220, rect.height || canvas.clientHeight || 280);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    const plot = {left: 60, top: 18, right: 18, bottom: 34};
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const values = samples.flatMap((sample) => series.map((item) => Number(sample[item.key] || 0)));
    const maxValue = Math.max(1, ...values);
    const yMax = Math.ceil(maxValue * 1.15);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.text;
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

    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.top + plotHeight);
    ctx.lineTo(width - plot.right, plot.top + plotHeight);
    ctx.stroke();

    if (!samples.length) {
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.fillText(options.emptyMessage || '暂无带宽历史样本', width / 2, height / 2);
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
    ctx.fillStyle = colors.text;
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
    const summary = document.getElementById('users-summary');
    usersPanel.hidden = false;
    body.innerHTML = '<tr><td colspan="7">加载中</td></tr>';
    if (summary) {
        summary.textContent = '加载中';
    }

    try {
        const result = await apiGet('/api/user/list');
        const users = Array.isArray(result) ? result : (result.users || []);
        usersCache = users;
        renderUserOpsSummary(users);
        if (!users.length) {
            body.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
            return;
        }
        body.innerHTML = users.map((user) => `
            <tr>
                <td data-label="用户名">${escapeHtml(user.username)}</td>
                <td data-label="姓名">${escapeHtml(user.full_name || '-')}</td>
                <td data-label="邮箱">${escapeHtml(user.email || '-')}</td>
                <td data-label="角色">${escapeHtml(user.role)}</td>
                <td data-label="状态">${renderUserStatus(user)}</td>
                <td data-label="最后登录">${escapeHtml(user.last_login || '-')}</td>
                <td data-label="操作">${renderUserActions(user)}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        if (summary) {
            summary.textContent = '加载失败';
        }
        renderUserOpsSummary([]);
    }
}

function renderUserOpsSummary(users) {
    const total = users.length;
    const active = users.filter((user) => user.is_active).length;
    const admin = users.filter((user) => user.is_superuser || user.role === 'admin').length;
    setText('user-stat-total', total);
    setText('user-stat-active', active);
    setText('user-stat-inactive', Math.max(0, total - active));
    setText('user-stat-admin', admin);
    const summary = document.getElementById('users-summary');
    if (summary) {
        summary.textContent = total
            ? `共 ${total} 个账号，启用 ${active} 个，管理员 ${admin} 个`
            : '暂无系统账号';
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
        renderDeviceFreshnessBanner(deviceState.statusFreshness);
        renderDeviceOpsSummary();

        summary.textContent = `${renderDeviceSummaryPrefix()}共 ${deviceState.total} 台，当前显示 ${result.returned || devices.length} 台${renderDeviceFreshnessSummary(deviceState.statusFreshness)}`;
        if (!devices.length) {
            body.innerHTML = '<tr><td colspan="8">暂无数据</td></tr>';
            maybeAutoRefreshDeviceStatus(deviceState.statusFreshness, options);
            return;
        }
        body.innerHTML = devices.map((device) => `
            <tr>
                <td data-label="名称" title="${escapeHtml(device.details || '')}">${escapeHtml(device.username)}</td>
                <td data-label="IP">${escapeHtml(device.ip_address)}</td>
                <td data-label="端口" class="device-port-cell" data-device-port-cell="${escapeHtml(device.id)}">${renderDevicePortLookup(device)}</td>
                <td data-label="MAC">${escapeHtml(device.mac_address || '-')}</td>
                <td data-label="分类">${escapeHtml(device.category || '未分类')}</td>
                <td data-label="状态">${renderDeviceStatus(device)}</td>
                <td data-label="最后检查">${escapeHtml(device.last_check_time || '-')}</td>
                <td data-label="操作">${renderDeviceActions(device)}</td>
            </tr>
        `).join('');
        maybeAutoRefreshDeviceStatus(deviceState.statusFreshness, options);
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
        renderDeviceOpsSummary();
    }
}

async function loadWireless(options = {}) {
    if (!options.emptyRetry && wirelessApEmptyRetryTimer) {
        window.clearTimeout(wirelessApEmptyRetryTimer);
        wirelessApEmptyRetryTimer = null;
    }

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
            const shouldRetry = !options.emptyRetry
                && apInfo.code === 0
                && apData.configured !== false
                && !wirelessApState.query
                && !wirelessApState.status;
            const emptyMessage = shouldRetry
                ? '暂未获取到 AP 数据，正在重试'
                : renderWirelessApEmptyMessage(apInfo, apData);
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(emptyMessage)}</td></tr>`;
            summary.textContent = emptyMessage;
            if (shouldRetry) {
                wirelessApEmptyRetryTimer = window.setTimeout(() => {
                    wirelessApEmptyRetryTimer = null;
                    if (!panel.hidden) {
                        loadWireless({emptyRetry: true});
                    }
                }, 1200);
            }
            return;
        }
        if (wirelessApEmptyRetryTimer) {
            window.clearTimeout(wirelessApEmptyRetryTimer);
            wirelessApEmptyRetryTimer = null;
        }
        body.innerHTML = apList.map((ap) => `
            <tr>
                <td data-label="AP">${escapeHtml(ap.ap_name || '-')}</td>
                <td data-label="IP">${escapeHtml(ap.ap_ip || '-')}</td>
                <td data-label="MAC">${escapeHtml(ap.ap_mac_address || '-')}</td>
                <td data-label="状态">${renderWirelessApStatus(ap)}</td>
                <td data-label="用户数">${escapeHtml(ap.user_count ?? 0)}</td>
                <td data-label="上行">${escapeHtml(ap.ap_recv_rate || '-')}</td>
                <td data-label="下行">${escapeHtml(ap.ap_send_rate || '-')}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
    }
}

function renderWirelessApEmptyMessage(apInfo, apData) {
    const responseMessage = typeof apInfo?.message === 'string' ? apInfo.message.trim() : '';
    const hasUsefulResponseMessage = responseMessage && responseMessage.toLowerCase() !== 'success';
    if (apInfo?.code !== 0 || apData?.configured === false) {
        return hasUsefulResponseMessage ? responseMessage : '无线数据源未配置或暂不可用';
    }
    if (wirelessApState.query) {
        return '未找到匹配的 AP';
    }
    if (wirelessApState.status) {
        return '当前筛选条件下暂无 AP';
    }
    return '暂无 AP 数据';
}

async function loadWirelessMetrics() {
    const status = await apiGetResult('/api/status/wireless-controller');
    const data = status.data || {};
    document.getElementById('wireless-users').textContent = data.wireless_users ?? 0;
    document.getElementById('wireless-ap-online').textContent = data.ap_online ?? 0;
    document.getElementById('wireless-cpu').textContent = `${data.cpu_usage ?? 0}%`;
    return status;
}

async function loadTopology(options = {}) {
    showView('topology-panel', 'topology-nav', 'topology');
    const empty = document.getElementById('topology-empty');
    if (!topologyState.data && empty) {
        empty.hidden = false;
        empty.classList.remove('error');
        empty.textContent = options.rediscover ? '正在重新读取核心交换机 LLDP' : '正在读取核心交换机 LLDP 关系';
    }
    topologyState.loading = true;
    try {
        const params = new URLSearchParams();
        if (options.rediscover) {
            params.set('refresh', '1');
        }
        const url = `/api/statistics/switches/topology${params.size ? `?${params.toString()}` : ''}`;
        const result = await apiGetResult(url);
        const data = result.data || {};
        if ((data.nodes || []).length) {
            topologyState.data = data;
            renderTopology(data);
        } else if (!topologyState.data) {
            renderTopologyEmpty(result.message || '暂无可用拓扑数据', true);
        }
        if (result.code !== 0) {
            renderTopologyWarning(data.warnings || [result.message || '拓扑数据加载异常']);
        }
        if (options.toast) {
            showToast(result.message === 'success' ? '拓扑状态已刷新' : result.message, result.code === 0 ? 'info' : 'error');
        }
        return data;
    } catch (error) {
        if (!topologyState.data) {
            renderTopologyEmpty(error.message, true);
        }
        renderTopologyWarning([error.message]);
        throw error;
    } finally {
        topologyState.loading = false;
    }
}

function renderTopology(data) {
    const stats = data.stats || {};
    setText('topology-switch-total', stats.switch_total ?? 0);
    setText('topology-switch-online', stats.switch_online ?? 0);
    setText('topology-switch-risk', (stats.switch_offline || 0) + (stats.switch_unknown || 0));
    setText('topology-link-total', stats.link_total ?? 0);
    setText('topology-generated-at', `${data.generated_at || '-'}${data.cached ? ' · 缓存' : ''}`);
    setText('topology-source', `${data.source || 'LLDP'} · 状态更新 ${data.status_updated_at || '-'}`);
    renderTopologyWarning(data.warnings || []);
    updateTopologyDevicePicker(data.devices || []);
    renderTopologyGraph();
}

function updateTopologyDevicePicker(devices) {
    topologyState.devices = [...devices];
    if (topologyState.pickerOpen) {
        renderTopologyDevicePicker();
    }
}

function topologyDeviceMatches(query) {
    const keyword = String(query || '').trim().toLowerCase();
    return topologyState.devices
        .map((device) => {
            const name = String(device.name || '').toLowerCase();
            const ip = String(device.ip || '').toLowerCase();
            const mac = String(device.mac || '').toLowerCase();
            const category = String(device.category || '').toLowerCase();
            let score = 50;
            if (keyword) {
                if (name === keyword || ip === keyword || mac === keyword) {
                    score = 0;
                } else if (name.startsWith(keyword)) {
                    score = 5;
                } else if (ip.startsWith(keyword) || mac.startsWith(keyword)) {
                    score = 10;
                } else if (name.includes(keyword)) {
                    score = 20;
                } else if (ip.includes(keyword) || mac.includes(keyword) || category.includes(keyword)) {
                    score = 30;
                } else {
                    return null;
                }
            }
            return {device, score};
        })
        .filter(Boolean)
        .sort((left, right) => left.score - right.score
            || Number(Boolean(right.device.is_online)) - Number(Boolean(left.device.is_online))
            || String(left.device.name || left.device.ip || '').localeCompare(
                String(right.device.name || right.device.ip || ''),
                'zh-CN',
            ))
        .slice(0, 10)
        .map((item) => item.device);
}

function renderTopologyDevicePicker() {
    const picker = document.getElementById('topology-device-picker');
    const input = document.getElementById('topology-search-input');
    if (!picker || !input) {
        return;
    }
    const matches = topologyDeviceMatches(input.value);
    topologyState.pickerMatches = matches;
    if (topologyState.pickerIndex >= matches.length) {
        topologyState.pickerIndex = matches.length - 1;
    }
    picker.innerHTML = matches.length ? `
        <div class="topology-picker-caption">${input.value.trim() ? `匹配 ${matches.length} 台设备` : '设备列表'}</div>
        <div class="topology-picker-options">
            ${matches.map((device, index) => {
                const label = device.name || device.ip || device.mac || '未命名设备';
                const metadata = [device.ip, device.mac, device.category].filter(Boolean).join(' · ');
                const active = index === topologyState.pickerIndex;
                return `
                    <button class="topology-picker-option${active ? ' active' : ''}" id="topology-device-option-${index}" type="button" role="option" data-topology-device-index="${index}" aria-selected="${active}">
                        <span class="topology-picker-option-main">
                            <strong>${escapeHtml(label)}</strong>
                            <span class="topology-picker-status ${device.is_online ? 'online' : 'offline'}"><i></i>${device.is_online ? '在线' : '离线'}</span>
                        </span>
                        <small title="${escapeHtml(metadata)}">${escapeHtml(metadata || '暂无地址信息')}</small>
                    </button>
                `;
            }).join('')}
        </div>
    ` : `
        <div class="topology-picker-empty">
            <i class="bi bi-search" aria-hidden="true"></i>
            <span>没有匹配设备</span>
        </div>
    `;
    input.setAttribute(
        'aria-activedescendant',
        topologyState.pickerIndex >= 0 ? `topology-device-option-${topologyState.pickerIndex}` : '',
    );
}

function openTopologyDevicePicker() {
    const picker = document.getElementById('topology-device-picker');
    const input = document.getElementById('topology-search-input');
    const toggle = document.getElementById('topology-picker-toggle');
    if (!picker || !input || !toggle) {
        return;
    }
    topologyState.pickerOpen = true;
    picker.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '收起设备列表');
    renderTopologyDevicePicker();
}

function closeTopologyDevicePicker() {
    const picker = document.getElementById('topology-device-picker');
    const input = document.getElementById('topology-search-input');
    const toggle = document.getElementById('topology-picker-toggle');
    topologyState.pickerOpen = false;
    topologyState.pickerIndex = -1;
    if (picker) {
        picker.hidden = true;
    }
    if (input) {
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', '展开设备列表');
    }
}

function selectTopologyDevice(device) {
    const input = document.getElementById('topology-search-input');
    if (!input || !device) {
        return;
    }
    const label = device.name || device.ip || device.mac || '';
    input.value = label;
    topologyState.pickerSelection = {
        label,
        target: device.ip || device.mac || label,
    };
    closeTopologyDevicePicker();
    input.focus();
}

function handleTopologyPickerKeydown(event) {
    if (event.key === 'Escape') {
        closeTopologyDevicePicker();
        return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        return;
    }
    if (!topologyState.pickerOpen && event.key !== 'Enter') {
        openTopologyDevicePicker();
    }
    if (!topologyState.pickerOpen) {
        return;
    }
    if (event.key === 'Enter') {
        if (topologyState.pickerIndex >= 0) {
            event.preventDefault();
            selectTopologyDevice(topologyState.pickerMatches[topologyState.pickerIndex]);
        }
        return;
    }
    event.preventDefault();
    const count = topologyState.pickerMatches.length;
    if (!count) {
        return;
    }
    if (event.key === 'ArrowDown') {
        topologyState.pickerIndex = (topologyState.pickerIndex + 1) % count;
    } else {
        topologyState.pickerIndex = topologyState.pickerIndex <= 0
            ? count - 1
            : topologyState.pickerIndex - 1;
    }
    renderTopologyDevicePicker();
    document.getElementById(`topology-device-option-${topologyState.pickerIndex}`)?.scrollIntoView({block: 'nearest'});
}

function renderTopologyWarning(warnings) {
    const panel = document.getElementById('topology-warning');
    if (!panel) {
        return;
    }
    const messages = [...new Set((warnings || []).filter(Boolean))];
    panel.hidden = messages.length === 0;
    panel.innerHTML = messages.length
        ? `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${escapeHtml(messages.slice(0, 3).join('；'))}</span>`
        : '';
}

function renderTopologyEmpty(message, isError = false) {
    const empty = document.getElementById('topology-empty');
    const nodes = document.getElementById('topology-nodes');
    const edges = document.getElementById('topology-edges');
    if (nodes) {
        nodes.innerHTML = '';
    }
    if (edges) {
        edges.innerHTML = '';
    }
    if (empty) {
        empty.hidden = false;
        empty.classList.toggle('error', isError);
        empty.textContent = message || '暂无拓扑数据';
    }
}

function buildTopologyGraph() {
    const base = topologyState.data || {};
    const nodes = (base.nodes || []).map((node) => ({...node, active: false}));
    const edges = (base.edges || []).map((edge) => ({...edge, active: false}));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const nodeByIp = new Map();
    nodes.filter((node) => node.ip).forEach((node) => {
        if (!nodeByIp.has(node.ip)) {
            nodeByIp.set(node.ip, node);
        }
    });
    const trace = topologyState.trace;
    if (!trace) {
        return {nodes, edges};
    }

    const activeNodeIds = new Set();
    const hops = trace.hops || [];
    const pathNodes = [];
    hops.forEach((hop, index) => {
        let node = findTopologyTraceNode(nodes, hop, index) || nodeByIp.get(hop.switch_ip);
        if (!node) {
            node = {
                id: `trace-switch:${hop.switch_ip || index}`,
                type: index === 0 ? 'core' : 'switch',
                name: hop.switch_name || (index === 0 ? '核心交换机' : '路径交换机'),
                ip: hop.switch_ip || '',
                status: hop.monitor_status || 'unknown',
                status_text: topologyStatusLabel(hop.monitor_status),
                status_source: '路径检测',
                active: true,
            };
            nodes.push(node);
            nodeById.set(node.id, node);
            if (node.ip) {
                nodeByIp.set(node.ip, node);
            }
        } else if (hop.monitor_status) {
            node.status = hop.monitor_status;
            node.status_text = topologyStatusLabel(hop.monitor_status);
            node.status_source = 'Prometheus · 路径检测';
        }
        node.active = true;
        activeNodeIds.add(node.id);
        pathNodes.push(node);
    });

    for (let index = 0; index < pathNodes.length - 1; index += 1) {
        activateOrAddTopologyEdge(edges, pathNodes[index], pathNodes[index + 1], {
            local_interface: hops[index]?.ingress_interface || '',
            remote_interface: hops[index]?.neighbor?.port_id || '',
        });
    }

    const terminalConnectivity = trace.connectivity?.terminal || {};
    const terminalId = `terminal:${trace.target_mac || trace.target_ip || 'selected'}`;
    const terminal = {
        id: terminalId,
        type: 'terminal',
        name: trace.target_name && trace.target_name !== '无' ? trace.target_name : '目标终端',
        ip: trace.target_ip || '',
        mac: trace.target_mac || '',
        status: terminalConnectivity.status || 'unknown',
        status_text: topologyStatusLabel(terminalConnectivity.status),
        status_source: '实时 Ping',
        last_checked_at: trace.connectivity?.checked_at || '',
        active: true,
    };
    nodes.push(terminal);
    nodeById.set(terminal.id, terminal);
    activeNodeIds.add(terminal.id);
    const lastPathNode = pathNodes[pathNodes.length - 1] || nodeByIp.get(trace.final_switch);
    if (lastPathNode) {
        activateOrAddTopologyEdge(edges, lastPathNode, terminal, {
            local_interface: trace.final_interface || '',
            remote_interface: trace.target_mac || '',
        });
    }

    const firewallConnectivity = trace.connectivity?.firewall || {};
    edges.forEach((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (source?.type === 'core' && source.active && target?.type === 'firewall') {
            if (firewallConnectivity.status) {
                target.status = firewallConnectivity.status;
                target.status_text = topologyStatusLabel(firewallConnectivity.status);
                target.status_source = 'SNMP · 路径检测';
                target.last_checked_at = trace.connectivity?.checked_at || '';
                target.last_error = firewallConnectivity.error || '';
            }
            edge.status = topologyEdgeStatus(source.status, target.status);
            edge.active = true;
            target.active = true;
            activeNodeIds.add(target.id);
        }
    });
    nodes.forEach((node) => {
        node.active = activeNodeIds.has(node.id);
    });
    return {nodes, edges};
}

function findTopologyTraceNode(nodes, hop, index) {
    const candidates = nodes.filter((node) => node.ip && node.ip === hop.switch_ip);
    if (candidates.length < 2) {
        return candidates[0] || null;
    }
    const interfaceName = hop.ingress_interface || hop.local_interface || '';
    const slotMatch = String(interfaceName).match(/(?:GigabitEthernet|GE)(\d+)\//i);
    if (slotMatch) {
        const member = candidates.find((node) => String(node.stack_member ?? '') === slotMatch[1]);
        if (member) {
            return member;
        }
    }
    return candidates.find((node) => node.type === (index === 0 ? 'core' : 'switch')) || candidates[0];
}

function activateOrAddTopologyEdge(edges, sourceNode, targetNode, link) {
    let edge = edges.find((item) => (
        (item.source === sourceNode.id && item.target === targetNode.id)
        || (item.source === targetNode.id && item.target === sourceNode.id)
    ));
    if (!edge) {
        edge = {
            id: `trace:${sourceNode.id}--${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            status: topologyEdgeStatus(sourceNode.status, targetNode.status),
            link_count: 1,
            links: [link],
        };
        edges.push(edge);
    }
    edge.status = topologyEdgeStatus(sourceNode.status, targetNode.status);
    edge.active = true;
}

function topologyEdgeStatus(sourceStatus, targetStatus) {
    const statuses = [normalizeTopologyStatus(sourceStatus), normalizeTopologyStatus(targetStatus)];
    if (statuses.includes('offline')) {
        return 'offline';
    }
    if (statuses.every((status) => status === 'online')) {
        return 'online';
    }
    return 'unknown';
}

function renderTopologyGraph() {
    const stage = document.getElementById('topology-stage');
    const nodesLayer = document.getElementById('topology-nodes');
    const edgeLayer = document.getElementById('topology-edges');
    const layerGuides = document.getElementById('topology-layer-guides');
    const empty = document.getElementById('topology-empty');
    if (!stage || !nodesLayer || !edgeLayer) {
        return;
    }
    const graph = buildTopologyGraph();
    if (!graph.nodes.length) {
        renderTopologyEmpty('暂无可用拓扑数据');
        return;
    }
    if (empty) {
        empty.hidden = true;
    }

    const layout = calculateTopologyLayout(graph.nodes, graph.edges, stage.clientWidth || 900);
    stage.style.height = `${layout.height}px`;
    if (layerGuides) {
        layerGuides.innerHTML = layout.layers.map((layer) => `
            <div class="topology-layer-guide" style="top:${layer.y}px"><span>${escapeHtml(layer.label)}</span></div>
        `).join('');
    }
    nodesLayer.innerHTML = [...graph.nodes]
        .sort(topologyNodeDisplaySort)
        .map((node) => renderTopologyNode(node, layout.positions.get(node.id)))
        .join('');
    edgeLayer.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    edgeLayer.setAttribute('width', String(layout.width));
    edgeLayer.setAttribute('height', String(layout.height));
    edgeLayer.innerHTML = graph.edges.map((edge) => renderTopologyEdge(
        edge,
        layout.positions,
        layout.nodeById,
    )).join('');

    if (topologyState.selectedNodeId) {
        renderTopologyNodeDetail(topologyState.selectedNodeId, graph);
    } else {
        const activeTerminal = graph.nodes.find((node) => node.type === 'terminal');
        const core = graph.nodes.find((node) => node.type === 'core');
        renderTopologyNodeDetail((activeTerminal || core || graph.nodes[0]).id, graph);
    }
}

function calculateTopologyLayout(nodes, edges, availableWidth) {
    const width = Math.max(720, availableWidth);
    const positions = new Map();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const externalPeers = nodes
        .filter((node) => ['uplink', 'firewall'].includes(node.type))
        .sort(topologyExternalLayoutSort);
    const cores = nodes
        .filter((node) => node.type === 'core')
        .sort((left, right) => Number(left.stack_member ?? 9) - Number(right.stack_member ?? 9));
    const coreIds = new Set(cores.map((node) => node.id));
    const switches = nodes
        .filter((node) => node.type === 'switch')
        .sort((left, right) => topologySwitchLayoutOrder(left, edges, coreIds, nodeById)
            - topologySwitchLayoutOrder(right, edges, coreIds, nodeById)
            || String(left.name || left.ip || '').localeCompare(String(right.name || right.ip || ''), 'zh-CN'));
    const terminals = nodes.filter((node) => node.type === 'terminal');
    const externalY = 72;
    const coreY = 202;
    const switchStartY = 338;
    const switchRowGap = 118;
    placeTopologyRow(positions, externalPeers, width, externalY);
    placeTopologyRow(positions, cores, width, coreY);

    const nodeWidth = width < 1100 ? 158 : 176;
    const columns = Math.max(3, Math.min(6, Math.floor((width - 100) / (nodeWidth + 44))));
    const switchRows = Math.max(1, Math.ceil(switches.length / columns));
    for (let row = 0; row < switchRows; row += 1) {
        const rowNodes = switches.slice(row * columns, (row + 1) * columns);
        placeTopologyGridRow(
            positions,
            rowNodes,
            width,
            switchStartY + row * switchRowGap,
            columns,
            row % 2 === 1,
            nodeWidth,
        );
    }

    const lastSwitchY = switchStartY + (switchRows - 1) * switchRowGap;
    const terminalY = lastSwitchY + 132;
    terminals.forEach((node, index) => {
        const finalSwitchIp = topologyState.trace?.final_switch || '';
        const finalSwitch = nodes.find((candidate) => (
            candidate.type === 'switch'
            && candidate.active
            && (!finalSwitchIp || candidate.ip === finalSwitchIp)
        )) || nodes.find((candidate) => candidate.type === 'switch' && candidate.active);
        const anchor = finalSwitch ? positions.get(finalSwitch.id) : null;
        positions.set(node.id, {
            x: terminals.length === 1 && anchor ? anchor.x : ((index + 1) * width) / (terminals.length + 1),
            y: terminalY,
        });
    });
    const layers = [
        {label: '运营商与安全边界', y: 18},
        {label: '核心堆叠', y: 145},
        {label: '接入层', y: 278},
    ];
    if (terminals.length) {
        layers.push({label: '检测终端', y: terminalY - 63});
    }
    return {
        width,
        height: terminals.length ? terminalY + 82 : lastSwitchY + 82,
        positions,
        layers,
        nodeById,
    };
}

function placeTopologyRow(positions, nodes, width, y) {
    nodes.forEach((node, index) => {
        positions.set(node.id, {
            x: ((index + 1) * width) / (nodes.length + 1),
            y,
        });
    });
}

function placeTopologyGridRow(positions, nodes, width, y, columns, stagger, nodeWidth) {
    const sidePadding = (nodeWidth / 2) + 14;
    nodes.forEach((node, index) => {
        let x = ((index + 1) * width) / (nodes.length + 1);
        if (stagger && nodes.length === columns && nodes.length > 1) {
            x = sidePadding + (index * (width - (sidePadding * 2))) / (nodes.length - 1);
        }
        positions.set(node.id, {x, y});
    });
}

function topologyExternalLayoutSort(left, right) {
    const rank = (node) => {
        const name = String(node.name || '').toLowerCase();
        if (node.type === 'uplink' && name.includes('联通')) return 0;
        if (node.type === 'firewall' && /1$/.test(name)) return 1;
        if (node.type === 'firewall' && /2$/.test(name)) return 2;
        if (node.type === 'uplink' && name.includes('电信')) return 3;
        return node.type === 'firewall' ? 5 : 6;
    };
    return rank(left) - rank(right)
        || String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
}

function topologySwitchLayoutOrder(node, edges, coreIds, nodeById) {
    const orders = [];
    edges.forEach((edge) => {
        if (edge.source !== node.id && edge.target !== node.id) {
            return;
        }
        const peerId = edge.source === node.id ? edge.target : edge.source;
        if (!coreIds.has(peerId)) {
            return;
        }
        const core = nodeById.get(peerId) || {};
        (edge.links || []).forEach((link) => {
            const match = String(link.local_interface || '').match(/(?:GigabitEthernet|GE)(\d+)\/\d+\/(\d+)/i);
            if (match) {
                orders.push((Number(match[2]) * 10) + Number(core.stack_member || match[1] || 0));
            }
        });
    });
    return orders.length ? Math.min(...orders) : 9999;
}

function renderTopologyNode(node, position = {x: 0, y: 0}) {
    const status = normalizeTopologyStatus(node.status);
    const selected = node.id === topologyState.selectedNodeId;
    const secondaryText = node.carrier_line
        ? (node.device_name || node.configured_local_interface || '运营商线路')
        : (node.ip || node.mac || topologyTypeLabel(node.type));
    return `
        <button class="topology-node ${escapeHtml(node.type || 'switch')} ${status} ${node.active ? 'active-path' : ''} ${selected ? 'selected' : ''}"
            type="button"
            data-topology-node="${escapeHtml(node.id)}"
            style="left:${position.x}px;top:${position.y}px"
            aria-label="${escapeHtml(`${topologyTypeLabel(node.type)} ${node.name || node.ip || ''} ${node.status_text || topologyStatusLabel(status)}`)}">
            <span class="topology-node-icon"><i class="bi ${topologyNodeIcon(node.type)}" aria-hidden="true"></i></span>
            <span class="topology-node-copy">
                <strong title="${escapeHtml(node.name || node.ip || '')}">${escapeHtml(node.name || node.ip || '未命名节点')}</strong>
                <small title="${escapeHtml(secondaryText)}">${escapeHtml(secondaryText)}</small>
            </span>
            <i class="topology-node-status" aria-hidden="true"></i>
        </button>
    `;
}

function renderTopologyEdge(edge, positions, nodeById) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) {
        return '';
    }
    const geometry = topologyEdgeGeometry(
        source,
        target,
        nodeById.get(edge.source) || {},
        nodeById.get(edge.target) || {},
    );
    const status = normalizeTopologyStatus(edge.status);
    const label = Number(edge.link_count || 0) > 1 ? `${edge.link_count} 条链路` : '';
    return `
        <g class="topology-edge ${status} ${edge.active ? 'active-path' : ''}">
            <path d="${geometry.path}"></path>
            ${label ? `<text x="${geometry.labelX}" y="${geometry.labelY}">${escapeHtml(label)}</text>` : ''}
        </g>
    `;
}

function topologyEdgeGeometry(source, target, sourceNode, targetNode) {
    if (Math.abs(source.y - target.y) < 4) {
        const archY = Math.max(18, source.y - 58);
        return {
            path: `M ${source.x} ${source.y} C ${source.x} ${archY}, ${target.x} ${archY}, ${target.x} ${target.y}`,
            labelX: (source.x + target.x) / 2,
            labelY: archY - 5,
        };
    }
    const sourceIsTop = source.y < target.y;
    const top = sourceIsTop ? source : target;
    const bottom = sourceIsTop ? target : source;
    const topNode = sourceIsTop ? sourceNode : targetNode;
    const bottomNode = sourceIsTop ? targetNode : sourceNode;
    const startY = top.y + 34;
    const endY = bottom.y - 34;
    let curveY = startY + ((endY - startY) / 2);
    if (topNode.type === 'core' && bottomNode.type === 'switch') {
        curveY += String(topNode.stack_member ?? '') === '1' ? 8 : -6;
    }
    return {
        path: `M ${top.x} ${startY} C ${top.x} ${curveY}, ${bottom.x} ${curveY}, ${bottom.x} ${endY}`,
        labelX: top.x + ((bottom.x - top.x) / 2),
        labelY: curveY - 6,
    };
}

function renderTopologyNodeDetail(nodeId, graph = buildTopologyGraph()) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) {
        return;
    }
    topologyState.selectedNodeId = node.id;
    document.querySelectorAll('[data-topology-node]').forEach((button) => {
        button.classList.toggle('selected', button.dataset.topologyNode === node.id);
    });
    setText('topology-detail-type', topologyTypeLabel(node.type));
    setText('topology-detail-title', node.name || node.ip || '未命名节点');
    const statusBadge = document.getElementById('topology-detail-status');
    if (statusBadge) {
        statusBadge.className = `status-badge ${topologyBadgeClass(node.status)}`;
        statusBadge.textContent = node.status_text || topologyStatusLabel(node.status);
    }
    setText('topology-detail-summary', topologyNodeSummary(node));
    const detailList = document.getElementById('topology-detail-list');
    if (detailList) {
        const fields = topologyNodeFields(node);
        detailList.innerHTML = fields.map(([label, value]) => `
            <div><dt>${escapeHtml(label)}</dt><dd title="${escapeHtml(value || '-')}">${escapeHtml(value || '-')}</dd></div>
        `).join('');
    }
    const relatedEdges = graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
    const linkList = document.getElementById('topology-link-list');
    if (linkList) {
        const visibleEdges = relatedEdges.slice(0, 6);
        linkList.innerHTML = relatedEdges.length ? `
            <h4>链路端口</h4>
            ${visibleEdges.map((edge) => renderTopologyDetailEdge(edge, node.id, graph.nodes)).join('')}
            ${relatedEdges.length > visibleEdges.length ? `<div class="topology-no-links">另有 ${relatedEdges.length - visibleEdges.length} 个相邻节点，点击对应节点查看端口</div>` : ''}
        ` : '<div class="topology-no-links">暂无关联链路</div>';
    }
    renderTopologyDetailActions(node);
}

function renderTopologyDetailEdge(edge, nodeId, nodes) {
    const peerId = edge.source === nodeId ? edge.target : edge.source;
    const peer = nodes.find((node) => node.id === peerId) || {};
    const links = edge.links || [];
    return `
        <div class="topology-link-detail">
            <div><strong>${escapeHtml(peer.name || peer.ip || '相邻节点')}</strong><span>${escapeHtml(topologyStatusLabel(edge.status))}</span></div>
            ${links.map((link) => {
                const evidence = link.source === 'configured'
                    ? (edge.relationship_type === 'carrier'
                        ? (link.observed ? '线路标注 · LLDP 已发现' : '线路标注 · 待确认')
                        : (link.observed ? '端口表配置 · 核心口已见防火墙 LLDP' : '仅端口表配置'))
                    : 'LLDP 已发现';
                const remoteInterface = link.remote_interface || link.observed_remote_interface || '-';
                return `<small>${escapeHtml(link.local_interface || '-')} ↔ ${escapeHtml(remoteInterface)} · ${evidence}</small>`;
            }).join('')}
        </div>
    `;
}

function renderTopologyDetailActions(node) {
    const actions = document.getElementById('topology-detail-actions');
    if (!actions) {
        return;
    }
    if (node.type === 'firewall') {
        actions.innerHTML = '<button class="small-button" type="button" data-topology-action="firewall"><i class="bi bi-graph-up"></i><span>查看防火墙</span></button>';
    } else if (node.type === 'terminal') {
        actions.innerHTML = '<button class="small-button" type="button" data-topology-action="devices"><i class="bi bi-hdd-network"></i><span>查看设备列表</span></button>';
    } else if (node.ip) {
        actions.innerHTML = `<button class="small-button" type="button" data-topology-action="switch" data-switch-instance="${escapeHtml(node.ip)}"><i class="bi bi-activity"></i><span>查看端口</span></button>`;
    } else {
        actions.innerHTML = '';
    }
}

async function traceTopologyTerminal(event) {
    if (event) {
        event.preventDefault();
    }
    const input = document.getElementById('topology-search-input');
    const button = document.getElementById('topology-trace-button');
    const inputValue = input?.value.trim() || '';
    const target = topologyState.pickerSelection?.label === inputValue
        ? topologyState.pickerSelection.target
        : inputValue;
    if (!target) {
        showToast('请输入设备名称、IP 或 MAC', 'error');
        input?.focus();
        return;
    }
    closeTopologyDevicePicker();
    setButtonBusy(button, true);
    setTopologyPathStatus('loading', '检测中');
    setText('topology-trace-summary', `正在检测 ${target} 的 Ping、MAC 表和 LLDP 路径`);
    try {
        const result = await apiPostResult('/api/statistics/switches/trace-terminal', {
            target,
            check_connectivity: true,
        });
        topologyState.trace = result.data || {};
        topologyState.traceMessage = result.message || '';
        topologyState.traceCode = result.code || 0;
        topologyState.selectedNodeId = '';
        renderTopologyGraph();
        renderTopologyTraceSummary(topologyState.trace, result.message || '', result.code || 0);
        const clearButton = document.getElementById('topology-clear-path');
        if (clearButton) {
            clearButton.disabled = false;
        }
        showToast(result.code === 0 ? '路径检测完成' : (result.message || '路径检测异常'), result.code === 0 ? 'info' : 'error');
    } catch (error) {
        setTopologyPathStatus('failed', '检测失败');
        setText('topology-trace-summary', error.message);
        showToast(error.message, 'error');
    } finally {
        setButtonBusy(button, false);
    }
}

function renderTopologyTraceSummary(trace, message, code) {
    const connectivity = trace.connectivity || {};
    const terminalStatus = connectivity.terminal?.status || 'unknown';
    const pathStatus = connectivity.path_status || (code === 0 ? 'degraded' : 'failed');
    const finalLocation = trace.final_switch && trace.final_interface
        ? `${trace.final_switch} / ${trace.final_interface}`
        : message || '未定位到最终端口';
    setTopologyPathStatus(pathStatus, topologyPathStatusLabel(pathStatus));
    setText(
        'topology-trace-summary',
        `${trace.target_name && trace.target_name !== '无' ? trace.target_name : trace.target_ip || trace.target_mac || '目标终端'}：${topologyStatusLabel(terminalStatus)} · ${finalLocation}`,
    );
}

function clearTopologyPath() {
    topologyState.trace = null;
    topologyState.traceMessage = '';
    topologyState.traceCode = 0;
    topologyState.selectedNodeId = '';
    const input = document.getElementById('topology-search-input');
    if (input) {
        input.value = '';
    }
    topologyState.pickerSelection = null;
    closeTopologyDevicePicker();
    const clearButton = document.getElementById('topology-clear-path');
    if (clearButton) {
        clearButton.disabled = true;
    }
    setTopologyPathStatus('unknown', '未检测');
    setText('topology-trace-summary', '选择终端后显示实时路径与分层检测结果');
    renderTopologyGraph();
}

function setTopologyPathStatus(status, label) {
    const badge = document.getElementById('topology-path-status');
    if (!badge) {
        return;
    }
    badge.className = `status-badge ${topologyBadgeClass(status)}`;
    badge.textContent = label;
}

function topologyNodeFields(node) {
    const fields = [
        ['管理地址', node.ip || '-'],
        ['状态来源', node.status_source || '-'],
        ['最近检测', node.last_checked_at || topologyState.data?.status_updated_at || '-'],
    ];
    if (node.mac || node.chassis_id) {
        fields.push(['MAC / Chassis', node.mac || node.chassis_id]);
    }
    if (node.stack_member !== undefined) {
        fields.push(['堆叠成员', `${node.name} · ${node.stack_member}/0/*`]);
    }
    if (node.carrier_line) {
        fields.push(['核心接入口', node.configured_local_interface || '-']);
        fields.push(['LLDP 对端设备', node.device_name || '暂未发现']);
    }
    if (node.ha_member) {
        fields.push(['高可用模式', node.ha_mode === 'active-active' ? '双机 HA · 业务链路双活' : node.ha_mode]);
        fields.push(['集群采集地址', node.cluster_target || '-']);
    }
    if (node.vendor) {
        fields.push(['厂商类型', node.vendor]);
    }
    if (node.type === 'firewall') {
        fields.push(['资源使用', `CPU ${node.cpu_usage ?? 0}% · 内存 ${node.memory_usage ?? 0}%`]);
    }
    return fields;
}

function topologyNodeSummary(node) {
    if (node.type === 'terminal') {
        return node.status === 'online' ? '终端 Ping 正常，接入路径已完成检测。' : '终端 Ping 未响应，请结合交换机路径状态继续排查。';
    }
    if (node.type === 'firewall') {
        return node.ha_member
            ? '该节点是防火墙 HA 成员；状态沿用集群 SNMP，物理端口关系来自 LLDP 与端口表。'
            : '出口防火墙状态来自现有 SNMP 采集，链路关系来自核心 LLDP。';
    }
    if (node.type === 'uplink') {
        return node.status === 'online'
            ? `${node.name || '运营商线路'}已通过 LLDP 与核心端口建立邻接。`
            : `${node.name || '运营商线路'}已标注在核心 ${node.configured_local_interface || '指定端口'}，当前未收到 LLDP 邻接。`;
    }
    if (node.type === 'core' && node.stack_member !== undefined) {
        return `${node.name} 是核心堆叠成员，负责 ${node.stack_member}/0/* 端口。`;
    }
    return node.status === 'online'
        ? '交换机采集正常，链路关系来自核心 LLDP 快照。'
        : '交换机状态异常或尚未纳入 Prometheus 监控。';
}

function topologyNodeDisplaySort(left, right) {
    if (['uplink', 'firewall'].includes(left.type) && ['uplink', 'firewall'].includes(right.type)) {
        return topologyExternalLayoutSort(left, right);
    }
    const order = {uplink: 0, firewall: 1, core: 2, switch: 3, terminal: 4};
    return (order[left.type] ?? 9) - (order[right.type] ?? 9)
        || String(left.name || left.ip || '').localeCompare(String(right.name || right.ip || ''), 'zh-CN');
}

function topologyNodeIcon(type) {
    return {
        uplink: 'bi-router',
        firewall: 'bi-shield-lock',
        core: 'bi-diagram-3',
        switch: 'bi-hdd-rack',
        terminal: 'bi-pc-display',
    }[type] || 'bi-circle';
}

function topologyTypeLabel(type) {
    return {
        uplink: '运营商接入',
        firewall: '防火墙',
        core: '核心交换机',
        switch: '接入交换机',
        terminal: '终端设备',
    }[type] || '网络节点';
}

function normalizeTopologyStatus(status) {
    return ['online', 'offline'].includes(status) ? status : 'unknown';
}

function topologyStatusLabel(status) {
    return {
        online: '在线',
        offline: '异常',
        unknown: '状态未知',
        unconfigured: '未配置',
        loading: '检测中',
        degraded: '部分可达',
        failed: '检测失败',
    }[status] || '状态未知';
}

function topologyPathStatusLabel(status) {
    return {
        online: '路径正常',
        degraded: '部分可达',
        failed: '路径异常',
    }[status] || '检测完成';
}

function topologyBadgeClass(status) {
    if (status === 'online') {
        return 'ok';
    }
    if (['offline', 'failed'].includes(status)) {
        return 'bad';
    }
    if (status === 'loading') {
        return '';
    }
    return 'warn';
}

function startTopologyAutoRefresh() {
    window.setInterval(() => {
        if (!isVisibleView('topology-panel') || document.visibilityState === 'hidden' || topologyState.loading || topologyState.autoRefreshing) {
            return;
        }
        topologyState.autoRefreshing = true;
        loadTopology()
            .catch((error) => console.warn('拓扑状态自动刷新失败', error))
            .finally(() => {
                topologyState.autoRefreshing = false;
            });
    }, TOPOLOGY_STATUS_REFRESH_MS);
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
                <td data-label="IP">${escapeHtml(item.instance || '-')}</td>
                <td data-label="厂商">${escapeHtml(renderSwitchVendorName(item.vendor))}</td>
                <td data-label="模块">${escapeHtml(item.module || '-')}</td>
                <td data-label="状态">${renderSwitchStatus(item)}</td>
                <td data-label="最近采集">${escapeHtml(item.last_scrape_at || '-')}</td>
                <td data-label="采集耗时">${escapeHtml(item.scrape_duration_text || '-')}</td>
                <td data-label="间隔">${escapeHtml(item.scrape_interval || '-')}</td>
                <td data-label="错误" title="${escapeHtml(item.last_error || '')}">${escapeHtml(item.last_error || '-')}</td>
                <td data-label="端口">
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
    const target = input ? input.value.trim() : '';
    if (!target) {
        showToast('请输入终端 IP 或 MAC', 'error');
        if (input) {
            input.focus();
        }
        return;
    }

    switchState.traceLoading = true;
    switchState.traceTarget = target;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i><span>追踪中</span>';
    }
    if (summary) {
        summary.textContent = `正在从核心交换机追踪 ${target}`;
    }
    if (resultPanel) {
        resultPanel.hidden = false;
        resultPanel.innerHTML = '<div class="trace-empty">正在执行 ARP、MAC 表和 LLDP 查询</div>';
    }

    try {
        const result = await apiPostResult('/api/statistics/switches/trace-terminal', {target});
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
        return message || (data.target_type === 'mac' ? '核心 MAC 表未找到目标 MAC' : '核心 ARP 未找到');
    }
    return message || '追踪失败';
}

function buildSwitchTraceKeyInfo(data) {
    const hops = data.hops || [];
    const coreHop = hops.find((hop) => hop.switch_ip === data.start_switch) || hops[0] || {};
    const finalHop = hops[hops.length - 1] || {};
    const neighbor = coreHop.neighbor || {};
    const finalSwitch = data.final_switch || finalHop.switch_ip || '';
    const isNotFound = data.result_type === 'not_found';
    const accessSwitch = isNotFound
        ? '-'
        : finalSwitch && finalSwitch !== data.start_switch
            ? finalSwitch
            : neighbor.management_ip || finalSwitch || data.start_switch || '-';
    return {
        name: data.target_name || '无',
        ip: data.target_ip || (data.target_type === 'ip' ? switchState.traceTarget : '') || '-',
        mac: data.target_mac || coreHop.target_mac || finalHop.target_mac
            || (data.target_type === 'mac' ? switchState.traceTarget : '') || '-',
        corePort: coreHop.ingress_interface || '-',
        accessSwitch,
        accessPort: isNotFound ? '-' : data.final_interface || finalHop.ingress_interface || '-'
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
                <td data-label="端口">
                    <div class="stacked-cell">
                        <strong>${escapeHtml(port.if_name || '-')}</strong>
                        <small>#${escapeHtml(port.if_index || '-')}</small>
                    </div>
                </td>
                <td data-label="描述" title="${escapeHtml(port.if_alias || '')}">${escapeHtml(port.if_alias || '-')}</td>
                <td data-label="状态">${renderSwitchPortStatus(port)}</td>
                <td data-label="速率">${escapeHtml(port.speed_text || '-')}</td>
                <td data-label="入方向">${escapeHtml(port.in_rate || '0 bps')}</td>
                <td data-label="出方向">${escapeHtml(port.out_rate || '0 bps')}</td>
                <td data-label="利用率">
                    <div class="utilization-cell">
                        <span style="width: ${clampPercent(utilization)}%"></span>
                        <strong>${escapeHtml(port.utilization_text || '-')}</strong>
                    </div>
                </td>
                <td data-label="错误" title="入错误 ${escapeHtml(port.in_errors || 0)}，出错误 ${escapeHtml(port.out_errors || 0)}">${escapeHtml(errorTotal)}</td>
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
        {key: 'total_in_mbps', label: '入方向', color: '#63a7df', fill: 'rgba(99, 167, 223, 0.08)'},
        {key: 'total_out_mbps', label: '出方向', color: '#58b88b', fill: 'rgba(88, 184, 139, 0.10)'},
    ], {theme: 'dark', emptyMessage: '暂无端口流量样本'});
}

function renderSwitchTrafficError(message) {
    switchState.trafficSamples = [];
    const source = document.getElementById('switch-traffic-source');
    if (source) {
        source.textContent = message;
    }
    drawBandwidthChart('switch-traffic-chart', [], [
        {key: 'total_in_mbps', label: '入方向', color: '#63a7df', fill: 'rgba(99, 167, 223, 0.08)'},
        {key: 'total_out_mbps', label: '出方向', color: '#58b88b', fill: 'rgba(88, 184, 139, 0.10)'},
    ], {theme: 'dark', emptyMessage: message || '暂无端口流量样本'});
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
                <td data-label="用户数据">${escapeHtml(user.phone_number || '-')}</td>
                <td data-label="姓名">${escapeHtml(user.real_name || '无')}</td>
                <td data-label="IP">${escapeHtml(user.ip_address || '-')}</td>
                <td data-label="上行">${escapeHtml(user.recv_rate || '-')}</td>
                <td data-label="下行">${escapeHtml(user.send_rate || '-')}</td>
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
        renderClientOpsSummary();

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
                <td data-label="IP">${escapeHtml(client.device_ip || '-')}</td>
                <td data-label="用户">${escapeHtml(client.username || '-')}</td>
                <td data-label="姓名">${escapeHtml(client.real_name || '-')}</td>
                <td data-label="设备名">${escapeHtml(client.device_name || '-')}</td>
                <td data-label="MAC">${escapeHtml(client.mac_address || '-')}</td>
                <td data-label="操作系统">${escapeHtml(client.os || '-')}</td>
                <td data-label="系统版本">${escapeHtml(client.os_version || '-')}</td>
                <td data-label="状态">${renderClientStatus(client)}</td>
            </tr>
        `).join('');
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        summary.textContent = '加载失败';
        renderClientOpsSummary();
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
        access_switch_ip: document.getElementById('device-access-switch').value.trim(),
        access_interface: document.getElementById('device-access-interface').value.trim(),
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

async function previewDevicePort() {
    const ipInput = document.getElementById('device-ip');
    const button = document.getElementById('device-port-preview-button');
    const ip = ipInput ? ipInput.value.trim() : '';
    if (!ip) {
        setDevicePortPreviewStatus('error', '请先填写 IP 地址');
        if (ipInput) {
            ipInput.focus();
        }
        return;
    }

    const originalButtonHtml = button ? button.innerHTML : '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i><span>查询中</span>';
    }
    setDevicePortPreviewStatus('loading', '正在查询 ARP、MAC 表和 LLDP');

    try {
        const result = await apiPostResult('/api/access-control/device-port-preview', {ip_address: ip});
        const data = result.data || {};
        if (result.code === 0 && (data.mac_address || data.access_switch_ip || data.access_interface)) {
            fillDevicePortPreview(data);
            const hasAccessLocation = Boolean(data.access_switch_ip || data.access_interface);
            setDevicePortPreviewStatus(
                hasAccessLocation ? 'ok' : 'warn',
                hasAccessLocation
                    ? `已填充 ${data.access_switch_ip || '-'} / ${data.access_interface || '-'}`
                    : '已解析 MAC，未定位到接入口'
            );
            return;
        }

        const statusType = result.code === 0 ? 'warn' : 'error';
        setDevicePortPreviewStatus(statusType, renderDevicePreviewMessage(data, result.message));
    } catch (error) {
        setDevicePortPreviewStatus('error', error.message || '智能查询失败');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalButtonHtml;
        }
    }
}

function fillDevicePortPreview(data) {
    const mac = document.getElementById('device-mac');
    const switchIp = document.getElementById('device-access-switch');
    const accessInterface = document.getElementById('device-access-interface');
    if (mac && data.mac_address) {
        mac.value = data.mac_address;
    }
    if (switchIp && data.access_switch_ip) {
        switchIp.value = data.access_switch_ip;
    }
    if (accessInterface && data.access_interface) {
        accessInterface.value = data.access_interface;
    }
}

function renderDevicePreviewMessage(data, fallback = '') {
    const resultType = data?.result_type || '';
    const message = fallback || data?.message || '';
    const lowerMessage = message.toLowerCase();
    if (resultType === 'not_found' || message.includes('未找到')) {
        return '未找到该 IP 的 MAC 或接入口';
    }
    if (lowerMessage.includes('ssh') || lowerMessage.includes('netmiko') || lowerMessage.includes('timeout') || lowerMessage.includes('authentication')) {
        return '交换机 SSH 查询失败';
    }
    if (data?.configured === false) {
        return message || '交换机查询未配置';
    }
    return message || '智能查询失败';
}

function setDevicePortPreviewStatus(type, message) {
    const status = document.getElementById('device-port-preview-status');
    if (!status) {
        return;
    }
    const icons = {
        ok: 'bi-check-circle',
        warn: 'bi-info-circle',
        error: 'bi-exclamation-triangle',
        loading: 'bi-hourglass-split'
    };
    status.hidden = false;
    status.className = `device-lookup-status full-field ${type}`;
    status.innerHTML = `<i class="bi ${icons[type] || 'bi-info-circle'}"></i><span>${escapeHtml(message || '')}</span>`;
}

function resetDevicePortPreviewStatus() {
    const status = document.getElementById('device-port-preview-status');
    if (status) {
        status.hidden = true;
        status.className = 'device-lookup-status full-field';
        status.textContent = '';
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

function renderDeviceOpsSummary() {
    const counts = deviceState.statusCounts || {};
    const freshness = deviceState.statusFreshness || {};
    setText('device-stat-total', counts.all ?? deviceState.total ?? 0);
    setText('device-stat-online', counts.online ?? 0);
    setText('device-stat-offline', counts.offline ?? 0);
    setText('device-stat-stale', Number(freshness.expired_count || 0));
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

function renderDeviceFreshnessBanner(freshness) {
    const banner = document.getElementById('device-freshness-banner');
    if (!banner) {
        return;
    }
    if (!freshness || !freshness.needs_refresh) {
        banner.hidden = true;
        banner.innerHTML = '';
        return;
    }
    const expired = Number(freshness.expired_count || 0);
    const unchecked = Number(freshness.unchecked_count || 0);
    banner.hidden = false;
    banner.innerHTML = `
        <span>
            <strong>设备状态需要刷新</strong>
            <small>过期 ${escapeHtml(expired)} 台，未检查 ${escapeHtml(unchecked)} 台；刷新后列表状态更可信。</small>
        </span>
        <button class="small-button" type="button" data-device-refresh-inline>
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
            <span>刷新状态</span>
        </button>
    `;
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
    if (!current && (device.access_switch_ip || device.access_interface)) {
        return renderDevicePortCard(
            device,
            device.access_switch_ip || '-',
            device.access_interface || '-',
            device.access_updated_at ? `保存于 ${device.access_updated_at}` : '已保存接入位置'
        );
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
        return renderDevicePortCard(device, current.switchIp || '-', current.interfaceName || '-', '本次查看结果');
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

function renderDevicePortCard(device, switchIp, interfaceName, titlePrefix = '') {
    const titleText = [
        titlePrefix,
        `接入交换机 ${switchIp || '-'}`,
        `端口 ${interfaceName || '-'}`
    ].filter(Boolean).join('，');
    return `
        <div class="device-port-card" title="${escapeHtml(titleText)}">
            <div class="device-port-lines">
                <span class="device-port-switch">
                    <i class="bi bi-hdd-network"></i>
                    <span>${escapeHtml(switchIp || '-')}</span>
                </span>
                <span class="device-port-interface">
                    <i class="bi bi-ethernet"></i>
                    <span>${escapeHtml(interfaceName || '-')}</span>
                </span>
            </div>
            <button class="device-port-icon-button" type="button" data-device-action="trace-port" data-device-id="${escapeHtml(device.id)}" title="重新查看" aria-label="重新查看端口">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
        </div>
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
    if (finalSwitch && finalInterface) {
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
    resetDevicePortPreviewStatus();
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
    document.getElementById('device-access-switch').value = device.access_switch_ip || '';
    document.getElementById('device-access-interface').value = device.access_interface || '';
    document.getElementById('device-category').value = device.category || '';
    document.getElementById('device-details').value = device.details || '';
    document.getElementById('device-form-message').textContent = '';
    resetDevicePortPreviewStatus();
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

function renderClientOpsSummary() {
    const counts = clientState.statusCounts || {};
    setText('client-stat-total', counts.all ?? clientState.total ?? 0);
    setText('client-stat-online', counts.online ?? 0);
    setText('client-stat-offline', counts.offline ?? 0);
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

function setTrafficAnalysisPageStatus(state, label) {
    const status = document.getElementById('traffic-analysis-page-status');
    if (!status) {
        return;
    }
    status.className = `traffic-page-status ${state}`;
    status.textContent = label;
}

function resetTrafficAnalysisView() {
    trafficAnalysisState.hasValidData = false;
    trafficAnalysisState.page = 1;
    trafficAnalysisState.pages = 0;
    trafficAnalysisState.total = 0;
    trafficAnalysisState.allTotal = 0;
    setText('traffic-user-count', '-');
    setText('traffic-status-count', '-');
    setText('traffic-total-rate', '-');
    setText('traffic-session-count', '-');
    setText('traffic-analysis-updated-at', '最近更新 -');
    renderTrafficAnalysisPager();
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
    const normalizedApps = (apps || []).filter((app) => app && app.app);
    const visibleApps = normalizedApps.slice(0, 2);
    const hiddenApps = normalizedApps.slice(2);
    if (!visibleApps.length) {
        return '-';
    }
    return `
        <div class="traffic-app-stack">
            ${visibleApps.map(renderTrafficAppItem).join('')}
            ${hiddenApps.length ? `
                <details class="traffic-app-more">
                    <summary>展开 ${hiddenApps.length} 个应用</summary>
                    ${hiddenApps.map(renderTrafficAppItem).join('')}
                </details>
            ` : ''}
        </div>
    `;
}

function renderTrafficAppItem(app) {
    return `
        <div class="traffic-app-item">
            <div class="traffic-app-meta">
                <strong title="${escapeHtml(app.app || '-')}">${escapeHtml(app.app || '-')}</strong>
                <span>${escapeHtml(renderTrafficAppValue(app))}</span>
            </div>
            <div class="traffic-app-bar">
                <i style="width: ${clampPercent(app.percent)}%"></i>
            </div>
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
        apButton.setAttribute('aria-pressed', String(view === 'aps'));
    }
    if (userButton) {
        userButton.classList.toggle('active', view === 'users');
        userButton.setAttribute('aria-pressed', String(view === 'users'));
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
        previousFocusedElement = document.activeElement;
        activeModalId = modalId;
        modal.setAttribute('tabindex', '-1');
        modal.hidden = false;
        document.body.classList.add('modal-open');
        window.setTimeout(() => focusFirstModalControl(modal), 0);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.hidden = true;
        if (activeModalId === modalId) {
            activeModalId = null;
        }
        if (!activeModalId) {
            document.body.classList.remove('modal-open');
        }
        if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
            previousFocusedElement.focus();
        }
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

async function loadRouteFromHash(hash = window.location.hash) {
    const route = (hash || '#dashboard').replace('#', '') || 'dashboard';
    if (route === 'firewall-bandwidth') {
        await loadFirewallBandwidth();
        return;
    }
    if (route === 'traffic-analysis') {
        await loadTrafficAnalysis({page: 1});
        return;
    }
    if (route === 'osdwan') {
        await loadOsdwan();
        return;
    }
    if (route === 'topology') {
        await loadTopology();
        return;
    }
    if (route === 'switches') {
        await loadSwitches({page: 1});
        return;
    }
    if (route === 'wireless') {
        await loadWireless();
        return;
    }
    if (route === 'devices') {
        await loadDevices();
        return;
    }
    if (route === 'clients') {
        await loadClients({page: 1});
        return;
    }
    if (route === 'users') {
        const usersNav = document.getElementById('users-nav');
        if (!usersNav?.classList.contains('disabled')) {
            await loadUsers();
            return;
        }
    }
    showView('dashboard-panel', 'dashboard-nav', 'dashboard');
    await loadSummary();
}

async function boot() {
    try {
        await loadProfile();
        await loadRouteFromHash();
    } catch (error) {
        if (error.message.includes('未授权')) {
            window.location.href = '/login';
            return;
        }
        showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    if (mobileNavToggle) {
        mobileNavToggle.addEventListener('click', toggleSidebar);
    }

    const sidebarScrim = document.getElementById('sidebar-scrim');
    if (sidebarScrim) {
        sidebarScrim.addEventListener('click', closeSidebar);
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    const refreshSummary = document.getElementById('refresh-summary');
    if (refreshSummary) {
        refreshSummary.addEventListener('click', () => {
            setButtonBusy(refreshSummary, true);
            refreshCurrentView()
                .then(() => showToast('已刷新'))
                .catch((error) => showToast(error.message, 'error'))
                .finally(() => setButtonBusy(refreshSummary, false));
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

    const topologyNav = document.getElementById('topology-nav');
    if (topologyNav) {
        topologyNav.addEventListener('click', (event) => {
            event.preventDefault();
            loadTopology()
                .catch((error) => showToast(error.message, 'error'));
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
        reloadUsers.addEventListener('click', () => runButtonTask(reloadUsers, () => loadUsers()));
    }

    const reloadFirewallBandwidth = document.getElementById('reload-firewall-bandwidth');
    if (reloadFirewallBandwidth) {
        reloadFirewallBandwidth.addEventListener('click', () => runButtonTask(reloadFirewallBandwidth, () => loadFirewallBandwidth({toast: true})));
    }

    const reloadTrafficAnalysis = document.getElementById('reload-traffic-analysis');
    if (reloadTrafficAnalysis) {
        reloadTrafficAnalysis.addEventListener('click', () => runButtonTask(reloadTrafficAnalysis, () => loadTrafficAnalysis({page: trafficAnalysisState.page, toast: true, refresh: true})));
    }

    const reloadOsdwan = document.getElementById('reload-osdwan');
    if (reloadOsdwan) {
        reloadOsdwan.addEventListener('click', () => runButtonTask(reloadOsdwan, () => loadOsdwanMetrics({toast: true, charts: false})));
    }

    const trafficAnalysisSearch = document.getElementById('traffic-analysis-search');
    if (trafficAnalysisSearch) {
        trafficAnalysisSearch.addEventListener('input', debounce((event) => {
            loadTrafficAnalysis({page: 1, query: event.target.value.trim()});
        }, 180));
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
        reloadSwitches.addEventListener('click', () => runButtonTask(reloadSwitches, () => loadSwitches({page: switchState.page})));
    }

    const refreshTopologyStatus = document.getElementById('refresh-topology-status');
    if (refreshTopologyStatus) {
        refreshTopologyStatus.addEventListener('click', () => runButtonTask(
            refreshTopologyStatus,
            () => loadTopology({toast: true}),
        ));
    }

    const rediscoverTopology = document.getElementById('rediscover-topology');
    if (rediscoverTopology) {
        rediscoverTopology.addEventListener('click', () => runButtonTask(
            rediscoverTopology,
            () => loadTopology({rediscover: true, toast: true}),
        ));
    }

    const topologySearchForm = document.getElementById('topology-search-form');
    if (topologySearchForm) {
        topologySearchForm.addEventListener('submit', traceTopologyTerminal);
    }

    const topologySearchInput = document.getElementById('topology-search-input');
    if (topologySearchInput) {
        topologySearchInput.addEventListener('focus', openTopologyDevicePicker);
        topologySearchInput.addEventListener('input', () => {
            topologyState.pickerSelection = null;
            topologyState.pickerIndex = -1;
            openTopologyDevicePicker();
        });
        topologySearchInput.addEventListener('keydown', handleTopologyPickerKeydown);
    }

    const topologyPickerToggle = document.getElementById('topology-picker-toggle');
    if (topologyPickerToggle) {
        topologyPickerToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            if (topologyState.pickerOpen) {
                closeTopologyDevicePicker();
            } else {
                openTopologyDevicePicker();
                topologySearchInput?.focus();
            }
        });
    }

    const topologyDevicePicker = document.getElementById('topology-device-picker');
    if (topologyDevicePicker) {
        topologyDevicePicker.addEventListener('click', (event) => {
            const option = event.target.closest('[data-topology-device-index]');
            if (!option) {
                return;
            }
            const device = topologyState.pickerMatches[Number(option.dataset.topologyDeviceIndex)];
            selectTopologyDevice(device);
        });
    }

    const topologyClearPath = document.getElementById('topology-clear-path');
    if (topologyClearPath) {
        topologyClearPath.addEventListener('click', clearTopologyPath);
    }

    const topologyNodes = document.getElementById('topology-nodes');
    if (topologyNodes) {
        topologyNodes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-topology-node]');
            if (button) {
                renderTopologyNodeDetail(button.dataset.topologyNode);
            }
        });
    }

    const topologyDetailActions = document.getElementById('topology-detail-actions');
    if (topologyDetailActions) {
        topologyDetailActions.addEventListener('click', (event) => {
            const button = event.target.closest('[data-topology-action]');
            if (!button) {
                return;
            }
            if (button.dataset.topologyAction === 'firewall') {
                loadFirewallBandwidth();
            } else if (button.dataset.topologyAction === 'devices') {
                loadDevices({page: 1});
            } else if (button.dataset.topologyAction === 'switch') {
                loadSwitches({page: 1})
                    .then(() => openSwitchDetail(button.dataset.switchInstance))
                    .catch((error) => showToast(error.message, 'error'));
            }
        });
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
        const workbenchButton = event.target.closest('[data-workbench-nav]');
        if (workbenchButton) {
            if (workbenchButton.dataset.workbenchNav === 'devices-nav' && workbenchButton.dataset.workbenchStatus) {
                loadDevices({page: 1, status: workbenchButton.dataset.workbenchStatus});
                return;
            }
            const nav = document.getElementById(workbenchButton.dataset.workbenchNav);
            if (nav) {
                nav.click();
            }
            return;
        }

        if (event.target.closest('[data-device-refresh-inline]')) {
            refreshDeviceStatus();
            return;
        }

        if (!event.target.closest('[data-range-dropdown]')) {
            closeRangeDropdowns();
        }
        if (!event.target.closest('.topology-search-control')) {
            closeTopologyDevicePicker();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (trapModalFocus(event)) {
            return;
        }
        if (event.key === 'Escape') {
            if (activeModalId) {
                closeModal(activeModalId);
                return;
            }
            closeSidebar();
            closeRangeDropdowns();
            closeTopologyDevicePicker();
        }
    });

    window.addEventListener('resize', debounce(() => {
        const firewallPanel = document.getElementById('firewall-bandwidth-panel');
        if (firewallPanel && !firewallPanel.hidden && firewallBandwidthState.latest) {
            renderFirewallBandwidthCharts(
                firewallBandwidthState.samples,
                firewallBandwidthState.emptyMessage,
            );
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
        if (isVisibleView('topology-panel') && topologyState.data) {
            renderTopologyGraph();
        }
    }, 150));

    window.addEventListener('hashchange', () => {
        loadRouteFromHash()
            .catch((error) => showToast(error.message, 'error'));
    });

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
        reloadDevices.addEventListener('click', () => runButtonTask(reloadDevices, () => loadDevices()));
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
        reloadWireless.addEventListener('click', () => runButtonTask(reloadWireless, () => {
            if (wirelessActiveView === 'users') {
                return loadWirelessUsers();
            }
            return loadWireless();
        }));
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
        reloadSwitchDetail.addEventListener('click', () => runButtonTask(reloadSwitchDetail, () => loadSwitchDetailData({toast: true})));
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
        reloadClients.addEventListener('click', () => runButtonTask(reloadClients, () => loadClients({page: clientState.page})));
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

    const devicePortPreviewButton = document.getElementById('device-port-preview-button');
    if (devicePortPreviewButton) {
        devicePortPreviewButton.addEventListener('click', previewDevicePort);
    }

    const deviceIpInput = document.getElementById('device-ip');
    if (deviceIpInput) {
        deviceIpInput.addEventListener('input', resetDevicePortPreviewStatus);
    }

    const refreshDeviceStatusButton = document.getElementById('refresh-device-status');
    if (refreshDeviceStatusButton) {
        refreshDeviceStatusButton.addEventListener('click', () => runButtonTask(refreshDeviceStatusButton, refreshDeviceStatus));
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
    startTopologyAutoRefresh();
});
