const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();

// ========== Configuration ==========
const COUNTER_FILE = 'visit_counter.json';
const PORT = process.env.PORT || 3000;

// ========== Utility Functions ==========

// HTML Sanitization function to prevent XSS
function sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Load or initialize visitor counter
function loadVisitCounter() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = fs.readFileSync(COUNTER_FILE, 'utf8');
            const parsed = JSON.parse(data);
            console.log(`[INFO] Loaded visitor counter from file: ${parsed.count}`);
            return parsed.count || 0;
        }
    } catch (error) {
        console.error(`[ERROR] Failed to load visit counter: ${error.message}`);
    }
    return 0;
}

// Save visitor counter to file
function saveVisitCounter(count) {
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count, timestamp: new Date().toISOString() }, null, 2));
    } catch (error) {
        console.error(`[ERROR] Failed to save visit counter: ${error.message}`);
    }
}

// ========== Middleware ==========

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware - logs method, endpoint, timestamp
let apiRequestCount = 0;
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    
    // Track API requests
    if (req.path.startsWith('/api/')) {
        apiRequestCount++;
    }
    next();
});

// ========== In-Memory Data Storage ==========
let visitCounter = loadVisitCounter();
const serverStartTime = Date.now();
let notes = []; // In-memory notes storage
let feedback = []; // In-memory feedback storage

// DevOps/Programming quotes array
const quotes = [
    "DevOps is a set of practices that combines software development and IT operations.",
    "Infrastructure as code makes your deployments repeatable and reliable.",
    "Automation reduces human error and speeds up your development cycle.",
    "Monitor everything, automate everything, improve everything.",
    "A deployment should be an event that nobody gets excited about.",
    "Version control is not just for code, it's for your entire infrastructure.",
    "The best feature of continuous integration is that it helps avoid integration hell.",
    "Containers are the new virtual machines.",
    "Test early, test often, deploy with confidence.",
    "DevOps culture: People over processes over tools.",
    "Failing fast is the path to success.",
    "Build, test, deploy, repeat.",
    "Your deployment pipeline should be faster than your coffee break.",
    "Code is for humans to read, incidentally also for machines to execute."
];

// ========== Routes ==========

// IMPORTANT: Frontend - Home Page route MUST be BEFORE static middleware
// This ensures visitor counter increments correctly
app.get('/', (req, res) => {
    visitCounter++;
    saveVisitCounter(visitCounter);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static files middleware - AFTER route handlers
app.use(express.static('public'));

// ========== Health & Status APIs ==========

// API: Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// API: Status - Now configurable with environment variables
app.get('/api/status', (req, res) => {
    res.json({
        status: process.env.DEPLOY_STATUS_TEXT || 'running',
        deployment: process.env.DEPLOY_SUCCESS || 'successful'
    });
});

// ========== System Information APIs ==========

// API: Server Uptime
app.get('/api/uptime', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    res.json({
        totalSeconds: uptimeSeconds,
        formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`
    });
});

// API: Current Time
app.get('/api/time', (req, res) => {
    res.json({
        current: new Date().toISOString(),
        unix: Date.now(),
        readable: new Date().toLocaleString()
    });
});

// API: System Information
app.get('/api/system', (req, res) => {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    res.json({
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        cpus: os.cpus().length,
        memory: {
            total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            free: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            percentage: `${((usedMemory / totalMemory) * 100).toFixed(2)}%`
        }
    });
});

// ========== Pipeline & Metrics APIs ==========

// API: Pipeline Status - Uses environment variables for configurable status
// Can be set via: JENKINS_STATUS, SONAR_STATUS, TRIVY_STATUS, DOCKER_STATUS, DEPLOY_STATUS
app.get('/api/pipeline', (req, res) => {
    res.json({
        jenkins: process.env.JENKINS_STATUS || 'success',
        sonar: process.env.SONAR_STATUS || 'passed',
        trivy: process.env.TRIVY_STATUS || 'passed',
        docker: process.env.DOCKER_STATUS || 'built',
        deployment: process.env.DEPLOY_STATUS || 'active'
    });
});

// API: Visitor Counter
app.get('/api/visits', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    res.json({
        totalVisits: visitCounter,
        uptime: uptimeSeconds
    });
});

// API: Statistics
app.get('/api/stats', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    res.json({
        totalApiRequests: apiRequestCount,
        totalVisits: visitCounter,
        serverUptime: uptimeSeconds,
        timestamp: new Date().toISOString()
    });
});

// ========== Quote API ==========

// API: Random Quote
app.get('/api/quote', (req, res) => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    res.json({
        quote: quotes[randomIndex],
        author: 'DevOps Community'
    });
});

// ========== Notes API (In-Memory) ==========

// GET: All Notes
app.get('/api/notes', (req, res) => {
    res.json({
        notes: notes,
        count: notes.length
    });
});

// POST: Add Note - With input validation and XSS protection
app.post('/api/notes', (req, res) => {
    const { title, content } = req.body;
    
    // Validate required fields
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Title and content are required'
        });
    }
    
    // Validate title length
    if (title.length > 100) {
        return res.status(400).json({
            success: false,
            message: 'Title must be 100 characters or less'
        });
    }
    
    // Validate content length
    if (content.length > 5000) {
        return res.status(400).json({
            success: false,
            message: 'Content must be 5000 characters or less'
        });
    }
    
    // Sanitize input to prevent XSS
    const sanitizedTitle = sanitizeHtml(title.trim());
    const sanitizedContent = sanitizeHtml(content.trim());
    
    const note = {
        id: Date.now(),
        title: sanitizedTitle,
        content: sanitizedContent,
        timestamp: new Date().toISOString()
    };
    
    notes.push(note);
    
    res.json({
        success: true,
        message: 'Note added successfully',
        note: note
    });
});

// DELETE: Remove Note
app.delete('/api/notes/:id', (req, res) => {
    const noteId = parseInt(req.params.id);
    const initialLength = notes.length;
    notes = notes.filter(note => note.id !== noteId);
    
    if (notes.length < initialLength) {
        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Note not found'
        });
    }
});

// ========== Feedback API ==========

// POST: Add Feedback - With input validation and XSS protection
app.post('/api/feedback', (req, res) => {
    const { name, message } = req.body;
    
    // Validate required fields
    if (!name || !message) {
        return res.status(400).json({
            success: false,
            message: 'Name and message are required'
        });
    }
    
    // Validate name length
    if (name.length > 50) {
        return res.status(400).json({
            success: false,
            message: 'Name must be 50 characters or less'
        });
    }
    
    // Validate message length
    if (message.length > 10000) {
        return res.status(400).json({
            success: false,
            message: 'Message must be 10000 characters or less'
        });
    }
    
    // Sanitize input to prevent XSS
    const sanitizedName = sanitizeHtml(name.trim());
    const sanitizedMessage = sanitizeHtml(message.trim());
    
    const feedbackItem = {
        id: Date.now(),
        name: sanitizedName,
        message: sanitizedMessage,
        timestamp: new Date().toISOString()
    };
    
    feedback.push(feedbackItem);
    
    res.json({
        success: true,
        message: 'Feedback received, thank you!',
        feedback: feedbackItem
    });
});

// GET: All Feedback (for reference)
app.get('/api/feedback', (req, res) => {
    res.json({
        feedback: feedback,
        count: feedback.length
    });
});

// ========== Server Initialization ==========
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Visitor counter loaded: ${visitCounter}`);
});
