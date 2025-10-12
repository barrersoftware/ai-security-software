# Contributing to AI Security Scanner

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/ssfdre38/ai-security-scanner/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Ollama version, model used)
   - Relevant logs or screenshots

### Suggesting Features

1. Check [existing feature requests](https://github.com/ssfdre38/ai-security-scanner/issues?q=is%3Aissue+label%3Aenhancement)
2. Create a new issue describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Any alternatives you've considered
   - Why this would benefit others

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly** on multiple systems if possible
5. **Commit with clear messages**: `git commit -m "Add: New security check for X"`
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Guidelines

- Use clear, descriptive variable names
- Add comments for complex logic
- Follow existing code style (bash best practices)
- Test on Linux (at minimum)
- Update documentation if needed

### Improving AI Prompts

We welcome improvements to the AI prompts used in analysis:

1. Test your improved prompts thoroughly
2. Document what you changed and why
3. Include before/after examples if possible
4. Consider different model sizes (3b, 8b, 70b)

### Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email security@yourdomain.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours.

## Development Setup

```bash
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
./install.sh
```

## Testing

Before submitting a PR, test your changes:

```bash
# Test scanner
./scripts/security-scanner.sh

# Test code review
./scripts/code-review.sh /path/to/test/code

# Test chat interface
echo "Test question" | ./scripts/security-chat.sh
```

## Documentation

If you're adding features or changing behavior:

1. Update README.md
2. Add examples to docs/ if appropriate
3. Update inline comments in scripts

## Questions?

- Open a [Discussion](https://github.com/ssfdre38/ai-security-scanner/discussions)
- Ask in issues with `question` label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
