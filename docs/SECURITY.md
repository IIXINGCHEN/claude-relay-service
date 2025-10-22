# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

### Environment Configuration

1. **Never commit sensitive data**
   - Use `.env` files for local configuration
   - Never commit `.env` files to version control
   - Use environment variables in production

2. **Generate strong keys**
   ```bash
   # Generate JWT Secret
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Generate Encryption Key
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   
   # Generate Redis Password
   node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
   ```

3. **Required Security Environment Variables**
   - `JWT_SECRET`: Strong random string for JWT signing
   - `ENCRYPTION_KEY`: 32-character hex key for data encryption
   - `REDIS_PASSWORD`: Password for Redis authentication
   - `ADMIN_PASSWORD`: Strong admin password (auto-generated if not set)

### Production Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Disable `DEBUG_HTTP_TRAFFIC`
- [ ] Configure strong passwords for all services
- [ ] Enable Redis password authentication
- [ ] Use HTTPS/TLS for all connections
- [ ] Enable rate limiting
- [ ] Configure proper CORS settings
- [ ] Regularly update dependencies
- [ ] Monitor security logs

### API Security

1. **Authentication**
   - All API endpoints require authentication
   - Use API keys with proper scoping
   - Implement token expiration

2. **Rate Limiting**
   - Configure appropriate rate limits
   - Monitor for abuse patterns
   - Implement IP-based throttling

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use TLS for data in transit
   - Sanitize all user inputs
   - Mask sensitive data in logs

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please:

1. **DO NOT** create a public GitHub issue
2. Send details to the maintainers privately
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Security Updates

Security patches are released as soon as possible after verification.
Monitor releases for security updates and apply them promptly.

## Compliance

This service implements:
- Data encryption for sensitive information
- Secure session management
- Input validation and sanitization
- Security headers (via Helmet.js)
- CORS protection
- Rate limiting

## Redis TLS Configuration

For production environments, consider enabling Redis TLS:

```env
REDIS_ENABLE_TLS=true
REDIS_PORT=6380  # TLS port
```

If TLS is not required (e.g., local development):
```env
REDIS_TLS_NOT_REQUIRED=true  # Suppress warnings
```

## Quick Security Setup

```bash
# Generate all required keys
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(16).toString('hex'))"
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(16).toString('base64'))"
```
