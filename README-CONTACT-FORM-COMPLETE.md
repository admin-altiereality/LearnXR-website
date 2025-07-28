# Complete Contact Form with Backend Email Integration

This is a production-ready contact form implementation with comprehensive backend functionality, security features, and enhanced user experience.

## 🚀 Features

### Backend Features
- ✅ **Node.js/Express server** with proper middleware
- ✅ **Nodemailer integration** with Gmail SMTP
- ✅ **Input validation & sanitization** (server-side and client-side)
- ✅ **Rate limiting** (5 submissions per IP per hour)
- ✅ **Security measures** (CORS, Helmet, CSRF protection)
- ✅ **Professional email templates** (HTML + text)
- ✅ **User confirmation emails** (optional)
- ✅ **Comprehensive logging** (JSON file)
- ✅ **Error handling & logging**
- ✅ **Health check endpoint**

### Frontend Features
- ✅ **Real-time validation** for all fields
- ✅ **Enhanced form fields** (phone, subject dropdown)
- ✅ **Character counter** for message field
- ✅ **Loading states** during submission
- ✅ **Success/error messages** with smooth animations
- ✅ **Form reset** after successful submission
- ✅ **Responsive design** (mobile-first)
- ✅ **Accessibility features**
- ✅ **Honeypot spam protection**

### Security Features
- ✅ **Rate limiting** (5 submissions per hour per IP)
- ✅ **Input sanitization** (XSS protection)
- ✅ **Honeypot field** for spam detection
- ✅ **CORS configuration**
- ✅ **Helmet security headers**
- ✅ **Environment variables** for sensitive data

## 📁 File Structure

```
LearnXR-website/
├── index.html              # Enhanced contact form
├── contact-form.js         # Frontend validation & AJAX
├── server.js               # Express + Nodemailer server
├── package.json            # Dependencies
├── env.example             # Environment template
├── contact-logs.json       # Submission logs (auto-generated)
├── style.css               # Global styles
└── README-CONTACT-FORM-COMPLETE.md
```

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file from the template:
```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
OWNER_EMAIL=princisharma086@gmail.com

# Server Configuration
PORT=3000

# Optional Features
SEND_USER_CONFIRMATION=false

# Security
NODE_ENV=production
```

### 3. Generate Gmail App Password

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification
3. Click "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in your `.env` file (not your regular password)

### 4. Start the Server
```bash
npm start
```

The contact form will be available at `http://localhost:3000`

## 📧 Email Configuration

### Email Templates
- **Owner Email**: Professional HTML template with all form data
- **User Confirmation**: Optional thank you email to users
- **Features**: Responsive design, proper formatting, security info

### Email Content
- ✅ **All form fields** (name, email, organization, phone, subject, message)
- ✅ **Timestamp & IP address** for security
- ✅ **User agent** information
- ✅ **Professional styling** with brand colors
- ✅ **Reply-to** set to sender's email

## 🔒 Security Features

### Rate Limiting
- **5 submissions per hour** per IP address
- **Automatic blocking** of excessive requests
- **Clear error messages** with retry information

### Input Validation
- **Server-side validation** for all fields
- **Client-side validation** for real-time feedback
- **Input sanitization** to prevent XSS attacks
- **Honeypot field** for spam protection

### Security Headers
- **Helmet.js** for security headers
- **CORS configuration** for cross-origin requests
- **Content Security Policy** (CSP)

## 📱 Form Features

### Validation Rules
- **First Name**: Required, minimum 2 characters
- **Last Name**: Required, minimum 2 characters
- **Email**: Required, valid email format
- **Organization**: Optional
- **Phone**: Optional, valid phone format
- **Subject**: Required, dropdown selection
- **Message**: Required, 10-500 characters

### User Experience
- ✅ **Real-time validation** with error messages
- ✅ **Character counter** for message field
- ✅ **Loading spinner** during submission
- ✅ **Success/error messages** with smooth animations
- ✅ **Form reset** after successful submission
- ✅ **Auto-focus** on first error field
- ✅ **Touch-friendly** design for mobile

