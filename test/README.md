# Test Suite for serverless-plugin-package-path

This directory contains integration tests for the plugin.

## Structure

```
test/
├── run-test.js           # Main test script
├── test-project/         # Sample Serverless project
│   ├── serverless.yml    # Serverless configuration
│   ├── handler.py        # Lambda function
│   ├── requirements.txt  # Python dependencies
│   └── package.json      # Node dependencies
└── README.md             # This file
```

## Running Tests

### Quick Test

From the root of the project:

```bash
npm test
```

Or directly:

```bash
node test/run-test.js
```

### Manual Testing

You can also test manually in the test project:

```bash
cd test/test-project
npm install
npx serverless package
```

Then inspect the generated layer:

```bash
unzip -l .serverless/pythonRequirements.zip | head -20
```

All files should be under `python/lib/python3.11/site-packages/`.

## What the Test Does

The test script performs the following:

1. **Setup**: Installs dependencies in the test project
2. **Clean**: Removes any previous build artifacts
3. **Package**: Runs `serverless package` to build the layer
4. **Verify**: Checks the layer zip structure:
   - All files are in the correct path (`python/lib/python3.11/site-packages/`)
   - Python packages (requests, urllib3, certifi) are present
   - File contents are intact and accessible
   - No files are in incorrect locations

## Expected Output

```
============================================================
  Testing serverless-plugin-package-path
============================================================

[1/4] Installing dependencies...
   ✓ Dependencies installed

[2/4] Cleaning previous builds...
   ✓ Cleaned .serverless directory

[3/4] Running serverless package...
   ✓ Packaging completed

[4/4] Verifying layer structure...

📦 Verifying layer structure...
   Layer zip: .../test-project/.serverless/pythonRequirements.zip

   Found 45 files in layer

   ✓ All files correctly placed under: python/lib/python3.11/site-packages/

   Package verification:
     ✓ requests package
     ✓ urllib3 package
     ✓ certifi package

   ✓ File contents accessible and intact

============================================================
  ✓ ALL TESTS PASSED!
============================================================
```

## Test Project Configuration

The test project is configured to:

- Use **Serverless Framework v4**
- Target **Python 3.11** runtime
- Install **requests** package (which pulls in urllib3, certifi, etc.)
- Use **serverless-python-requirements** plugin for dependency management
- Apply **serverless-plugin-package-path** to restructure the layer

The configuration in `serverless.yml`:

```yaml
plugins:
  - ../../index.js # Load the plugin from parent directory
  - serverless-python-requirements

custom:
  packagePath:
    path: python/lib/python3.11/site-packages
```

## Troubleshooting

### AWS Credentials Warning

The test may show a warning about AWS credentials. This is expected and won't affect the test as long as the layer zip file is created.

### Missing Dependencies

If you get errors about missing packages:

```bash
cd test/test-project
npm install
```

### Docker Required

The `serverless-python-requirements` plugin may require Docker for certain packages. If you don't have Docker, you can disable it in the test project's `serverless.yml`:

```yaml
custom:
  pythonRequirements:
    dockerizePip: false # Already set in test config
```

## CI/CD Integration

To run tests in CI/CD pipelines:

```bash
# Install plugin dependencies
npm install

# Run tests
npm test
```

The test will exit with code 0 on success and code 1 on failure.
