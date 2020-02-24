# Serverless package path

Serverless plugin to package python layer’s in a custom path.

This plugin will help if you need to package your service or layer inside a custom path like `python/lib/python3.7/site-packages`.

```yaml
plugins:
  - serverless-plugin-package-path # Needs to go before serverless-python-requirements
  - serverless-python-requirements
  
custom:
  packagePath:
    path: python/lib/python3.7/site-packages
```
