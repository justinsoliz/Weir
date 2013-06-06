var Weir = angular.module("Weir", []);

//SERVICES

//Weir.Request handles making requests with TOTP auth (eventually)
Weir.service("Weir.Request", ["$http", "$q", function($http, $q) {
  return {
    ask: function(options) {
      //add security wrapper
      var defaults = {
        url: "",
        method: "GET"
      };
      var deferred = $q.defer();
      var request = $http(angular.extend(defaults, options));
      request.success(deferred.resolve);
      request.error(deferred.reject);
      return deferred.promise;
    }
  }
}]);

//Weir.Server talks to the DB and gets stream updates
Weir.service("Weir.Server", ["Weir.Request", "$q", function(Request, $q) {
  var ask = Request.ask;

  var stream = {
    items: [],
    unread: 0,
    total: 0,
    updatedAt: new Date()
  };

  var facade = {
    stream: stream,
    markAsRead: function(item) {
      ask({
        url: "/stream/mark",
        params: {
          item: item.id
        }
      }).then(function() {
        stream.unread--;
      });
    },
    markAll: function() {
      var ids = stream.items.map(function(item) {
        return item.id;
      });
      var deferred = $q.defer();
      ask({
        url: "/stream/markRefresh",
        params: {
          items: ids.join(",")
        }
      }).then(function(data) {
        stream.items = data.items;
        stream.items[0].active = true;
        stream.unread = data.unread;
        stream.total = data.total;
        stream.updatedAt = new Date();
        deferred.resolve();
      });
      return deferred.promise;
    },
    refresh: function() {
      ask({
        url: "/stream/unread"
      }).then(function(data) {
        stream.items = data.items;
        stream.items[0].active = true;
        stream.updatedAt = new Date();
      });
    },
    stats: function() {
      ask({
        url: "/stream/status"
      }).then(function(data) {
        stream.unread = data.unread;
        stream.total = data.total;
      });
    }
  }

  facade.stats();
  facade.refresh();

  return facade;

}]);

//CONTROLLERS

//stream controller handles UI for the stream and status
var StreamController = function($scope, Server, $document, $anchorScroll, $location) {

  $scope.stream = Server.stream;

  $scope.activate = function(item) {
    $scope.stream.items.forEach(function(i) {
      i.active = i === item;
    });
    $location.replace();
    $location.hash(item.id);
    $anchorScroll();
  };

  $scope.markRefresh = function() {
    $scope.message = "Marking items as read, refreshing...";
    Server.markAll().then(function() {
      $scope.message = "";
      $location.replace();
      $location.hash("top");
      $anchorScroll();
    });
    $scope.$apply();
  };

  $scope.next = function() {
    var stream = Server.stream.items;
    var current = stream.filter(function(i) { return i.active }).pop();
    var currentIndex = stream.indexOf(current);
    if (currentIndex == stream.length - 1) {
      return $scope.markRefresh();
    }
    $scope.activate(stream[currentIndex + 1]);
    $scope.$apply();
  };

  $scope.previous = function() {
    var stream = Server.stream.items;
    var current = stream.filter(function(i) { return i.active }).pop();
    var currentIndex = stream.indexOf(current);
    if (currentIndex == 0) return;
    $scope.activate(stream[currentIndex - 1]);
    $scope.$apply();
  }

  angular.element($document).bind("keypress", function(e) {
    var key = String.fromCharCode(e.charCode).toLowerCase();
    switch (key) {
      case "j":
        $scope.next();
        break;

      case "k":
        $scope.previous();
        break;

      case ".":
      case "r":
        $scope.markRefresh();
        break;

      case " ":
        //adjust selection based on position
        break;
    }
  })
};
StreamController.$inject = ["$scope", "Weir.Server", "$document", "$anchorScroll", "$location"];

//feed controller talks to the DB for feed-related data
var FeedController = function($scope) {

}

//DIRECTIVES
Weir.directive("preventDefault", function() {
  return {
    restrict: "A",
    link: function(scope, element) {
      element.bind("click", function(e) {
        e.preventDefault();
      });
    }
  }
});