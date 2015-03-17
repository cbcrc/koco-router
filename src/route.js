define(['./query'],
    function(Query) {
        'use strict';

        var Route = function(url, matchedRoute, page) {
            var self = this;

            self.url = url;
            self.query = new Query(url);
            self.urlParams = matchedRoute.params;
            self.pattern = matchedRoute.route._pattern;
            self.params = matchedRoute.route.params;
            self.pageTitle = matchedRoute.route.pageTitle;
            self.page = page;
        };

        return Route;
    });
