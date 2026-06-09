const DEFAULT_DEPLOYMENT_STEPS = [
    'Git Push',
    'Jenkins Build',
    'SonarCloud Analysis',
    'Trivy Security Scan',
    'Docker Image Build',
    'Render Deployment'
];

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);
const SUPABASE_BASE_URL = SUPABASE_ENABLED ? `${SUPABASE_URL}/rest/v1` : null;

const memoryStore = {
    deployments: [],
    deploymentSteps: [],
    deploymentLogs: [],
    nextDeploymentId: 1,
    nextStepId: 1,
    nextLogId: 1
};

function nowIso() {
    return new Date().toISOString();
}

function normalizeText(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
}

function coerceId(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : String(value);
}

function normalizeDeploymentRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: coerceId(row.id),
        scenarioName: row.scenario_name ?? row.scenarioName ?? '',
        status: row.status ?? 'running',
        startedAt: row.started_at ?? row.startedAt ?? null,
        completedAt: row.completed_at ?? row.completedAt ?? null
    };
}

function normalizeStepRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: coerceId(row.id),
        deploymentId: coerceId(row.deployment_id ?? row.deploymentId),
        stepName: row.step_name ?? row.stepName ?? '',
        status: row.status ?? 'pending',
        updatedAt: row.updated_at ?? row.updatedAt ?? null
    };
}

function normalizeLogRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: coerceId(row.id),
        deploymentId: coerceId(row.deployment_id ?? row.deploymentId),
        stepName: row.step_name ?? row.stepName ?? '',
        logText: row.log_text ?? row.logText ?? '',
        createdAt: row.created_at ?? row.createdAt ?? null
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createStepRecords(deploymentId, stepNames) {
    const currentTimestamp = nowIso();
    return stepNames.map((stepName) => ({
        id: memoryStore.nextStepId++,
        deploymentId,
        stepName,
        status: 'pending',
        updatedAt: currentTimestamp
    }));
}

function createLogRecord(deploymentId, stepName, logText) {
    return {
        id: memoryStore.nextLogId++,
        deploymentId,
        stepName,
        logText,
        createdAt: nowIso()
    };
}

function upsertMemoryStep(deploymentId, stepName, status) {
    const currentTimestamp = nowIso();
    const existing = memoryStore.deploymentSteps.find((step) => String(step.deploymentId) === String(deploymentId) && step.stepName === stepName);

    if (existing) {
        existing.status = status;
        existing.updatedAt = currentTimestamp;
        return clone(existing);
    }

    const step = {
        id: memoryStore.nextStepId++,
        deploymentId,
        stepName,
        status,
        updatedAt: currentTimestamp
    };

    memoryStore.deploymentSteps.push(step);
    return clone(step);
}

function appendMemoryLog(deploymentId, stepName, logText) {
    const log = createLogRecord(deploymentId, stepName, logText);
    memoryStore.deploymentLogs.push(log);
    return clone(log);
}

function updateMemoryDeployment(deploymentId, status) {
    const deployment = memoryStore.deployments.find((entry) => String(entry.id) === String(deploymentId));

    if (!deployment) {
        return null;
    }

    deployment.status = status;
    deployment.completedAt = status === 'running' ? null : nowIso();
    return clone(deployment);
}

function getMemoryDeploymentById(deploymentId) {
    const deployment = memoryStore.deployments.find((entry) => String(entry.id) === String(deploymentId));

    if (!deployment) {
        return null;
    }

    const steps = memoryStore.deploymentSteps
        .filter((step) => String(step.deploymentId) === String(deploymentId))
        .sort((left, right) => new Date(left.updatedAt) - new Date(right.updatedAt))
        .map((step) => clone(step));

    const logs = memoryStore.deploymentLogs
        .filter((log) => String(log.deploymentId) === String(deploymentId))
        .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
        .map((log) => clone(log));

    return {
        deployment: clone(deployment),
        steps,
        logs
    };
}

function calculateAnalytics(deployments, steps) {
    const analytics = {
        totalDeployments: deployments.length,
        successfulDeployments: deployments.filter((deployment) => deployment.status === 'successful').length,
        failedDeployments: deployments.filter((deployment) => deployment.status === 'failed').length,
        mostFailedStage: null
    };

    const failureCounts = new Map();
    steps.forEach((step) => {
        if (step.status !== 'failed') {
            return;
        }

        const currentCount = failureCounts.get(step.stepName) || 0;
        failureCounts.set(step.stepName, currentCount + 1);
    });

    for (const [stepName, failureCount] of failureCounts.entries()) {
        if (!analytics.mostFailedStage || failureCount > analytics.mostFailedStage.count) {
            analytics.mostFailedStage = {
                stepName,
                count: failureCount
            };
        }
    }

    return analytics;
}

