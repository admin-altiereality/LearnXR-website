# Contact Form Email Integration Setup

This guide will help you set up the enhanced contact form with email functionality using Nodemailer and Express.

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Email Settings

Create a `.env` file in the root directory:
```bash
cp env.example .env
```

Edit `.env` with your Gmail credentials:
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
OWNER_EMAIL=princisharma086@gmail.com
PORT=3000
```

### 3. Generate Gmail App Password

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification
3. Click "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in your `.env` file (not your regular Gmail password)

### 4. Start the Server
```bash
npm start
```

The contact form will be available at `http://localhost:3000`

## 📧 Email Configuration

### Gmail Setup
- **Email User**: Your Gmail address
- **Email Pass**: Gmail app password (not regular password)
- **Owner Email**: Where contact form submissions will be sent

### Email Template Features
- Professional HTML email with your brand colors
- Includes all form fields (name, email, organization, message)
- Timestamp and IP address for security
- Reply-to set to sender's email for easy response

## 🔒 Security Features

- **Rate Limiting**: 5 submissions per 15 minutes per IP
- **Input Sanitization**: Removes potentially harmful characters
- **CSRF Protection**: Built-in Express security
- **Helmet**: Security headers for protection
- **Validation**: Server-side and client-side validation

## 📱 Form Features

### Validation Rules
- **First Name**: Required, minimum 2 characters
- **Last Name**: Required, minimum 2 characters  
- **Email**: Required, valid email format
- **Organization**: Optional
- **Message**: Required, 10-500 characters

### User Experience
- Real-time validation with error messages
- Character counter for message field
- Loading states during submission
- Success/error message display
- Form reset after successful submission
- Auto-focus on first error field

## 🛠️ Development

### Start Development Server
```bash
npm run server
```

### Health Check
Visit `http://localhost:3000/health` to check server status

### Logs
Server logs will show:
- Successful email submissions
- Validation errors
- Server errors

## 📁 File Structure

```
LearnXR-website/
├── index.html          # Enhanced contact form
├── contact-form.js     # Form validation & AJAX
├── server.js           # Express + Nodemailer server
├── package.json        # Dependencies
├── env.example         # Environment template
└── README-CONTACT-FORM.md
```

## 🚨 Troubleshooting

### Common Issues

1. **Email not sending**
   - Check Gmail app password is correct
   - Ensure 2-factor authentication is enabled
   - Verify `.env` file is in root directory

2. **Form validation errors**
   - Check browser console for JavaScript errors
   - Verify all required fields are filled
   - Ensure message is 10-500 characters

3. **Server won't start**
   - Check if port 3000 is available
   - Verify all dependencies are installed
   - Check `.env` file syntax

### Debug Mode
Add to `.env`:
```env
NODE_ENV=development
DEBUG=*
```

## 📊 Testing

### Test the Form
1. Fill out all required fields
2. Submit the form
3. Check your email (princisharma086@gmail.com)
4. Verify email content and formatting

### Test Validation
1. Try submitting with empty required fields
2. Test invalid email formats
3. Test message length limits
4. Verify error messages display correctly

## 🔧 Customization

### Email Template
Edit the `createEmailTemplate()` function in `server.js` to customize email appearance.

### Validation Rules
Modify the `validateFormData()` function in `server.js` to change validation requirements.

### Rate Limiting
Adjust the rate limiter settings in `server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // requests per windowMs
});
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify all configuration steps are completed

## ✅ Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with Gmail credentials
- [ ] Gmail app password generated
- [ ] Server starts without errors (`npm start`)
- [ ] Contact form accessible at `http://localhost:3000`
- [ ] Form submission sends email successfully
- [ ] Validation works for all fields
- [ ] Error handling displays appropriate messages 