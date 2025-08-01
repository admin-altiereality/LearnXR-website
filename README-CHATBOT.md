# LearnXR Lead Capture Chatbot

A professional, conversational lead capture chatbot integrated into your LearnXR website. The chatbot provides a smooth, guided experience for collecting visitor information and generating qualified leads.

## 🚀 Features

### Conversational Flow
- **Guided Experience**: Asks for name, organization, phone, email, subject, and message in a natural conversation
- **Personalized Responses**: Uses the user's name throughout the conversation
- **Smart Validation**: Real-time input validation with helpful error messages
- **Smooth Transitions**: Natural conversation flow with typing animations

### Professional UI
- **Purple Theme**: Matches your brand colors (#7E23CF)
- **Modern Design**: Clean, professional interface with smooth animations
- **Responsive**: Works perfectly on all devices (desktop, tablet, mobile)
- **Non-intrusive**: Overlay design that doesn't disrupt existing content

### Input Validation
- **Email Format**: Validates proper email format
- **Phone Numbers**: Accepts international phone number formats
- **Required Fields**: Ensures all necessary information is collected
- **Real-time Feedback**: Immediate validation feedback to users

### Email Integration
- **Formatted Emails**: Professional HTML email templates
- **Lead Tracking**: Marks submissions as chatbot leads
- **Owner Notifications**: Sends detailed lead information to you
- **User Confirmations**: Optional confirmation emails to users

### Error Handling
- **Graceful Errors**: User-friendly error messages
- **Retry Logic**: Automatic retry on network issues
- **Fallback Options**: Alternative contact methods if needed
- **Logging**: Comprehensive error logging for debugging

## 📋 Quick Setup

### 1. Files Added/Modified

**New Files:**
- `chatbot.js` - Main chatbot functionality
- `README-CHATBOT.md` - This documentation

**Modified Files:**
- `index.html` - Added chatbot HTML structure and ID to "REQUEST A QUOTE" button
- `style.css` - Added chatbot CSS styles
- `server.js` - Added `/api/send-quote-request` endpoint

### 2. Configuration

**Email Settings** (in your `.env` file):
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
OWNER_EMAIL=princisharma086@gmail.com
SEND_USER_CONFIRMATION=true
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in EMAIL_PASS

### 3. Testing

**Start the server:**
```bash
npm start
# or
node server.js
```

**Test the chatbot:**
1. Open your website
2. Click the chat button (bottom-right corner)
3. Or click "REQUEST A QUOTE" button
4. Follow the conversation flow
5. Submit the form
6. Check your email for the lead

## 🔧 Customization

### Conversation Flow
Edit the `conversationFlow` array in `chatbot.js`:

```javascript
this.conversationFlow = [
  {
    message: "Hi! 👋 I'm your LearnXR assistant...",
    field: 'name',
    validation: (value) => value.trim().length >= 2,
    errorMessage: "Please enter your name"
  },
  // Add more steps...
];
```

### Styling
Modify the CSS variables in `style.css`:

```css
.chatbot-toggle {
  background: linear-gradient(135deg, #7E23CF, #9c27b0);
  /* Your brand colors */
}
```

### Auto-trigger Timing
Change the auto-trigger delay in `chatbot.js`:

```javascript
setTimeout(() => {
  // Auto-trigger after 30 seconds
}, 30000);
```

## 📊 Analytics & Tracking

### Lead Sources
- Chatbot submissions are marked with `source: 'chatbot'`
- Separate from regular contact form submissions
- Track conversion rates and engagement

### Logging
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

## 🛠️ Troubleshooting

### Common Issues

**1. Emails not sending:**
- Check Gmail App Password setup
- Verify EMAIL_USER and EMAIL_PASS in .env
- Check server logs for error messages

**2. Chatbot not appearing:**
- Ensure chatbot.js is loaded
- Check browser console for JavaScript errors
- Verify CSS is properly loaded

**3. Form validation errors:**
- Check field requirements in chatbot.js
- Verify validation functions are working
- Test with different input formats

### Debug Mode
Add this to your browser console to debug:
```javascript
// Access chatbot instance
window.chatbot = new LearnXRChatbot();
console.log(window.chatbot);
```

## 📱 Mobile Optimization

The chatbot is fully responsive:
- **Mobile**: Full-width chat window
- **Tablet**: Optimized layout
- **Desktop**: Standard 350px width
- **Touch-friendly**: Large touch targets

## 🔒 Security Features

- **Input Sanitization**: Removes dangerous HTML/scripts
- **Rate Limiting**: Prevents spam submissions
- **Honeypot Protection**: Hidden field to catch bots
- **Validation**: Server-side and client-side validation
- **CORS Protection**: Proper CORS headers

## 📈 Performance

- **Lightweight**: Minimal impact on page load
- **Lazy Loading**: Chatbot loads after page is ready
- **Efficient**: No unnecessary API calls
- **Cached**: CSS and JS are cached by browser

## 🎯 Best Practices

### For Maximum Conversion:
1. **Auto-trigger**: Shows pulse animation after 30 seconds
2. **Clear CTA**: "REQUEST A QUOTE" button integration
3. **Progressive Disclosure**: Collects information step-by-step
4. **Social Proof**: Professional design builds trust
5. **Mobile-First**: Works great on all devices

### For User Experience:
1. **Non-intrusive**: Doesn't block content
2. **Easy to Close**: Clear close button
3. **Fast Response**: Quick validation and feedback
4. **Clear Instructions**: Step-by-step guidance
5. **Success Confirmation**: Clear success message

## 🔄 Updates & Maintenance

### Regular Tasks:
- Monitor email delivery rates
- Check contact-logs.json for errors
- Update conversation flow as needed
- Test on different devices/browsers

### Version History:
- **v1.0**: Initial release with full feature set
- Integrated with existing contact form backend
- Professional UI matching brand colors
- Complete validation and error handling

## 📞 Support

For technical support or customization requests:
- Check the troubleshooting section above
- Review server logs for error messages
- Test with different browsers/devices
- Contact your development team

---

**Ready to capture more leads with your new LearnXR chatbot! 🚀** 