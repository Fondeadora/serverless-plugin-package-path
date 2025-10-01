# Test Project for serverless-plugin-package-path

This test project mirrors the setup from [Fondeadora/f4b-common-layer](https://github.com/Fondeadora/f4b-common-layer) to demonstrate how the plugin works.

## Structure

The plugin reorganizes the Lambda Layer zip structure:

### Before Plugin (standard serverless-python-requirements):

```
common312.zip/
└── common/
    ├── __init__.py
    ├── utils.py
    ├── aiohttp/      # dependencies mixed with project code
    ├── pydantic/
    └── requests/
```

### After Plugin (with serverless-plugin-package-path):

```
common312.zip/
└── python/lib/python3.12/site-packages/
    ├── common/       # project code in subdirectory
    │   ├── __init__.py
    │   └── utils.py
    ├── aiohttp/      # dependencies at package path root
    ├── pydantic/
    └── requests/
```

## How It Works

1. **`after:package:createDeploymentArtifacts`**: Moves project files from `common/` into `python/lib/python3.12/site-packages/common/` and saves to tmp.zip
2. **`before:package:compileLayers`**: Merges Python dependencies (from serverless-python-requirements) into the package path alongside the project code

## Running Tests

```bash
cd test
node run-test.js
```

Or from the test-project directory:

```bash
npm run package
```

## Configuration

Key settings in `serverless.yml`:

- `layers.common312.path: common` - Source directory for project code
- `custom.packagePath.path: python/lib/python3.12/site-packages` - Target path structure
- Plugin order matters: `serverless-plugin-package-path` must come before `serverless-python-requirements`
