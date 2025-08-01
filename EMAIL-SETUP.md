# Email Setup for LearnXR Chatbot

## ✅ Current Email Configuration

The chatbot is already configured to send emails to the website owner when users click "Send Request". Here's how it works:

### Email Flow:
1. **User completes chatbot conversation**
2. **User clicks "Send Request" button**
3. **Data is sent to website owner's email** ✅
4. **Professional HTML email is delivered** ✅

### Email Details:
- **To:** `info.altiereality@gmail.com` (default)
- **Subject:** "New Chatbot Lead - [User Name]"
- **Content:** All user details in professional HTML format
- **Reply-To:** User's email address

## 🔧 Email Configuration

### 1. Environment Variables (.env file)
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
OWNER_EMAIL=princisharma086@gmail.com
SEND_USER_CONFIRMATION=true
```

### 2. Gmail Setup (Required)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password:**
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Use the App Password** in EMAIL_PASS

### 3. Test the Email System
```bash
# Start the server
cd LearnXR-website
node server.js

# Test the health endpoint
curl http://localhost:3000/health
```

## 📧 Email Template

The chatbot sends a professional HTML email with:

### Email Content:
- **User's Name:** First and Last name
- **Email:** User's email address
- **Organization:** School/organization (if provided)
- **Phone:** Contact number
- **Subject:** What they need help with
- **Message:** Detailed inquiry
- **Source:** Marked as "Chatbot"
- **Timestamp:** When submitted
- **IP Address:** For security

### Email Format:
```html
Subject: New Chatbot Lead - John Doe

Name: John Doe
Email: john@example.com
Organization: ABC School
Phone: +1234567890
Subject: VR Education Solutions
Message: I'm interested in implementing VR in our school...

Submitted via: Chatbot
Submitted on: 2024-01-15 10:30:00
IP Address: 192.168.1.1
```

## 🚀 How to Test

1. **Start the server:**
   ```bash
   cd LearnXR-website
   node server.js
   ```

2. **Open your website:**
   - Go to `http://localhost:3000`

3. **Test the chatbot:**
   - Click the chat button or "REQUEST A QUOTE"
   - Complete the conversation
   - Click "Send Request"

4. **Check your email:**
   - Look for email from `your-gmail@gmail.com`
   - Subject: "New Chatbot Lead - [Name]"

## 🔍 Troubleshooting

### If emails aren't sending:

1. **Check Gmail settings:**
   - 2FA enabled ✅
   - App password generated ✅
   - Less secure apps disabled ✅

2. **Verify .env file:**
   ```env
   EMAIL_USER=your-actual-gmail@gmail.com
   EMAIL_PASS=your-16-digit-app-password
   OWNER_EMAIL=princisharma086@gmail.com
   ```

3. **Check server logs:**
   ```bash
   node server.js
   # Look for "Email server is ready" message
   ```

4. **Test with curl:**
   ```bash
   curl -X POST http://localhost:3000/api/send-quote-request \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Test",
       "lastName": "User",
       "email": "test@example.com",
       "phone": "1234567890",
       "subject": "Test",
       "message": "Test message"
     }'
   ```

## 📊 Email Logging

All submissions are logged to `contact-logs.json`:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "source": "chatbot"
  }
}
```

## ✅ Success Indicators

When working correctly, you'll see:
- ✅ "Email server is ready to send messages" in console
- ✅ "Chatbot lead sent successfully" message
- ✅ Email received in `princisharma086@gmail.com`
- ✅ Professional HTML email formatting
- ✅ All user details included

---

**Your chatbot is ready to capture leads and send them directly to your email! 🚀** 