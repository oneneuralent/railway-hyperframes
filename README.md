# HyperFrames Rendering Service on Railway

This is a Railway service that provides an HTTP API for HyperFrames video rendering.

## Deployment Instructions

### Option 1: Deploy from GitHub (Recommended)

1. **Push this directory to a GitHub repository**
   ```bash
   cd railway-hyperframes
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/railway-hyperframes.git
   git push -u origin main
   ```

2. **Create Railway service from GitHub**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository
   - Railway will automatically detect the Dockerfile and build it

### Option 2: Deploy from Local Directory

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize and deploy**
   ```bash
   cd railway-hyperframes
   railway init
   railway up
   ```

### Option 3: Use Docker Image Directly

If you want to use a pre-built Docker image:

1. **Build and push to a registry** (Docker Hub, GitHub Container Registry, etc.)
   ```bash
   docker build -t your-username/hyperframes-renderer:latest .
   docker push your-username/hyperframes-renderer:latest
   ```

2. **In Railway dashboard**
   - Click "New Project" → "New Service"
   - Select "Docker Image"
   - Enter: `your-username/hyperframes-renderer:latest`

## API Endpoints

### Health Check
```
GET /health
```

### Create Project
```
POST /api/project
Body: { "name": "my-video" }
```

### Upload Composition
```
POST /api/composition/:project
Content-Type: multipart/form-data
Body: html file or { "html": "<html>..." }
```

### Upload Asset
```
POST /api/asset/:project
Content-Type: multipart/form-data
Body: asset file
```

### Lint Composition
```
POST /api/lint/:project
```

### Render Video
```
POST /api/render/:project
Body: { "quality": "standard" } // draft, standard, high
```

### Download Video
```
GET /api/download/:project
```

### Delete Project
```
DELETE /api/project/:project
```

## Environment Variables

Railway will automatically set:
- `PORT` - Railway assigns this automatically

## Storage

This service uses local filesystem storage. For production:
- Consider using Railway Volumes for persistent storage
- Or integrate with S3/R2 for asset storage
