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

const deploymentSimulatorSteps = [
    {
        key: 'git-push',
        title: 'Git Push',
        shortLabel: 'Push'
    },
    {
        key: 'jenkins',
        title: 'Jenkins Build',
        shortLabel: 'Build'
    },
    {
        key: 'sonar',
        title: 'SonarCloud Analysis',
        shortLabel: 'Analyze'
    },
    {
        key: 'trivy',
        title: 'Trivy Security Scan',
        shortLabel: 'Scan'
    },
    {
        key: 'docker',
        title: 'Docker Image Build',
        shortLabel: 'Image'
    },
    {
        key: 'render',
        title: 'Render Deployment',
        shortLabel: 'Deploy'
    }
];

const deploymentSimulatorState = {
    runId: 0,
    isRunning: false,
    selectedMode: 'happy',
    selectedStage: 'github',
    activeFailure: null,
    activeDeploymentId: null
};

const deploymentSimulatorTimings = {
    stageDelay: 780,
    betweenStageDelay: 180
};

const playbookStageOrder = ['github', 'jenkins', 'sonar', 'trivy', 'docker', 'dockerhub', 'render', 'application'];

const simulationModeDefinitions = {
    happy: {
        icon: 'HP',
        label: 'Happy Path',
        badge: 'Happy Path',
        tone: 'success',
        description: 'Everything passes.'
    },
    random: {
        icon: 'RF',
        label: 'Random Failure',
        badge: 'Random Failure',
        tone: 'warning',
        description: 'A random stage fails.'
    },
    critical: {
        icon: 'CF',
        label: 'Critical Failure',
        badge: 'Critical Failure',
        tone: 'danger',
        description: 'Only high-severity failures.'
    },
    vulnerability: {
        icon: 'VS',
        label: 'Vulnerability Scenario',
        badge: 'Vulnerability Scenario',
        tone: 'danger',
        description: 'Trivy or SonarCloud fails.'
    },
    deployment: {
        icon: 'DF',
        label: 'Deployment Failure',
        badge: 'Deployment Failure',
        tone: 'danger',
        description: 'DockerHub or Render fails.'
    }
};

function createFailureProfile(stageKey, errorName, severity, description, rootCause, impact, prevention, resolutionSteps) {
    return {
        stageKey,
        errorName,
        severity,
        description,
        rootCause,
        impact,
        prevention,
        resolutionSteps
    };
}

