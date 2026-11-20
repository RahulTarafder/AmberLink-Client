# Contributing to AmberLink Client

Thanks for taking the time to contribute!

## Getting started

1. Fork the repository and create a feature branch from `main`.
2. Install dependencies with `npm install` (Node.js 18+).
3. Make focused changes. Avoid unrelated formatting or API changes in the same pull request.
4. Run checks before submitting:

   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```

5. Open a pull request describing the change, motivation, and any relevant testing. Link related issues when applicable.

## Contribution guidelines

- Preserve compatibility where practical; clearly call out breaking changes.
- Include or update tests when behavior changes.
- Update README/examples when public APIs or setup instructions change.
- Keep code style consistent with the existing codebase.
- Never commit credentials, tokens, voice-session payloads, or other secrets.
- Be respectful and constructive in reviews and discussions.

## Reporting bugs

Open a GitHub issue with a clear title, reproduction steps, expected behavior, actual behavior, and relevant sanitized logs or environment details. Remove credentials and private identifiers before sharing logs.


## Pull requests

Pull requests should be focused, documented, and ready for review. Maintainers may ask for changes or tests before merging.
