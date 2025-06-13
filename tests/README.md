# Test Suite

This directory contains comprehensive tests for the MCP EPUB RAG server.

## Test Structure

### Unit Tests
- `utils/helpers.test.ts` - Tests for utility functions (ID generation, file validation)
- `parsers/documentParser.test.ts` - Tests for document parsing functionality
- `services/chunkingService.test.ts` - Tests for text chunking service
- `services/embeddingService.test.ts` - Tests for embedding generation service
- `services/vectorDatabaseService.test.ts` - Tests for vector database operations

### Integration Tests
- `integration/mcpServer.test.ts` - End-to-end tests for MCP server functionality

### Test Data
- `data/sample.md` - Sample markdown file for testing
- `setup.ts` - Test environment setup and configuration

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Features

### Mocking
- External dependencies (transformers, vectra) are mocked to avoid downloading models
- File system operations use temporary directories
- Console output is captured and can be inspected

### Test Data
- Temporary test directories are created and cleaned up automatically
- Sample documents are provided for testing document parsing
- Test configurations are isolated from production settings

### Coverage
- Tests cover all major functionality including error handling
- Edge cases and boundary conditions are tested
- Integration tests verify end-to-end workflows

## Test Environment

- **Framework**: Jest with TypeScript support
- **Mocking**: Jest mocks for external dependencies
- **Cleanup**: Automatic cleanup of test files and directories
- **Isolation**: Each test runs in isolation with fresh mocks

## Adding New Tests

1. Create test files with `.test.ts` extension
2. Place unit tests in appropriate service/component directories
3. Use the existing mocking patterns for external dependencies
4. Follow the AAA pattern (Arrange, Act, Assert)
5. Include both positive and negative test cases
6. Clean up any test data in `afterEach` hooks