const troubleshootingCatalog = {
    github: {
        icon: 'GH',
        title: 'GitHub',
        badge: 'Source control',
        summary: 'Repository access, branches, and Git state issues usually show up here first.',
        commonErrors: [
            'Repository not found',
            'Wrong repository URL',
            'Branch not found',
            'Access denied',
            'Invalid Git credentials'
        ],
        advancedErrors: [
            'GitHub rate limit exceeded',
            'Merge conflict',
            'Detached HEAD state',
            'Corrupted local repository',
            'Network timeout'
        ],
        realProjectErrors: [
            'DNS resolution failure',
            'SSL certificate issues',
            'Force push overwrite',
            'Missing commit history'
        ],
        preventionMethods: [
            'Use verified clone URLs and protected branches.',
            'Rotate credentials without changing the repository remote.',
            'Avoid force pushing to shared branches.',
            'Reclone or mirror the repository if local metadata is damaged.'
        ],
        troubleshootingSteps: [
            'Check the remote URL and branch name.',
            'Verify access with git ls-remote.',
            'Refresh the token or SSH key scopes.',
            'Reclone the repository if the local clone is corrupted.'
        ],
        failureProfiles: [
            createFailureProfile(
                'github',
                'Repository not found',
                'high',
                'The checkout points to a repository that does not exist or is not visible to the token.',
                'The remote URL is wrong, the repository was renamed, or the account cannot access the repo.',
                'Jenkins cannot fetch source code, so the pipeline stops before build and test stages begin.',
                'Keep clone URLs verified, protect repository names, and test access after permission changes.',
                ['Check the remote URL', 'Confirm the repository exists and is readable', 'Refresh the Git credentials or SSH key', 'Retry the checkout step']
            ),
            createFailureProfile(
                'github',
                'Invalid Git credentials',
                'high',
                'The repository is reachable, but the stored credentials are rejected during checkout.',
                'The token expired, the SSH key changed, or the credential scope is too narrow.',
                'The checkout step fails and the rest of the pipeline never starts.',
                'Use a service account or scoped token and rotate credentials in a controlled way.',
                ['Verify the credential ID in Jenkins', 'Test the token or SSH key locally', 'Update the credential store', 'Run the checkout again']
            ),
            createFailureProfile(
                'github',
                'Detached HEAD state',
                'medium',
                'The clone is not pinned to a normal branch, so follow-up Git operations behave unexpectedly.',
                'The pipeline checked out a commit SHA or an incomplete ref instead of a branch.',
                'Builds can pass, but later steps that expect a branch name or commit history may fail.',
                'Always check out a named branch for CI jobs and keep the branch reference explicit.',
                ['Inspect the checkout log', 'Confirm the branch ref in the pipeline', 'Recreate the workspace if needed', 'Trigger the job from a named branch']
            )
        ]
    },
    jenkins: {
        icon: 'JK',
        title: 'Jenkins',
        badge: 'Pipeline runner',
        summary: 'Pipeline execution, agents, and workspace health problems show up in Jenkins first.',
        commonErrors: [
            'Jenkins service stopped',
            'Node offline',
            'Agent disconnected',
            'Workspace corruption',
            'Jenkinsfile missing'
        ],
        advancedErrors: [
            'Jenkinsfile syntax error',
            'Missing plugins',
            'Plugin version conflict',
            'Credential ID not found',
            'Git checkout failed',
            'SCM polling failure'
        ],
        realProjectErrors: [
            'Build timeout',
            'Permission denied',
            'Disk space full',
            'Java not installed',
            'Java version mismatch',
            'NodeJS tool missing',
            'Sonar Scanner missing',
            'Pipeline stage failure',
            'Pipeline aborted',
            'Concurrent build conflict'
        ],
        preventionMethods: [
            'Keep Jenkins, plugins, and agents aligned on compatible versions.',
            'Validate the Jenkinsfile in pull requests before merging.',
            'Monitor disk usage and workspace cleanup on shared builders.',
            'Pin build tools such as Java, Node.js, and scanners in the job config.'
        ],
        troubleshootingSteps: [
            'Check the Jenkins service and agent status first.',
            'Open the console log and inspect the failed stage.',
            'Verify plugin versions and credential IDs.',
            'Clean the workspace and rerun the job.'
        ],
        failureProfiles: [
            createFailureProfile(
                'jenkins',
                'Jenkinsfile syntax error',
                'high',
                'The pipeline script fails before the job can move past parsing.',
                'A stage block, quote, or brace is malformed in the Jenkinsfile.',
                'The build stops immediately, so none of the CI/CD stages execute.',
                'Lint the Jenkinsfile before merge and keep scripted changes small.',
                ['Open the Jenkins console log', 'Check the reported line number in the Jenkinsfile', 'Fix the syntax and commit again', 'Rerun the pipeline']
            ),
            createFailureProfile(
                'jenkins',
                'Agent disconnected',
                'high',
                'The job starts, but the worker node drops out before the stage completes.',
                'The agent lost connectivity, restarted, or ran out of resources.',
                'The stage remains incomplete and the pipeline is usually aborted.',
                'Use healthy agents, monitor resource usage, and keep network links stable.',
                ['Verify the agent is online', 'Check agent logs and CPU or memory pressure', 'Reconnect or replace the node', 'Restart the build on a healthy agent']
            ),
            createFailureProfile(
                'jenkins',
                'Missing plugins',
                'medium',
                'The job depends on a plugin that is not installed on the Jenkins controller.',
                'The environment was updated without installing the required plugin set.',
                'A stage can fail before the build even reaches the application logic.',
                'Track plugin dependencies and update them together instead of one by one.',
                ['Review the plugin list', 'Install the missing dependency', 'Restart Jenkins if required', 'Rerun the job after the plugin is available']
            )
        ]
    },
    sonar: {
        icon: 'SC',
        title: 'SonarCloud',
        badge: 'Quality analysis',
        summary: 'Quality gates, scanner configuration, and analysis setup are common sources of failure.',
        commonErrors: [
            'Invalid project key',
            'Invalid organization',
            'Sonar token missing',
            'Sonar token expired',
            'Authentication failed',
            'Sonar scanner missing'
        ],
        advancedErrors: [
            'Scanner version mismatch',
            'Source path not found',
            'Analysis timeout',
            'Network failure',
            'Quality Gate failed'
        ],
        realProjectErrors: [
            'Code coverage below threshold',
            'Security hotspot detected',
            'Vulnerability detected',
            'Duplicate code threshold exceeded',
            'Too many code smells',
            'Project quota exceeded'
        ],
        preventionMethods: [
            'Keep the project key and organization synchronized.',
            'Rotate analysis tokens before they expire.',
            'Pin the scanner version used in CI.',
            'Tune quality gates so they are strict but realistic.'
        ],
        troubleshootingSteps: [
            'Verify sonar-project.properties and scanner arguments.',
            'Confirm the token, organization, and project key.',
            'Check the analysis logs for the exact failing rule.',
            'Rerun after fixing path or coverage issues.'
        ],
        failureProfiles: [
            createFailureProfile(
                'sonar',
                'Quality Gate failed',
                'high',
                'The analysis completed, but the project did not meet the configured quality gate.',
                'Coverage, duplication, code smells, or security rules crossed the allowed threshold.',
                'The pipeline can be marked unstable or blocked from release promotion.',
                'Set realistic gates, fix the highlighted issues, and keep coverage visible in pull requests.',
                ['Open the SonarCloud report', 'Review the rules that failed', 'Fix the flagged code or tests', 'Run the analysis again']
            ),
            createFailureProfile(
                'sonar',
                'Sonar token expired',
                'high',
                'The scanner cannot authenticate to SonarCloud because the token is no longer valid.',
                'The token expired, was rotated, or was copied incorrectly into Jenkins.',
                'Analysis stops before quality data is published.',
                'Rotate tokens on a schedule and store them in Jenkins credentials.',
                ['Replace the token in the credential store', 'Confirm the organization and project key', 'Rerun the scanner', 'Verify that analysis data appears in SonarCloud']
            ),
            createFailureProfile(
                'sonar',
                'Source path not found',
                'medium',
                'The scanner cannot find the files it needs to analyze in the current workspace.',
                'The working directory is wrong, a monorepo path is missing, or the checkout was incomplete.',
                'The scan ends early and no report is generated.',
                'Keep the path settings explicit and test them in the same workspace used by Jenkins.',
                ['Verify the checkout path', 'Check scanner include and exclude rules', 'Confirm the workspace contents', 'Rerun the analysis after correcting the path']
            )
        ]
    },
    trivy: {
        icon: 'TR',
        title: 'Trivy',
        badge: 'Security scan',
        summary: 'Image scanning, database updates, and secret detection create the most useful DevSecOps failures.',
        commonErrors: [
            'Trivy not installed',
            'Vulnerability database update failed',
            'Internet connectivity issue',
            'Database download timeout',
            'Unsupported dependency',
            'Unsupported image format',
            'Filesystem scan failed'
        ],
        advancedErrors: [
            'Critical vulnerability detected',
            'High severity vulnerability detected',
            'Secret detected in code',
            'Hardcoded credentials found'
        ],
        realProjectErrors: [
            'Dependency scan failure',
            'Docker image scan failed',
            'Trivy cache corruption'
        ],
        preventionMethods: [
            'Pin the Trivy version used in CI.',
            'Warm the vulnerability database cache regularly.',
            'Scan the image after build, not before the image exists.',
            'Block secrets before they reach the main branch.'
        ],
        troubleshootingSteps: [
            'Refresh the vulnerability database first.',
            'Confirm the target image tag or filesystem path.',
            'Clear the Trivy cache if the scan behaves inconsistently.',
            'Rerun with debug output and review the ignores.'
        ],
        failureProfiles: [
            createFailureProfile(
                'trivy',
                'Critical vulnerability detected',
                'critical',
                'The scan found a vulnerability severe enough to block the release.',
                'A base image, dependency, or OS package includes a known critical issue.',
                'The pipeline should stop until the vulnerable package is updated or replaced.',
                'Keep base images current, scan early, and treat critical findings as release blockers.',
                ['Open the Trivy report', 'Identify the vulnerable package or layer', 'Patch or replace the dependency', 'Run the scan again']
            ),
            createFailureProfile(
                'trivy',
                'Secret detected in code',
                'critical',
                'A credential-like value was discovered in the source or build artifact.',
                'A hardcoded token, API key, or private key was committed accidentally.',
                'The release must stop because the secret could be exposed outside the repo.',
                'Use secret scanning, environment variables, and pre-commit checks to block leaks early.',
                ['Remove the secret from the codebase', 'Rotate the exposed credential', 'Purge the secret from history if needed', 'Rerun the scan before deploying']
            ),
            createFailureProfile(
                'trivy',
                'Vulnerability database update failed',
                'high',
                'Trivy cannot refresh its vulnerability database before scanning.',
                'The network is down, the cache is stale, or the update endpoint is unavailable.',
                'The scan may stop early or run with outdated vulnerability data.',
                'Cache the database carefully and allow CI access to the update source.',
                ['Check network connectivity', 'Retry the database update', 'Clear the cache if it is corrupt', 'Run the scan again']
            )
        ]
    },
    docker: {
        icon: 'DK',
        title: 'Docker',
        badge: 'Container build',
        summary: 'Build context, image layers, and dependency installation issues surface while packaging the app.',
        commonErrors: [
            'Docker Desktop not running',
            'Docker daemon unavailable',
            'Dockerfile missing',
            'Dockerfile syntax error',
            'Build context error',
            'COPY path not found'
        ],
        advancedErrors: [
            'Package installation failed',
            'NPM install failure',
            'Missing package.json',
            'Build timeout',
            'Out of memory',
            'Port already in use'
        ],
        realProjectErrors: [
            'Invalid image tag',
            'Layer caching failure',
            'Base image pull failure',
            'Network issue during build',
            'Image size too large'
        ],
        preventionMethods: [
            'Use a .dockerignore file to keep the build context lean.',
            'Pin base images and keep them updated on a schedule.',
            'Validate COPY paths and package manifests before build.',
            'Prefer multi-stage builds and slim runtime images.'
        ],
        troubleshootingSteps: [
            'Check the Dockerfile line that failed.',
            'Confirm the build context is the project root.',
            'Rerun the build with --no-cache if layers look stale.',
            'Inspect daemon logs and reduce image size if needed.'
        ],
        failureProfiles: [
            createFailureProfile(
                'docker',
                'Dockerfile syntax error',
                'high',
                'The image build fails because the Dockerfile cannot be parsed correctly.',
                'A command, line continuation, or instruction is malformed.',
                'The image never builds, so nothing can be pushed or deployed.',
                'Keep Dockerfiles small, review changes carefully, and test them locally.',
                ['Open the Docker build log', 'Fix the reported Dockerfile line', 'Rebuild locally', 'Push the corrected image']
            ),
            createFailureProfile(
                'docker',
                'Docker daemon unavailable',
                'high',
                'The build cannot connect to the local Docker engine.',
                'Docker Desktop is stopped, the daemon is unhealthy, or the CI host lost access.',
                'The image build aborts before layers can be produced.',
                'Keep the Docker engine healthy and verify CI runners can reach it before the build starts.',
                ['Check whether Docker is running', 'Restart the daemon if necessary', 'Verify host permissions', 'Rerun the build']
            ),
            createFailureProfile(
                'docker',
                'Out of memory',
                'high',
                'The build process is killed because the environment does not have enough memory.',
                'Dependency installation, bundling, or image layering consumed more RAM than available.',
                'The build stops mid-way and the image is incomplete.',
                'Use multi-stage builds, slimmer dependencies, and sensible resource limits.',
                ['Check memory usage during the build', 'Reduce the build footprint', 'Increase runner resources if possible', 'Run the build again']
            )
        ]
    },
    dockerhub: {
        icon: 'DH',
        title: 'DockerHub',
        badge: 'Image registry',
        summary: 'Authentication, registry naming, and push reliability are the usual failure points here.',
        commonErrors: [
            'Login failed',
            'Invalid username',
            'Invalid password',
            'Repository not found',
            'Access denied',
            'Push denied'
        ],
        advancedErrors: [
            'Tag not found',
            'Rate limit exceeded',
            'Network timeout',
            'Authentication expired'
        ],
        realProjectErrors: [
            'Image upload interrupted',
            'Private repository restrictions'
        ],
        preventionMethods: [
            'Use access tokens or service accounts instead of personal passwords.',
            'Keep image tags consistent between Jenkins and the registry.',
            'Retry transient network failures before changing the image.',
            'Avoid pushing too frequently from shared CI environments.'
        ],
        troubleshootingSteps: [
            'Run docker login again with the correct account.',
            'Confirm the repository namespace and tag name.',
            'Check whether the registry token expired.',
            'Retry the push after network or rate limit issues clear.'
        ],
        failureProfiles: [
            createFailureProfile(
                'dockerhub',
                'Login failed',
                'high',
                'The registry rejects the credentials before the push can start.',
                'The username, password, or token is invalid or expired.',
                'The image cannot be published, so the deployment chain stalls.',
                'Use scoped tokens and rotate them before they expire.',
                ['Re-authenticate with docker login', 'Verify the account and token', 'Confirm the repository path', 'Retry the push']
            ),
            createFailureProfile(
                'dockerhub',
                'Push denied',
                'high',
                'The registry authenticates the user but blocks the push operation.',
                'The account lacks write access or the repository name does not match the namespace.',
                'The release image cannot be uploaded to the registry.',
                'Grant the correct write permissions and keep the registry namespace consistent.',
                ['Check registry permissions', 'Confirm the repository name', 'Verify the image tag', 'Push the image again']
            ),
            createFailureProfile(
                'dockerhub',
                'Rate limit exceeded',
                'medium',
                'The registry throttles the CI job because too many requests were made too quickly.',
                'Shared runners or repeated retries hit the registry request limit.',
                'Pushes slow down or fail until the limit resets.',
                'Use authenticated pulls, cache layers, and keep retries under control.',
                ['Wait for the limit to reset', 'Reduce repeated pulls or pushes', 'Authenticate the client', 'Retry the registry action']
            )
        ]
    },
    render: {
        icon: 'RD',
        title: 'Render',
        badge: 'Hosting',
        summary: 'Build logs, service settings, and runtime health checks usually tell the full story here.',
        commonErrors: [
            'Build failed',
            'Deployment failed',
            'Application crash',
            'Container startup failed',
            'Incorrect port configuration',
            'PORT variable missing'
        ],
        advancedErrors: [
            'Environment variable missing',
            'Health check failed',
            'Memory limit exceeded',
            'CPU limit exceeded',
            'Build timeout',
            'Dependency installation failure'
        ],
        realProjectErrors: [
            'Runtime error',
            'Service unavailable',
            'DNS issue',
            'SSL certificate issue',
            'Render service outage'
        ],
        preventionMethods: [
            'Set PORT and environment variables explicitly in Render.',
            'Keep the start command aligned with the application entry point.',
            'Add a health route that returns quickly and consistently.',
            'Test the same build and runtime settings locally first.'
        ],
        troubleshootingSteps: [
            'Review the Render build and runtime logs.',
            'Verify the port binding and environment variables.',
            'Check the health endpoint directly.',
            'Redeploy after the root cause is fixed.'
        ],
        failureProfiles: [
            createFailureProfile(
                'render',
                'Incorrect port configuration',
                'high',
                'The service starts, but it listens on a different port than Render expects.',
                'The app ignores the PORT variable or binds to the wrong host and port.',
                'Render marks the deployment unhealthy and does not route traffic cleanly.',
                'Always bind to the Render-provided PORT value and test the same startup command locally.',
                ['Check the PORT environment variable', 'Confirm the app binds to 0.0.0.0', 'Update the start command if needed', 'Redeploy the service']
            ),
            createFailureProfile(
                'render',
                'Health check failed',
                'high',
                'The app starts but does not respond to the health probe correctly.',
                'The health endpoint is missing, slow, or failing because of a runtime dependency.',
                'Render may roll back or keep the service unhealthy.',
                'Keep the health route simple and make sure it only depends on stable code paths.',
                ['Open the health endpoint', 'Fix the route or dependency error', 'Test the endpoint locally', 'Redeploy once it returns quickly']
            ),
            createFailureProfile(
                'render',
                'Build failed',
                'high',
                'The deployment cannot finish because the build step stops before a runnable artifact is produced.',
                'A dependency install, compile step, or script returned a non-zero exit code.',
                'The service never reaches a live state.',
                'Keep the build reproducible and validate scripts before pushing them to Render.',
                ['Read the build log top to bottom', 'Fix the failing build command', 'Verify package installation', 'Redeploy the service']
            )
        ]
    },
    application: {
        icon: 'AP',
        title: 'Application',
        badge: 'Runtime',
        summary: 'Once the app is live, request validation, middleware, and process stability become the focus.',
        commonErrors: [
            'API route not found',
            'Internal server error (500)',
            'Bad request (400)',
            'Unauthorized access (401)',
            'Forbidden access (403)',
            'Resource not found (404)',
            'Method not allowed (405)'
        ],
        advancedErrors: [
            'Request timeout',
            'JSON parsing error',
            'Memory leak',
            'Infinite loop'
        ],
        realProjectErrors: [
            'Unhandled exception',
            'Dependency failure'
        ],
        preventionMethods: [
            'Centralize route names and request schemas.',
            'Validate incoming payloads before processing them.',
            'Add error middleware and structured logging.',
            'Watch memory usage and test timeout paths regularly.'
        ],
        troubleshootingSteps: [
            'Check the browser network tab and server logs.',
            'Confirm the route and HTTP method match.',
            'Validate the JSON payload and headers.',
            'Reproduce the issue locally and inspect the stack trace.'
        ],
        failureProfiles: [
            createFailureProfile(
                'application',
                'Internal server error (500)',
                'high',
                'The backend throws an unhandled error while processing the request.',
                'A logic bug, missing guard, or failed dependency caused the request handler to crash.',
                'The API returns a 500 error and the user request fails.',
                'Use defensive error handling and keep exception paths covered by tests.',
                ['Open the server log', 'Reproduce the request locally', 'Fix the failing code path', 'Retry the request after redeploying']
            ),
            createFailureProfile(
                'application',
                'JSON parsing error',
                'medium',
                'The server cannot read the request body because the payload is malformed.',
                'The client sent invalid JSON, the content type is wrong, or the parser middleware is missing.',
                'The API rejects the request before the main handler runs.',
                'Validate request bodies and keep payload formats consistent across the app.',
                ['Inspect the request payload', 'Check the Content-Type header', 'Fix the malformed JSON', 'Send the request again']
            ),
            createFailureProfile(
                'application',
                'Memory leak',
                'high',
                'The process keeps growing in memory until it becomes unstable.',
                'Timers, caches, or listeners are not cleaned up after requests complete.',
                'The app slows down, crashes, or starts returning errors under load.',
                'Monitor memory, close listeners, and test long-running sessions before release.',
                ['Check memory growth over time', 'Inspect recurring timers or listeners', 'Patch the leak source', 'Restart the service after the fix']
            )
        ]
    }
};