## 🛠️ Development

### Start Development Server
```bash
npm run server
```

### Health Check
Visit `http://localhost:3000/health` to check server status

### Logs
- **Console logs**: Real-time server activity
- **contact-logs.json**: All form submissions (success/failure)
- **Email delivery**: Automatic logging of sent emails

## 📊 Testing

### Test the Form
1. Fill out all required fields
2. Submit the form
3. Check your email (princisharma086@gmail.com)
4. Verify email content and formatting

### Test Validation
1. Try submitting with empty required fields
2. Test invalid email formats
3. Test phone number validation
4. Test message length limits
5. Verify error messages display correctly

### Test Security
1. Try rapid submissions (rate limiting)
2. Test honeypot field (should be empty)
3. Verify input sanitization

## 🔧 Customization

### Email Templates
Edit the `createOwnerEmailTemplate()` and `createUserConfirmationTemplate()` functions in `server.js`

### Validation Rules
Modify the `validateFormData()` function in `server.js`

### Rate Limiting
Adjust the rate limiter settings in `server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5 // requests per hour
});
```

### Form Fields
Add new fields in `index.html` and update validation in `contact-form.js`

## 🚨 Troubleshooting

### Common Issues

1. **Email not sending**
   - Check Gmail app password is correct
   - Ensure 2-factor authentication is enabled
   - Verify `.env` file is in root directory
   - Check server logs for error messages

2. **Form validation errors**
   - Check browser console for JavaScript errors
   - Verify all required fields are filled
   - Ensure message is 10-500 characters
   - Check phone number format

3. **Server won't start**
   - Check if port 3000 is available
   - Verify all dependencies are installed
   - Check `.env` file syntax
   - Ensure Node.js version is 14+

4. **Rate limiting issues**
   - Wait 1 hour between submissions from same IP
   - Check server logs for rate limit messages
   - Verify IP address detection

### Debug Mode
Add to `.env`:
```env
NODE_ENV=development
DEBUG=*
```

## 📈 Monitoring

### Log Files
- **contact-logs.json**: All form submissions
- **Console logs**: Real-time server activity
- **Email delivery**: Automatic logging

### Health Check
- **Endpoint**: `GET /health`
- **Response**: Server status, email configuration, timestamp

## 🔄 API Endpoints

### POST /send-message
**Purpose**: Handle form submissions

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "organization": "ABC School",
  "phone": "+1234567890",
  "subject": "General Inquiry",
  "message": "Hello, I'm interested in your services.",
  "honeypot": ""
}
```

**Response**:
```json
{
  "success": true,
  "message": "Message sent successfully! We will get back to you soon."
}
```

### GET /health
**Purpose**: Server health check

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "emailConfigured": true
}
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify all configuration steps are completed
4. Test with the health check endpoint

## ✅ Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with Gmail credentials
- [ ] Gmail app password generated
- [ ] Server starts without errors (`npm start`)
- [ ] Contact form accessible at `http://localhost:3000`
- [ ] Form submission sends email successfully
- [ ] Validation works for all fields
- [ ] Rate limiting functions correctly
- [ ] Error handling displays appropriate messages
- [ ] Logs are being generated
- [ ] Health check endpoint responds correctly

## 🚀 Production Deployment

### Environment Variables
Ensure all environment variables are set in production:
- `EMAIL_USER`
- `EMAIL_PASS`
- `OWNER_EMAIL`
- `PORT`
- `NODE_ENV=production`

### Security Checklist
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] Log files protected
- [ ] Error messages sanitized

### Performance
- [ ] Static files served efficiently
- [ ] Email sending optimized
- [ ] Log rotation configured
- [ ] Monitoring in place

The contact form is now production-ready with comprehensive backend functionality, security features, and excellent user experience! 