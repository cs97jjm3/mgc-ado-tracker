# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do NOT open a public issue**
2. Email details to: [your-email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Considerations

### Azure DevOps PAT

- Never commit your PAT to version control
- Store in Claude Desktop config only
- Rotate tokens regularly
- Use minimum required permissions

### Database

- Database stored locally at `~/.ado-tracker/`
- Contains work item data from Azure DevOps
- No encryption at rest (local SQLite file)
- Ensure filesystem permissions are appropriate

### Network

- Dashboard runs on localhost only
- No external network access except Azure DevOps API
- HTTPS used for Azure DevOps communication

## Best Practices

1. **Token Management**
   - Use tokens with minimal permissions
   - Set expiration dates
   - Rotate regularly

2. **Data Storage**
   - Regular backups via dashboard
   - Monitor database location access
   - Clean up old data periodically

3. **Updates**
   - Keep dependencies updated
   - Review changelog for security fixes
   - Test updates in development first
