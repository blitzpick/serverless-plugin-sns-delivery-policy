/* eslint-disable strict */
"use strict";

const _ = require("lodash");

module.exports = S => {
    const SCli = require(S.getServerlessPath("utils/cli"));

    class SNSDeliveryPolicyPlugin extends S.classes.Plugin {
        constructor() {
            super();
            this.name = "sns-delivery-policy";
        }

        registerHooks() {
            S.addHook(this._postDeploy.bind(this), {
                action: "eventDeploy",
                event: "post"
            });

            return Promise.resolve();
        }

        _postDeploy(evt) {
            return new Promise((resolve, reject) => {
                try {
                    const project = S.getProject();
                    const aws = S.getProvider("aws");
                    const stage = evt.options.stage;

                    const eventsToUpdate = _(evt.data.deployed)
                        .flatMap((eventInfos, region) => {
                            const awsAccountId = aws.getAccountId(stage, region);

                            return _.map(eventInfos, eventInfo => {
                                const func = _.get(eventInfo, "function");
                                const event = project.getEvent(eventInfo.name);
                                const info = event.toObjectPopulated({
                                    stage,
                                    region
                                });
                                const deployedFunctionName = func.getDeployedName({
                                    stage,
                                    region
                                });

                                return {
                                    awsAccountId,
                                    functionName: func.name,
                                    lambdaArn: `arn:aws:lambda:${region}:${awsAccountId}:function:${deployedFunctionName}:${stage}`,
                                    info,
                                    stage,
                                    region
                                };
                            });
                        })
                        .filter(["info.type", "sns"])
                        .filter("info.config.deliveryPolicy")
                        .value();

                    return updateSubscriptions(aws, eventsToUpdate)
                        .then(() => {
                            return resolve(evt);
                        });
                } catch (err) {
                    reject(err);
                }
            });
        }
    }

    return SNSDeliveryPolicyPlugin;

    function updateSubscriptions(aws, eventsToUpdate) {
        const eventsByTopic = _.groupBy(eventsToUpdate, "info.config.topicName");

        let promise = Promise.resolve();
        _.each(eventsByTopic, (events, topic) => {
            promise = promise
                .then(() => updateTopicSubscriptions(aws, topic, events));
        });

        return promise;
    }

    function updateTopicSubscriptions(aws, topic, events) {
        const stage = events[0].stage;
        const region = events[0].region;

        const params = {
            TopicArn: topic
        };

        return aws.request("SNS", "listSubscriptionsByTopic", params, stage, region)
            .then(result => {
                const updates = _(result.Subscriptions)
                    .map(subscription => {
                        if (subscription.Protocol !== "lambda") {
                            return undefined;
                        }

                        const event = _.find(events, {
                            lambdaArn: subscription.Endpoint
                        });

                        if (!event) {
                            return undefined;
                        }

                        return {
                            event,
                            subscriptionArn: subscription.SubscriptionArn,
                            deliveryPolicy: event.info.config.deliveryPolicy
                        };
                    })
                    .compact()
                    .value();

                let promise = Promise.resolve();
                _.each(updates, update => {
                    const params = {
                        SubscriptionArn: update.subscriptionArn,
                        AttributeName: "DeliveryPolicy",
                        AttributeValue: JSON.stringify(update.deliveryPolicy)
                    };

                    promise = promise
                        .then(() => aws.request("SNS", "setSubscriptionAttributes", params, stage, region))
                        .catch(err => {
                            SCli.log(`Failed updating ${update.event.functionName}:${update.event.info.name}`);
                            SCli.log(err);
                        });
                });

                return promise;
            })
            .catch(err => {
                SCli.log(err);
            });
    }
};
