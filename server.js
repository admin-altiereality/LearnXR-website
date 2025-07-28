import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for form submissions
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: {
    error: 'Too many form submissions from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/send-message', limiter);

// Serve static files
app.use(express.static(path.join(__dirname)));


// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  secure: true,
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify(function (error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email template functions
function createOwnerEmailTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Contact Form Submission</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 8px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #7E23CF, #3b82f6); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: white; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #7E23CF; display: inline-block; width: 120px; }
        .value { color: #333; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .highlight { background: #fff3cd; padding: 10px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 15px 0; }
        .message-box { background: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid #e9ecef; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">You have received a new inquiry through your website</p>
        </div>
        <div class="content">
          <div class="field">
            <span class="label">Name:</span>
            <span class="value">${data.firstName} ${data.lastName}</span>
          </div>
          <div class="field">
            <span class="label">Email:</span>
            <span class="value">${data.email}</span>
          </div>
          <div class="field">
            <span class="label">Organization:</span>
            <span class="value">${data.organization || 'Not specified'}</span>
          </div>
          <div class="field">
            <span class="label">Phone:</span>
            <span class="value">${data.phone || 'Not provided'}</span>
          </div>
          <div class="field">
            <span class="label">Subject:</span>
            <span class="value">${data.subject || 'General Inquiry'}</span>
          </div>
          <div class="field">
            <span class="label">Message:</span>
          </div>
          <div class="message-box">
            ${data.message.replace(/\n/g, '<br>')}
          </div>
          <div class="highlight">
            <strong>Submitted on:</strong> ${new Date().toLocaleString()}<br>
            <strong>IP Address:</strong> ${data.ipAddress || 'Not available'}<br>
            <strong>User Agent:</strong> ${data.userAgent || 'Not available'}
          </div>
        </div>
        <div class="footer">
          <p>This message was sent from your website contact form.</p>
          <p>Please respond to the sender at: ${data.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createUserConfirmationTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Thank you for contacting us</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; border-radius: 8px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #7E23CF, #3b82f6); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: white; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Thank you for contacting us!</h1>
        </div>
        <div class="content">
          <p>Dear ${data.firstName} ${data.lastName},</p>
          <p>Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.</p>
          <p><strong>Your message details:</strong></p>
          <ul>
            <li><strong>Subject:</strong> ${data.subject || 'General Inquiry'}</li>
            <li><strong>Message:</strong> ${data.message}</li>
          </ul>
          <p>We typically respond within 24 hours during business days.</p>
          <p>Best regards,<br>The LearnXR Team</p>
        </div>
        <div class="footer">
          <p>This is an automated confirmation email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Input validation function
function validateFormData(data) {
  const errors = {};
  
  // Required fields validation
  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }
  
  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  if (!data.message || data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }
  
  if (data.message && data.message.trim().length > 500) {
    errors.message = 'Message must be less than 500 characters';
  }
  
  // Optional fields validation
  if (data.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(data.phone.replace(/[\s\-\(\)]/g, ''))) {
    errors.phone = 'Please enter a valid phone number';
  }
  
  // Honey pot validation
  if (data.honeypot && data.honeypot.trim() !== '') {
    errors.honeypot = 'Invalid submission detected';
  }
  
  return errors;
}

// Input sanitization function
function sanitizeData(data) {
  const sanitized = {};
  
  // Sanitize each field
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'string') {
      // Remove HTML tags and dangerous characters
      sanitized[key] = data[key]
        .trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    } else {
      sanitized[key] = data[key];
    }
  });
  
  return sanitized;
}

// Logging function
function logSubmission(data, success = true) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    success,
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      organization: data.organization,
      phone: data.phone,
      subject: data.subject,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    }
  };
  
  const logFile = path.join(__dirname, 'contact-logs.json');
  let logs = [];
  
  try {
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading log file:', error);
  }
  
  logs.push(logEntry);
  
  try {
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Contact form submission endpoint
app.post('/send-message', async (req, res) => {
  try {
    const rawData = req.body;
    
    // Sanitize input data
    const data = sanitizeData(rawData);
    data.ipAddress = req.ip || req.connection.remoteAddress;
    data.userAgent = req.get('User-Agent');
    
    // Validate form data
    const errors = validateFormData(data);
    if (Object.keys(errors).length > 0) {
      logSubmission(data, false);
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    // Email configuration for owner
    const ownerMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.OWNER_EMAIL || 'princisharma086@gmail.com',
      replyTo: data.email,
      subject: `New Contact Form Submission - ${data.firstName} ${data.lastName}`,
      html: createOwnerEmailTemplate(data),
      text: `
New Contact Form Submission

Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Organization: ${data.organization || 'Not specified'}
Phone: ${data.phone || 'Not provided'}
Subject: ${data.subject || 'General Inquiry'}
Message: ${data.message}

Submitted on: ${new Date().toLocaleString()}
IP Address: ${data.ipAddress}

---
This message was sent from your website contact form.
      `
    };
    
    // Send email to owner
    await transporter.sendMail(ownerMailOptions);
    
    // Send confirmation email to user (optional)
    if (process.env.SEND_USER_CONFIRMATION === 'true') {
      const userMailOptions = {
        from: process.env.EMAIL_USER,
        to: data.email,
        subject: 'Thank you for contacting us',
        html: createUserConfirmationTemplate(data)
      };
      
      try {
        await transporter.sendMail(userMailOptions);
      } catch (error) {
        console.error('Error sending user confirmation:', error);
        // Don't fail the main request if user confirmation fails
      }
    }
    
    // Log successful submission
    logSubmission(data, true);
    console.log(`Email sent successfully from ${data.email} to ${ownerMailOptions.to}`);
    
    res.status(200).json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.'
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    logSubmission(req.body, false);
    
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Contact form endpoint: http://localhost:${PORT}/send-message`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 