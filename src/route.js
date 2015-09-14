// Copyright (c) CBC/Radio-Canada. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

define(['./query'],
    function(Query) {
        'use strict';

        var Route = function(url, matchedRoute, page, coerce) {
            var self = this;

            self.url = url;
            self.query = new Query(url, coerce);
            self.urlParams = matchedRoute.params;
            self.pattern = matchedRoute.route._pattern;
            self.params = matchedRoute.route.params;
            self.pageTitle = matchedRoute.route.pageTitle;
            self.page = page;
            self.cached = matchedRoute.route.cached;
        };

        return Route;
    });
