# Deployment Guide

## Overview
This guide covers deploying the In3D Neural Website project to various platforms.

## GitHub Deployment

### Prerequisites
- Git configured with your GitHub credentials
- All environment variables properly set up

### Steps for GitHub Deployment

1. **Prepare for Deployment**
   ```bash
   # Check current status
   git status
   
   # Ensure no sensitive files are being committed
   git diff --cached
   ```

2. **Add and Commit Changes**
   ```bash
   # Add safe files (avoid .env files)
   git add .
   
   # Commit with descriptive message
   git commit -m "feat: Your feature description"
   ```

3. **Push to GitHub**
   ```bash
   git push origin main
   ```

### Environment Variables Setup

#### For Local Development
1. Copy template files:
   ```bash
   cp server/.env.template server/.env
   cp server/client/.env.template server/client/.env
   ```

2. Fill in your actual values in the `.env` files

#### For Production Deployment
Set environment variables in your hosting platform:
- **Vercel**: Use the Vercel dashboard
- **Netlify**: Use the Netlify dashboard
- **Railway**: Use Railway's environment variables section

### Required Environment Variables

#### Server (.env)
```
API_KEY=your_meshy_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
SERVER_PORT=5002
NODE_ENV=production
```

#### Client (.env)
```
VITE_API_URL=your_api_url
VITE_MESHY_API_KEY=your_meshy_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Platform-Specific Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Netlify Deployment
1. Connect your GitHub repository to Netlify
2. Set build command: `cd server/client && npm run build`
3. Set publish directory: `server/client/dist`
4. Set environment variables in Netlify dashboard

### Railway Deployment
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Railway will automatically detect and deploy your Node.js app

## Security Best Practices

1. **Never commit .env files** - They contain sensitive information
2. **Use environment templates** - Include `.env.template` files with placeholder values
3. **Rotate API keys regularly** - Keep your API keys secure and up-to-date
4. **Use different keys for development and production** - Never use production keys in development

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   - Check that all required environment variables are set
   - Use the ConfigurationDiagnostic component to verify setup

2. **Build Failures**
   - Ensure all dependencies are installed
   - Check for TypeScript errors
   - Verify Node.js version compatibility

3. **API Connection Issues**
   - Verify API endpoints are correct
   - Check CORS configuration
   - Ensure API keys are valid

### Debug Commands
```bash
# Check environment setup
cd server/client && npm run setup-env

# Test API connection
curl http://localhost:5002/health

# Check build process
cd server/client && npm run build
```

## Continuous Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml` for automated deployment:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Monitoring and Maintenance

1. **Regular Updates**
   - Keep dependencies updated
   - Monitor for security vulnerabilities
   - Update API keys as needed

2. **Performance Monitoring**
   - Monitor API response times
   - Check for memory leaks
   - Optimize build sizes

3. **Backup Strategy**
   - Regular database backups
   - Configuration backups
   - Code repository backups 