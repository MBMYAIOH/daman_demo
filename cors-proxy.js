require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multer = require('multer');
const path = require('path');

const app = express();

// ---------------------------------------------------------------------------
// Configuration (see .env.example)
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3002;

// Where claim documents are sent. The browser never chooses this in production.
// Deliberately has no default: the webhook URL is a credential, so it comes from
// the environment (.env locally, the dashboard on Render) and is never committed.
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!N8N_WEBHOOK_URL) {
    console.error('N8N_WEBHOOK_URL is not set.');
    console.error('  Local:  copy .env.example to .env and fill it in');
    console.error('  Render: set it under Environment in the service dashboard');
    process.exit(1);
}

// Hosts this proxy is allowed to forward to. Defaults to the webhook's own host,
// which is what stops the deployed proxy being used as an open relay to anywhere.
const ALLOWED_HOSTS = (process.env.ALLOWED_WEBHOOK_HOSTS || new URL(N8N_WEBHOOK_URL).host)
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

// Browser origins allowed to call the proxy cross-origin. Same-origin deployments
// (page and proxy on one host) do not need this at all.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);
const MAX_FILES = Number(process.env.MAX_FILES || 5);

const upload = multer({
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES }
});

/**
 * Returns the URL if it is an http(s) URL pointing at an allowed host,
 * otherwise null. Everything the browser supplies goes through here.
 */
function validateDestination(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch (err) {
        return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return null;
    }
    if (!ALLOWED_HOSTS.includes(parsed.host.toLowerCase())) {
        return null;
    }
    return parsed.toString();
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS
}));
app.use(express.json({ limit: '50mb' }));

// Only ever serve public/ - never the repository root, which holds the proxy
// source, dependency manifests and the sample scan fixture.
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// File upload proxy endpoint (claim documents -> n8n)
app.post('/upload', upload.any(), async (req, res) => {
    try {
        // The destination is a server-side decision. A client-supplied override is
        // honoured only when it points at an allowed host.
        let webhookUrl = N8N_WEBHOOK_URL;
        if (req.body.webhookUrl && req.body.webhookUrl !== N8N_WEBHOOK_URL) {
            const validated = validateDestination(req.body.webhookUrl);
            if (!validated) {
                console.warn('Rejected upload to disallowed host:', req.body.webhookUrl);
                return res.status(400).json({
                    success: false,
                    error: 'Requested webhook host is not allowed'
                });
            }
            webhookUrl = validated;
        }

        console.log('Proxying file upload to:', new URL(webhookUrl).host);
        console.log('Files received:', req.files?.length || 0);

        const formData = new FormData();

        if (req.files) {
            req.files.forEach(file => {
                formData.append('file', file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype
                });
            });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const result = await response.json().catch(() => ({}));

        console.log('n8n upload response status:', response.status);

        res.status(response.status).json(result);

    } catch (error) {
        console.error('Upload proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Resume workflow proxy endpoint
app.post('/resume', async (req, res) => {
    try {
        const { resumeUrl, data } = req.body;

        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl is required' });
        }

        // n8n hands the resume URL to the browser, so it arrives here as untrusted
        // input and has to be checked against the same allowlist.
        const validatedUrl = validateDestination(resumeUrl);
        if (!validatedUrl) {
            console.warn('Rejected resume to disallowed host:', resumeUrl);
            return res.status(400).json({ error: 'Requested resume host is not allowed' });
        }

        console.log('Proxying request to:', new URL(validatedUrl).host);

        const response = await fetch(validatedUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json().catch(() => ({}));

        console.log('n8n response status:', response.status);

        // Return n8n response directly (same as /upload endpoint for consistency)
        res.status(response.status).json(result);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'daman-claims-proxy', message: 'CORS proxy is running' });
});

// Multer rejects oversized uploads before the route runs, so translate that into
// the same JSON shape the interface already handles.
app.use((error, req, res, next) => {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            error: `Each file must be ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB or smaller`
        });
    }
    if (error && error.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
            success: false,
            error: `A maximum of ${MAX_FILES} files can be uploaded at once`
        });
    }
    if (error) {
        console.error('Unhandled proxy error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
    return next();
});

app.listen(PORT, () => {
    console.log(`Daman claims proxy running on port ${PORT}`);
    console.log(`Interface:        http://localhost:${PORT}/`);
    console.log(`Upload endpoint:  POST /upload`);
    console.log(`Resume endpoint:  POST /resume`);
    console.log(`Forwarding to:    ${new URL(N8N_WEBHOOK_URL).host}`);
    console.log(`Allowed hosts:    ${ALLOWED_HOSTS.join(', ')}`);
});
