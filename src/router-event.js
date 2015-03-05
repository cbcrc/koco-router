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

            return new $.Deferred(function(dfd) {
                try {
                    var promises = [];
                    var result = true;

                    for (var i in self.subscribers) {
                        var subscriber = self.subscribers[i];
                        var handlerResult = subscriber.handler.call(subscriber.context);

                        if (isPromise(handlerResult)) {
                            promises.push(handlerResult);
                        } else {
                            result = result && handlerResult;
                        }
                    }

                    if (promises.length) {
                        $.when.apply($, promises).then(function() {
                            finishHim(dfd, result, arguments);
                        }, function(e) {
                            dfd.reject(e);
                        });
                    } else {
                        dfd.resolve(result);
                    }
                } catch (err) {
                    dfd.reject(err);
                }
            }).promise();
        };


        function finishHim(dfd, currentResult, args) {
            for (var i = 0; i < args.length; i++) {
                currentResult = currentResult && args[i];
            }

            dfd.resolve(currentResult);
        }

        function isPromise(value) {
            if (typeof value.then !== 'function') {
                return false;
            }
            var promiseThenSrc = String($.Deferred().then);
            var valueThenSrc = String(value.then);

            return promiseThenSrc === valueThenSrc;
        }

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
