/* eslint-disable strict */
"use strict";

const _ = require("lodash");

module.exports = S => {
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
          console.log("Events Deployed:", JSON.stringify(evt.data.deployed, null, 2));
          return;


          const project = S.getProject();
          const aws = S.getProvider("aws");
          const options = getStageAndRegion(evt, project);
          const functionNames = _(evt.data.deployed)
            .flatMap()
            .map(item => {
              return item.lambdaName;
            })
            .value();

          return configureLogging(project, aws, functionNames, options)
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
};
