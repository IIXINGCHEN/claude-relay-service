# 📚 Deployment Documentation

Claude Relay Service supports multiple deployment methods. Choose the one that best fits your infrastructure.

## 🚀 Quick Start

### Recommended: Docker Compose (Easiest)

```bash
# 1. Copy environment template
cp .env.docker.example .env

# 2. Edit .env and set your secrets
# Required: JWT_SECRET, ENCRYPTION_KEY

# 3. Start services
docker-compose up -d
```

### Alternative: Node.js Direct Deployment

```bash
# 1. Run deployment script
./deploy.sh

# 2. Or use start script
node start.js
```

## 📖 Detailed Guides

### Docker Deployments
- [Docker Compose Deployment](./DOCKER_DEPLOY.md) - Full Docker guide with offline support

### Node.js Deployments
- [Node.js Direct Deployment](./DEPLOY_NODE.md) - Without Docker

### Advanced Scenarios
- **Accelerated Deployment (China)**: Set env vars in `.env`:
  ```env
  NODE_IMAGE_REGISTRY=docker.1panel.live/library/
  NPM_REGISTRY=https://registry.npmmirror.com
  REDIS_IMAGE=docker.1panel.live/library/redis:7-alpine
  ```

- **Custom Build Args**: Pass to docker-compose:
  ```bash
  NODE_IMAGE_REGISTRY=custom.registry.com/ docker-compose build
  ```

## 🔧 Configuration

### Required Environment Variables

All deployment methods require these secrets:

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-generated-secret-here

# Generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
ENCRYPTION_KEY=your-32-char-hex-key
```

### Optional Configuration

See `.env.example` for all available options.

## 🆘 Troubleshooting

### Docker Issues
- **Port conflicts**: Change `PORT` in `.env`
- **Build failures**: Check network connectivity or use accelerated registries
- **Permission errors**: Run with `sudo` or fix Docker permissions

### Node.js Issues
- **Node version**: Requires Node.js 18+
- **Redis connection**: Ensure Redis is running (`redis-cli ping`)
- **Port in use**: Check with `netstat -tlnp | grep 13006`

## 📞 Support

- Check main [README](../../README.md) for general information
- See [Security Guide](../SECURITY.md) for production hardening
- Review [Production Checklist](../PRODUCTION_CHECKLIST.md) before going live
