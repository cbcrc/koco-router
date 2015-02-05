define(['jquery'],
    function($) {
        'use strict';

        var RouterStatePush = function(router) {
            var self = this;

            self.router = router;
        };

        RouterStatePush.prototype.init = function() {
            var self = this;

            $(window).on('popstate', function(e) {
                if (e.originalEvent.state !== null) {
                    self.router._navigate(getRelativeUrlFromLocation());
                }
            });



            //https://developer.mozilla.org/en-US/docs/Web/API/Location
            //http://medialize.github.io/URI.js/about-uris.html



            $(document).on('click', 'a, area', function(e) {
                var href = $(this).attr('href');

                //TODO: permettre un regex (ou autre) en config pour savoir si c'est un lien interne
                //car avec ça les sous-domaines vont etre exclus
                //ce qui ne doit pas nécessairement etre le cas!
                var isRelativeUrl = href.indexOf(':') === -1;
                var isSameDomain = href.indexOf(document.domain) > -1;

                if (isSameDomain || isRelativeUrl) {

                    if (isRelativeUrl) {
                        //Replace all (/.../g) leading slash (^\/) or (|) trailing slash (\/$) with an empty string.
                        href = href.replace(/^\/|\/$/g, '');
                        href = '/' + href;
                    }

                    window.history.pushState({}, '', href);
                    self.router._navigate(getRelativeUrlFromLocation());

                    e.preventDefault();
                }
            });

            self.router._navigate(getRelativeUrlFromLocation());
        };

        RouterStatePush.prototype.setUrlSilently = function(url) {
            var self = this;

            window.history.pushState({}, '', url);
        };

        RouterStatePush.prototype.setUrl = function(url) {
            var self = this;

            window.history.pushState({}, '', url);
            self.router._navigate(getRelativeUrlFromLocation());
        };

        RouterStatePush.prototype.setUrlWithoutGeneratingNewHistoryRecord = function(url) {
            var self = this;

            window.history.pushState({}, '', url);
            self.router._navigate(getRelativeUrlFromLocation());
        };

        function getRelativeUrlFromLocation() {
            return window.location.pathname + window.location.search + window.location.hash;
        }

        return RouterStatePush;
    });