function getMemoryHistory() {
    const deployments = clone(memoryStore.deployments).sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt));
    const steps = clone(memoryStore.deploymentSteps);
    const analytics = calculateAnalytics(deployments, steps);

    const stepsByDeployment = steps.reduce((accumulator, step) => {
        const key = String(step.deploymentId);
        if (!accumulator[key]) {
            accumulator[key] = [];
        }

        accumulator[key].push(step);
        return accumulator;
    }, {});

    const deploymentsWithSteps = deployments.map((deployment) => ({
        ...deployment,
        steps: (stepsByDeployment[String(deployment.id)] || []).sort((left, right) => new Date(left.updatedAt) - new Date(right.updatedAt))
    }));

    return {
        analytics,
        deployments: deploymentsWithSteps
    };
}

async function supabaseRequest(table, { method = 'GET', query = {}, body = null, prefer = 'return=representation' } = {}) {
    const url = new URL(`${SUPABASE_BASE_URL}/${table}`);

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    const headers = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
    };

    if (prefer) {
        headers.Prefer = prefer;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body === null || body === undefined ? undefined : JSON.stringify(body)
    });

    const responseText = await response.text();
    const payload = responseText ? (() => {
        try {
            return JSON.parse(responseText);
        } catch (error) {
            return responseText;
        }
    })() : null;

    if (!response.ok) {
        const message = typeof payload === 'string'
            ? payload
            : payload?.message || `Supabase request failed with status ${response.status}`;
        throw new Error(message);
    }

    return payload;
}

async function createDeployment({ scenarioName, stepNames = DEFAULT_DEPLOYMENT_STEPS, status = 'running' }) {
    const safeScenarioName = normalizeText(scenarioName, 'Deployment Run');
    const deploymentPayload = {
        scenario_name: safeScenarioName,
        status,
        started_at: nowIso(),
        completed_at: null
    };

    if (SUPABASE_ENABLED) {
        const [deploymentRow] = await supabaseRequest('deployments', {
            method: 'POST',
            body: deploymentPayload
        }) || [];

        if (!deploymentRow) {
            throw new Error('Failed to create deployment record');
        }

        const deploymentStepsPayload = stepNames.map((stepName) => ({
            deployment_id: deploymentRow.id,
            step_name: normalizeText(stepName),
            status: 'pending',
            updated_at: nowIso()
        }));

        if (deploymentStepsPayload.length > 0) {
            await supabaseRequest('deployment_steps', {
                method: 'POST',
                query: { on_conflict: 'deployment_id,step_name' },
                body: deploymentStepsPayload,
                prefer: 'resolution=merge-duplicates,return=representation'
            });
        }

        await supabaseRequest('deployment_logs', {
            method: 'POST',
            body: {
                deployment_id: deploymentRow.id,
                step_name: 'deployment',
                log_text: `Deployment created for ${safeScenarioName}.`,
                created_at: nowIso()
            }
        });

        return {
            deployment: normalizeDeploymentRow(deploymentRow),
            steps: deploymentStepsPayload.map((stepPayload, index) => normalizeStepRow({
                id: index + 1,
                deployment_id: deploymentRow.id,
                step_name: stepPayload.step_name,
                status: stepPayload.status,
                updated_at: stepPayload.updated_at
            }))
        };
    }

    const deployment = {
        id: memoryStore.nextDeploymentId++,
        scenarioName: safeScenarioName,
        status,
        startedAt: nowIso(),
        completedAt: null
    };

    memoryStore.deployments.push(deployment);
    const steps = createStepRecords(deployment.id, stepNames.map((stepName) => normalizeText(stepName)));
    memoryStore.deploymentSteps.push(...steps);
    appendMemoryLog(deployment.id, 'deployment', `Deployment created for ${deployment.scenarioName}.`);

    return {
        deployment: clone(deployment),
        steps: clone(steps)
    };
}

async function upsertDeploymentStep({ deploymentId, stepName, status, logText = '' }) {
    const safeStepName = normalizeText(stepName);
    const safeStatus = normalizeText(status, 'pending').toLowerCase() || 'pending';

    if (!safeStepName) {
        throw new Error('Step name is required');
    }

    if (SUPABASE_ENABLED) {
        const [stepRow] = await supabaseRequest('deployment_steps', {
            method: 'POST',
            query: { on_conflict: 'deployment_id,step_name' },
            body: [{
                deployment_id: deploymentId,
                step_name: safeStepName,
                status: safeStatus,
                updated_at: nowIso()
            }],
            prefer: 'resolution=merge-duplicates,return=representation'
        }) || [];

        if (!stepRow) {
            throw new Error('Failed to update deployment step');
        }

        let logRow = null;
        if (safeStepName && normalizeText(logText)) {
            const [insertedLog] = await supabaseRequest('deployment_logs', {
                method: 'POST',
                body: {
                    deployment_id: deploymentId,
                    step_name: safeStepName,
                    log_text: normalizeText(logText),
                    created_at: nowIso()
                }
            }) || [];
            logRow = insertedLog || null;
        }

        return {
            step: normalizeStepRow(stepRow),
            log: normalizeLogRow(logRow)
        };
    }

    const step = upsertMemoryStep(deploymentId, safeStepName, safeStatus);
    const log = normalizeText(logText) ? appendMemoryLog(deploymentId, safeStepName, normalizeText(logText)) : null;
    return {
        step,
        log
    };
}

