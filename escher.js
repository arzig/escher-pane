(function () {
    'use strict';
    angular.module('escher', [])
    .factory('escherEvents',
        // Functions for working with event emission
        function () {
            var CanLoad = 'escher.canLoad',
                // These are separate because bad things happen when receiving and emitting
                // is loading on the same scope
                IsLoading = 'escher.isLoading',
                eventValue = R.prop('value'),
                broadcast = R.curry(function (name, scope, value) {
                    scope.$broadcast(name, value);
                }),
                emit = R.curry(function (name, scope, value) {
                    scope.$emit(name, value);
                }),
                on = R.curry(function (name, scope) {
                    return Kefir.stream(function (emitter) {
                        function listener(event) {
                            emitter.emit({
                                event: event,
                                value: arguments[1]
                            });
                        }
                        // scope returns a cancel function to deregister
                        return scope.$on(name, listener);
                    });
                }),
                onCanLoad = on(CanLoad),
                onIsLoading = on(IsLoading),
                emitIsLoading = emit(IsLoading),
                broadcastCanLoad = broadcast(CanLoad),
                performAsyncLoad = R.curry(function (scope, run) {
                    emitIsLoading(scope, true);
                    run().then(function () {
                        emitIsLoading(scope, false);
                    });
                });
            return {
                CanLoad: CanLoad,
                IsLoading: IsLoading,
                eventValue: eventValue,
                performAsyncLoad: performAsyncLoad,
                on: on,
                onCanLoad: onCanLoad,
                onIsLoading: onIsLoading,
                emitIsLoading: emitIsLoading,
                broadcastCanLoad: broadcastCanLoad
            };
        })
    .factory('escherDOM',
        // Functions for extracting information from real dom elements
        function () {
            function viewHeight(view) {
                return view.innerHeight;
            }
            function viewOffsetY(view) {
                return view.scrollY;
            }
            function parentHeight(parent) {
                return parent.clientHeight;
            }
            function parentOffsetY(parent) {
                return parent.scrollTop;
            }
            function selfHeight(self) {
                var rect = self.getBoundingClientRect();
                return rect.height;
            }
            function selfAbsoluteOffsetY(self) {
                var rect = self.getBoundingClientRect();
                return rect.top;
            }
            return {
                viewHeight: viewHeight,
                viewOffsetY: viewOffsetY,
                parentHeight: parentHeight,
                parentOffsetY: parentOffsetY,
                selfHeight: selfHeight,
                selfAbsoluteOffsetY: selfAbsoluteOffsetY
            };
        })
    .factory('escherLogic',
        // Functions for making decisions about loading state
        function () {
            // Sample the necessary offsets for a computation
            var sampleOffsets = R.curry(function positionsOf(protocols, view, parent, self) {
                    return function () {
                        return {
                            viewHeight: protocols.viewHeight(view),
                            viewOffsetY: protocols.viewOffsetY(view),
                            parentHeight: protocols.parentHeight(parent),
                            parentOffsetY: protocols.parentOffsetY(parent),
                            selfHeight: protocols.selfHeight(self),
                            selfAbsoluteOffsetY: protocols.selfAbsoluteOffsetY(self)
                        };
                    };
                }),
                // We are visible and children should fetch more when
                isNearEnd = R.curry(function (threshold, stats) {
                    // The bottom of the pane is visible on the screen
                    return stats.selfAbsoluteOffsetY + stats.selfHeight < stats.viewHeight + threshold &&
                    // and the parent of the pane is scrolled to the bottom if there is overflow
                        stats.parentHeight + stats.parentOffsetY >= stats.selfHeight;
                });
            return {
                sampleOffsets: sampleOffsets,
                isNearEnd: isNearEnd
            };
        })
    .directive('escherPane', ['$window', 'escherDOM', 'escherLogic', 'escherEvents',
        function($window, escherDOM, escherLogic, escherEvents) {
            // Can load when we are near the end and we aren't already loading
            function nearEnd(position$) {
                return position$.map(escherLogic.isNearEnd(50));
            }

            function canLoad(nearEndProp$, isLoadingProp$) {
                return nearEndProp$.combine(isLoadingProp$.map(R.not), R.and);
            }

            function link(scope, element) {
                var elementScroll$ = Kefir.fromEvents(element.parent()[0], 'scroll'),
                    windowScroll$ = Kefir.fromEvents($window, 'scroll'),
                    isLoading$ = escherEvents.onIsLoading(scope)
                                        .map(escherEvents.eventValue),
                    finishedLoading$ = isLoading$.filter(R.not),
                    trigger$ = elementScroll$.merge(windowScroll$).merge(finishedLoading$),
                    sampleFn = escherLogic.sampleOffsets(escherDOM, $window, element.parent()[0], element[0]),
                    position$ = trigger$.map(sampleFn).toProperty(sampleFn),
                    nearEnd$ = nearEnd(position$),
                    canLoad$ = canLoad(nearEnd$, isLoading$.toProperty(R.always(false)));

                // Tell children that they are allowed to load
                canLoad$.onValue(escherEvents.broadcastCanLoad(scope));
            }

            return {
                restrict: 'E',
                transclude: true,
                replace: true,
                link: link,
                template: '<div class="escher-pane">' +
                          '<div ng-transclude></div>' +
                          '</div>'
            };
        }]);
}());
