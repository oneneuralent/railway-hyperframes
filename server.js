const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 8000;

// Local hyperframes binary — installed in the container by npm install
const HF_BIN = path.resolve('/app/node_modules/.bin/hyperframes');

// Railway containers run as root / no-sandbox.
// Pass these through to every exec so Chrome headless can start.
const EXEC_ENV = {
  ...process.env,
  PUPPETEER_ARGS: '--no-sandbox --disable-setuid-sandbox',
};

// multer: store uploaded HTML in memory (no temp files to clean up)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Ensure base directories exist
async function ensureDirs() {
  await fs.mkdir('./projects', { recursive: true });
}
ensureDirs();

app.use(express.json({ limit: '10mb' }));

// ── Health check — actually verify the binary is present ────────────────────
app.get('/health', async (req, res) => {
  try {
    await fs.access(HF_BIN);
    res.json({ status: 'ok', binary: HF_BIN, node: process.version });
  } catch {
    res.status(500).json({ status: 'error', error: `hyperframes binary not found at ${HF_BIN}` });
  }
});

// ── Create project — just a directory, no CLI init needed ───────────────────
app.post('/api/project', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const projectPath = path.resolve('./projects', name);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'renders'), { recursive: true });

    res.json({ success: true, project: name });
  } catch (error) {
    console.error('Project creation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Upload composition HTML ──────────────────────────────────────────────────
app.post('/api/composition/:project', upload.single('html'), async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = path.resolve('./projects', project);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'renders'), { recursive: true });

    let htmlContent = null;
    if (req.file) {
      htmlContent = req.file.buffer.toString('utf-8');
    } else if (req.body.html) {
      htmlContent = req.body.html;
    }

    if (!htmlContent) return res.status(400).json({ error: 'html content is required (multipart field "html" or JSON body.html)' });

    await fs.writeFile(path.join(projectPath, 'index.html'), htmlContent, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Lint composition ─────────────────────────────────────────────────────────
app.post('/api/lint/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = path.resolve('./projects', project);
    const htmlFile = path.join(projectPath, 'index.html');

    await fs.access(htmlFile);

    const { stdout, stderr } = await execAsync(
      `${HF_BIN} lint index.html`,
      { cwd: projectPath, env: EXEC_ENV, timeout: 30000 }
    );

    res.json({ success: true, output: stdout, warnings: stderr });
  } catch (error) {
    res.json({ success: false, output: error.stdout || '', errors: error.stderr || error.message });
  }
});

// ── Render composition ───────────────────────────────────────────────────────
app.post('/api/render/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const { quality = 'draft', width, height, fps } = req.body;

    const projectPath = path.resolve('./projects', project);
    const rendersDir = path.join(projectPath, 'renders');
    const outputFile = path.join(rendersDir, `${project}.mp4`);

    // Ensure renders subdirectory exists
    await fs.mkdir(rendersDir, { recursive: true });

    // Build CLI command — input is index.html, output is renders/{project}.mp4
    let cmd = `${HF_BIN} render index.html --quality ${quality} --output renders/${project}.mp4`;
    if (width)  cmd += ` --width ${width}`;
    if (height) cmd += ` --height ${height}`;
    if (fps)    cmd += ` --fps ${fps}`;

    const renderTimeout = quality === 'draft' ? 120000 : 300000;

    console.log(`[render] cmd: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectPath,
      env: EXEC_ENV,
      timeout: renderTimeout,
    });

    // Verify output file was produced
    await fs.access(outputFile);

    res.json({
      success: true,
      output: stdout,
      download_url: `/api/download/${project}`,
      videoUrl: `/api/download/${project}`,
    });
  } catch (error) {
    console.error('Render error:', error.message);
    console.error('stdout:', error.stdout || '(none)');
    console.error('stderr:', error.stderr || '(none)');
    res.status(500).json({
      error: error.message,
      output: error.stdout || '',
      errors: error.stderr || '',
    });
  }
});

// ── Download rendered video ──────────────────────────────────────────────────
app.get('/api/download/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const outputPath = path.resolve('./projects', project, 'renders', `${project}.mp4`);

    await fs.access(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${project}.mp4"`);
    res.download(outputPath);
  } catch {
    res.status(404).json({ error: 'Video not found — render may still be in progress or failed' });
  }
});

// ── Delete project ───────────────────────────────────────────────────────────
app.delete('/api/project/:project', async (req, res) => {
  try {
    const { project } = req.params;
    await fs.rm(path.resolve('./projects', project), { recursive: true, force: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HyperFrames rendering API on port ${PORT} | binary: ${HF_BIN}`);
});