async function updateDeploymentStatus({ deploymentId, status, logText = '' }) {
    const safeStatus = normalizeText(status, 'running').toLowerCase() || 'running';
    const completedAt = safeStatus === 'running' ? null : nowIso();

    if (SUPABASE_ENABLED) {
        const [deploymentRow] = await supabaseRequest('deployments', {
            method: 'PATCH',
            query: { id: `eq.${deploymentId}` },
            body: {
                status: safeStatus,
                completed_at: completedAt
            }
        }) || [];

        if (!deploymentRow) {
            throw new Error('Failed to update deployment status');
        }

        let logRow = null;
        if (normalizeText(logText)) {
            const [insertedLog] = await supabaseRequest('deployment_logs', {
                method: 'POST',
                body: {
                    deployment_id: deploymentId,
                    step_name: 'deployment',
                    log_text: normalizeText(logText),
                    created_at: nowIso()
                }
            }) || [];
            logRow = insertedLog || null;
        }

        return {
            deployment: normalizeDeploymentRow(deploymentRow),
            log: normalizeLogRow(logRow)
        };
    }

    const deployment = updateMemoryDeployment(deploymentId, safeStatus);
    const log = normalizeText(logText) ? appendMemoryLog(deploymentId, 'deployment', normalizeText(logText)) : null;

    return {
        deployment,
        log
    };
}

async function getDeploymentById(deploymentId) {
    if (SUPABASE_ENABLED) {
        const deployments = await supabaseRequest('deployments', {
            method: 'GET',
            query: {
                select: '*',
                id: `eq.${deploymentId}`,
                limit: '1'
            },
            prefer: ''
        });

        const deploymentRow = Array.isArray(deployments) ? deployments[0] : null;
        if (!deploymentRow) {
            return null;
        }

        const steps = await supabaseRequest('deployment_steps', {
            method: 'GET',
            query: {
                select: '*',
                deployment_id: `eq.${deploymentId}`,
                order: 'updated_at.asc,id.asc'
            },
            prefer: ''
        }) || [];

        const logs = await supabaseRequest('deployment_logs', {
            method: 'GET',
            query: {
                select: '*',
                deployment_id: `eq.${deploymentId}`,
                order: 'created_at.asc,id.asc'
            },
            prefer: ''
        }) || [];

        return {
            deployment: normalizeDeploymentRow(deploymentRow),
            steps: steps.map(normalizeStepRow),
            logs: logs.map(normalizeLogRow)
        };
    }

    return getMemoryDeploymentById(deploymentId);
}

async function getDeploymentLogs(deploymentId) {
    const deployment = await getDeploymentById(deploymentId);
    if (!deployment) {
        return null;
    }

    return deployment.logs;
}

async function getDeploymentHistory(limit = 20) {
    if (SUPABASE_ENABLED) {
        const deployments = await supabaseRequest('deployments', {
            method: 'GET',
            query: {
                select: '*',
                order: 'started_at.desc,id.desc'
            },
            prefer: ''
        }) || [];

        const steps = await supabaseRequest('deployment_steps', {
            method: 'GET',
            query: {
                select: '*',
                order: 'updated_at.asc,id.asc'
            },
            prefer: ''
        }) || [];

        const normalizedDeployments = deployments.map(normalizeDeploymentRow);
        const normalizedSteps = steps.map(normalizeStepRow);
        const analytics = calculateAnalytics(normalizedDeployments, normalizedSteps);

        const stepsByDeployment = normalizedSteps.reduce((accumulator, step) => {
            const key = String(step.deploymentId);
            if (!accumulator[key]) {
                accumulator[key] = [];
            }

            accumulator[key].push(step);
            return accumulator;
        }, {});

        return {
            analytics,
            deployments: normalizedDeployments.slice(0, limit).map((deployment) => ({
                ...deployment,
                steps: stepsByDeployment[String(deployment.id)] || []
            }))
        };
    }

    const memoryHistory = getMemoryHistory();
    return {
        analytics: memoryHistory.analytics,
        deployments: memoryHistory.deployments.slice(0, limit)
    };
}

function isSupabaseConfigured() {
    return SUPABASE_ENABLED;
}

module.exports = {
    DEFAULT_DEPLOYMENT_STEPS,
    isSupabaseConfigured,
    createDeployment,
    upsertDeploymentStep,
    updateDeploymentStatus,
    getDeploymentById,
    getDeploymentLogs,
    getDeploymentHistory
};
