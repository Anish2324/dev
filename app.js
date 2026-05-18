const express = require('express');
const path = require('path');

const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// API Endpoints
app.get('/api/status', (req, res) => {
    res.json({ status: 'running' });
});

app.get('/api/health', (req, res) => {
    res.send('Application Healthy');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});