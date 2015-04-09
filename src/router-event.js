// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

define(['lodash', 'jquery'],
    function(_, $) {
        'use strict';

        var RouterEvent = function() {
            var self = this;

            self.subscribers = [];
        };

        RouterEvent.prototype.subscribe = function(handler, context) {
            var self = this;

            self.subscribers.push({
                handler: handler,
                context: context
            });
        };

        RouterEvent.prototype.canRoute = function() {
            var self = this;

            return checkSubscriber(self.subscribers, 0);
        };

        function checkSubscriber(subscribers, index) {
            // No more subscribers to check
            if (index >= subscribers.length) {
                return $.Deferred().resolve(true).promise();
            }

            var subscriber = subscribers[index];
            var handlerResult = subscriber.handler.call(subscriber.context);

            if (!handlerResult) {
                return $.Deferred().resolve(false).promise();
            }

            return $.when(handlerResult).then(function (result) {
                if (!result) {
                    return false;
                }

                return checkSubscriber(subscribers, index + 1);
            });
        }

        RouterEvent.prototype.unsubscribe = function(handler) {
            var self = this;

            _.remove(self.subscribers, function(subscriber) {
                return subscriber.handler === handler;
            });
        };

        return RouterEvent;
    });
