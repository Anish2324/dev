const htmlDecoder = document.createElement('textarea');
let feedbackStatusTimer = null;

const pipelineStageDefinitions = [
    {
        key: 'github',
        name: 'GitHub',
        short: 'GH',
        description: 'Repository changes trigger the workflow.',
        value: 'source'
    },
    {
        key: 'jenkins',
        name: 'Jenkins',
        short: 'JK',
        description: 'Build and test automation runs in Jenkins.',
        value: null
    },
    {
        key: 'sonar',
        name: 'SonarCloud',
        short: 'SC',
        description: 'Static analysis keeps the code quality visible.',
        value: null
    },
    {
        key: 'trivy',
        name: 'Trivy',
        short: 'TR',
        description: 'Container scanning keeps security checks explicit.',
        value: null
    },
    {
        key: 'docker',
        name: 'Docker',
        short: 'DK',
        description: 'Images are built and prepared for deployment.',
        value: null
    },
    {
        key: 'render',
        name: 'Render',
        short: 'RD',
        description: 'The final application is deployed to Render.',
        value: null
    }
];

function decodeHtmlEntities(value) {
    htmlDecoder.innerHTML = value ?? '';
    return htmlDecoder.value;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
        const replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return replacements[character];
    });
}

function titleCase(value) {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeStatus(value) {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (!normalized) {
        return { tone: 'neutral', label: 'Unknown' };
    }

    const labelMap = {
        success: 'Success',
        successful: 'Successful',
        passed: 'Passing',
        pass: 'Passing',
        built: 'Built',
        active: 'Live',
        healthy: 'Healthy',
        running: 'Running',
        deployed: 'Deployed',
        ready: 'Ready',
        ok: 'OK',
        source: 'Source',
        connected: 'Connected',
        loading: 'Loading',
        pending: 'Pending',
        queued: 'Queued',
        'in_progress': 'In Progress',
        warning: 'Attention',
        failed: 'Failed',
        error: 'Error',
        down: 'Down',
        unhealthy: 'Unhealthy'
    };

    const successStatuses = new Set([
        'success',
        'successful',
        'passed',
        'pass',
        'built',
        'active',
        'healthy',
        'running',
        'deployed',
        'ready',
        'ok'
    ]);

    const warningStatuses = new Set(['warning', 'pending', 'queued', 'loading', 'in_progress']);
    const dangerStatuses = new Set(['failed', 'error', 'down', 'unhealthy']);
    const neutralStatuses = new Set(['source', 'connected']);

    let tone = 'neutral';
    if (successStatuses.has(normalized)) {
        tone = 'success';
    } else if (warningStatuses.has(normalized)) {
        tone = 'warning';
    } else if (dangerStatuses.has(normalized)) {
        tone = 'danger';
    } else if (neutralStatuses.has(normalized)) {
        tone = 'neutral';
    }

    return {
        tone,
        label: labelMap[normalized] || titleCase(normalized)
    };
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setCardTone(id, tone) {
    const element = document.getElementById(id);
    if (element) {
        element.dataset.tone = tone;
    }
}

function setBadge(element, tone, label) {
    if (!element) {
        return;
    }

    element.className = `status-badge status-badge--${tone}`;
    element.textContent = label;
}

function showAlert(message, tone = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    window.setTimeout(() => {
        toast.classList.remove('toast--visible');
        window.setTimeout(() => toast.remove(), 240);
    }, 2600);
}

function setFeedbackStatus(message, tone = '') {
    const statusElement = document.getElementById('feedbackStatus');
    if (!statusElement) {
        return;
    }

    if (feedbackStatusTimer) {
        window.clearTimeout(feedbackStatusTimer);
        feedbackStatusTimer = null;
    }

    statusElement.className = 'inline-status';

    if (tone) {
        statusElement.classList.add(`inline-status--${tone}`);
    }

    statusElement.textContent = message;

    if (message && tone === 'success') {
        feedbackStatusTimer = window.setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'inline-status';
            feedbackStatusTimer = null;
        }, 3500);
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || `Request failed with status ${response.status}`);
    }

    return data;
}

