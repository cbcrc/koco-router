# Knockout Router

Knockout router is build around the knockout components. Using push state or hash to create routes, it will be able to tell knockout which component to display upon changing URL.

## Installation

    bower install ko-router

## Usages

In your startup file, we need to do a number of things in order to fully initialize the router:

### startup.js

    define(['knockout', 'router'], 
        function(ko, router) {
            'use strict';

            // First: registering a page.
            router.registerPage('page_name');

            // Second: add a router.
            router.addRoute('',             // First parameter is the url, in this case '/' will serve the page.
                {
                    title: 'Page Title',    // The bowser title will be changed to this when routing.
                    pageName: 'page_name'   // Knockout component name.
                });

            // Third: bind the Knockout ViewModel with the router object.
            ko.applyBindings({
                    router: router
                    // other objects come here
                });

            // Fourth: initialize the router.
            router.init();
        });

### index.html

    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Test</title> <!-- Won't be used, router will handle page titles on its own. -->
        </head>
        <body>
            <router params="{ title: router.currentRouteTitle }"></router>
        </body>
    </html>

### Registering a page

To register a page, you have to use the `registerPage()` function.

    registerPage(name, options)

### name

The name of the knockout component being added.

### options

The options to be used when creating the page.

    {
        isBower: boolean    // defines if the component comes from bower, a default bower path will be used.
        basePath: string    // the base path to be use to find the component. It has to be the root of the default files (see below).
        htmlOnly: boolean   // when creating a page, it is possible that there would be no JavaScript linked to this page, it will assume so and load the page using the naming convention (see below).
    }

## Creating a page component

By default, register page will look in the `~/components` directory. The convention for component directory name is `[name]-page`. The `-page` may not be used when registering the page. A page component may be composed of three files:

### JavaScript UI handler

By convention, the name of this file has to be `[name]-page-ui.js`, [name] being the name of your new page. This file has to return a Knockout component structure:

    define(["text!./test-page.html", "knockout"], // beware of the first parameter where you have to define the html file to be used.
        function(template, ko) {
            'use strict';

            var ViewModel = function() {
                var self = this;

                self.title = ko.observable('Test page');

                return self;
            };

            return {
                viewModel: {
                    createViewModel: function(params, componentInfo) {
                        return new ViewModel(params, componentInfo);
                    }
                },
                template: template
            };
        });

### HTML presentation

When using a JavaScript UI handler, the name of this file has to be defined by you. However, if using the `htmlOnly` option, the component will be loading `[name]-page.html` by convention.

    <div class="container">
        <h1 class="page-header" data-bind="text: title"></h1>
        <p>This is a test page.</p>
    </div>

### The activator concept

Sometimes, you may not want to display a page right away when changing route as you could be loading data synchronously before displaying it. To do so, you need to implement the `activator contract`.