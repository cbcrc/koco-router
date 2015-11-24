// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

define(['jquery', 'lodash'],
    function($, _) {
        'use strict';

        //https://developer.mozilla.org/en-US/docs/Web/API/Location
        //http://medialize.github.io/URI.js/about-uris.html

        //TODO: Supporter les urls complètes (on supporte relative seulement en ce moement).
        //Pour, exemple, pemettre de naviguer dans un sous-domain dans la même app...

        var RouterStatePush = function(router) {
            var self = this;

            //http://stackoverflow.com/questions/8980255/how-do-i-retrieve-if-the-popstate-event-comes-from-back-or-forward-actions-with
            self.stateId = 0;

            self.router = router;

            //TODO: Pas besoin de debounce étant donné que le router annule automatiquement les requêtes précédentes... pas certain du résultat --> à valider
            self.setUrlDebounced = /*_.debounce(*/ function(url) {
                self.router.navigate(url);
            };
            /*, 500, {
                            'leading': true,
                            'trailing': true
                        });*/

            //TODO: Pas besoin de debounce étant donné que le router annule automatiquement les requêtes précédentes... pas certain du résultat --> à valider
            self.backOrForwardDebounced = /*_.debounce(*/ function(state) {
                var direction;

                if (state.id < self.stateId) {
                    self.stateId--;
                    direction = 'back';
                } else {
                    direction = 'forward';
                    self.stateId++;
                }

                return self.backOrForward(state, direction);
            };
            /*, 500, {
                            'leading': true,
                            'trailing': true
                        });*/
        };

        RouterStatePush.prototype.backOrForward = function( /*state*/ ) {
            var self = this;

            //même dans le cas où on fait back, il se peut que, dû au pipeline du router, l'url ne
            //soit pas celle du back (a cause de guardRoute par exemple)
            //il faut donc faire un replace du state à la fin pour être certain d'avoir la bonne url
            return self.router.navigate(getRelativeUrl(self.router.currentUrl()), {
                replace: true,
                stateChanged: true
                    /*,
                                    force: true*/
            });
        };

        RouterStatePush.prototype.init = function() {
            var self = this;

            //prevent bug with safari (popstate is fired on page load with safari)
            $(document).ready(function() {
                //back and forward button support
                $(window).on('popstate', function(e) {
                    backAndForwardButtonHandler(self, e);
                });

            });

            //href click support
            $(document).on('click', 'a, area', function(e) {
                hrefClickHandler(self, e, $(this));
            });

            //l'url peut être changée à cause de guardRoute par exemple
            //il faut donc faire un replace du state à la fin pour être certain d'avoir la bonne url
            return self.router.navigate(getRelativeUrl(self.router.currentUrl()), {
                replace: true
            });
        };

        RouterStatePush.prototype.pushState = function(options) {
            var self = this;

            var defaultOptions = {
                url: '',
                pageTitle: '',
                stateObject: {},
                replace: false
            };

            options = $.extend(defaultOptions, options || {});

            options.stateObject.url = options.url;
            options.stateObject.pageTitle = options.pageTitle;

            if (options.replace) {
                options.stateObject.id = self.stateId;
                window.history.replaceState(options.stateObject, options.pageTitle, options.url);
            } else {
                options.stateObject.id = ++self.stateId;
                window.history.pushState(options.stateObject, options.pageTitle, options.url);
            }
        };

        function backAndForwardButtonHandler(self, e) {
            //why this if???
            if (e.originalEvent.state !== null) {
                self.backOrForwardDebounced(e.originalEvent.state);
            }
        }

        function hrefClickHandler(self, e, $element) {
            // Only handle left-click with no modifiers
            if (e.which !== 1 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) {
                return;
            }

            var ignore = $element.attr('data-router-ignore');

            if (ignore) {
                return;
            }

            var url = $element.attr('href');

            //TODO: permettre un regex (ou autre) en config pour savoir si c'est un lien interne
            //car avec ça les sous-domaines vont etre exclus
            //ce qui ne doit pas nécessairement etre le cas!
            var isRelativeUrl = url.indexOf(':') === -1;
            /*var isSameDomain = url.indexOf(document.domain) > -1;*/

            //if ( /*isSameDomain || */ isRelativeUrl) {

            if (!isRelativeUrl && startsWithRootUrl(self, url)) {
                url = getRelativeUrl(url);
            }

            url = makeRelativeUrlStartWithSlash(url);

            if (shouldHandleNavigation(self, e, $element, url)) {
                e.preventDefault();

                // var currentUrl = self.router.currentUrl();

                // if (url !== currentUrl) {
                self.setUrlDebounced(url);
                // }
            }
        }

        function shouldHandleNavigation(self, e, $element, url) {
            return _.startsWith(url.toLowerCase(), self.router.settings.baseUrl.toLowerCase());
        }

        function startsWithRootUrl(self, url) {
            return _.startsWith(url.toLowerCase(), (document.location.origin + self.router.settings.baseUrl).toLowerCase());
        }

        function getRelativeUrl(url) {
            return '/' + url.replace(/^(?:\/\/|[^\/]+)*\//, '');
        }

        function makeRelativeUrlStartWithSlash(url) {
            var isRelativeUrl = url.indexOf(':') === -1;

            if (isRelativeUrl) {
                //Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string.
                url = url.replace(/^\/|\/$/g, '');
                url = '/' + url;
            }

            return url;
        }

        return RouterStatePush;
    });