function formatCountLabel(count, label) {
    return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function renderNoteCard(note) {
    const card = document.createElement('article');
    card.className = 'note-card';

    const title = document.createElement('div');
    title.className = 'note-card__title';
    title.textContent = decodeHtmlEntities(note.title);

    const content = document.createElement('div');
    content.className = 'note-card__content';
    content.textContent = decodeHtmlEntities(note.content);

    const meta = document.createElement('div');
    meta.className = 'note-card__meta';

    const timestamp = document.createElement('span');
    timestamp.textContent = new Date(note.timestamp).toLocaleString();

    const noteId = document.createElement('span');
    noteId.textContent = `#${note.id}`;

    meta.append(timestamp, noteId);

    const actions = document.createElement('div');
    actions.className = 'note-card__actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn--danger btn--small';
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.noteId = note.id;

    actions.append(deleteButton);
    card.append(title, content, meta, actions);

    return card;
}

function renderFeedbackCard(entry) {
    const card = document.createElement('article');
    card.className = 'history-card';

    const title = document.createElement('div');
    title.className = 'history-card__title';
    title.textContent = decodeHtmlEntities(entry.name);

    const message = document.createElement('div');
    message.className = 'history-card__message';
    message.textContent = decodeHtmlEntities(entry.message);

    const meta = document.createElement('div');
    meta.className = 'history-card__meta';

    const timestamp = document.createElement('span');
    timestamp.textContent = new Date(entry.timestamp).toLocaleString();

    const feedbackId = document.createElement('span');
    feedbackId.textContent = `#${entry.id}`;

    meta.append(timestamp, feedbackId);
    card.append(title, message, meta);

    return card;
}

async function updateVisitorCount(data = null) {
    try {
        const payload = data || await fetchJson('/api/visits');
        setText('visitCount', payload.totalVisits);
        setText('heroVisits', payload.totalVisits);
    } catch (error) {
        console.error('Error fetching visitor count:', error);
        setText('visitCount', 'Error');
        setText('heroVisits', 'Error');
    }
}

async function updateUptime(data = null) {
    try {
        const payload = data || await fetchJson('/api/uptime');
        setText('uptimeValue', payload.formatted);
        setText('heroUptime', payload.formatted);
    } catch (error) {
        console.error('Error fetching uptime:', error);
        setText('uptimeValue', 'Error');
        setText('heroUptime', 'Error');
    }
}

async function updateCurrentTime(data = null) {
    try {
        const payload = data || await fetchJson('/api/time');
        const currentTime = new Date(payload.current).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        setText('currentTime', currentTime);
    } catch (error) {
        console.error('Error fetching time:', error);
        setText('currentTime', 'Unavailable');
    }
}

async function updateHealthStatus(data = null, notify = false) {
    try {
        const payload = data || await fetchJson('/api/health');
        const normalized = normalizeStatus(payload.status);

        setText('healthStatus', normalized.label);
        setText('heroHealth', normalized.label);
        setCardTone('healthCard', normalized.tone);
        setBadge(document.querySelector('#healthCard .status-badge'), normalized.tone, normalized.label);

        const healthDetails = document.querySelector('#healthCard p');
        if (healthDetails) {
            healthDetails.textContent = `Health endpoint returned ${normalized.label.toLowerCase()}.`;
        }

        if (notify) {
            showAlert(`Health check: ${normalized.label}`, normalized.tone === 'danger' ? 'error' : 'success');
        }
    } catch (error) {
        console.error('Error checking health:', error);
        setText('healthStatus', 'Unavailable');
        setText('heroHealth', 'Unavailable');
        setCardTone('healthCard', 'danger');
        setBadge(document.querySelector('#healthCard .status-badge'), 'danger', 'Unavailable');

        const healthDetails = document.querySelector('#healthCard p');
        if (healthDetails) {
            healthDetails.textContent = 'Health endpoint could not be reached.';
        }

        if (notify) {
            showAlert('Health check failed', 'error');
        }
    }
}

async function updateDeploymentStatus(data = null) {
    try {
        const payload = data || await fetchJson('/api/status');
        const normalized = normalizeStatus(payload.deployment || payload.status);

        setText('deploymentStatus', normalized.label);
        setText('heroDeployment', normalized.label);
        setCardTone('deploymentCard', normalized.tone);
        setBadge(document.querySelector('#deploymentCard .status-badge'), normalized.tone, normalized.label);

        const deploymentDetails = document.querySelector('#deploymentCard p');
        if (deploymentDetails) {
            const runtimeLabel = payload.status ? ` Runtime status: ${decodeHtmlEntities(String(payload.status))}.` : '';
            deploymentDetails.textContent = `Deployment state reported by the status API.${runtimeLabel}`;
        }
    } catch (error) {
        console.error('Error fetching deployment status:', error);
        setText('deploymentStatus', 'Unavailable');
        setText('heroDeployment', 'Unavailable');
        setCardTone('deploymentCard', 'danger');
        setBadge(document.querySelector('#deploymentCard .status-badge'), 'danger', 'Unavailable');

        const deploymentDetails = document.querySelector('#deploymentCard p');
        if (deploymentDetails) {
            deploymentDetails.textContent = 'Deployment status could not be loaded.';
        }
    }
}

function renderPipelineViews(pipelineData, statusData) {
    const rawStages = [
        { key: 'github', name: 'GitHub', short: 'GH', description: pipelineStageDefinitions[0].description, value: 'source' },
        { key: 'jenkins', name: 'Jenkins', short: 'JK', description: pipelineStageDefinitions[1].description, value: pipelineData.jenkins },
        { key: 'sonar', name: 'SonarCloud', short: 'SC', description: pipelineStageDefinitions[2].description, value: pipelineData.sonar },
        { key: 'trivy', name: 'Trivy', short: 'TR', description: pipelineStageDefinitions[3].description, value: pipelineData.trivy },
        { key: 'docker', name: 'Docker', short: 'DK', description: pipelineStageDefinitions[4].description, value: pipelineData.docker },
        { key: 'render', name: 'Render', short: 'RD', description: pipelineStageDefinitions[5].description, value: statusData.deployment || pipelineData.deployment }
    ];

    const stages = rawStages.map((stage) => {
        const normalized = stage.key === 'github' ? { tone: 'neutral', label: 'Source' } : normalizeStatus(stage.value);
        return {
            ...stage,
            tone: normalized.tone,
            label: normalized.label
        };
    });

    const overallTone = stages.some((stage) => stage.tone === 'danger')
        ? 'danger'
        : stages.some((stage) => stage.tone === 'warning')
            ? 'warning'
            : 'success';

    const overallLabel = overallTone === 'success'
        ? 'All green'
        : overallTone === 'warning'
            ? 'Needs attention'
            : 'Needs review';

    const miniContainer = document.getElementById('pipelineStatus');
    if (miniContainer) {
        miniContainer.innerHTML = stages.map((stage) => `
            <div class="pipeline-mini__item">
                <span>${escapeHtml(stage.name)}</span>
                <span class="status-badge status-badge--${stage.tone}">${escapeHtml(stage.label)}</span>
            </div>
        `).join('');
    }

    const overallBadge = document.getElementById('pipelineOverallStatus');
    if (overallBadge) {
        setBadge(overallBadge, overallTone, overallLabel);
    }

    setCardTone('pipelineCard', overallTone);

    const pipelineFlow = document.getElementById('pipelineFlow');
    if (pipelineFlow) {
        pipelineFlow.innerHTML = stages.map((stage, index) => `
            <article class="pipeline-step" data-stage="${escapeHtml(stage.key)}" data-tone="${stage.tone}">
                <div class="pipeline-step__head">
                    <span class="pipeline-step__icon">${escapeHtml(stage.short)}</span>
                    <div>
                        <p class="pipeline-step__label">Stage ${String(index + 1).padStart(2, '0')}</p>
                        <h3>${escapeHtml(stage.name)}</h3>
                    </div>
                </div>
                <span class="status-badge status-badge--${stage.tone}">${escapeHtml(stage.label)}</span>
                <p>${escapeHtml(stage.description)}</p>
            </article>
        `).join('');
    }
}

async function updatePipelineViews() {
    try {
        const [pipelineData, statusData] = await Promise.all([
            fetchJson('/api/pipeline'),
            fetchJson('/api/status')
        ]);

        renderPipelineViews(pipelineData, statusData);
    } catch (error) {
        console.error('Error fetching pipeline status:', error);
        const miniContainer = document.getElementById('pipelineStatus');
        if (miniContainer) {
            miniContainer.innerHTML = '<p class="empty-state">Pipeline status is currently unavailable.</p>';
        }

        const flowContainer = document.getElementById('pipelineFlow');
        if (flowContainer) {
            flowContainer.innerHTML = '<p class="empty-state">Pipeline flow is currently unavailable.</p>';
        }

        const overallBadge = document.getElementById('pipelineOverallStatus');
        if (overallBadge) {
            setBadge(overallBadge, 'danger', 'Unavailable');
        }

        setCardTone('pipelineCard', 'danger');
    }
}

async function updateSystemInfo(data = null) {
    try {
        const payload = data || await fetchJson('/api/system');
        setText('sysPlatform', payload.platform);
        setText('sysArchitecture', payload.architecture);
        setText('sysNodeVersion', payload.nodeVersion);
        setText('sysMemory', `${payload.memory.used} / ${payload.memory.total} (${payload.memory.percentage})`);
    } catch (error) {
        console.error('Error fetching system info:', error);
        setText('sysPlatform', 'Unavailable');
        setText('sysArchitecture', 'Unavailable');
        setText('sysNodeVersion', 'Unavailable');
        setText('sysMemory', 'Unavailable');
    }
}

async function loadNotes() {
    try {
        const payload = await fetchJson('/api/notes');
        const notes = [...payload.notes].reverse();
        const notesList = document.getElementById('notesList');

        if (!notesList) {
            return;
        }

        notesList.innerHTML = '';

        if (notes.length === 0) {
            notesList.innerHTML = '<p class="empty-state">No notes yet. Add one to get started.</p>';
        } else {
            notes.forEach((note) => {
                notesList.appendChild(renderNoteCard(note));
            });
        }

        setText('notesCount', formatCountLabel(notes.length, 'note'));
    } catch (error) {
        console.error('Error loading notes:', error);
        const notesList = document.getElementById('notesList');
        if (notesList) {
            notesList.innerHTML = '<p class="empty-state">Notes could not be loaded right now.</p>';
        }
    }
}

async function addNote(event) {
    event.preventDefault();

    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const title = titleInput?.value.trim() || '';
    const content = contentInput?.value.trim() || '';

    if (!title || !content) {
        showAlert('Please fill in both the note title and content.', 'error');
        return;
    }

    try {
        const payload = await fetchJson('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });

        if (payload.success) {
            if (titleInput) {
                titleInput.value = '';
            }
            if (contentInput) {
                contentInput.value = '';
            }
            showAlert('Note added successfully.', 'success');
            await loadNotes();
        }
    } catch (error) {
        console.error('Error adding note:', error);
        showAlert('Failed to add note.', 'error');
    }
}

async function deleteNote(noteId) {
    try {
        const payload = await fetchJson(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });

        if (payload.success) {
            showAlert('Note deleted.', 'success');
            await loadNotes();
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showAlert('Failed to delete note.', 'error');
    }
}

async function loadFeedbackHistory() {
    try {
        const payload = await fetchJson('/api/feedback');
        const feedbackItems = [...payload.feedback].reverse();
        const feedbackHistory = document.getElementById('feedbackHistory');

        if (!feedbackHistory) {
            return;
        }

        feedbackHistory.innerHTML = '';

        if (feedbackItems.length === 0) {
            feedbackHistory.innerHTML = '<p class="empty-state">No feedback submitted yet.</p>';
        } else {
            feedbackItems.forEach((entry) => {
                feedbackHistory.appendChild(renderFeedbackCard(entry));
            });
        }

        setText('feedbackCount', formatCountLabel(feedbackItems.length, 'entry'));
    } catch (error) {
        console.error('Error loading feedback history:', error);
        const feedbackHistory = document.getElementById('feedbackHistory');
        if (feedbackHistory) {
            feedbackHistory.innerHTML = '<p class="empty-state">Feedback history could not be loaded right now.</p>';
        }
    }
}

async function submitFeedback(event) {
    event.preventDefault();

    const nameInput = document.getElementById('feedbackName');
    const bodyInput = document.getElementById('feedbackBody');
    const name = nameInput?.value.trim() || '';
    const message = bodyInput?.value.trim() || '';

    if (!name || !message) {
        setFeedbackStatus('Please enter both your name and feedback.', 'error');
        showAlert('Please enter both your name and feedback.', 'error');
        return;
    }

    try {
        const payload = await fetchJson('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, message })
        });

        if (payload.success) {
            if (nameInput) {
                nameInput.value = '';
            }
            if (bodyInput) {
                bodyInput.value = '';
            }

            setFeedbackStatus('Feedback submitted successfully.', 'success');
            showAlert('Feedback submitted successfully.', 'success');
            await loadFeedbackHistory();
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        setFeedbackStatus('Could not submit feedback.', 'error');
        showAlert('Failed to submit feedback.', 'error');
    }
}

async function refreshDashboard({ notify = false } = {}) {
    await Promise.all([
        updateVisitorCount(),
        updateUptime(),
        updateCurrentTime(),
        updateHealthStatus(),
        updateDeploymentStatus(),
        updatePipelineViews(),
        updateSystemInfo()
    ]);

    if (notify) {
        showAlert('Dashboard refreshed.', 'success');
    }
}

async function checkHealth() {
    await updateHealthStatus(null, true);
}

function attachSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const targetId = anchor.getAttribute('href');
            const target = targetId ? document.querySelector(targetId) : null;

            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
}

function attachCardActions() {
    const notesList = document.getElementById('notesList');
    if (notesList) {
        notesList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-note-id]');
            if (!button) {
                return;
            }

            deleteNote(button.dataset.noteId);
        });
    }
}

async function initializeDashboard() {
    attachSmoothScrolling();
    attachCardActions();

    const heroRefreshBtn = document.getElementById('heroRefreshBtn');
    if (heroRefreshBtn) {
        heroRefreshBtn.addEventListener('click', () => refreshDashboard({ notify: true }));
    }

    const heroHealthBtn = document.getElementById('heroHealthBtn');
    if (heroHealthBtn) {
        heroHealthBtn.addEventListener('click', checkHealth);
    }

    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', addNote);
    }

    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', submitFeedback);
    }

    await Promise.all([
        refreshDashboard(),
        loadNotes(),
        loadFeedbackHistory()
    ]);

    window.setInterval(() => {
        refreshDashboard();
    }, 30000);

    window.setInterval(() => {
        updateCurrentTime();
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
