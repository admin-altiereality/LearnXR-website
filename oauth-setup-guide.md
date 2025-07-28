# OAuth Setup Guide for LearnXR Authentication System

This guide will help you set up Google and GitHub OAuth applications for the LearnXR authentication system.

## Prerequisites

- A Google account (for Google OAuth)
- A GitHub account (for GitHub OAuth)
- Access to your website's domain

## Google OAuth Setup

### Step 1: Create Google OAuth Application

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth 2.0 Client IDs"
6. Choose "Web application" as the application type

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "LearnXR"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (optional for development)

### Step 3: Configure OAuth Client

1. In the OAuth 2.0 Client ID creation:
   - Name: "LearnXR Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3000
     https://yourdomain.com
     ```

### Step 4: Get Your Client ID

1. After creating the OAuth client, copy the Client ID
2. Update the `auth-system.js` file:
   ```javascript
   google: {
       clientId: 'YOUR_ACTUAL_GOOGLE_CLIENT_ID_HERE',
       scope: 'openid email profile'
   }
   ```

## GitHub OAuth Setup

### Step 1: Create GitHub OAuth Application

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: "LearnXR"
   - Homepage URL: `https://yourdomain.com`
   - Application description: "LearnXR Authentication System"
   - Authorization callback URL: `https://yourdomain.com/auth/github/callback`

### Step 2: Get Your Client ID and Secret

1. After creating the OAuth app, you'll get a Client ID and Client Secret
2. Update the `auth-system.js` file:
   ```javascript
   github: {
       clientId: 'YOUR_ACTUAL_GITHUB_CLIENT_ID_HERE',
       scope: 'read:user user:email'
   }
   ```

## Backend Setup (Required for Production)

For production use, you'll need a backend server to handle the OAuth flow securely. Here's a basic Express.js example:

### Install Dependencies

```bash
npm install express cors axios
```

### Create Backend Server

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// GitHub OAuth endpoints
app.post('/auth/github/token', async (req, res) => {
    try {
        const { code } = req.body;
        
        const response = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const { access_token } = response.data;
        
        // Get user data
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${access_token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        res.json({
            user: userResponse.data,
            access_token
        });
    } catch (error) {
        res.status(500).json({ error: 'Authentication failed' });
    }
});

app.listen(3001, () => {
    console.log('Auth server running on port 3001');
});
```

### Update Frontend for Backend Integration

Update the `fetchGitHubUser` method in `auth-system.js`:

```javascript
async fetchGitHubUser(code) {
    const response = await fetch('/auth/github/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
        throw new Error('Failed to authenticate with GitHub');
    }
    
    const data = await response.json();
    
    return {
        id: data.user.id.toString(),
        name: data.user.name || data.user.login,
        email: data.user.email,
        avatar: data.user.avatar_url,
        provider: 'github',
        accessToken: data.access_token
    };
}
```

## Environment Variables

Create a `.env` file for your backend:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
```

## Security Considerations

1. **Never expose client secrets in frontend code**
2. **Use HTTPS in production**
3. **Implement proper session management**
4. **Add rate limiting to prevent abuse**
5. **Validate tokens on the backend**
6. **Use secure cookie storage for sessions**

## Testing

1. **Local Development**: Use `http://localhost:3000` in OAuth app settings
2. **Production**: Use your actual domain in OAuth app settings
3. **Test both Google and GitHub authentication flows**
4. **Verify user data is correctly stored and displayed**
5. **Test sign-out functionality**

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**: Make sure the redirect URI in your OAuth app matches exactly
2. **"Client ID not found"**: Verify the client ID is correctly copied
3. **"Scope not allowed"**: Check that the requested scopes are enabled in your OAuth app
4. **CORS errors**: Ensure your backend has proper CORS configuration

### Debug Mode

Enable debug logging by adding this to your browser console:

```javascript
localStorage.setItem('debug_auth', 'true');
```

## Production Deployment

1. **Update OAuth app settings** with your production domain
2. **Deploy backend server** with proper environment variables
3. **Update frontend configuration** to point to your backend
4. **Test authentication flow** in production environment
5. **Monitor authentication logs** for any issues

## Support

For issues with:
- **Google OAuth**: Check [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- **GitHub OAuth**: Check [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- **LearnXR Integration**: Check the browser console for error messages 