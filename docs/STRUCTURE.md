# 📂 Documentation Structure

Complete documentation organization for Claude Relay Service.

---

## 🗂️ Directory Structure

```
docs/
├── README.md                           # Documentation index (you are here)
├── STRUCTURE.md                        # This file - structure explanation
│
├── START_GUIDE.md                      # Quick start guide
├── PRODUCTION_CHECKLIST.md             # Production deployment checklist  
├── SECURITY.md                         # Security best practices
│
├── changelog/                          # Version history
│   ├── CHANGELOG.md                   # Version changelog
│   ├── CHANGES.md                     # Detailed changes
│   └── RELEASE_NOTES.md               # Release notes
│
├── configuration/                      # Configuration documentation
│   └── ENV_VARIABLES.md               # Environment variables guide (70+ variables)
│
├── deployment/                         # Deployment guides
│   ├── README.md                      # Deployment overview
│   ├── DOCKER_DEPLOY.md               # Docker deployment
│   └── DEPLOY_NODE.md                 # Node.js deployment
│
├── guides/                             # Comprehensive guides
│   ├── MIGRATION_GUIDE.md             # Migration from old versions
│   ├── OPTIMIZATION_SUMMARY.md        # Project optimization details
│   └── PUSH_TO_GITHUB.md              # GitHub push guide
│
└── security/                           # Security documentation
    ├── README_SECURITY.md             # Security overview
    ├── SECURITY_AUDIT.md              # Security audit report
    └── SECURITY_CHECKLIST.md          # Security hardening checklist
```

---

## 📍 Root Directory Files

Essential files kept in project root for easy access:

- `README.md` - Main project README (Chinese)
- `README_EN.md` - English README
- `LICENSE` - MIT License
- `OPTIMIZATION_COMPLETE.txt` - Optimization completion marker

---

## 📚 Documentation Categories

### 🚀 Getting Started
Quick start and onboarding documentation.

**Location**: `docs/`
- `START_GUIDE.md` - 5-minute quick start
- `PRODUCTION_CHECKLIST.md` - Pre-deployment checklist

### 🐳 Deployment
Complete deployment guides for different platforms.

**Location**: `docs/deployment/`
- `README.md` - Deployment options overview
- `DOCKER_DEPLOY.md` - Docker/Docker Compose
- `DEPLOY_NODE.md` - Bare metal Node.js

### 🔧 Configuration
Configuration references and examples.

**Location**: `docs/configuration/`
- `ENV_VARIABLES.md` - **70+ environment variables** with:
  - Required vs optional
  - Default values
  - Validation rules
  - Generation commands
  - Examples

### 🔐 Security
Security hardening and best practices.

**Location**: `docs/security/`
- `SECURITY.md` - General security guide
- `README_SECURITY.md` - Security overview
- `SECURITY_AUDIT.md` - Comprehensive audit report
- `SECURITY_CHECKLIST.md` - Step-by-step hardening

### 📋 Changelog
Version history and change tracking.

**Location**: `docs/changelog/`
- `CHANGELOG.md` - Version history
- `CHANGES.md` - Detailed change documentation
- `RELEASE_NOTES.md` - Release announcements

### 📖 Guides
In-depth guides for specific tasks.

**Location**: `docs/guides/`
- `MIGRATION_GUIDE.md` - Upgrade from v1.1.182 and earlier
- `OPTIMIZATION_SUMMARY.md` - Project optimization report
- `PUSH_TO_GITHUB.md` - Git/GitHub workflow guide

---

## 🔗 Navigation

### From Root README
Main README links to docs using relative paths:
```markdown
[Migration Guide](guides/MIGRATION_GUIDE.md)
[Environment Variables](configuration/ENV_VARIABLES.md)
[Security Guide](SECURITY.md)
```

### Within docs/ Directory
Use relative paths from docs:
```markdown
[Quick Start](START_GUIDE.md)
[Deployment](deployment/DOCKER_DEPLOY.md)
[Security](security/SECURITY_AUDIT.md)
```

### From Subdirectories
Use relative paths back to docs:
```markdown
../START_GUIDE.md
../deployment/DOCKER_DEPLOY.md
../../README.md (back to root)
```

---

## 📊 File Inventory

### Total Files: 19 Documentation Files

| Category | Count | Location |
|----------|-------|----------|
| Root | 4 | `/` |
| Core Docs | 4 | `/docs` |
| Changelog | 3 | `/docs/changelog` |
| Configuration | 1 | `/docs/configuration` |
| Deployment | 3 | `/docs/deployment` |
| Guides | 3 | `/docs/guides` |
| Security | 3 | `/docs/security` |

### By Type

| Type | Count |
|------|-------|
| README files | 4 |
| Guides | 6 |
| Reference | 1 |
| Changelog | 3 |
| Security | 4 |
| Deployment | 3 |

---

## ✅ Validation Checklist

Before committing documentation changes:

- [ ] All internal links use correct relative paths
- [ ] No broken links (test with markdown linter)
- [ ] Files in correct subdirectories
- [ ] README.md indexes updated
- [ ] Cross-references are accurate
- [ ] Examples tested and working

---

## 🔄 Moving Files

If you need to move a file to a different category:

1. **Move the file**
   ```bash
   mv docs/guides/EXAMPLE.md docs/security/
   ```

2. **Update links in the file**
   - Adjust relative paths for imports
   - Update navigation links

3. **Update referencing files**
   - Search for old path: `grep -r "EXAMPLE.md" .`
   - Update all references

4. **Update indexes**
   - `docs/README.md`
   - `docs/STRUCTURE.md` (this file)

---

## 📝 Adding New Documentation

1. **Determine category**
   - Getting Started → `docs/`
   - Deployment → `docs/deployment/`
   - Configuration → `docs/configuration/`
   - Security → `docs/security/`
   - Changelog → `docs/changelog/`
   - Guides → `docs/guides/`

2. **Create file in correct location**
   ```bash
   touch docs/guides/NEW_GUIDE.md
   ```

3. **Add to indexes**
   - Update `docs/README.md`
   - Update this file (`docs/STRUCTURE.md`)
   - Update root `README.md` if relevant

4. **Use consistent formatting**
   - H1 (`#`) for title
   - H2 (`##`) for major sections
   - H3 (`###`) for subsections
   - Include emoji for visual appeal
   - Add table of contents for long docs

---

## 🎯 Best Practices

### Naming Conventions
- Use `UPPER_SNAKE_CASE.md` for major docs
- Use descriptive names (not `doc1.md`)
- Keep names concise but clear

### File Organization
- Related docs in same subdirectory
- Maximum 3 directory levels
- No orphaned files without links

### Content Guidelines
- Start with clear H1 title
- Include table of contents for long docs
- Use code blocks with language tags
- Add examples for technical content
- Include troubleshooting sections

### Link Management
- Use relative paths only
- Test all links before committing
- Avoid absolute paths to localhost
- Keep external links updated

---

## 📖 Related Documentation

- [Documentation Index](README.md) - Main documentation hub
- [Quick Start](START_GUIDE.md) - Get started quickly
- [Main README](../README.md) - Project overview

---

*Last Updated: 2025-10-23*
*Version: v1.1.183+*