const allFailureProfiles = playbookStageOrder.flatMap((stageKey) => {
    const stage = troubleshootingCatalog[stageKey];
    return stage.failureProfiles.map((profile) => ({
        ...profile,
        stageKey,
        stageTitle: stage.title
    }));
});

const criticalFailureProfiles = allFailureProfiles.filter((profile) => ['high', 'critical'].includes(profile.severity));
const vulnerabilityFailureProfiles = allFailureProfiles.filter((profile) => ['sonar', 'trivy'].includes(profile.stageKey));
const deploymentFailureProfiles = allFailureProfiles.filter((profile) => ['dockerhub', 'render'].includes(profile.stageKey));

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

function getTroubleshootingStage(stageKey) {
    return troubleshootingCatalog[stageKey] || troubleshootingCatalog.github;
}

function getSimulationMode(modeKey) {
    return simulationModeDefinitions[modeKey] || simulationModeDefinitions.happy;
}

function getSeverityTone(severity) {
    if (severity === 'critical' || severity === 'high') {
        return 'danger';
    }

    if (severity === 'medium') {
        return 'warning';
    }

    return 'neutral';
}

function renderPillList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    if (!items.length) {
        container.innerHTML = '<p class="empty-state">No items available.</p>';
        return;
    }

    container.innerHTML = items.map((item) => `<span class="error-pill">${escapeHtml(item)}</span>`).join('');
}

