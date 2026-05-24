const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 8000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Ensure directories exist
async function ensureDirs() {
  await fs.mkdir('./uploads', { recursive: true });
  await fs.mkdir('./projects', { recursive: true });
  await fs.mkdir('./renders', { recursive: true });
}
ensureDirs();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: true, chrome: true });
});

// Create new project
app.post('/api/project', async (req, res) => {
  try {
    const { name } = req.body;
    const projectPath = path.join('./projects', name);
    
    await fs.mkdir(projectPath, { recursive: true });
    
    // Initialize HyperFrames project
    await execAsync(`npx hyperframes init ${name} --non-interactive`, {
      cwd: './projects'
    });
    
    res.json({ success: true, project: name });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload composition HTML
app.post('/api/composition/:project', upload.single('html'), async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = path.join('./projects', project);
    
    if (req.file) {
      await fs.copyFile(req.file.path, path.join(projectPath, 'index.html'));
      await fs.unlink(req.file.path);
    } else if (req.body.html) {
      await fs.writeFile(path.join(projectPath, 'index.html'), req.body.html);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload asset file
app.post('/api/asset/:project', upload.single('asset'), async (req, res) => {
  try {
    const { project } = req.params;
    const assetsPath = path.join('./projects', project, 'assets');
    await fs.mkdir(assetsPath, { recursive: true });
    
    if (req.file) {
      const destPath = path.join(assetsPath, req.file.originalname);
      await fs.copyFile(req.file.path, destPath);
      await fs.unlink(req.file.path);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lint composition
app.post('/api/lint/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = path.join('./projects', project);
    
    const { stdout, stderr } = await execAsync('npx hyperframes lint', {
      cwd: projectPath
    });
    
    res.json({ success: true, output: stdout, errors: stderr });
  } catch (error) {
    res.json({ success: false, output: error.stdout || '', errors: error.stderr || error.message });
  }
});

// Render composition
app.post('/api/render/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const { quality = 'standard' } = req.body;
    const projectPath = path.join('./projects', project);
    
    // Use local hyperframes binary (installed in container, not via npx)
    const HYPERFRAMES_BIN = path.resolve('/app/node_modules/.bin/hyperframes');
    const renderCmd = `${HYPERFRAMES_BIN} render --quality ${quality} --output renders/${project}.mp4`;

    const { stdout, stderr } = await execAsync(renderCmd, {
      cwd: projectPath,
      timeout: 300000 // 5 minute timeout
    });
    
    // Check if output file exists
    const outputPath = path.join(projectPath, 'renders', `${project}.mp4`);
    const exists = await fs.access(outputPath).then(() => true).catch(() => false);
    
    if (exists) {
      res.json({ 
        success: true, 
        output: stdout,
        videoUrl: `/api/download/${project}`
      });
    } else {
      res.status(500).json({ error: 'Render failed - no output file', output: stdout, errors: stderr });
    }
  } catch (error) {
    console.error('Render error:', error.message);
    console.error('Render stdout:', error.stdout || '(none)');
    console.error('Render stderr:', error.stderr || '(none)');
    res.status(500).json({ error: error.message, output: error.stdout || '', errors: error.stderr || '' });
  }
});

// Download rendered video
app.get('/api/download/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const outputPath = path.join('./projects', project, 'renders', `${project}.mp4`);
    
    await fs.access(outputPath);
    res.download(outputPath);
  } catch (error) {
    res.status(404).json({ error: 'Video not found' });
  }
});

// Delete project
app.delete('/api/project/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const projectPath = path.join('./projects', project);
    
    await fs.rm(projectPath, { recursive: true, force: true });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`HyperFrames rendering API running on port ${PORT}`);
});
