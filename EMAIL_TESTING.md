# Email Testing Guide

This guide explains how to test email notifications in the reservation system using Ethereal Email.

## Overview

The reservation system sends two types of emails:
1. **Participant Confirmation** - Sent to participants when they register for a lesson
2. **Admin Notification** - Sent to admin when a new registration occurs

All emails are in Czech language.

## Email Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-username@ethereal.email
SMTP_PASS=your-ethereal-password

# Email Addresses
ADMIN_EMAIL=admin@centrumrubacek.cz
FROM_EMAIL=info@centrumrubacek.cz
```

### Setting Up Ethereal Email (Free Test Account)

Ethereal Email is a free fake SMTP service for testing email functionality in development.

1. **Create an account** at https://ethereal.email/
   - Click "Create Ethereal Account"
   - Copy the generated credentials

2. **Update your .env file** with the credentials:
   ```env
   SMTP_HOST=smtp.ethereal.email
   SMTP_PORT=587
   SMTP_USER=your-username@ethereal.email
   SMTP_PASS=your-password-here
   ADMIN_EMAIL=admin@centrumrubacek.cz
   FROM_EMAIL=info@centrumrubacek.cz
   ```

3. **Start the server**:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   Email service enabled. Admin email: admin@centrumrubacek.cz
   ```

## Testing Email Functionality

### 1. Register a Participant

Use the registration UI or API to register a participant:

```bash
curl -X POST http://localhost:3000/api/registrations \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "lesson_1",
    "participant": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+420 123 456 789",
      "ageGroup": "3-12 months"
    }
  }'
```

### 2. Check Ethereal Inbox

1. Go to https://ethereal.email/messages
2. Login with your Ethereal credentials
3. You should see 2 new emails:
   - **Participant confirmation** (to: test@example.com)
   - **Admin notification** (to: admin@centrumrubacek.cz)

### 3. Verify Email Content

**Participant Confirmation (Confirmed Status):**
- Subject: `Potvrzení registrace - [Lesson Title]`
- Body includes:
  - Greeting in Czech
  - Lesson details (title, day, time, location, age group)
  - Status: POTVRZENO ✓
  - Signature: Centrum Rubáček

**Participant Confirmation (Waitlist Status):**
- Subject: `Registrace na čekací listinu - [Lesson Title]`
- Body includes:
  - Greeting in Czech
  - Lesson details
  - Status: ČEKACÍ LISTINA
  - Message about being contacted when spot opens

**Admin Notification:**
- Subject: `Nová registrace - [Lesson Title]`
- Body includes:
  - Participant details (name, email, phone, age group)
  - Lesson details
  - Registration status
  - Current enrollment: X/Y

## Production Setup

For production, replace Ethereal with a real SMTP service:

### Gmail Example

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@centrumrubacek.cz
FROM_EMAIL=info@centrumrubacek.cz
```

**Note:** For Gmail, you need to create an [App Password](https://support.google.com/accounts/answer/185833).

### Other SMTP Providers

- **SendGrid**: smtp.sendgrid.net (port 587)
- **Mailgun**: smtp.mailgun.org (port 587)
- **AWS SES**: email-smtp.[region].amazonaws.com (port 587)
- **Postmark**: smtp.postmarkapp.com (port 587)

## Graceful Degradation

The system works without email configuration:

- If SMTP variables are not set, the system logs a warning and continues
- Registrations still succeed even if email sending fails
- Email failures are logged but don't block the registration process

```
Email service not configured. Missing required environment variables. Email notifications will be disabled.
```

## Troubleshooting

### Emails not sending

1. **Check environment variables** are set correctly:
   ```bash
   echo $SMTP_HOST
   echo $SMTP_USER
   ```

2. **Check server logs** for email errors:
   ```
   Email sending failed: Error: ...
   ```

3. **Verify SMTP credentials** are correct in Ethereal dashboard

4. **Test SMTP connection** manually:
   ```bash
   telnet smtp.ethereal.email 587
   ```

### Emails going to spam

- For Ethereal: Not applicable (fake SMTP)
- For production: Configure SPF, DKIM, and DMARC records

### Timeout errors

- The email service has a 10-second timeout
- Check network connectivity to SMTP server
- Verify firewall doesn't block port 587

## Email Templates

Templates are defined in `src/email-service.ts`:
- `createConfirmedEmailText()` - Confirmed registration
- `createWaitlistEmailText()` - Waitlist registration
- `createAdminNotificationText()` - Admin notification

To customize templates, edit these methods.

## Running Tests

Email functionality is tested in:
- `tests/email-service.spec.ts` - Unit tests for EmailService
- `tests/email-factory.spec.ts` - Unit tests for email factory
- `tests/registration-email.spec.ts` - Integration tests

Run email tests:
```bash
npm test tests/email-service.spec.ts
npm test tests/email-factory.spec.ts
npm test tests/registration-email.spec.ts
```

All tests use mocked SMTP transporter (no real emails sent).