function renderResolutionList(items) {
    const container = document.getElementById('failureResolutionList');
    if (!container) {
        return;
    }

    if (!items.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderSimulationModeControls() {
    const container = document.getElementById('simulationModeControls');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    Object.entries(simulationModeDefinitions).forEach(([modeKey, mode]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'simulation-mode-chip';
        button.dataset.simulationMode = modeKey;
        button.dataset.tone = mode.tone;
        button.setAttribute('aria-pressed', 'false');

        const icon = document.createElement('span');
        icon.className = 'simulation-mode-chip__icon';
        icon.textContent = mode.icon;

        const content = document.createElement('span');
        content.className = 'simulation-mode-chip__content';

        const title = document.createElement('strong');
        title.textContent = mode.label;

        const description = document.createElement('small');
        description.textContent = mode.description;

        content.append(title, description);
        button.append(icon, content);
        container.appendChild(button);
    });
}

function renderSimulationStageControls() {
    const container = document.getElementById('simulationStageControls');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    playbookStageOrder.forEach((stageKey) => {
        const stage = getTroubleshootingStage(stageKey);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'simulation-stage-chip';
        button.dataset.troubleshootingStage = stageKey;
        button.setAttribute('aria-pressed', 'false');

        const icon = document.createElement('span');
        icon.className = 'simulation-stage-chip__icon';
        icon.textContent = stage.icon;

        const content = document.createElement('span');
        content.className = 'simulation-stage-chip__content';

        const title = document.createElement('strong');
        title.textContent = stage.title;

        const description = document.createElement('small');
        description.textContent = stage.badge;

        content.append(title, description);
        button.append(icon, content);
        container.appendChild(button);
    });
}

function updateSimulationModeSelection(modeKey) {
    deploymentSimulatorState.selectedMode = modeKey;

    document.querySelectorAll('[data-simulation-mode]').forEach((button) => {
        const isActive = button.dataset.simulationMode === modeKey;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    const mode = getSimulationMode(modeKey);
    const badge = document.getElementById('simulationModeBadge');
    if (badge) {
        setBadge(badge, mode.tone, mode.badge);
    }

    if (!deploymentSimulatorState.isRunning) {
        setText('simulatorHeadline', 'Ready to simulate');
        setText('simulatorMessage', `Mode selected: ${mode.label}. ${mode.description}`);
    }
}

function updateTroubleshootingStageSelection(stageKey, { preserveFailure = false } = {}) {
    deploymentSimulatorState.selectedStage = stageKey;

    document.querySelectorAll('[data-troubleshooting-stage]').forEach((button) => {
        const isActive = button.dataset.troubleshootingStage === stageKey;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    if (!preserveFailure) {
        deploymentSimulatorState.activeFailure = null;
    }

    const stage = getTroubleshootingStage(stageKey);
    const countsText = `${stage.commonErrors.length} common, ${stage.advancedErrors.length} advanced, ${stage.realProjectErrors.length} real project`;
    setText('playbookStageSummary', `${stage.summary} Includes ${countsText} errors.`);

    const badge = document.getElementById('playbookStageBadge');
    if (badge) {
        setBadge(badge, 'neutral', stage.badge);
    }

    setText('commonErrorCount', String(stage.commonErrors.length));
    setText('advancedErrorCount', String(stage.advancedErrors.length));
    setText('realProjectErrorCount', String(stage.realProjectErrors.length));
    setText('preventionMethodCount', String(stage.preventionMethods.length));
    setText('troubleshootingStepCount', String(stage.troubleshootingSteps.length));

    renderPillList('commonErrorsList', stage.commonErrors);
    renderPillList('advancedErrorsList', stage.advancedErrors);
    renderPillList('realProjectErrorsList', stage.realProjectErrors);
    renderPillList('preventionMethodsList', stage.preventionMethods);
    renderPillList('troubleshootingStepsList', stage.troubleshootingSteps);

    const activeFailure = deploymentSimulatorState.activeFailure;
    const profile = activeFailure && activeFailure.stageKey === stageKey
        ? activeFailure
        : stage.failureProfiles[0];

    renderFailureSpotlight(profile, {
        context: activeFailure && activeFailure.stageKey === stageKey
            ? `Simulation result for ${stage.title}`
            : `Sample failure for ${stage.title}`,
        isActiveFailure: Boolean(activeFailure && activeFailure.stageKey === stageKey)
    });
}

function renderFailureSpotlight(profile, { context = '', isActiveFailure = false } = {}) {
    const stage = getTroubleshootingStage(profile.stageKey);
    const severityTone = getSeverityTone(profile.severity);
    const badge = document.getElementById('failureSeverityBadge');

    setText('failureName', profile.errorName);
    setText('failureContext', context || `${stage.title} failure profile`);
    setText('failureDescription', profile.description);
    setText('failureRootCause', profile.rootCause);
    setText('failureImpact', profile.impact);
    setText('failurePrevention', profile.prevention);
    renderResolutionList(profile.resolutionSteps);

    if (badge) {
        const label = isActiveFailure
            ? `${profile.severity === 'critical' ? 'Critical' : profile.severity === 'high' ? 'High' : 'Medium'} severity`
            : 'Sample failure';
        setBadge(badge, isActiveFailure ? severityTone : 'neutral', label);
    }

    const spotlight = document.getElementById('failureSpotlight');
    if (spotlight) {
        spotlight.classList.toggle('is-danger', severityTone === 'danger' && isActiveFailure);
        spotlight.classList.toggle('is-warning', severityTone === 'warning' && isActiveFailure);
        spotlight.classList.toggle('is-success', severityTone === 'success' && isActiveFailure);
    }
}

function initializeTroubleshootingPlaybook() {
    renderSimulationModeControls();
    renderSimulationStageControls();
    updateSimulationModeSelection(deploymentSimulatorState.selectedMode);
    updateTroubleshootingStageSelection(deploymentSimulatorState.selectedStage);
}

function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function updateSimulatorButtons(isRunning) {
    const simulateButton = document.getElementById('simulateDeploymentBtn');
    const restartButton = document.getElementById('restartSimulationBtn');

    if (simulateButton) {
        simulateButton.disabled = isRunning;
        simulateButton.textContent = isRunning ? 'Simulating…' : '▶ Simulate Deployment';
    }

    if (restartButton) {
        restartButton.disabled = false;
    }
}

function resetDeploymentSimulation() {
    const stepElements = document.querySelectorAll('#simulatorStages [data-step]');
    stepElements.forEach((stepElement) => {
        stepElement.classList.remove('is-active', 'is-complete');
        stepElement.classList.add('is-pending');

        const stateBadge = stepElement.querySelector('.simulator-step__state');
        if (stateBadge) {
            stateBadge.textContent = 'Pending';
        }
    });

    setText('simulatorStepLabel', 'Ready');
    setText('simulatorProgressText', '0%');

    const progressBar = document.getElementById('simulatorProgressBar');
    if (progressBar) {
        progressBar.style.width = '0%';
    }

    const resultPanel = document.getElementById('simulatorResult');
    if (resultPanel) {
        resultPanel.classList.remove('is-success');
    }

    setText('simulatorHeadline', 'Ready to simulate');
    setText('simulatorMessage', 'This preview does not affect Jenkins, Docker, or Render.');
}

function markSimulatorStep(stepElement, stateLabel) {
    stepElement.classList.remove('is-pending', 'is-active', 'is-complete');
    stepElement.classList.add(`is-${stateLabel}`);

    const stateBadge = stepElement.querySelector('.simulator-step__state');
    if (stateBadge) {
        if (stateLabel === 'complete') {
            stateBadge.textContent = '✓ Completed';
        } else if (stateLabel === 'active') {
            stateBadge.textContent = 'In Progress';
        } else {
            stateBadge.textContent = 'Pending';
        }
    }
}

function updateSimulatorProgress(completedSteps, totalSteps, currentTitle = '') {
    const progressBar = document.getElementById('simulatorProgressBar');
    const progressText = document.getElementById('simulatorProgressText');
    const stepLabel = document.getElementById('simulatorStepLabel');
    const progressPercent = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }

    if (progressText) {
        progressText.textContent = `${progressPercent}%`;
    }

    if (stepLabel) {
        stepLabel.textContent = currentTitle || (progressPercent === 100 ? 'Complete' : 'Ready');
    }
}

async function runDeploymentSimulation(runId) {
    const stepElements = Array.from(document.querySelectorAll('#simulatorStages .simulator-step'));

    resetDeploymentSimulation();
    updateSimulatorButtons(true);

    for (let index = 0; index < stepElements.length; index += 1) {
        if (runId !== deploymentSimulatorState.runId) {
            return;
        }

        const currentStep = deploymentSimulatorSteps[index];
        const currentElement = stepElements[index];
        const previousElement = stepElements[index - 1];

        if (previousElement) {
            markSimulatorStep(previousElement, 'complete');
        }

        markSimulatorStep(currentElement, 'active');
        updateSimulatorProgress(index, stepElements.length, `Step ${index + 1} of ${stepElements.length}: ${currentStep.title}`);
        setText('simulatorHeadline', currentStep.title);
        setText('simulatorMessage', `${currentStep.title} is running in the simulator.`);

        await delay(deploymentSimulatorTimings.stageDelay);

        if (runId !== deploymentSimulatorState.runId) {
            return;
        }

        markSimulatorStep(currentElement, 'complete');
        updateSimulatorProgress(index + 1, stepElements.length, `Completed ${currentStep.title}`);

        if (index < stepElements.length - 1) {
            await delay(deploymentSimulatorTimings.betweenStageDelay);
        }
    }

    if (runId !== deploymentSimulatorState.runId) {
        return;
    }

    deploymentSimulatorState.isRunning = false;
    updateSimulatorButtons(false);
    updateSimulatorProgress(stepElements.length, stepElements.length, 'Deployment Successful');
    setText('simulatorHeadline', 'Deployment Successful');
    setText('simulatorMessage', 'The frontend simulation finished successfully.');

    const resultPanel = document.getElementById('simulatorResult');
    if (resultPanel) {
        resultPanel.classList.add('is-success');
    }
}

function startDeploymentSimulation() {
    deploymentSimulatorState.runId += 1;
    deploymentSimulatorState.isRunning = true;
    runDeploymentSimulation(deploymentSimulatorState.runId);
}

function restartDeploymentSimulation() {
    deploymentSimulatorState.runId += 1;
    deploymentSimulatorState.isRunning = true;
    runDeploymentSimulation(deploymentSimulatorState.runId);
}

function getFailureTargetIndex(stageKey) {
    const indexMap = {
        github: 0,
        jenkins: 1,
        sonar: 2,
        trivy: 3,
        docker: 4,
        dockerhub: 4,
        render: 5,
        application: 5
    };

    return indexMap[stageKey] ?? 0;
}

function pickFailureProfile(modeKey) {
    const pools = {
        happy: [],
        random: allFailureProfiles,
        critical: criticalFailureProfiles,
        vulnerability: vulnerabilityFailureProfiles,
        deployment: deploymentFailureProfiles
    };

    const pool = pools[modeKey] || [];
    if (!pool.length) {
        return null;
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

function updateSimulatorButtons(isRunning) {
    const simulateButton = document.getElementById('simulateDeploymentBtn');
    const restartButton = document.getElementById('restartSimulationBtn');

    if (simulateButton) {
        simulateButton.disabled = isRunning;
        simulateButton.textContent = isRunning ? 'Simulating...' : '▶ Simulate Deployment';
    }

    document.querySelectorAll('[data-simulation-mode], [data-troubleshooting-stage]').forEach((button) => {
        button.disabled = isRunning;
    });

    if (restartButton) {
        restartButton.disabled = false;
    }
}

function resetDeploymentSimulation() {
    const stepElements = document.querySelectorAll('#simulatorStages [data-step]');
    stepElements.forEach((stepElement) => {
        stepElement.classList.remove('is-active', 'is-complete', 'is-failed');
        stepElement.classList.add('is-pending');

        const stateBadge = stepElement.querySelector('.simulator-step__state');
        if (stateBadge) {
            stateBadge.textContent = 'Pending';
        }
    });

    setText('simulatorStepLabel', 'Ready');
    setText('simulatorProgressText', '0%');

    const progressBar = document.getElementById('simulatorProgressBar');
    if (progressBar) {
        progressBar.style.width = '0%';
    }

    const resultPanel = document.getElementById('simulatorResult');
    if (resultPanel) {
        resultPanel.classList.remove('is-success', 'is-failure');
    }

    deploymentSimulatorState.activeFailure = null;
    updateSimulationModeSelection(deploymentSimulatorState.selectedMode);
    updateTroubleshootingStageSelection(deploymentSimulatorState.selectedStage);
}

function markSimulatorStep(stepElement, stateLabel) {
    stepElement.classList.remove('is-pending', 'is-active', 'is-complete', 'is-failed');
    stepElement.classList.add(`is-${stateLabel}`);

    const stateBadge = stepElement.querySelector('.simulator-step__state');
    if (stateBadge) {
        if (stateLabel === 'complete') {
            stateBadge.textContent = '✓ Completed';
        } else if (stateLabel === 'active') {
            stateBadge.textContent = 'In Progress';
        } else if (stateLabel === 'failed') {
            stateBadge.textContent = 'Failed';
        } else {
            stateBadge.textContent = 'Pending';
        }
    }
}

function updateSimulatorProgress(completedSteps, totalSteps, currentTitle = '') {
    const progressBar = document.getElementById('simulatorProgressBar');
    const progressText = document.getElementById('simulatorProgressText');
    const stepLabel = document.getElementById('simulatorStepLabel');
    const progressPercent = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }

    if (progressText) {
        progressText.textContent = `${progressPercent}%`;
    }

    if (stepLabel) {
        stepLabel.textContent = currentTitle || (progressPercent === 100 ? 'Complete' : 'Ready');
    }
}

function getDeploymentScenarioName() {
    return getSimulationMode(deploymentSimulatorState.selectedMode).label;
}

async function createDeploymentRecord() {
    try {
        const payload = await fetchJson('/api/deployments/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scenarioName: getDeploymentScenarioName(),
                steps: deploymentSimulatorSteps.map((step) => step.title)
            })
        });

        return payload?.deployment || null;
    } catch (error) {
        console.warn('Could not create deployment record:', error);
        return null;
    }
}

async function recordDeploymentStep(deploymentId, stepName, status, logText = '') {
    if (!deploymentId) {
        return null;
    }

    try {
        return await fetchJson(`/api/deployments/${deploymentId}/steps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stepName,
                status,
                logText
            })
        });
    } catch (error) {
        console.warn(`Could not persist step "${stepName}":`, error);
        return null;
    }
}

async function finalizeDeploymentRecord(deploymentId, status, logText = '') {
    if (!deploymentId) {
        return null;
    }

    try {
        return await fetchJson(`/api/deployments/${deploymentId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status,
                logText
            })
        });
    } catch (error) {
        console.warn(`Could not finalize deployment "${deploymentId}":`, error);
        return null;
    }
}

async function runDeploymentSimulation(runId) {
    const stepElements = Array.from(document.querySelectorAll('#simulatorStages .simulator-step'));
    const failureProfile = pickFailureProfile(deploymentSimulatorState.selectedMode);
    const deploymentId = deploymentSimulatorState.activeDeploymentId;

    resetDeploymentSimulation();
    updateSimulatorButtons(true);

    setText('simulatorHeadline', `${getSimulationMode(deploymentSimulatorState.selectedMode).label} running`);
    setText('simulatorMessage', 'The frontend simulator is animating the selected deployment path.');

    for (let index = 0; index < stepElements.length; index += 1) {
        if (runId !== deploymentSimulatorState.runId) {
            return;
        }

        const currentStep = deploymentSimulatorSteps[index];
        const currentElement = stepElements[index];
        const previousElement = stepElements[index - 1];

        if (previousElement) {
            markSimulatorStep(previousElement, 'complete');
        }

        markSimulatorStep(currentElement, 'active');
        updateSimulatorProgress(index, stepElements.length, `Step ${index + 1} of ${stepElements.length}: ${currentStep.title}`);
        setText('simulatorHeadline', currentStep.title);
        setText('simulatorMessage', `${currentStep.title} is running in the simulator.`);
        void recordDeploymentStep(deploymentId, currentStep.title, 'running', `${currentStep.title} started.`);

        await delay(deploymentSimulatorTimings.stageDelay);

        if (runId !== deploymentSimulatorState.runId) {
            return;
        }

        if (failureProfile && index === getFailureTargetIndex(failureProfile.stageKey)) {
            markSimulatorStep(currentElement, 'failed');
            deploymentSimulatorState.isRunning = false;
            deploymentSimulatorState.activeFailure = failureProfile;
            updateSimulatorButtons(false);
            updateTroubleshootingStageSelection(failureProfile.stageKey, { preserveFailure: true });
            updateSimulatorProgress(index, stepElements.length, `Failed at ${currentStep.title}`);
            setText('simulatorHeadline', failureProfile.errorName);
            setText('simulatorMessage', `${failureProfile.stageTitle} failed during ${currentStep.title}.`);
            void recordDeploymentStep(deploymentId, currentStep.title, 'failed', `${currentStep.title} failed because of ${failureProfile.errorName}.`);
            void finalizeDeploymentRecord(
                deploymentId,
                'failed',
                `${failureProfile.errorName} occurred during ${currentStep.title}.`
            );
            deploymentSimulatorState.activeDeploymentId = null;

            const resultPanel = document.getElementById('simulatorResult');
            if (resultPanel) {
                resultPanel.classList.remove('is-success');
                resultPanel.classList.add('is-failure');
            }

            return;
        }

        markSimulatorStep(currentElement, 'complete');
        updateSimulatorProgress(index + 1, stepElements.length, `Completed ${currentStep.title}`);
        void recordDeploymentStep(deploymentId, currentStep.title, 'completed', `${currentStep.title} completed successfully.`);

        if (index < stepElements.length - 1) {
            await delay(deploymentSimulatorTimings.betweenStageDelay);
        }
    }

    if (runId !== deploymentSimulatorState.runId) {
        return;
    }

    deploymentSimulatorState.isRunning = false;
    deploymentSimulatorState.activeFailure = null;
    updateSimulatorButtons(false);
    updateSimulatorProgress(stepElements.length, stepElements.length, 'Deployment Successful');
    setText('simulatorHeadline', 'Deployment Successful');
    setText('simulatorMessage', 'The frontend simulation finished successfully.');
    void finalizeDeploymentRecord(deploymentId, 'successful', 'Deployment completed successfully.');
    deploymentSimulatorState.activeDeploymentId = null;

    const resultPanel = document.getElementById('simulatorResult');
    if (resultPanel) {
        resultPanel.classList.remove('is-failure');
        resultPanel.classList.add('is-success');
    }
}

async function startDeploymentSimulation() {
    const previousDeploymentId = deploymentSimulatorState.isRunning ? deploymentSimulatorState.activeDeploymentId : null;

    if (previousDeploymentId) {
        void finalizeDeploymentRecord(previousDeploymentId, 'cancelled', 'Simulation superseded by a new run.');
    }

    deploymentSimulatorState.runId += 1;
    deploymentSimulatorState.isRunning = true;
    deploymentSimulatorState.activeDeploymentId = null;

    const deployment = await createDeploymentRecord();
    deploymentSimulatorState.activeDeploymentId = deployment?.id ?? null;

    runDeploymentSimulation(deploymentSimulatorState.runId);
}

async function restartDeploymentSimulation() {
    return startDeploymentSimulation();
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

    const pipelineDescription = document.querySelector('#pipelineCard > p');
    if (pipelineDescription) {
        pipelineDescription.textContent = 'Live status from the existing CI/CD APIs.';
    }

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
    initializeTroubleshootingPlaybook();
    resetDeploymentSimulation();

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

    const simulationModeControls = document.getElementById('simulationModeControls');
    if (simulationModeControls) {
        simulationModeControls.addEventListener('click', (event) => {
            const button = event.target.closest('[data-simulation-mode]');
            if (!button || deploymentSimulatorState.isRunning) {
                return;
            }

            deploymentSimulatorState.selectedMode = button.dataset.simulationMode;
            resetDeploymentSimulation();
        });
    }

    const simulationStageControls = document.getElementById('simulationStageControls');
    if (simulationStageControls) {
        simulationStageControls.addEventListener('click', (event) => {
            const button = event.target.closest('[data-troubleshooting-stage]');
            if (!button || deploymentSimulatorState.isRunning) {
                return;
            }

            deploymentSimulatorState.selectedStage = button.dataset.troubleshootingStage;
            resetDeploymentSimulation();
        });
    }

    const simulateDeploymentBtn = document.getElementById('simulateDeploymentBtn');
    if (simulateDeploymentBtn) {
        simulateDeploymentBtn.addEventListener('click', startDeploymentSimulation);
    }

    const restartSimulationBtn = document.getElementById('restartSimulationBtn');
    if (restartSimulationBtn) {
        restartSimulationBtn.addEventListener('click', restartDeploymentSimulation);
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
        updateUptime();
    }, 1000);

    window.setInterval(() => {
        updateCurrentTime();
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
