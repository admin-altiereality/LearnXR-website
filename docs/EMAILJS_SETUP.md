# EmailJS Setup for LearnXR

LearnXR uses EmailJS for transactional emails (approvals, welcome, school notifications, edit requests). **No domain verification required**—works with Wix-managed DNS.

## 1. Create EmailJS Account

1. Sign up at [emailjs.com](https://www.emailjs.com/)
2. Go to **Account > Security** and **enable API requests** (required for Node.js/server-side)

## 2. Add Email Service

1. Go to **Email Services** in the dashboard
2. Add a new service (e.g. Gmail, Outlook, or a custom SMTP)
3. Connect your sending email account
4. Copy the **Service ID**

## 3. Create Email Template

1. Go to **Email Templates** and create a new template
2. Use these dynamic variables (our code passes `to`, `subject`, `content`):

| Field | Value |
|-------|-------|
| **To Email** | `{{to}}` |
| **Subject** | `{{subject}}` |
| **Content** | `{{{content}}}` (triple brackets = raw HTML) |

3. Save and copy the **Template ID**

## 4. Get Keys

- **Public Key**: Account > General > Public Key
- **Private Key**: Account > Security > Private Key (create one if needed)

## 5. Set Firebase Secrets

```bash
firebase functions:secrets:set EMAILJS_SERVICE_ID
firebase functions:secrets:set EMAILJS_TEMPLATE_ID
firebase functions:secrets:set EMAILJS_PUBLIC_KEY
firebase functions:secrets:set EMAILJS_PRIVATE_KEY
```

Enter each value when prompted. Then redeploy:

```bash
firebase deploy --only functions
```

## Free Tier

- 200 emails/month on free plan
- Upgrade at [emailjs.com](https://www.emailjs.com/) for higher limits
