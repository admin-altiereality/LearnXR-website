const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function validate(data) {
  const errors = {};
  if (!data.firstName || data.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.';
  if (!data.lastName || data.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.';
  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) errors.email = 'Invalid email address.';
  if (!data.message || data.message.trim().length < 10 || data.message.trim().length > 500) errors.message = 'Message must be 10-500 characters.';
  return errors;
}

function htmlTemplate(data) {
  return `
    <div style="font-family: Arial, sans-serif; color: #222;">
      <h2 style="color: #7E23CF;">New VR Education Inquiry</h2>
      <table style="margin-bottom: 16px;">
        <tr><td><b>Name:</b></td><td>${data.firstName} ${data.lastName}</td></tr>
        <tr><td><b>Email:</b></td><td>${data.email}</td></tr>
        <tr><td><b>Organization:</b></td><td>${data.organization || 'Not specified'}</td></tr>
        <tr><td><b>Message:</b></td><td>${data.message}</td></tr>
        <tr><td><b>Submitted:</b></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
      <div style="font-size:13px; color:#888;">This message was sent from the LearnXR website contact form.</div>
    </div>
  `;
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }
  const data = JSON.parse(event.body);
  const errors = validate(data);
  if (Object.keys(errors).length > 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, errors })
    };
  }
  try {
    await sgMail.send({
      to: 'princisharma086@gmail.com',
      from: 'no-reply@learnxr.com',
      subject: 'New VR Education Inquiry',
      html: htmlTemplate(data),
      replyTo: data.email
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to send email.' })
    };
  }
}; 