import json
import requests


def hello(event, context):
    """
    Simple Lambda function that uses requests library
    """
    response = {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Hello from Lambda!",
            "requests_version": requests.__version__
        })
    }
    
    return response
