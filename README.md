Serverless SNS Delivery Policy Plugin
=============================

This plugin will configure your SNS events with the Delivery Policy option, which the serverless system does not natively support.

**Note:** Requires Serverless *v0.5.0*.

### Setup

Just add a "deliveryPolicy" block to your SNS event:

```javascript
"events": [
  {
    "name": "alertsSNS",
    "type": "sns",
    "config": {
      "topicName": "${alertsSNSTopicName}",
      "deliveryPolicy": {
        "healthyRetryPolicy": {
          "minDelayTarget": 10,
          "maxDelayTarget": 30,
          "numRetries": 10,
          "numNoDelayRetries": 0,
          "numMinDelayRetries": 3,
          "numMaxDelayRetries": 7,
          "backoffFunction" : "linear"
        }
      }
    }
  }
],
```

For a little (fairly barren) documentation of the deliveryPolicy structure, see http://docs.aws.amazon.com/sns/latest/dg/json-formats.html

### Setup

* Install the plugin in the root of your Serverless Project:
```
npm install serverless-plugin-sns-delivery-policy --save-dev
```

* Add the plugin to the `plugins` array in your Serverless Project's `s-project.json`, like this:

```
plugins: [
    "serverless-plugin-sns-delivery-policy"
]
```

Now, any time you deploy an event to AWS, `serverless-plugin-sns-delivery-policy` will automatically configure the SNS event with your Delivery Policy settings.
