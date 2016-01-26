(function () {
    angular.module('escherExample', ['escher'])
        .controller('exampleController', function () {
        })
        .directive('fibonacciPane', function () {
            function FibonacciPane($scope, $timeout, escherEvents) {
                var self = this;
                self.fibonacci = [1, 1];
                self.loading = false;
                escherEvents.onCanLoad($scope)
                    .map(escherEvents.eventValue)
                    .changes()
                    .skipDuplicates()
                    .filter(R.identity)
                    .onValue(function () {
                        escherEvents.performAsyncLoad($scope, function () {
                            return $timeout(1000)
                                .then(function () {
                                    for (var i = 0; i < 10; i++) {
                                        self.fibonacci.push(self.fibonacci[self.fibonacci.length - 2] + self.fibonacci[self.fibonacci.length - 1]);
                                    }
                                    return null;
                                });
                        });
                    });
            }

            FibonacciPane.$inject = ['$scope', '$timeout', 'escherEvents'];

            return {
                restrict: 'E',
                bindToController: true,
                controllerAs: 'fib',
                scope: {},
                controller: FibonacciPane,
                template: '<div><div ng-repeat="f in fib.fibonacci track by $index">{{f}}</div></div>'
            };
        });
}());
