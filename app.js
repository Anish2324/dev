const express = require('express');
const path = require('path');
const os = require('os');

const app = express();

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

app.use(express.static('public'));

// ========== In-Memory Data Storage ==========
let visitCounter = 0;
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

// Frontend - Home Page
app.get('/', (req, res) => {
    visitCounter++;
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== Health & Status APIs ==========

// API: Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// API: Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        deployment: 'successful'
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

// API: Pipeline Status
app.get('/api/pipeline', (req, res) => {
    res.json({
        jenkins: 'success',
        sonar: 'passed',
        trivy: 'passed',
        docker: 'built',
        deployment: 'active'
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

// POST: Add Note
app.post('/api/notes', (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Title and content are required'
        });
    }
    
    const note = {
        id: Date.now(),
        title: title,
        content: content,
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

// POST: Add Feedback
app.post('/api/feedback', (req, res) => {
    const { name, message } = req.body;
    
    if (!name || !message) {
        return res.status(400).json({
            success: false,
            message: 'Name and message are required'
        });
    }
    
    const feedbackItem = {
        id: Date.now(),
        name: name,
        message: message,
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Started at: ${new Date().toISOString()}`);
});