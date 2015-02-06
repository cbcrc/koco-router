define(['lodash'],
    function(_) {
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

            for (var i in self.subscribers) {
                var subscriber = self.subscribers[i];
                var result = subscriber.handler.call(subscriber.context);

                if (!result) return false;
            }

            return true;
        };

        RouterEvent.prototype.unsubscribe = function(handler) {
            var self = this;
            var subs = _.where(self.subscribers, {
                handler: handler
            });

            for (var i in subs) {
                self.subscribers.splice(self.subscribers.indexOf(subs[i]));
            }
        };

        return RouterEvent;
    });
