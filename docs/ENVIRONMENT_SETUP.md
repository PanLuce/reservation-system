# Environment Configuration Guide

This document explains how to configure the reservation system for different environments.

## Quick Start

### Development

1. Copy the development template:
   ```bash
   cp .env.development.template .env
   ```

2. (Optional) Customize the values as needed

3. Start the server:
   ```bash
   npm run dev
   ```

### Production

1. Copy the production template:
   ```bash
   cp .env.production.template .env.production
   ```

2. **REQUIRED**: Generate a strong session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Fill in all required values (marked with REQUIRED in the template)

4. Set up the environment variables on your server

5. Start the server:
   ```bash
   NODE_ENV=production npm start
   ```

## Environment Variables Reference

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode: `development` or `production` |
| `PORT` | No | `3000` | Port number for the HTTP server |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | **Yes (Production)** | dev-secret | Secret key for session encryption. **MUST** be set in production. |
| `ALLOWED_ORIGINS` | No | `https://centrumrubacek.cz` | Comma-separated list of allowed CORS origins for iframe embedding |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_PATH` | No | `./data/reservations.db` | Path to SQLite database file |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` (prod), `debug` (dev) | Logging level: `error`, `warn`, `info`, or `debug` |

### Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS for SMTP connection |
| `SMTP_USER` | No | - | SMTP authentication username |
| `SMTP_PASS` | No | - | SMTP authentication password |
| `ADMIN_EMAIL` | No | `admin@centrumrubacek.cz` | Admin email for receiving notifications |
| `FROM_EMAIL` | No | `reservations@centrumrubacek.cz` | From address for outgoing emails |

### Admin Account

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_EMAIL_SEED` | **Yes (Production)** | - | Email for initial admin account (only used if database is empty) |
| `ADMIN_PASSWORD_SEED` | **Yes (Production)** | - | Password for initial admin account (only used if database is empty) |

## Security Best Practices

### Production Checklist

- [ ] Generate a strong `SESSION_SECRET` (32+ random bytes)
- [ ] Set `ADMIN_PASSWORD_SEED` to a strong password
- [ ] Configure `ALLOWED_ORIGINS` to your WordPress domain
- [ ] Set `NODE_ENV=production`
- [ ] Never commit `.env` files to version control
- [ ] Use HTTPS in production (required for secure cookies)
- [ ] Regularly backup the database
- [ ] Keep dependencies up to date

### Generating Secure Secrets

```bash
# Generate a strong session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate a strong password
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

## Validation

The application validates required environment variables at startup:

- **Production mode**:
  - `SESSION_SECRET` must be set (application exits if missing)
  - Warning if `ALLOWED_ORIGINS` is not set

- **Development mode**:
  - Safe defaults are used
  - Warning if admin credentials are not set

## Troubleshooting

### "SESSION_SECRET environment variable is required in production"

**Solution**: Set the `SESSION_SECRET` environment variable with a strong random value.

```bash
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### "No admin user created"

**Solution**: Set both `ADMIN_EMAIL_SEED` and `ADMIN_PASSWORD_SEED` environment variables.

### CORS errors in iframe

**Solution**: Ensure `ALLOWED_ORIGINS` includes your WordPress domain:

```bash
export ALLOWED_ORIGINS=https://centrumrubacek.cz
```

### Email notifications not working

**Solution**: Configure SMTP settings or leave empty to use console logging in development.

## Example Configurations

### Local Development

```bash
NODE_ENV=development
PORT=3000
ADMIN_EMAIL_SEED=admin@test.local
ADMIN_PASSWORD_SEED=test123
LOG_LEVEL=debug
```

### Production Server

```bash
NODE_ENV=production
PORT=3001
SESSION_SECRET=<64-character-hex-string>
ALLOWED_ORIGINS=https://centrumrubacek.cz
ADMIN_EMAIL_SEED=admin@centrumrubacek.cz
ADMIN_PASSWORD_SEED=<strong-password>
DATABASE_PATH=/var/lib/reservations/reservations.db
LOG_LEVEL=info

# SMTP (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@centrumrubacek.cz
FROM_EMAIL=reservations@centrumrubacek.cz
```

### Production with PM2

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'reservations',
    script: 'server.js',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      SESSION_SECRET: process.env.SESSION_SECRET,
      ALLOWED_ORIGINS: 'https://centrumrubacek.cz'
    }
  }]
};
```

## Next Steps

After configuring the environment:

1. Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions
2. Read [WORDPRESS_INTEGRATION.md](./WORDPRESS_INTEGRATION.md) for WordPress setup
3. Review [API.md](./API.md) for API documentation
