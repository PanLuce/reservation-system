# Email Setup Instructions

## Files Created

The email notification system has been implemented. The following files were created:

### Source Files
- `src/email-service.ts` - Email service with Czech templates
- `src/email-factory.ts` - Factory for creating email service from env vars
- `src/registration-db.ts` - Updated with email integration

### Test Files
- `tests/email-service.spec.ts` - Email service unit tests (6 tests)
- `tests/email-factory.spec.ts` - Email factory unit tests (5 tests)
- `tests/registration-email.spec.ts` - Integration tests (5 tests)

### Documentation
- `EMAIL_TESTING.md` - Complete testing guide with Ethereal Email setup

## Manual Updates Needed

### 1. Update `.env.example`

Add these lines to `.env.example`:

```env
# Email Configuration (Optional - system works without it)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password
ADMIN_EMAIL=admin@centrumrubacek.cz
FROM_EMAIL=info@centrumrubacek.cz
```

### 2. Update `README.md`

Add an "Email Notifications" section:

```markdown
## Email Notifications

The system sends automatic email notifications in Czech when participants register:

- **Participant Confirmation**: Sent to the participant with lesson details and status
- **Admin Notification**: Sent to admin with participant and lesson information

### Configuration

Email is optional - the system works without it. To enable emails, add SMTP configuration to `.env`:

\`\`\`env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-email@ethereal.email
SMTP_PASS=your-password
ADMIN_EMAIL=admin@centrumrubacek.cz
FROM_EMAIL=info@centrumrubacek.cz
\`\`\`

For testing: See [EMAIL_TESTING.md](./EMAIL_TESTING.md) for setup instructions with Ethereal Email (free test SMTP).

For production: Use a real SMTP provider like Gmail, SendGrid, Mailgun, or AWS SES.

### Features

- Graceful degradation: Registration succeeds even if email fails
- Czech language: All emails in Czech for Czech audience
- Two status types: Confirmed or waitlist
- No blocking: Emails sent asynchronously
```

## Testing

All tests pass:
- ✅ 6 email service tests
- ✅ 5 email factory tests
- ✅ 5 registration integration tests

Run tests:
```bash
npm test tests/email-service.spec.ts
npm test tests/email-factory.spec.ts
npm test tests/registration-email.spec.ts
```

## Quick Start

1. Create Ethereal account: https://ethereal.email/
2. Copy credentials to `.env` file
3. Start server: `npm run dev`
4. Register a participant
5. Check emails at: https://ethereal.email/messages

## Success Criteria Met

✅ Participant receives confirmation email in Czech with lesson details
✅ Admin receives notification email in Czech with registration info
✅ All tests passing (16 new tests)
✅ System works with or without email configuration
✅ Email failures don't block registrations
✅ Documentation complete (EMAIL_TESTING.md)
✅ Manual testing ready with Ethereal
